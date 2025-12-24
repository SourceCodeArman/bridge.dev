"""
Concurrency management for workflow runs.

Manages per-workflow concurrency limits using Redis for distributed tracking.
"""
import redis
from django.conf import settings
from typing import Optional
from uuid import UUID
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


class ConcurrencyManager:
    """Manages concurrency limits for workflow runs"""
    
    def __init__(self):
        """Initialize Redis connection"""
        redis_url = getattr(settings, 'REDIS_URL', settings.CELERY_BROKER_URL)
        self.redis_client = redis.from_url(redis_url, decode_responses=True)
        self.default_max_concurrent = getattr(
            settings,
            'WORKFLOW_MAX_CONCURRENT_RUNS_DEFAULT',
            10
        )
    
    def _get_workflow_key(self, workflow_id: UUID) -> str:
        """Get Redis key for workflow active runs counter"""
        return f"workflow:concurrent_runs:{workflow_id}"
    
    def _get_run_key(self, workflow_id: UUID, run_id: str) -> str:
        """Get Redis key for tracking a specific run"""
        return f"workflow:run:{workflow_id}:{run_id}"
    
    def can_start_run(self, workflow_id: UUID, max_concurrent: Optional[int] = None) -> bool:
        """
        Check if a new run can be started for a workflow.
        
        Args:
            workflow_id: UUID of the workflow
            max_concurrent: Optional maximum concurrent runs (defaults to settings)
            
        Returns:
            True if run can be started, False if concurrency limit reached
        """
        if max_concurrent is None:
            max_concurrent = self.default_max_concurrent
        
        key = self._get_workflow_key(workflow_id)
        current_count = self.redis_client.get(key)
        current_count = int(current_count) if current_count else 0
        
        can_start = current_count < max_concurrent
        
        if not can_start:
            logger.debug(
                f"Concurrency limit reached for workflow {workflow_id}: {current_count}/{max_concurrent}",
                extra={
                    'workflow_id': str(workflow_id),
                    'current_count': current_count,
                    'max_concurrent': max_concurrent
                }
            )
        
        return can_start
    
    def track_run_start(self, workflow_id: UUID, run_id: str):
        """
        Track the start of a run for concurrency management.
        
        Args:
            workflow_id: UUID of the workflow
            run_id: UUID string of the run
        """
        workflow_key = self._get_workflow_key(workflow_id)
        run_key = self._get_run_key(workflow_id, run_id)
        
        # Increment counter and set run tracking key with expiration (24 hours)
        pipeline = self.redis_client.pipeline()
        pipeline.incr(workflow_key)
        pipeline.set(run_key, '1', ex=86400)  # 24 hour expiration
        pipeline.execute()
        
        logger.debug(
            f"Tracked run start: workflow {workflow_id}, run {run_id}",
            extra={
                'workflow_id': str(workflow_id),
                'run_id': run_id
            }
        )
    
    def track_run_completion(self, workflow_id: UUID, run_id: str):
        """
        Track the completion of a run for concurrency management.
        
        Args:
            workflow_id: UUID of the workflow
            run_id: UUID string of the run
        """
        workflow_key = self._get_workflow_key(workflow_id)
        run_key = self._get_run_key(workflow_id, run_id)
        
        # Check if run was tracked
        if self.redis_client.exists(run_key):
            # Decrement counter and remove run tracking key
            pipeline = self.redis_client.pipeline()
            pipeline.decr(workflow_key)
            pipeline.delete(run_key)
            pipeline.execute()
            
            # Ensure counter doesn't go negative
            current_count = self.redis_client.get(workflow_key)
            if current_count and int(current_count) < 0:
                self.redis_client.set(workflow_key, 0)
            
            logger.debug(
                f"Tracked run completion: workflow {workflow_id}, run {run_id}",
                extra={
                    'workflow_id': str(workflow_id),
                    'run_id': run_id
                }
            )
        else:
            logger.warning(
                f"Run {run_id} not found in concurrency tracking",
                extra={
                    'workflow_id': str(workflow_id),
                    'run_id': run_id
                }
            )
    
    def get_active_run_count(self, workflow_id: UUID) -> int:
        """
        Get the current number of active runs for a workflow.
        
        Args:
            workflow_id: UUID of the workflow
            
        Returns:
            Number of active runs
        """
        key = self._get_workflow_key(workflow_id)
        count = self.redis_client.get(key)
        return int(count) if count else 0
    
    def reset_workflow_concurrency(self, workflow_id: UUID):
        """
        Reset concurrency tracking for a workflow (useful for cleanup).
        
        Args:
            workflow_id: UUID of the workflow
        """
        workflow_key = self._get_workflow_key(workflow_id)
        self.redis_client.delete(workflow_key)
        
        # Also clean up any run tracking keys
        pattern = f"workflow:run:{workflow_id}:*"
        keys = self.redis_client.keys(pattern)
        if keys:
            self.redis_client.delete(*keys)
        
        logger.info(
            f"Reset concurrency tracking for workflow {workflow_id}",
            extra={'workflow_id': str(workflow_id)}
        )

