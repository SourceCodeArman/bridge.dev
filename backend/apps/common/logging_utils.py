"""
Logging utilities for Bridge.dev

Provides helper functions and context managers for structured logging.
"""
import logging
from contextvars import ContextVar
from functools import wraps

# Context variable for correlation ID
correlation_id_context: ContextVar[str] = ContextVar('correlation_id', default=None)


class CorrelationIDAdapter(logging.LoggerAdapter):
    """
    Logger adapter that automatically adds correlation ID to log records.
    """
    
    def process(self, msg, kwargs):
        """
        Add correlation ID to log record.
        """
        # Get correlation ID from context or request
        correlation_id = correlation_id_context.get()
        
        if correlation_id:
            kwargs['extra'] = kwargs.get('extra', {})
            kwargs['extra']['correlation_id'] = correlation_id
        
        return msg, kwargs


def get_logger(name, correlation_id=None):
    """
    Get a logger instance with correlation ID support.
    
    Args:
        name: Logger name (typically __name__)
        correlation_id: Optional correlation ID to set in context
    
    Returns:
        LoggerAdapter instance
    """
    logger = logging.getLogger(name)
    
    if correlation_id:
        correlation_id_context.set(correlation_id)
    
    return CorrelationIDAdapter(logger, {})


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

