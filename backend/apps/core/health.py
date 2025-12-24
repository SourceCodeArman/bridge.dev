"""
Health check endpoint for workers and system components.

Provides health status for Redis, database, and worker metrics.
"""
import redis
from django.conf import settings
from django.db import connection
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework import status
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    Health check endpoint for system components.
    
    Returns:
        JSON response with health status of Redis, database, and worker metrics
    """
    health_status = {
        'status': 'healthy',
        'components': {}
    }
    
    # Check Redis connectivity
    redis_status = _check_redis()
    health_status['components']['redis'] = redis_status
    
    # Check database connectivity
    db_status = _check_database()
    health_status['components']['database'] = db_status
    
    # Get worker metrics if Redis is available
    if redis_status['status'] == 'healthy':
        worker_metrics = _get_worker_metrics()
        health_status['components']['workers'] = worker_metrics
    else:
        health_status['components']['workers'] = {
            'status': 'unknown',
            'error': 'Redis unavailable'
        }
    
    # Determine overall status
    all_healthy = all(
        comp.get('status') == 'healthy'
        for comp in health_status['components'].values()
    )
    
    if not all_healthy:
        health_status['status'] = 'unhealthy'
        return JsonResponse(health_status, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    
    return JsonResponse(health_status, status=status.HTTP_200_OK)


def _check_redis() -> dict:
    """Check Redis connectivity"""
    try:
        redis_url = getattr(settings, 'REDIS_URL', settings.CELERY_BROKER_URL)
        client = redis.from_url(redis_url, socket_connect_timeout=2)
        client.ping()
        
        return {
            'status': 'healthy',
            'message': 'Redis connection successful'
        }
    except Exception as e:
        logger.error(f"Redis health check failed: {str(e)}")
        return {
            'status': 'unhealthy',
            'error': str(e)
        }


def _check_database() -> dict:
    """Check database connectivity"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        
        return {
            'status': 'healthy',
            'message': 'Database connection successful'
        }
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        return {
            'status': 'unhealthy',
            'error': str(e)
        }


def _get_worker_metrics() -> dict:
    """Get worker metrics from Redis"""
    try:
        redis_url = getattr(settings, 'REDIS_URL', settings.CELERY_BROKER_URL)
        client = redis.from_url(redis_url)
        
        # Get queue lengths (simplified - in production you'd use Celery's inspect API)
        metrics = {
            'status': 'healthy',
            'queues': {}
        }
        
        # Get queue lengths for configured queues
        queues = ['default', 'workflows', 'steps', 'retries', 'scheduler']
        for queue_name in queues:
            queue_key = f"celery:queue:{queue_name}"
            length = client.llen(queue_key)
            metrics['queues'][queue_name] = {
                'length': length
            }
        
        return metrics
        
    except Exception as e:
        logger.error(f"Failed to get worker metrics: {str(e)}")
        return {
            'status': 'unhealthy',
            'error': str(e)
        }

