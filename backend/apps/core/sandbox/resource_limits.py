"""
Resource limits for sandbox execution.

Defines and enforces limits on time, memory, CPU, and other resources.
"""
import resource
import signal
import time
from typing import Dict, Any, Optional
from django.conf import settings
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


class ResourceLimits:
    """
    Resource limits configuration and enforcement for sandbox execution.
    """
    
    def __init__(
        self,
        max_time_seconds: Optional[int] = None,
        max_memory_mb: Optional[int] = None,
        max_cpu_time_seconds: Optional[int] = None
    ):
        """
        Initialize resource limits.
        
        Args:
            max_time_seconds: Maximum wall-clock time in seconds (default: 30)
            max_memory_mb: Maximum memory in MB (default: 512)
            max_cpu_time_seconds: Maximum CPU time in seconds (default: 60)
        """
        self.max_time_seconds = max_time_seconds or getattr(
            settings,
            'SANDBOX_MAX_TIME_SECONDS',
            30
        )
        self.max_memory_mb = max_memory_mb or getattr(
            settings,
            'SANDBOX_MAX_MEMORY_MB',
            512
        )
        self.max_cpu_time_seconds = max_cpu_time_seconds or getattr(
            settings,
            'SANDBOX_MAX_CPU_TIME_SECONDS',
            60
        )
        
        # Convert memory to bytes
        self.max_memory_bytes = self.max_memory_mb * 1024 * 1024
    
    def apply_limits(self, pid: Optional[int] = None):
        """
        Apply resource limits to the current process or specified PID.
        
        Args:
            pid: Process ID (None for current process)
        """
        try:
            # Set memory limit (RSS - Resident Set Size)
            resource.setrlimit(
                resource.RLIMIT_AS,
                (self.max_memory_bytes, self.max_memory_bytes)
            )
            
            # Set CPU time limit
            resource.setrlimit(
                resource.RLIMIT_CPU,
                (self.max_cpu_time_seconds, self.max_cpu_time_seconds)
            )
            
            # Set file size limit (prevent large file writes)
            resource.setrlimit(
                resource.RLIMIT_FSIZE,
                (10 * 1024 * 1024, 10 * 1024 * 1024)  # 10MB max file size
            )
            
            logger.debug(
                f"Applied resource limits: memory={self.max_memory_mb}MB, "
                f"cpu_time={self.max_cpu_time_seconds}s",
                extra={
                    'max_memory_mb': self.max_memory_mb,
                    'max_cpu_time_seconds': self.max_cpu_time_seconds,
                    'max_time_seconds': self.max_time_seconds
                }
            )
            
        except Exception as e:
            logger.error(
                f"Failed to apply resource limits: {str(e)}",
                exc_info=e
            )
            raise
    
    def create_timeout_handler(self, process):
        """
        Create a timeout handler that will kill the process after max_time_seconds.
        
        Args:
            process: Process object to monitor
            
        Returns:
            Function to cancel timeout
        """
        def timeout_handler():
            """Kill process if timeout exceeded"""
            if process.poll() is None:  # Process still running
                logger.warning(
                    f"Process {process.pid} exceeded time limit {self.max_time_seconds}s, killing",
                    extra={
                        'process_id': process.pid,
                        'timeout_seconds': self.max_time_seconds
                    }
                )
                try:
                    process.kill()
                except Exception as e:
                    logger.error(
                        f"Error killing process {process.pid}: {str(e)}",
                        exc_info=e
                    )
        
        # Schedule timeout
        import threading
        timer = threading.Timer(self.max_time_seconds, timeout_handler)
        timer.start()
        
        def cancel():
            """Cancel the timeout timer"""
            timer.cancel()
        
        return cancel
    
    def get_limits_dict(self) -> Dict[str, Any]:
        """Get limits as dictionary for logging/monitoring"""
        return {
            'max_time_seconds': self.max_time_seconds,
            'max_memory_mb': self.max_memory_mb,
            'max_cpu_time_seconds': self.max_cpu_time_seconds,
            'max_memory_bytes': self.max_memory_bytes
        }


