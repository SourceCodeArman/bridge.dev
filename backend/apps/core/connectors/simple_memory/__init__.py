"""
Simple Memory Connector for Bridge.dev

Provides in-app database-backed chat memory storage.
"""

from .connector import SimpleMemoryConnector
from apps.core.connectors.base import ConnectorRegistry

# Register the connector
registry = ConnectorRegistry()
registry.register(SimpleMemoryConnector)

__all__ = ["SimpleMemoryConnector"]
