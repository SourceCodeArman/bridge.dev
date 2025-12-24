"""
Alert system for Bridge.dev

Provides alerting capabilities for workflow failures and timeouts.
"""
# Import from models.py since models are defined there
from apps.core.models import AlertConfiguration, AlertHistory

__all__ = ['AlertConfiguration', 'AlertHistory']

