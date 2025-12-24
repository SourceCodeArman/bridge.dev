"""
Replay service for workflow runs.

Enables replaying workflow runs with saved state, supporting both
full replays and partial replays from specific steps.
"""
from django.utils import timezone
from django.db import transaction
from django.core.exceptions import ValidationError
from typing import Optional
from uuid import UUID

from apps.common.logging_utils import get_logger
from .models import Run, RunStep, WorkflowVersion
from .orchestrator import RunOrchestrator
from .tasks import execute_workflow_run

logger = get_logger(__name__)


class ReplayService:
    """Service for replaying workflow runs"""
    
    def __init__(self):
        self.orchestrator = RunOrchestrator()
    
    def replay_full_run(self, run_id: UUID, triggered_by=None) -> Run:
        """
        Replay an entire workflow run from the beginning.
        
        Args:
            run_id: ID of the original run to replay
            triggered_by: User triggering the replay (optional)
            
        Returns:
            New Run instance created for the replay
            
        Raises:
            Run.DoesNotExist: If original run not found
            ValidationError: If run cannot be replayed
        """
        original_run = Run.objects.select_related('workflow_version').get(id=run_id)
        
        # Validate run can be replayed
        if original_run.status not in ['completed', 'failed', 'cancelled']:
            raise ValidationError(
                f"Cannot replay run {run_id}: run must be in a terminal state "
                f"(current status: {original_run.status})"
            )
        
        # Ensure original run has saved input data
        if not original_run.saved_input_data:
            original_run.save_for_replay()
        
        # Get input data (use saved if available, otherwise use current)
        input_data = original_run.saved_input_data or original_run.input_data
        
        with transaction.atomic():
            # Create new run
            replay_run = self.orchestrator.create_run(
                workflow_version=original_run.workflow_version,
                trigger_type='manual',
                input_data=input_data,
                triggered_by=triggered_by,
                idempotency_key=None,  # Replays should not use idempotency
                check_limits=True
            )
            
            # Set replay metadata
            replay_run.original_run = original_run
            replay_run.replay_type = 'full'
            replay_run.saved_input_data = input_data.copy()
            replay_run.save(update_fields=['original_run', 'replay_type', 'saved_input_data'])
            
            logger.info(
                f"Created full replay run {replay_run.id} for original run {original_run.id}",
                extra={
                    'replay_run_id': str(replay_run.id),
                    'original_run_id': str(original_run.id)
                }
            )
            
            # Enqueue execution
            execute_workflow_run.delay(str(replay_run.id))
        
        return replay_run
    
    def replay_from_step(self, run_id: UUID, step_id: str, triggered_by=None) -> Run:
        """
        Replay a workflow run from a specific step, using outputs from prior steps.
        
        Args:
            run_id: ID of the original run to replay
            step_id: Step ID to start replaying from
            triggered_by: User triggering the replay (optional)
            
        Returns:
            New Run instance created for the partial replay
            
        Raises:
            Run.DoesNotExist: If original run not found
            RunStep.DoesNotExist: If step not found
            ValidationError: If run cannot be replayed from step
        """
        original_run = Run.objects.select_related('workflow_version').prefetch_related('steps').get(id=run_id)
        
        # Validate run can be replayed
        if original_run.status not in ['completed', 'failed', 'cancelled']:
            raise ValidationError(
                f"Cannot replay run {run_id}: run must be in a terminal state "
                f"(current status: {original_run.status})"
            )
        
        # Find the step to replay from
        try:
            target_step = original_run.steps.get(step_id=step_id)
        except RunStep.DoesNotExist:
            raise ValidationError(f"Step {step_id} not found in run {run_id}")
        
        # Validate step is in a terminal state
        if target_step.status not in ['completed', 'failed', 'skipped']:
            raise ValidationError(
                f"Cannot replay from step {step_id}: step must be in a terminal state "
                f"(current status: {target_step.status})"
            )
        
        # Ensure original run has saved input data
        if not original_run.saved_input_data:
            original_run.save_for_replay()
        
        # Get input data from original run
        input_data = original_run.saved_input_data or original_run.input_data
        
        with transaction.atomic():
            # Create new run
            replay_run = self.orchestrator.create_run(
                workflow_version=original_run.workflow_version,
                trigger_type='manual',
                input_data=input_data,
                triggered_by=triggered_by,
                idempotency_key=None,
                check_limits=True
            )
            
            # Set replay metadata
            replay_run.original_run = original_run
            replay_run.replay_type = 'partial'
            replay_run.replay_from_step_id = step_id
            replay_run.saved_input_data = input_data.copy()
            replay_run.save(update_fields=[
                'original_run', 'replay_type', 'replay_from_step_id', 'saved_input_data'
            ])
            
            # Initialize steps with partial replay logic
            self._initialize_partial_replay_steps(replay_run, original_run, step_id)
            
            logger.info(
                f"Created partial replay run {replay_run.id} for original run {original_run.id} from step {step_id}",
                extra={
                    'replay_run_id': str(replay_run.id),
                    'original_run_id': str(original_run.id),
                    'replay_from_step_id': step_id
                }
            )
            
            # Enqueue execution
            execute_workflow_run.delay(str(replay_run.id))
        
        return replay_run
    
    def _initialize_partial_replay_steps(self, replay_run: Run, original_run: Run, from_step_id: str):
        """
        Initialize steps for partial replay.
        
        Steps before from_step_id are marked as skipped with saved outputs.
        Steps from from_step_id onwards are marked as pending.
        
        Args:
            replay_run: The new replay run
            original_run: The original run
            from_step_id: Step ID to start replaying from
        """
        # Get workflow definition
        workflow_def = original_run.workflow_version.definition
        nodes = workflow_def.get('nodes', [])
        
        # Create a map of step_id to original step
        original_steps_by_id = {
            step.step_id: step
            for step in original_run.steps.all()
        }
        
        # Determine which steps to skip vs replay
        replay_from_this_step = False
        step_order = 0
        
        for node in nodes:
            node_step_id = node.get('id', f'step_{step_order}')
            
            if node_step_id == from_step_id:
                replay_from_this_step = True
            
            if not replay_from_this_step:
                # Mark as skipped and copy outputs from original
                original_step = original_steps_by_id.get(node_step_id)
                step_status = 'skipped'
                step_outputs = {}
                
                if original_step and original_step.status == 'completed':
                    step_outputs = original_step.outputs.copy()
                
                RunStep.objects.create(
                    run=replay_run,
                    step_id=node_step_id,
                    step_type=node.get('type', 'unknown'),
                    inputs=node.get('data', {}),
                    outputs=step_outputs,
                    status=step_status,
                    order=step_order
                )
            else:
                # Mark as pending for replay
                RunStep.objects.create(
                    run=replay_run,
                    step_id=node_step_id,
                    step_type=node.get('type', 'unknown'),
                    inputs=node.get('data', {}),
                    status='pending',
                    order=step_order
                )
            
            step_order += 1
    
    def get_replay_lineage(self, run_id: UUID) -> list:
        """
        Get replay lineage for a run.
        
        Returns a list of runs in the replay chain, starting from the original run.
        
        Args:
            run_id: ID of the run to get lineage for
            
        Returns:
            List of run metadata dictionaries
        """
        try:
            run = Run.objects.get(id=run_id)
            return run.get_replay_lineage()
        except Run.DoesNotExist:
            return []


