"""
Rate limiting for workflow runs.

Manages per-workflow rate limits using Redis for distributed rate limiting.
"""
import redis
import time
from django.conf import settings
from typing import Optional, Tuple
from uuid import UUID
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


class RateLimiter:
    """Manages rate limits for workflow runs"""
    
    def __init__(self):
        """Initialize Redis connection"""
        redis_url = getattr(settings, 'REDIS_URL', settings.CELERY_BROKER_URL)
        self.redis_client = redis.from_url(redis_url, decode_responses=True)
        self.default_runs_per_minute = getattr(
            settings,
            'WORKFLOW_RATE_LIMIT_RUNS_PER_MINUTE_DEFAULT',
            60
        )
    
    def _get_minute_key(self, workflow_id: UUID, minute_timestamp: int) -> str:
        """Get Redis key for a specific minute window"""
        return f"workflow:rate_limit:{workflow_id}:{minute_timestamp}"
    
    def check_rate_limit(
        self,
        workflow_id: UUID,
        runs_per_minute: Optional[int] = None
    ) -> Tuple[bool, int]:
        """
        Check if a run can be started based on rate limits.
        
        Args:
            workflow_id: UUID of the workflow
            runs_per_minute: Optional rate limit (defaults to settings)
            
        Returns:
            Tuple of (allowed: bool, remaining: int)
        """
        if runs_per_minute is None:
            runs_per_minute = self.default_runs_per_minute
        
        # Get current minute timestamp
        current_minute = int(time.time() / 60)
        key = self._get_minute_key(workflow_id, current_minute)
        
        # Get current count for this minute
        current_count = self.redis_client.get(key)
        current_count = int(current_count) if current_count else 0
        
        # Check if limit exceeded
        allowed = current_count < runs_per_minute
        remaining = max(0, runs_per_minute - current_count)
        
        if not allowed:
            logger.debug(
                f"Rate limit exceeded for workflow {workflow_id}: {current_count}/{runs_per_minute}",
                extra={
                    'workflow_id': str(workflow_id),
                    'current_count': current_count,
                    'runs_per_minute': runs_per_minute
                }
            )
        
        return allowed, remaining
    
    def record_run(self, workflow_id: UUID):
        """
        Record a run for rate limiting purposes.
        
        Args:
            workflow_id: UUID of the workflow
        """
        current_minute = int(time.time() / 60)
        key = self._get_minute_key(workflow_id, current_minute)
        
        # Increment counter with expiration (2 minutes to account for clock skew)
        pipeline = self.redis_client.pipeline()
        pipeline.incr(key)
        pipeline.expire(key, 120)  # 2 minute expiration
        pipeline.execute()
        
        logger.debug(
            f"Recorded run for rate limiting: workflow {workflow_id}",
            extra={'workflow_id': str(workflow_id)}
        )
    
    def get_current_rate(self, workflow_id: UUID) -> int:
        """
        Get the current run count for the current minute.
        
        Args:
            workflow_id: UUID of the workflow
            
        Returns:
            Number of runs in the current minute
        """
        current_minute = int(time.time() / 60)
        key = self._get_minute_key(workflow_id, current_minute)
        count = self.redis_client.get(key)
        return int(count) if count else 0
    
    def reset_workflow_rate_limit(self, workflow_id: UUID):
        """
        Reset rate limit tracking for a workflow (useful for cleanup).
        
        Args:
            workflow_id: UUID of the workflow
        """
        # Delete all rate limit keys for this workflow
        pattern = f"workflow:rate_limit:{workflow_id}:*"
        keys = self.redis_client.keys(pattern)
        if keys:
            self.redis_client.delete(*keys)
        
        logger.info(
            f"Reset rate limit tracking for workflow {workflow_id}",
            extra={'workflow_id': str(workflow_id)}
        )

