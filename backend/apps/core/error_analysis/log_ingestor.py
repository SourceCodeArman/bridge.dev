"""
Log ingestor for error analysis.

Collects run logs and traces for failed steps to provide context for LLM analysis.
"""
from typing import Dict, Any, List
from apps.common.logging_utils import get_logger
from apps.core.models import RunStep, RunLog, RunTrace

logger = get_logger(__name__)


class LogIngestor:
    """
    Ingests logs and traces for failed steps.
    """
    
    @staticmethod
    def ingest_step_context(run_step: RunStep) -> Dict[str, Any]:
        """
        Collect all context data for a failed step.
        
        Args:
            run_step: The failed RunStep instance
            
        Returns:
            Dictionary containing all context data
        """
        context = {
            'step_id': run_step.step_id,
            'step_type': run_step.step_type,
            'status': run_step.status,
            'error_message': run_step.error_message or '',
            'inputs': run_step.inputs,
            'outputs': run_step.outputs,
            'started_at': run_step.started_at.isoformat() if run_step.started_at else None,
            'completed_at': run_step.completed_at.isoformat() if run_step.completed_at else None,
            'logs': [],
            'trace_data': None,
            'run_context': {}
        }
        
        # Collect step-level logs
        step_logs = RunLog.objects.filter(
            step=run_step,
            level__in=['ERROR', 'WARNING', 'CRITICAL']
        ).order_by('timestamp')
        
        context['logs'] = [
            {
                'level': log.level,
                'message': log.message,
                'timestamp': log.timestamp.isoformat(),
                'extra_data': log.extra_data
            }
            for log in step_logs
        ]
        
        # Collect run-level context
        run = run_step.run
        context['run_context'] = {
            'run_id': str(run.id),
            'workflow_name': run.workflow_version.workflow.name,
            'run_status': run.status,
            'run_error_message': run.error_message or '',
            'trigger_type': run.trigger_type,
            'input_data': run.input_data
        }
        
        # Collect trace data if available
        try:
            trace = RunTrace.objects.get(run=run)
            context['trace_data'] = trace.trace_data
        except RunTrace.DoesNotExist:
            pass
        
        # Collect other failed steps in the same run for context
        other_failed_steps = run.steps.filter(
            status='failed'
        ).exclude(id=run_step.id)
        
        context['other_failed_steps'] = [
            {
                'step_id': step.step_id,
                'step_type': step.step_type,
                'error_message': step.error_message
            }
            for step in other_failed_steps
        ]
        
        logger.info(
            f"Ingested context for step {run_step.step_id}",
            extra={
                'run_step_id': str(run_step.id),
                'log_count': len(context['logs']),
                'has_trace': context['trace_data'] is not None
            }
        )
        
        return context

