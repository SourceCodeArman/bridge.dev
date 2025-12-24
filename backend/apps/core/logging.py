"""
Run and step logging utilities.

Provides RunLogger for structured logging to database.
"""
from typing import Dict, Any, Optional
from django.utils import timezone
from apps.common.logging_utils import get_logger, with_run_context
from .models import Run, RunStep, RunLog

logger = get_logger(__name__)


class RunLogger:
    """
    Logger that writes structured logs to RunLog model.
    
    Provides methods for logging run and step events with automatic
    correlation ID injection.
    """
    
    def __init__(self, run: Run, step: Optional[RunStep] = None):
        """
        Initialize RunLogger for a run and optional step.
        
        Args:
            run: Run instance
            step: Optional RunStep instance
        """
        self.run = run
        self.step = step
        self.correlation_id = str(run.id)
        if step:
            self.correlation_id = f"{run.id}:{step.step_id}"
    
    def log_run_event(self, level: str, message: str, extra: Dict[str, Any] = None):
        """
        Log a run-level event.
        
        Args:
            level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
            message: Log message
            extra: Additional data to store in extra_data
        """
        extra = extra or {}
        
        # Create log entry
        RunLog.objects.create(
            run=self.run,
            step=None,
            level=level.upper(),
            message=message,
            timestamp=timezone.now(),
            correlation_id=self.correlation_id,
            extra_data=extra
        )
        
        # Also log to standard logger with context
        with with_run_context(str(self.run.id)):
            log_func = getattr(logger, level.lower(), logger.info)
            log_func(message, extra=extra)
    
    def log_step_event(self, level: str, message: str, extra: Dict[str, Any] = None):
        """
        Log a step-level event.
        
        Args:
            level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
            message: Log message
            extra: Additional data to store in extra_data
        """
        if not self.step:
            raise ValueError("Cannot log step event without step context")
        
        extra = extra or {}
        
        # Create log entry
        RunLog.objects.create(
            run=self.run,
            step=self.step,
            level=level.upper(),
            message=message,
            timestamp=timezone.now(),
            correlation_id=self.correlation_id,
            extra_data=extra
        )
        
        # Also log to standard logger with context
        with with_run_context(str(self.run.id), str(self.step.step_id)):
            log_func = getattr(logger, level.lower(), logger.info)
            log_func(message, extra=extra)
    
    def debug(self, message: str, extra: Dict[str, Any] = None, step_level: bool = False):
        """Log debug message"""
        if step_level:
            self.log_step_event('DEBUG', message, extra)
        else:
            self.log_run_event('DEBUG', message, extra)
    
    def info(self, message: str, extra: Dict[str, Any] = None, step_level: bool = False):
        """Log info message"""
        if step_level:
            self.log_step_event('INFO', message, extra)
        else:
            self.log_run_event('INFO', message, extra)
    
    def warning(self, message: str, extra: Dict[str, Any] = None, step_level: bool = False):
        """Log warning message"""
        if step_level:
            self.log_step_event('WARNING', message, extra)
        else:
            self.log_run_event('WARNING', message, extra)
    
    def error(self, message: str, extra: Dict[str, Any] = None, step_level: bool = False):
        """Log error message"""
        if step_level:
            self.log_step_event('ERROR', message, extra)
        else:
            self.log_run_event('ERROR', message, extra)
    
    def critical(self, message: str, extra: Dict[str, Any] = None, step_level: bool = False):
        """Log critical message"""
        if step_level:
            self.log_step_event('CRITICAL', message, extra)
        else:
            self.log_run_event('CRITICAL', message, extra)

