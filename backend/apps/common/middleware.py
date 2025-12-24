"""
Middleware for correlation ID tracking
"""
import uuid
from django.utils.deprecation import MiddlewareMixin
import logging

logger = logging.getLogger(__name__)


class CorrelationIDMiddleware(MiddlewareMixin):
    """
    Middleware to generate and track correlation IDs for request tracing.
    
    Generates a unique correlation ID for each request and makes it available
    via request.correlation_id. The ID is also added to logging context.
    """
    
    def process_request(self, request):
        """
        Generate or extract correlation ID from request.
        
        Checks for X-Correlation-ID header first, otherwise generates a new one.
        """
        # Check for existing correlation ID in header
        correlation_id = request.headers.get('X-Correlation-ID')
        
        if not correlation_id:
            # Generate new correlation ID
            correlation_id = str(uuid.uuid4())
        
        # Attach to request
        request.correlation_id = correlation_id
        
        # Add to logging context
        # This will be picked up by the CorrelationIDFormatter
        logging.LoggerAdapter(logger, {'correlation_id': correlation_id})
        
        return None
    
    def process_response(self, request, response):
        """
        Add correlation ID to response headers.
        """
        correlation_id = getattr(request, 'correlation_id', None)
        if correlation_id:
            response['X-Correlation-ID'] = correlation_id
        
        return response

