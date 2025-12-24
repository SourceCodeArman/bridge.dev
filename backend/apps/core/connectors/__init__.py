"""
Connector SDK for Bridge.dev

Provides base classes and utilities for building workflow connectors.
"""
from .base import BaseConnector, ConnectorRegistry
from .validator import ManifestValidator

__all__ = ['BaseConnector', 'ConnectorRegistry', 'ManifestValidator']

