"""
Workflow orchestrator service.

Manages the execution lifecycle of workflow runs, including state transitions,
step execution, and workflow graph traversal.
"""
from django.utils import timezone
from django.db import transaction
from django.core.exceptions import ValidationError
from typing import Dict, List, Optional, Any
from uuid import UUID

from apps.common.logging_utils import get_logger
from django.conf import settings
from .models import Run, RunStep, WorkflowVersion
from .state_machine import RunStateMachine, RunStepStateMachine, log_state_transition
from .concurrency import ConcurrencyManager
from .rate_limiter import RateLimiter

logger = get_logger(__name__)


class RunOrchestrator:
    """Orchestrates workflow run execution"""
    
    def __init__(self):
        self.run_state_machine = RunStateMachine()
        self.step_state_machine = RunStepStateMachine()
    
    def create_run(
        self,
        workflow_version: WorkflowVersion,
        trigger_type: str,
        input_data: Dict[str, Any],
        triggered_by=None,
        idempotency_key: Optional[str] = None,
        check_limits: bool = True
    ) -> Run:
        """
        Create a new workflow run, checking for idempotency.
        
        Args:
            workflow_version: The workflow version to execute
            trigger_type: Type of trigger ('manual', 'webhook', 'cron', 'event')
            input_data: Input data for the workflow
            triggered_by: User who triggered the run (optional)
            idempotency_key: Optional idempotency key for deduplication
            
        Returns:
            Run instance (existing if idempotency_key matches, new otherwise)
        """
        # Check for existing run with same idempotency_key
        if idempotency_key:
            existing_run = Run.objects.filter(
                idempotency_key=idempotency_key,
                workflow_version=workflow_version
            ).first()
            
            if existing_run:
                logger.info(
                    f"Returning existing run {existing_run.id} for idempotency_key {idempotency_key}",
                    extra={'run_id': str(existing_run.id), 'idempotency_key': idempotency_key}
                )
                return existing_run
        
        # Check concurrency and rate limits if enabled
        if check_limits:
            workflow = workflow_version.workflow
            workflow_id = workflow.id
            
            # Check rate limiting
            rate_limiter = RateLimiter()
            rate_allowed, rate_remaining = rate_limiter.check_rate_limit(workflow_id)
            if not rate_allowed:
                raise ValidationError(
                    f"Rate limit exceeded for workflow {workflow_id}. "
                    f"Please try again later."
                )
            
            # Check concurrency limits
            concurrency_manager = ConcurrencyManager()
            max_concurrent = workflow.max_concurrent_runs
            if max_concurrent is None:
                max_concurrent = getattr(settings, 'WORKFLOW_MAX_CONCURRENT_RUNS_DEFAULT', 10)
            
            if not concurrency_manager.can_start_run(workflow_id, max_concurrent):
                raise ValidationError(
                    f"Concurrency limit reached for workflow {workflow_id}. "
                    f"Maximum concurrent runs: {max_concurrent}"
                )
            
            # Record rate limit usage (after successful checks)
            if check_limits:
                rate_limiter.record_run(workflow_id)
        
        with transaction.atomic():
            run = Run.objects.create(
                workflow_version=workflow_version,
                trigger_type=trigger_type,
                input_data=input_data,
                triggered_by=triggered_by,
                idempotency_key=idempotency_key or '',
                status='pending'
            )
            
            # Initialize run steps from workflow definition
            self._initialize_run_steps(run)
            
            logger.info(
                f"Created run {run.id} for workflow version {workflow_version.id}",
                extra={'run_id': str(run.id), 'workflow_version_id': str(workflow_version.id)}
            )
            
            return run
    
    def _initialize_run_steps(self, run: Run):
        """
        Initialize RunStep instances from workflow definition.
        
        Args:
            run: The Run instance
        """
        workflow_def = run.workflow_version.definition
        nodes = workflow_def.get('nodes', [])
        
        for order, node in enumerate(nodes):
            RunStep.objects.create(
                run=run,
                step_id=node.get('id', f'step_{order}'),
                step_type=node.get('type', 'unknown'),
                inputs=node.get('data', {}),
                status='pending',
                order=order
            )
    
    def start_run(self, run: Run) -> Run:
        """
        Start a workflow run execution.
        
        Args:
            run: The Run instance to start
            
        Returns:
            Updated Run instance
            
        Raises:
            ValidationError: If state transition is invalid
        """
        if not self.run_state_machine.can_transition(run.status, 'running'):
            raise ValidationError(
                f"Cannot transition run {run.id} from {run.status} to running"
            )
        
        with transaction.atomic():
            from_status = run.status
            run.status = 'running'
            run.started_at = timezone.now()
            run.save(update_fields=['status', 'started_at', 'updated_at'])
            
            log_state_transition(run, from_status, 'running')
            
            logger.info(
                f"Started run {run.id}",
                extra={'run_id': str(run.id)}
            )
        
        return run
    
    def execute_step(self, run_step: RunStep) -> RunStep:
        """
        Execute a single workflow step.
        
        Args:
            run_step: The RunStep instance to execute
            
        Returns:
            Updated RunStep instance
            
        Raises:
            ValidationError: If state transition is invalid
        """
        if not self.step_state_machine.can_transition(run_step.status, 'running'):
            raise ValidationError(
                f"Cannot transition step {run_step.id} from {run_step.status} to running"
            )
        
        with transaction.atomic():
            from_status = run_step.status
            run_step.status = 'running'
            run_step.started_at = timezone.now()
            run_step.save(update_fields=['status', 'started_at', 'updated_at'])
            
            log_state_transition(run_step, from_status, 'running')
            
            logger.info(
                f"Started step {run_step.step_id} for run {run_step.run.id}",
                extra={
                    'run_step_id': str(run_step.id),
                    'run_id': str(run_step.run.id),
                    'step_id': run_step.step_id
                }
            )
        
        return run_step
    
    def handle_step_completion(
        self,
        run_step: RunStep,
        outputs: Dict[str, Any]
    ) -> RunStep:
        """
        Handle successful completion of a step.
        
        Args:
            run_step: The RunStep instance
            outputs: Output data from the step execution
            
        Returns:
            Updated RunStep instance
        """
        # Validate outputs against schema
        from .validators import validate_step_outputs
        try:
            validate_step_outputs(run_step.step_type, outputs)
        except Exception as e:
            logger.warning(
                f"Output validation failed for step {run_step.id}: {str(e)}",
                extra={
                    'run_step_id': str(run_step.id),
                    'step_type': run_step.step_type,
                    'validation_error': str(e)
                }
            )
            # Continue anyway, but log the warning
        
        if not self.step_state_machine.can_transition(run_step.status, 'completed'):
            raise ValidationError(
                f"Cannot transition step {run_step.id} from {run_step.status} to completed"
            )
        
        with transaction.atomic():
            from_status = run_step.status
            run_step.status = 'completed'
            run_step.outputs = outputs
            run_step.completed_at = timezone.now()
            run_step.save(update_fields=['status', 'outputs', 'completed_at', 'updated_at'])
            
            log_state_transition(run_step, from_status, 'completed', {'outputs_keys': list(outputs.keys())})
            
            logger.info(
                f"Completed step {run_step.step_id} for run {run_step.run.id}",
                extra={
                    'run_step_id': str(run_step.id),
                    'run_id': str(run_step.run.id),
                    'step_id': run_step.step_id
                }
            )
            
            # Check if all steps are completed
            self._check_run_completion(run_step.run)
        
        return run_step
    
    def handle_step_failure(
        self,
        run_step: RunStep,
        error_message: str
    ) -> RunStep:
        """
        Handle failure of a step.
        
        Args:
            run_step: The RunStep instance
            error_message: Error message describing the failure
            
        Returns:
            Updated RunStep instance
        """
        if not self.step_state_machine.can_transition(run_step.status, 'failed'):
            raise ValidationError(
                f"Cannot transition step {run_step.id} from {run_step.status} to failed"
            )
        
        with transaction.atomic():
            from_status = run_step.status
            run_step.status = 'failed'
            run_step.error_message = error_message
            run_step.completed_at = timezone.now()
            run_step.save(update_fields=['status', 'error_message', 'completed_at', 'updated_at'])
            
            log_state_transition(run_step, from_status, 'failed', {'error_message': error_message})
            
            logger.error(
                f"Failed step {run_step.step_id} for run {run_step.run.id}: {error_message}",
                extra={
                    'run_step_id': str(run_step.id),
                    'run_id': str(run_step.run.id),
                    'step_id': run_step.step_id,
                    'error_message': error_message
                }
            )
            
            # Mark run as failed
            self.fail_run(run_step.run, error_message)
        
        return run_step
    
    def _check_run_completion(self, run: Run):
        """
        Check if all steps in a run are completed and mark run as completed if so.
        
        Args:
            run: The Run instance to check
        """
        pending_or_running_steps = run.steps.filter(
            status__in=['pending', 'running']
        ).count()
        
        failed_steps = run.steps.filter(status='failed').count()
        
        if failed_steps > 0:
            # Run already marked as failed
            return
        
        if pending_or_running_steps == 0:
            # All steps completed successfully
            self.complete_run(run)
    
    def complete_run(self, run: Run) -> Run:
        """
        Mark a run as completed.
        
        Args:
            run: The Run instance
            
        Returns:
            Updated Run instance
        """
        if not self.run_state_machine.can_transition(run.status, 'completed'):
            raise ValidationError(
                f"Cannot transition run {run.id} from {run.status} to completed"
            )
        
        with transaction.atomic():
            from_status = run.status
            run.status = 'completed'
            run.completed_at = timezone.now()
            
            # Aggregate outputs from all steps
            run.output_data = self._aggregate_step_outputs(run)
            run.save(update_fields=['status', 'completed_at', 'output_data', 'updated_at'])
            
            log_state_transition(run, from_status, 'completed')
            
            logger.info(
                f"Completed run {run.id}",
                extra={'run_id': str(run.id)}
            )
        
        return run
    
    def fail_run(self, run: Run, error_message: str) -> Run:
        """
        Mark a run as failed.
        
        Args:
            run: The Run instance
            error_message: Error message describing the failure
            
        Returns:
            Updated Run instance
        """
        if not self.run_state_machine.can_transition(run.status, 'failed'):
            # Run might already be in a terminal state
            return run
        
        with transaction.atomic():
            from_status = run.status
            run.status = 'failed'
            run.error_message = error_message
            run.completed_at = timezone.now()
            run.save(update_fields=['status', 'error_message', 'completed_at', 'updated_at'])
            
            log_state_transition(run, from_status, 'failed', {'error_message': error_message})
            
            logger.error(
                f"Failed run {run.id}: {error_message}",
                extra={'run_id': str(run.id), 'error_message': error_message}
            )
        
        return run
    
    def _aggregate_step_outputs(self, run: Run) -> Dict[str, Any]:
        """
        Aggregate outputs from all completed steps.
        
        Args:
            run: The Run instance
            
        Returns:
            Dictionary of aggregated outputs
        """
        outputs = {}
        for step in run.steps.filter(status='completed').order_by('order'):
            outputs[step.step_id] = step.outputs
        
        return outputs
    
    def get_next_steps(self, run: Run) -> List[RunStep]:
        """
        Get the next steps to execute based on workflow definition.
        
        This is a simplified version - in a full implementation, this would
        traverse the workflow graph and determine which steps are ready to execute
        based on dependencies.
        
        Args:
            run: The Run instance
            
        Returns:
            List of RunStep instances ready to execute
        """
        # Simple implementation: get pending steps in order
        # TODO: Implement proper graph traversal with dependency resolution
        return list(run.steps.filter(status='pending').order_by('order'))

