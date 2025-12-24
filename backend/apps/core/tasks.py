"""
Celery tasks for workflow execution.

Handles asynchronous execution of workflow runs and steps.
"""
from celery import shared_task
from django.conf import settings
from django.utils import timezone
from typing import Dict, Any
from uuid import UUID

from apps.common.logging_utils import get_logger
from .models import Run, RunStep
from .orchestrator import RunOrchestrator
from .concurrency import ConcurrencyManager
from .rate_limiter import RateLimiter

logger = get_logger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
    reject_on_worker_lost=True
)
def execute_workflow_run(self, run_id: str):
    """
    Execute a workflow run.
    
    This is the main task that orchestrates the execution of a workflow run.
    It manages the run lifecycle and coordinates step execution.
    
    Args:
        run_id: UUID string of the Run instance
        
    Returns:
        str: Success message or raises exception
    """
    try:
        run = Run.objects.select_related('workflow_version', 'workflow_version__workflow').get(id=run_id)
        orchestrator = RunOrchestrator()
        
        logger.info(
            f"Executing workflow run {run_id}",
            extra={'run_id': run_id}
        )
        
        # Start the run
        orchestrator.start_run(run)
        
        # Get workflow for concurrency tracking
        workflow = run.workflow_version.workflow
        
        # Track run start for concurrency management
        # Note: Concurrency and rate limits are checked in orchestrator.create_run
        concurrency_manager = ConcurrencyManager()
        concurrency_manager.track_run_start(workflow.id, run_id)
        
        try:
            # Execute steps
            next_steps = orchestrator.get_next_steps(run)
            
            while next_steps:
                for step in next_steps:
                    # Execute step asynchronously
                    execute_run_step.delay(str(step.id))
                    
                    # Wait for step completion (in a real implementation, this would be
                    # handled via callbacks or polling)
                    step.refresh_from_db()
                    if step.status == 'failed':
                        # Run will be marked as failed by orchestrator
                        break
                
                # Refresh run to get updated status
                run.refresh_from_db()
                if run.status in ['failed', 'completed', 'cancelled']:
                    break
                
                next_steps = orchestrator.get_next_steps(run)
            
            # Final check - orchestrator should have marked run as completed
            run.refresh_from_db()
            if run.status == 'running':
                # Check if all steps are completed
                pending_or_running = run.steps.filter(status__in=['pending', 'running']).count()
                if pending_or_running == 0:
                    orchestrator.complete_run(run)
            
            logger.info(
                f"Completed workflow run {run_id}",
                extra={'run_id': run_id, 'status': run.status}
            )
            
            return f"Run {run_id} executed successfully with status {run.status}"
            
        finally:
            # Always track run completion for concurrency management
            concurrency_manager.track_run_completion(workflow.id, run_id)
            
    except Run.DoesNotExist:
        logger.error(f"Run {run_id} not found")
        raise
    except Exception as exc:
        logger.error(
            f"Error executing workflow run {run_id}: {str(exc)}",
            exc_info=exc,
            extra={'run_id': run_id}
        )
        # Retry with exponential backoff
        raise self.retry(countdown=60 * (2 ** self.request.retries), exc=exc)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    acks_late=True,
    reject_on_worker_lost=True
)
def execute_run_step(self, run_step_id: str):
    """
    Execute a single workflow step.
    
    Args:
        run_step_id: UUID string of the RunStep instance
        
    Returns:
        str: Success message or raises exception
    """
    try:
        run_step = RunStep.objects.select_related('run').get(id=run_step_id)
        orchestrator = RunOrchestrator()
        
        logger.info(
            f"Executing step {run_step.step_id} for run {run_step.run.id}",
            extra={
                'run_step_id': run_step_id,
                'run_id': str(run_step.run.id),
                'step_id': run_step.step_id,
                'step_type': run_step.step_type
            }
        )
        
        # Start the step
        orchestrator.execute_step(run_step)
        
        # Validate step inputs before execution
        from .validators import validate_step_inputs
        try:
            validate_step_inputs(run_step.step_type, run_step.inputs)
        except Exception as e:
            logger.warning(
                f"Input validation failed for step {run_step.id}: {str(e)}",
                extra={
                    'run_step_id': run_step_id,
                    'step_type': run_step.step_type,
                    'validation_error': str(e)
                }
            )
            # Continue execution anyway, but log the warning
        
        # Execute the step logic
        # TODO: This will be implemented with connector SDK in Phase 2
        # For now, we'll simulate execution
        outputs = _execute_step_logic(run_step)
        
        # Mark step as completed
        orchestrator.handle_step_completion(run_step, outputs)
        
        logger.info(
            f"Completed step {run_step.step_id} for run {run_step.run.id}",
            extra={
                'run_step_id': run_step_id,
                'run_id': str(run_step.run.id),
                'step_id': run_step.step_id
            }
        )
        
        return f"Step {run_step.step_id} executed successfully"
        
    except RunStep.DoesNotExist:
        logger.error(f"RunStep {run_step_id} not found")
        raise
    except Exception as exc:
        logger.error(
            f"Error executing step {run_step_id}: {str(exc)}",
            exc_info=exc,
            extra={'run_step_id': run_step_id}
        )
        
        # Mark step as failed
        try:
            run_step = RunStep.objects.get(id=run_step_id)
            orchestrator = RunOrchestrator()
            orchestrator.handle_step_failure(run_step, str(exc))
        except RunStep.DoesNotExist:
            pass
        
        # Retry with exponential backoff
        raise self.retry(countdown=30 * (2 ** self.request.retries), exc=exc)


def _execute_step_logic(run_step: RunStep) -> Dict[str, Any]:
    """
    Execute the actual step logic.
    
    This is a placeholder - in Phase 2, this will be replaced with
    connector SDK execution.
    
    Args:
        run_step: The RunStep instance
        
    Returns:
        Dict containing step outputs
    """
    # Placeholder implementation
    # In Phase 2, this will:
    # 1. Load the appropriate connector
    # 2. Execute the step based on step_type
    # 3. Return outputs
    
    logger.info(
        f"Executing step logic for {run_step.step_id} (type: {run_step.step_type})",
        extra={
            'run_step_id': str(run_step.id),
            'step_id': run_step.step_id,
            'step_type': run_step.step_type
        }
    )
    
    # For now, return a placeholder output
    return {
        'status': 'completed',
        'message': f"Step {run_step.step_id} executed (placeholder)",
        'step_type': run_step.step_type
    }


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60
)
def retry_failed_step(self, run_step_id: str):
    """
    Retry a failed step with backoff.
    
    Args:
        run_step_id: UUID string of the RunStep instance
        
    Returns:
        str: Success message or raises exception
    """
    try:
        run_step = RunStep.objects.get(id=run_step_id)
        
        if run_step.status != 'failed':
            logger.warning(
                f"Step {run_step_id} is not in failed state, skipping retry",
                extra={'run_step_id': run_step_id, 'status': run_step.status}
            )
            return f"Step {run_step_id} is not failed, skipping retry"
        
        logger.info(
            f"Retrying failed step {run_step_id}",
            extra={'run_step_id': run_step_id}
        )
        
        # Reset step to pending
        run_step.status = 'pending'
        run_step.error_message = ''
        run_step.started_at = None
        run_step.completed_at = None
        run_step.save(update_fields=['status', 'error_message', 'started_at', 'completed_at', 'updated_at'])
        
        # Re-execute the step
        execute_run_step.delay(str(run_step_id))
        
        return f"Retry initiated for step {run_step_id}"
        
    except RunStep.DoesNotExist:
        logger.error(f"RunStep {run_step_id} not found for retry")
        raise
    except Exception as exc:
        logger.error(
            f"Error retrying step {run_step_id}: {str(exc)}",
            exc_info=exc,
            extra={'run_step_id': run_step_id}
        )
        raise self.retry(countdown=60 * (2 ** self.request.retries), exc=exc)


@shared_task
def check_and_trigger_cron_workflows():
    """
    Periodic task to check and trigger cron-based workflows.
    
    This task runs on a schedule (configured in CELERY_BEAT_SCHEDULE)
    and checks for workflows with cron triggers that need to be executed.
    
    Returns:
        int: Number of workflows triggered
    """
    from .models import Trigger, WorkflowVersion
    from .orchestrator import RunOrchestrator
    
    try:
        import croniter
    except ImportError:
        logger.error("croniter not installed, cannot check cron triggers")
        return 0
    
    logger.info("Checking cron triggers")
    
    orchestrator = RunOrchestrator()
    triggered_count = 0
    
    # Get all active cron triggers
    cron_triggers = Trigger.objects.filter(
        trigger_type='cron',
        is_active=True
    ).select_related('workflow')
    
    now = timezone.now()
    
    for trigger in cron_triggers:
        try:
            cron_expression = trigger.config.get('cron_expression')
            if not cron_expression:
                logger.warning(
                    f"Trigger {trigger.id} missing cron_expression in config",
                    extra={'trigger_id': str(trigger.id)}
                )
                continue
            
            # Get active workflow version
            workflow_version = trigger.workflow.get_active_version()
            if not workflow_version:
                logger.warning(
                    f"Workflow {trigger.workflow.id} has no active version",
                    extra={'workflow_id': str(trigger.workflow.id)}
                )
                continue
            
            # Check if cron expression matches current time
            # This is simplified - in production, you'd track last execution time
            # Convert timezone-aware datetime to UTC naive for croniter
            from datetime import datetime
            now_utc = now.astimezone(timezone.utc)
            now_naive = datetime(
                now_utc.year, now_utc.month, now_utc.day,
                now_utc.hour, now_utc.minute, now_utc.second
            )
            cron = croniter.croniter(cron_expression, now_naive)
            next_time_naive = cron.get_next(datetime)
            prev_time_naive = cron.get_prev(datetime)
            # Convert back to timezone-aware UTC
            prev_time = timezone.make_aware(prev_time_naive, timezone.utc)
            
            # Simple heuristic: trigger if previous execution time was recent
            # (within the last minute, accounting for task execution interval)
            time_diff = (now - prev_time).total_seconds()
            if time_diff < 120:  # Within 2 minutes
                # Create and enqueue run (skip limits check for cron triggers)
                run = orchestrator.create_run(
                    workflow_version=workflow_version,
                    trigger_type='cron',
                    input_data=trigger.config.get('input_data', {}),
                    idempotency_key=f"cron_{trigger.id}_{int(prev_time.timestamp())}",
                    check_limits=False  # Cron triggers bypass limits
                )
                
                execute_workflow_run.delay(str(run.id))
                triggered_count += 1
                
                logger.info(
                    f"Triggered cron workflow {trigger.workflow.id}",
                    extra={
                        'trigger_id': str(trigger.id),
                        'workflow_id': str(trigger.workflow.id),
                        'run_id': str(run.id)
                    }
                )
                
        except Exception as exc:
            logger.error(
                f"Error processing cron trigger {trigger.id}: {str(exc)}",
                exc_info=exc,
                extra={'trigger_id': str(trigger.id)}
            )
    
    logger.info(
        f"Cron trigger check completed, triggered {triggered_count} workflows",
        extra={'triggered_count': triggered_count}
    )
    
    return triggered_count

