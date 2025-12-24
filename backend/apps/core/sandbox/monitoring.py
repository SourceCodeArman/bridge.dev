"""
Monitoring and metrics for sandbox execution.

Tracks resource usage, execution times, and failures.
"""
import time
import psutil
from typing import Dict, Any, Optional
from datetime import datetime
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


class SandboxMonitor:
    """
    Monitor sandbox execution metrics and resource usage.
    """
    
    def __init__(self, process_id: Optional[int] = None):
        """
        Initialize monitor.
        
        Args:
            process_id: Process ID to monitor (None for current process)
        """
        self.process_id = process_id
        self.start_time: Optional[float] = None
        self.end_time: Optional[float] = None
        self.peak_memory_mb: float = 0.0
        self.cpu_time_seconds: float = 0.0
        self.network_requests: int = 0
        self.errors: list = []
    
    def start(self):
        """Start monitoring"""
        self.start_time = time.time()
        logger.debug(
            f"Started monitoring process {self.process_id}",
            extra={'process_id': self.process_id}
        )
    
    def stop(self):
        """Stop monitoring and collect final metrics"""
        self.end_time = time.time()
        self._collect_metrics()
        logger.debug(
            f"Stopped monitoring process {self.process_id}",
            extra={
                'process_id': self.process_id,
                'duration_seconds': self.duration,
                'peak_memory_mb': self.peak_memory_mb
            }
        )
    
    def _collect_metrics(self):
        """Collect metrics from process"""
        if not self.process_id:
            return
        
        try:
            process = psutil.Process(self.process_id)
            
            # Get memory usage
            memory_info = process.memory_info()
            self.peak_memory_mb = memory_info.rss / (1024 * 1024)
            
            # Get CPU time
            cpu_times = process.cpu_times()
            self.cpu_time_seconds = cpu_times.user + cpu_times.system
            
        except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
            logger.warning(
                f"Could not collect metrics for process {self.process_id}: {str(e)}",
                extra={'process_id': self.process_id}
            )
        except Exception as e:
            logger.error(
                f"Error collecting metrics: {str(e)}",
                exc_info=e
            )
    
    def record_network_request(self, url: str, success: bool = True):
        """
        Record a network request.
        
        Args:
            url: URL that was accessed
            success: Whether request was successful
        """
        self.network_requests += 1
        logger.debug(
            f"Network request {self.network_requests}: {url}",
            extra={
                'process_id': self.process_id,
                'url': url,
                'success': success,
                'request_count': self.network_requests
            }
        )
    
    def record_error(self, error: Exception):
        """
        Record an error.
        
        Args:
            error: Exception that occurred
        """
        self.errors.append({
            'type': type(error).__name__,
            'message': str(error),
            'timestamp': datetime.utcnow().isoformat()
        })
        logger.error(
            f"Error in sandbox execution: {str(error)}",
            exc_info=error,
            extra={'process_id': self.process_id}
        )
    
    @property
    def duration(self) -> Optional[float]:
        """Get execution duration in seconds"""
        if self.start_time and self.end_time:
            return self.end_time - self.start_time
        elif self.start_time:
            return time.time() - self.start_time
        return None
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get all metrics as dictionary"""
        return {
            'process_id': self.process_id,
            'duration_seconds': self.duration,
            'peak_memory_mb': self.peak_memory_mb,
            'cpu_time_seconds': self.cpu_time_seconds,
            'network_requests': self.network_requests,
            'error_count': len(self.errors),
            'errors': self.errors,
            'start_time': self.start_time,
            'end_time': self.end_time
        }


