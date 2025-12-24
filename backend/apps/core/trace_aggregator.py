"""
Trace aggregation for workflow runs.

Builds trace structures from RunLog entries for fast retrieval.
"""
from typing import Dict, Any, List
from django.utils import timezone
from apps.common.logging_utils import get_logger
from .models import Run, RunStep, RunLog, RunTrace

logger = get_logger(__name__)


class TraceAggregator:
    """
    Aggregates run logs into trace structures.
    
    Builds hierarchical trace data showing run and step execution
    with timing and log entries.
    """
    
    def build_trace(self, run: Run) -> Dict[str, Any]:
        """
        Build trace structure for a run.
        
        Args:
            run: Run instance
            
        Returns:
            Dictionary containing complete trace structure
        """
        # Get all logs for the run
        logs = RunLog.objects.filter(run=run).order_by('timestamp')
        
        # Get all steps for the run
        steps = run.steps.all().order_by('order', 'created_at')
        
        # Build step traces
        step_traces = []
        for step in steps:
            step_logs = logs.filter(step=step)
            step_trace = self._build_step_trace(step, step_logs)
            step_traces.append(step_trace)
        
        # Build run-level trace
        run_logs = logs.filter(step__isnull=True)
        
        trace = {
            'run_id': str(run.id),
            'workflow_name': run.workflow_version.workflow.name,
            'workflow_version': run.workflow_version.version_number,
            'status': run.status,
            'trigger_type': run.trigger_type,
            'started_at': run.started_at.isoformat() if run.started_at else None,
            'completed_at': run.completed_at.isoformat() if run.completed_at else None,
            'duration_seconds': run.duration,
            'steps': step_traces,
            'run_logs': [
                {
                    'level': log.level,
                    'message': log.message,
                    'timestamp': log.timestamp.isoformat(),
                    'correlation_id': log.correlation_id,
                    'extra_data': log.extra_data
                }
                for log in run_logs
            ],
            'summary': {
                'total_steps': len(steps),
                'completed_steps': len([s for s in steps if s.status == 'completed']),
                'failed_steps': len([s for s in steps if s.status == 'failed']),
                'total_logs': logs.count(),
                'error_logs': logs.filter(level='ERROR').count(),
                'warning_logs': logs.filter(level='WARNING').count(),
            }
        }
        
        return trace
    
    def _build_step_trace(self, step: RunStep, logs: List[RunLog]) -> Dict[str, Any]:
        """
        Build trace structure for a step.
        
        Args:
            step: RunStep instance
            logs: List of RunLog entries for this step
            
        Returns:
            Dictionary containing step trace structure
        """
        return {
            'step_id': step.step_id,
            'step_type': step.step_type,
            'status': step.status,
            'started_at': step.started_at.isoformat() if step.started_at else None,
            'completed_at': step.completed_at.isoformat() if step.completed_at else None,
            'duration_seconds': (
                (step.completed_at - step.started_at).total_seconds()
                if step.started_at and step.completed_at else None
            ),
            'error_message': step.error_message,
            'inputs_keys': list(step.inputs.keys()) if step.inputs else [],
            'outputs_keys': list(step.outputs.keys()) if step.outputs else [],
            'logs': [
                {
                    'level': log.level,
                    'message': log.message,
                    'timestamp': log.timestamp.isoformat(),
                    'correlation_id': log.correlation_id,
                    'extra_data': log.extra_data
                }
                for log in logs
            ],
            'log_summary': {
                'total': logs.count(),
                'error': logs.filter(level='ERROR').count(),
                'warning': logs.filter(level='WARNING').count(),
                'info': logs.filter(level='INFO').count(),
            }
        }
    
    def update_trace(self, run: Run) -> RunTrace:
        """
        Build and update trace for a run.
        
        Args:
            run: Run instance
            
        Returns:
            RunTrace instance
        """
        trace_data = self.build_trace(run)
        
        # Get or create trace
        trace, created = RunTrace.objects.get_or_create(
            run=run,
            defaults={'trace_data': trace_data}
        )
        
        if not created:
            # Update existing trace
            trace.trace_data = trace_data
            trace.save(update_fields=['trace_data', 'updated_at'])
        
        logger.debug(
            f"Updated trace for run {run.id}",
            extra={'run_id': str(run.id), 'created': created}
        )
        
        return trace

