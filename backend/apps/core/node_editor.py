"""
Schema-driven node editor for Bridge.dev.

Provides utilities for generating form schemas from connector manifests
and validating node configurations.
"""
import jsonschema
from typing import Dict, Any, List, Optional
from apps.common.logging_utils import get_logger
from .connectors.base import ConnectorRegistry

logger = get_logger(__name__)


class NodeEditor:
    """
    Schema-driven node editor for generating forms and validating configurations.
    """
    
    def __init__(self):
        self.connector_registry = ConnectorRegistry()
    
    def get_form_schema(self, connector_id: str, action_id: str) -> Dict[str, Any]:
        """
        Extract form schema from connector manifest for a specific action.
        
        Args:
            connector_id: ID of the connector
            action_id: ID of the action
            
        Returns:
            Dictionary containing form field definitions
            
        Raises:
            ValueError: If connector or action not found
        """
        # Get connector class
        connector_class = self.connector_registry.get(connector_id)
        if not connector_class:
            raise ValueError(f"Connector {connector_id} not found")
        
        # Create temporary instance to get manifest
        temp_instance = connector_class({})
        manifest = temp_instance.get_manifest()
        
        # Find the action
        actions = manifest.get('actions', [])
        action = next((a for a in actions if a.get('id') == action_id), None)
        
        if not action:
            raise ValueError(f"Action {action_id} not found in connector {connector_id}")
        
        # Get input schema
        input_schema = action.get('input_schema', {})
        
        # Parse input schema to form fields
        form_fields = self.parse_input_schema(input_schema, action.get('required_fields', []))
        
        return {
            'connector_id': connector_id,
            'action_id': action_id,
            'action_name': action.get('name'),
            'action_description': action.get('description'),
            'fields': form_fields,
            'output_schema': action.get('output_schema', {})
        }
    
    def parse_input_schema(self, schema: Dict[str, Any], required_fields: List[str]) -> List[Dict[str, Any]]:
        """
        Convert JSON schema to form field definitions.
        
        Args:
            schema: JSON schema object
            required_fields: List of required field names
            
        Returns:
            List of form field definitions
        """
        fields = []
        
        if not schema or not isinstance(schema, dict):
            return fields
        
        properties = schema.get('properties', {})
        schema_required = schema.get('required', [])
        all_required = set(schema_required + required_fields)
        
        for field_name, field_schema in properties.items():
            if not isinstance(field_schema, dict):
                continue
            
            field_def = self._parse_field_schema(field_name, field_schema, field_name in all_required)
            if field_def:
                fields.append(field_def)
        
        return fields
    
    def _parse_field_schema(self, field_name: str, field_schema: Dict[str, Any], required: bool) -> Optional[Dict[str, Any]]:
        """
        Parse a single field schema to form field definition.
        
        Args:
            field_name: Name of the field
            field_schema: Field schema definition
            required: Whether field is required
            
        Returns:
            Form field definition or None if invalid
        """
        field_type = field_schema.get('type')
        
        # Handle different field types
        if field_type == 'object':
            # For nested objects, we'll flatten or create grouped fields
            # For now, skip nested objects (can be enhanced later)
            return None
        elif field_type == 'array':
            # Handle arrays
            items_schema = field_schema.get('items', {})
            item_type = items_schema.get('type', 'string')
            
            return {
                'field_id': field_name,
                'type': 'array',
                'item_type': item_type,
                'label': field_schema.get('title') or field_name.replace('_', ' ').title(),
                'required': required,
                'description': field_schema.get('description', ''),
                'default': field_schema.get('default'),
                'validation': {
                    'minItems': field_schema.get('minItems'),
                    'maxItems': field_schema.get('maxItems'),
                }
            }
        elif field_type in ['string', 'number', 'integer', 'boolean']:
            # Map JSON schema types to form types
            form_type = field_type
            if field_type == 'integer':
                form_type = 'number'
            
            # Check for enum
            enum_values = field_schema.get('enum')
            if enum_values:
                form_type = 'enum'
            
            # Check if it's a password field (by name convention or format)
            if field_name.lower() in ['password', 'api_key', 'secret', 'token'] or \
               field_schema.get('format') == 'password':
                form_type = 'password'
            
            field_def = {
                'field_id': field_name,
                'type': form_type,
                'label': field_schema.get('title') or field_name.replace('_', ' ').title(),
                'required': required,
                'description': field_schema.get('description', ''),
                'default': field_schema.get('default'),
                'validation': {}
            }
            
            # Add enum values if applicable
            if form_type == 'enum':
                field_def['enum_values'] = enum_values
            
            # Add validation constraints
            if field_type == 'string':
                if 'minLength' in field_schema:
                    field_def['validation']['minLength'] = field_schema['minLength']
                if 'maxLength' in field_schema:
                    field_def['validation']['maxLength'] = field_schema['maxLength']
                if 'pattern' in field_schema:
                    field_def['validation']['pattern'] = field_schema['pattern']
            elif field_type in ['number', 'integer']:
                if 'minimum' in field_schema:
                    field_def['validation']['minimum'] = field_schema['minimum']
                if 'maximum' in field_schema:
                    field_def['validation']['maximum'] = field_schema['maximum']
            
            return field_def
        
        return None
    
    def validate_node_config(self, connector_id: str, action_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate node configuration against connector manifest schema.
        
        Args:
            connector_id: ID of the connector
            action_id: ID of the action
            config: Node configuration dictionary
            
        Returns:
            Dictionary with validation result:
            {
                'valid': bool,
                'errors': List[str],
                'field_errors': Dict[str, List[str]]  # Field-specific errors
            }
        """
        errors = []
        field_errors = {}
        
        try:
            # Get connector class
            connector_class = self.connector_registry.get(connector_id)
            if not connector_class:
                return {
                    'valid': False,
                    'errors': [f"Connector {connector_id} not found"],
                    'field_errors': {}
                }
            
            # Create temporary instance to get manifest
            temp_instance = connector_class({})
            manifest = temp_instance.get_manifest()
            
            # Find the action
            actions = manifest.get('actions', [])
            action = next((a for a in actions if a.get('id') == action_id), None)
            
            if not action:
                return {
                    'valid': False,
                    'errors': [f"Action {action_id} not found in connector {connector_id}"],
                    'field_errors': {}
                }
            
            # Get input schema
            input_schema = action.get('input_schema', {})
            
            # Validate required fields
            required_fields = action.get('required_fields', [])
            schema_required = input_schema.get('required', [])
            all_required = set(schema_required + required_fields)
            
            for field in all_required:
                if field not in config or config[field] is None or config[field] == '':
                    errors.append(f"Required field '{field}' is missing")
                    if field not in field_errors:
                        field_errors[field] = []
                    field_errors[field].append('This field is required')
            
            # Validate against JSON schema if available
            if input_schema and isinstance(input_schema, dict):
                try:
                    jsonschema.validate(instance=config, schema=input_schema)
                except jsonschema.ValidationError as e:
                    error_path = list(e.path) if e.path else []
                    field_name = '.'.join(str(p) for p in error_path) if error_path else 'root'
                    
                    if field_name == 'root':
                        errors.append(f"Validation error: {e.message}")
                    else:
                        error_msg = e.message
                        if field_name not in field_errors:
                            field_errors[field_name] = []
                        field_errors[field_name].append(error_msg)
                except jsonschema.SchemaError as e:
                    logger.warning(
                        f"Schema error for connector {connector_id}, action {action_id}: {str(e)}",
                        extra={
                            'connector_id': connector_id,
                            'action_id': action_id,
                            'schema_error': str(e)
                        }
                    )
                    # Don't fail validation on schema errors, but log them
            
            # Validate credential references if any
            # Check if config contains credential_id fields
            for field_name, field_value in config.items():
                if field_name.endswith('_credential_id') or field_name == 'credential_id':
                    # This would require workspace context - handled in views
                    pass
            
            return {
                'valid': len(errors) == 0 and len(field_errors) == 0,
                'errors': errors,
                'field_errors': field_errors
            }
            
        except Exception as e:
            logger.error(
                f"Error validating node config: {str(e)}",
                exc_info=e,
                extra={
                    'connector_id': connector_id,
                    'action_id': action_id
                }
            )
            return {
                'valid': False,
                'errors': [f"Validation error: {str(e)}"],
                'field_errors': {}
            }
    
    def get_credential_fields(self, connector_id: str, workspace_id: str) -> List[Dict[str, Any]]:
        """
        Get available credentials for a connector in a workspace.
        
        This is a helper method that would be used by the API to get
        credentials filtered by the connector's auth requirements.
        
        Args:
            connector_id: ID of the connector
            workspace_id: ID of the workspace
            
        Returns:
            List of credential dictionaries (id, name, type)
        """
        try:
            # Get connector manifest to determine auth type
            connector_class = self.connector_registry.get(connector_id)
            if not connector_class:
                return []
            
            temp_instance = connector_class({})
            manifest = temp_instance.get_manifest()
            
            auth_config = manifest.get('auth_config', {})
            auth_type = auth_config.get('type', 'api_key')
            
            # Import here to avoid circular imports
            from .models import Credential
            
            # Query credentials for workspace matching auth type
            credentials = Credential.objects.filter(
                workspace_id=workspace_id,
                credential_type=auth_type
            ).values('id', 'name', 'credential_type')
            
            return list(credentials)
            
        except Exception as e:
            logger.error(
                f"Error getting credentials for connector {connector_id}: {str(e)}",
                exc_info=e,
                extra={'connector_id': connector_id, 'workspace_id': workspace_id}
            )
            return []


