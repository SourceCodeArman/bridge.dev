"""
Base connector classes for Bridge.dev connector SDK.

Provides abstract base class and registry for connector implementations.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from apps.common.logging_utils import get_logger
from .hooks import get_hook_registry

logger = get_logger(__name__)


class BaseConnector(ABC):
    """
    Abstract base class for all connectors.
    
    Connectors must implement this interface to be used in workflows.
    Each connector should:
    1. Define a manifest describing its capabilities
    2. Implement initialize() to set up authentication/config
    3. Implement execute() to perform actions
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize connector with configuration.
        
        Args:
            config: Configuration dictionary containing credentials and settings
        """
        self.config = config
        self.manifest = self.get_manifest()
        self._initialized = False
    
    @abstractmethod
    def get_manifest(self) -> Dict[str, Any]:
        """
        Get connector manifest describing capabilities.
        
        Returns:
            Dictionary containing manifest data (id, name, version, actions, etc.)
        """
    
    def initialize(self) -> None:
        """
        Initialize connector with credentials and configuration.
        
        This is called before execute() to set up authentication, connections, etc.
        Should raise an exception if initialization fails.
        
        Subclasses should override _initialize() instead of initialize() to
        ensure hooks are called correctly.
        """
        hook_registry = get_hook_registry()
        context = {'connector_id': self.connector_id}
        
        # Execute before_init hooks
        hook_registry.execute_before_init(self, context)
        
        try:
            # Call the actual initialization
            self._initialize()
            self._initialized = True
            
            # Execute after_init hooks
            hook_registry.execute_after_init(self, context)
        except Exception as e:
            # Execute on_error hooks
            hook_registry.execute_on_error(self, e, context)
            raise
    
    def _initialize(self) -> None:
        """
        Internal initialization method.
        
        Subclasses should override this method to implement initialization logic.
        """
    
    def execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a connector action.
        
        Args:
            action_id: ID of the action to execute (from manifest)
            inputs: Input data for the action
            
        Returns:
            Dictionary containing action outputs
            
        Raises:
            ValueError: If action_id is invalid
            Exception: If execution fails
        """
        if not self._initialized:
            self.initialize()
        
        hook_registry = get_hook_registry()
        context = {'connector_id': self.connector_id, 'action_id': action_id}
        
        # Execute before_execute hooks
        hook_registry.execute_before_execute(self, action_id, inputs, context)
        
        try:
            # Call the actual execution
            outputs = self._execute(action_id, inputs)
            
            # Execute after_execute hooks
            hook_registry.execute_after_execute(self, action_id, inputs, outputs, context)
            
            return outputs
        except Exception as e:
            # Execute on_error hooks
            hook_registry.execute_on_error(self, e, context)
            raise
    
    @abstractmethod
    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Internal execution method.
        
        Subclasses should override this method to implement execution logic.
        
        Args:
            action_id: ID of the action to execute (from manifest)
            inputs: Input data for the action
            
        Returns:
            Dictionary containing action outputs
            
        Raises:
            ValueError: If action_id is invalid
            Exception: If execution fails
        """
    
    def validate_inputs(self, schema: Dict[str, Any], data: Dict[str, Any]) -> bool:
        """
        Validate input data against a JSON schema.
        
        Args:
            schema: JSON schema to validate against
            data: Data to validate
            
        Returns:
            True if valid, False otherwise
            
        Raises:
            ValueError: If validation fails (detailed error message)
        """
        try:
            import jsonschema
            jsonschema.validate(instance=data, schema=schema)
            return True
        except jsonschema.ValidationError as e:
            raise ValueError(f"Input validation failed: {e.message}")
        except Exception as e:
            raise ValueError(f"Schema validation error: {str(e)}")
    
    def validate_outputs(self, schema: Dict[str, Any], data: Dict[str, Any]) -> bool:
        """
        Validate output data against a JSON schema.
        
        Args:
            schema: JSON schema to validate against
            data: Data to validate
            
        Returns:
            True if valid, False otherwise
            
        Raises:
            ValueError: If validation fails (detailed error message)
        """
        try:
            import jsonschema
            jsonschema.validate(instance=data, schema=schema)
            return True
        except jsonschema.ValidationError as e:
            raise ValueError(f"Output validation failed: {e.message}")
        except Exception as e:
            raise ValueError(f"Schema validation error: {str(e)}")
    
    @property
    def connector_id(self) -> str:
        """Get connector ID from manifest"""
        return self.manifest.get('id', 'unknown')
    
    def __repr__(self):
        return f"<{self.__class__.__name__}(id={self.connector_id})>"


class ConnectorRegistry:
    """
    Registry for managing connector classes.
    
    Singleton pattern to ensure one registry instance across the application.
    """
    _instance = None
    _connectors: Dict[str, type] = {}
    
    def __new__(cls):
        """Singleton pattern"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def register(self, connector_class: type) -> None:
        """
        Register a connector class.
        
        Args:
            connector_class: Class extending BaseConnector
            
        Raises:
            ValueError: If connector_class is invalid
        """
        if not issubclass(connector_class, BaseConnector):
            raise ValueError(f"{connector_class} must extend BaseConnector")
        
        # Create a temporary instance to get the manifest
        try:
            temp_instance = connector_class({})
            connector_id = temp_instance.connector_id
        except Exception as e:
            raise ValueError(f"Failed to get connector ID from {connector_class}: {str(e)}")
        
        if connector_id in self._connectors:
            logger.warning(f"Connector {connector_id} already registered, overwriting")
        
        self._connectors[connector_id] = connector_class
        logger.info(f"Registered connector: {connector_id}")
    
    def get(self, connector_id: str) -> Optional[type]:
        """
        Get connector class by ID.
        
        Args:
            connector_id: ID of the connector
            
        Returns:
            Connector class or None if not found
        """
        return self._connectors.get(connector_id)
    
    def list_all(self) -> List[str]:
        """
        List all registered connector IDs.
        
        Returns:
            List of connector IDs
        """
        return list(self._connectors.keys())
    
    def create_instance(self, connector_id: str, config: Dict[str, Any]) -> BaseConnector:
        """
        Create an instance of a connector.
        
        Args:
            connector_id: ID of the connector
            config: Configuration for the connector
            
        Returns:
            Connector instance
            
        Raises:
            ValueError: If connector_id is not found
        """
        connector_class = self.get(connector_id)
        if not connector_class:
            raise ValueError(f"Connector {connector_id} not found in registry")
        
        return connector_class(config)


class DatabaseCustomConnector(BaseConnector):
    """
    Generic connector implementation backed by a database-stored manifest.
    
    This is used as a safe, sandboxed execution wrapper for user-contributed
    connectors whose manifests are stored in the CustomConnector models.
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize with a manifest provided in config.
        
        Expected config keys:
          - manifest: connector manifest dictionary
          - other keys are treated as connector configuration/credentials
        """
        self._provided_manifest = config.get('manifest') or {}
        super().__init__(config)
    
    def get_manifest(self) -> Dict[str, Any]:
        """Return the manifest provided via config."""
        return self._provided_manifest
    
    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a custom connector action.
        
        For now this provides a safe echo-style implementation that can be
        extended to call user-defined logic. It ensures workflows can execute
        end-to-end while keeping execution sandboxed.
        """
        logger.info(
            "Executing database-backed custom connector action",
            extra={
                'connector_id': self.connector_id,
                'action_id': action_id,
            },
        )
        
        return {
            'connector_id': self.connector_id,
            'action_id': action_id,
            'inputs': inputs,
            'message': 'Custom connector executed in sandbox (placeholder implementation)',
        }

