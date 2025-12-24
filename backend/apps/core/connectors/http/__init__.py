"""
HTTP Connector for Bridge.dev

Provides HTTP request capabilities with URL templating and response parsing.
"""
from .connector import HTTPConnector
from .webhook_connector import WebhookConnector

__all__ = ['HTTPConnector', 'WebhookConnector']


