"""
Logging utilities for Bridge.dev

Provides helper functions and context managers for structured logging.
"""
import logging
import re
from contextvars import ContextVar
from functools import wraps
from django.conf import settings

# Context variables for correlation IDs
correlation_id_context: ContextVar[str] = ContextVar('correlation_id', default=None)
run_id_context: ContextVar[str] = ContextVar('run_id', default=None)
step_id_context: ContextVar[str] = ContextVar('step_id', default=None)


class SecretMaskingFilter(logging.Filter):
    """
    Logging filter that masks secrets and sensitive data in log messages.
    
    Scans log messages for patterns matching API keys, tokens, and other secrets,
    replacing them with ***REDACTED*** before logging.
    """
    
    # Common secret patterns
    SECRET_PATTERNS = [
        # API keys (e.g., sk_live_..., api_key_..., etc.)
        (r'(?i)(api[_-]?key|apikey)\s*[:=]\s*["\']?([a-zA-Z0-9_\-]{20,})["\']?', r'\1: ***REDACTED***'),
        # Bearer tokens
        (r'(?i)(bearer|token|authorization)\s*[:=]\s*["\']?([a-zA-Z0-9_\-\.]{20,})["\']?', r'\1: ***REDACTED***'),
        # OAuth tokens
        (r'(?i)(oauth[_-]?token|access[_-]?token)\s*[:=]\s*["\']?([a-zA-Z0-9_\-\.]{20,})["\']?', r'\1: ***REDACTED***'),
        # Passwords
        (r'(?i)(password|passwd|pwd)\s*[:=]\s*["\']?([^"\'\s]+)["\']?', r'\1: ***REDACTED***'),
        # Secret keys
        (r'(?i)(secret[_-]?key|secret)\s*[:=]\s*["\']?([a-zA-Z0-9_\-]{20,})["\']?', r'\1: ***REDACTED***'),
        # Private keys (PEM format)
        (r'-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----', '***REDACTED PRIVATE KEY***'),
    ]
    
    def __init__(self, name=''):
        super().__init__(name)
        # Allow custom patterns from settings
        custom_patterns = getattr(settings, 'LOG_SECRET_PATTERNS', [])
        if custom_patterns:
            self.SECRET_PATTERNS.extend(custom_patterns)
    
    def filter(self, record):
        """
        Filter log record by masking secrets in the message.
        
        Args:
            record: LogRecord instance
            
        Returns:
            True (always passes, but modifies the record)
        """
        if hasattr(record, 'msg') and record.msg:
            # Convert to string if not already
            msg = str(record.msg)
            
            # Apply all secret patterns
            for pattern, replacement in self.SECRET_PATTERNS:
                if isinstance(replacement, str):
                    msg = re.sub(pattern, replacement, msg)
                else:
                    # Replacement is a callable
                    msg = re.sub(pattern, replacement, msg)
            
            record.msg = msg
        
        # Also mask secrets in extra fields
        if hasattr(record, 'extra') and record.extra:
            for key, value in record.extra.items():
                if isinstance(value, str) and len(value) > 20:
                    # Check if value looks like a secret
                    for pattern, _ in self.SECRET_PATTERNS:
                        if re.search(pattern, value):
                            record.extra[key] = '***REDACTED***'
                            break
        
        return True


class CorrelationIDAdapter(logging.LoggerAdapter):
    """
    Logger adapter that automatically adds correlation ID to log records
    and applies secret masking.
    """
    
    def __init__(self, logger, extra):
        super().__init__(logger, extra)
        # Add secret masking filter
        self.logger.addFilter(SecretMaskingFilter())
    
    def process(self, msg, kwargs):
        """
        Add correlation IDs (correlation_id, run_id, step_id) to log record.
        """
        # Get correlation IDs from context
        correlation_id = correlation_id_context.get()
        run_id = run_id_context.get()
        step_id = step_id_context.get()
        
        if correlation_id or run_id or step_id:
            kwargs['extra'] = kwargs.get('extra', {})
            if correlation_id:
                kwargs['extra']['correlation_id'] = correlation_id
            if run_id:
                kwargs['extra']['run_id'] = run_id
            if step_id:
                kwargs['extra']['step_id'] = step_id
        
        return msg, kwargs


def get_logger(name, correlation_id=None, run_id=None, step_id=None):
    """
    Get a logger instance with correlation ID support.
    
    Args:
        name: Logger name (typically __name__)
        correlation_id: Optional correlation ID to set in context
        run_id: Optional run ID to set in context
        step_id: Optional step ID to set in context
    
    Returns:
        LoggerAdapter instance
    """
    logger = logging.getLogger(name)
    
    if correlation_id:
        correlation_id_context.set(correlation_id)
    if run_id:
        run_id_context.set(run_id)
    if step_id:
        step_id_context.set(step_id)
    
    return CorrelationIDAdapter(logger, {})


def with_run_context(run_id, step_id=None):
    """
    Context manager to set run_id and step_id in logging context.
    
    Usage:
        with with_run_context('run-123', 'step-456'):
            logger.info('This log will have run_id and step_id')
    """
    class RunContext:
        def __enter__(self):
            if run_id:
                run_id_context.set(run_id)
            if step_id:
                step_id_context.set(step_id)
            return self
        
        def __exit__(self, exc_type, exc_val, exc_tb):
            run_id_context.set(None)
            step_id_context.set(None)
    
    return RunContext()


def log_request(logger, request, level=logging.INFO):
    """
    Log request information with correlation ID and context.
    
    Args:
        logger: Logger instance
        request: Django request object
        level: Log level (default: INFO)
    """
    correlation_id = getattr(request, 'correlation_id', None)
    user_id = getattr(request.user, 'id', None) if hasattr(request, 'user') and request.user.is_authenticated else None
    workspace_id = getattr(request, 'workspace_id', None)
    
    extra = {
        'correlation_id': correlation_id,
        'request_path': request.path,
        'request_method': request.method,
    }
    
    if user_id:
        extra['user_id'] = str(user_id)
    if workspace_id:
        extra['workspace_id'] = workspace_id
    
    logger.log(
        level,
        f"{request.method} {request.path}",
        extra=extra
    )


def log_error(logger, error, request=None, level=logging.ERROR):
    """
    Log error with correlation ID and context.
    
    Args:
        logger: Logger instance
        error: Exception instance or error message
        request: Optional Django request object
        level: Log level (default: ERROR)
    """
    extra = {}
    
    if request:
        correlation_id = getattr(request, 'correlation_id', None)
        if correlation_id:
            extra['correlation_id'] = correlation_id
        
        user_id = getattr(request.user, 'id', None) if hasattr(request, 'user') and request.user.is_authenticated else None
        if user_id:
            extra['user_id'] = str(user_id)
        
        workspace_id = getattr(request, 'workspace_id', None)
        if workspace_id:
            extra['workspace_id'] = workspace_id
    
    if isinstance(error, Exception):
        logger.exception(
            f"Error: {str(error)}",
            exc_info=error,
            extra=extra
        )
    else:
        logger.log(level, str(error), extra=extra)


def with_correlation_id(correlation_id):
    """
    Context manager to set correlation ID in logging context.
    
    Usage:
        with with_correlation_id('abc-123'):
            logger.info('This log will have correlation_id=abc-123')
    """
    class CorrelationIDContext:
        def __enter__(self):
            correlation_id_context.set(correlation_id)
            return self
        
        def __exit__(self, exc_type, exc_val, exc_tb):
            correlation_id_context.set(None)
    
    return CorrelationIDContext()


def log_function_call(logger):
    """
    Decorator to log function calls with correlation ID.
    
    Usage:
        @log_function_call(logger)
        def my_function():
            pass
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            correlation_id = correlation_id_context.get()
            logger.debug(
                f"Calling {func.__name__}",
                extra={'correlation_id': correlation_id} if correlation_id else {}
            )
            try:
                result = func(*args, **kwargs)
                logger.debug(
                    f"Completed {func.__name__}",
                    extra={'correlation_id': correlation_id} if correlation_id else {}
                )
                return result
            except Exception as e:
                logger.exception(
                    f"Error in {func.__name__}: {str(e)}",
                    extra={'correlation_id': correlation_id} if correlation_id else {}
                )
                raise
        return wrapper
    return decorator

