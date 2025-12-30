"""
Logging configuration for Bridge.dev

Provides structured logging with correlation IDs and environment-specific formatting.
"""
import logging
import json


class CorrelationIDFormatter(logging.Formatter):
    """
    Custom formatter that includes correlation ID in log records.
    """
    
    def format(self, record):
        """
        Format log record with correlation ID.
        """
        # Get correlation ID from record if available
        correlation_id = getattr(record, 'correlation_id', None)
        
        if correlation_id:
            record.correlation_id = correlation_id
        else:
            record.correlation_id = 'N/A'
        
        # Call parent formatter
        return super().format(record)


class JSONFormatter(logging.Formatter):
    """
    JSON formatter for structured logging (used in production).
    """
    
    def format(self, record):
        """
        Format log record as JSON.
        """
        log_data = {
            'timestamp': self.formatTime(record, self.datefmt),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'correlation_id': getattr(record, 'correlation_id', 'N/A'),
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)
        
        # Add extra fields from record
        if hasattr(record, 'user_id'):
            log_data['user_id'] = record.user_id
        if hasattr(record, 'workspace_id'):
            log_data['workspace_id'] = record.workspace_id
        if hasattr(record, 'request_path'):
            log_data['request_path'] = record.request_path
        if hasattr(record, 'request_method'):
            log_data['request_method'] = record.request_method
        
        return json.dumps(log_data)


def get_logger(name):
    """
    Get a logger instance with correlation ID support.
    
    Args:
        name: Logger name (typically __name__)
    
    Returns:
        Logger instance
    """
    return logging.getLogger(name)


def configure_logging():
    """
    Configure logging based on environment.
    
    This is called from settings to set up logging configuration.
    """
    # Logging is configured in settings files (dev.py and prod.py)
    # This function can be used for additional runtime configuration if needed

