"""
Manifest validator for connector manifests.

Validates connector manifests against JSON Schema.
"""
import jsonschema
from typing import Dict, Any, List, Tuple
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)

# JSON Schema for connector manifests
MANIFEST_SCHEMA = {
    "type": "object",
    "required": ["id", "name", "version", "connector_type"],
    "properties": {
        "id": {
            "type": "string",
            "pattern": "^[a-z0-9_-]+$",
            "description": "Unique connector identifier (lowercase, alphanumeric, underscores, hyphens)"
        },
        "name": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200,
            "description": "Human-readable connector name"
        },
        "version": {
            "type": "string",
            "pattern": "^\\d+\\.\\d+\\.\\d+$",
            "description": "Semantic version (e.g., 1.0.0)"
        },
        "description": {
            "type": "string",
            "description": "Connector description"
        },
        "author": {
            "type": "string",
            "description": "Connector author"
        },
        "connector_type": {
            "type": "string",
            "enum": ["action", "trigger", "both"],
            "description": "Type of connector"
        },
        "auth_config": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "enum": ["api_key", "oauth", "basic_auth", "custom"],
                    "description": "Authentication type"
                },
                "fields": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["name", "type"],
                        "properties": {
                            "name": {"type": "string"},
                            "type": {"type": "string", "enum": ["string", "password", "number", "boolean"]},
                            "required": {"type": "boolean", "default": False},
                            "description": {"type": "string"}
                        }
                    }
                }
            },
            "required": ["type"]
        },
        "actions": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["id", "name"],
                "properties": {
                    "id": {"type": "string"},
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                    "input_schema": {"type": "object"},
                    "output_schema": {"type": "object"},
                    "required_fields": {
                        "type": "array",
                        "items": {"type": "string"}
                    }
                }
            }
        },
        "triggers": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["id", "name"],
                "properties": {
                    "id": {"type": "string"},
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                    "output_schema": {"type": "object"}
                }
            }
        }
    },
    "additionalProperties": True
}


class ManifestValidator:
    """
    Validator for connector manifests.
    
    Validates manifests against JSON Schema and performs additional checks.
    """
    
    def __init__(self):
        """Initialize validator with manifest schema"""
        self.schema = MANIFEST_SCHEMA
    
    def validate(self, manifest: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        Validate a connector manifest.
        
        Args:
            manifest: Manifest dictionary to validate
            
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        
        # Validate against JSON Schema
        try:
            jsonschema.validate(instance=manifest, schema=self.schema)
        except jsonschema.ValidationError as e:
            errors.append(f"Schema validation error: {e.message} (path: {'.'.join(str(p) for p in e.path)})")
        except Exception as e:
            errors.append(f"Validation error: {str(e)}")
        
        # Additional custom validations
        if not errors:
            errors.extend(self._validate_actions(manifest))
            errors.extend(self._validate_triggers(manifest))
            errors.extend(self._validate_auth_config(manifest))
        
        return (len(errors) == 0, errors)
    
    def _validate_actions(self, manifest: Dict[str, Any]) -> List[str]:
        """Validate actions array"""
        errors = []
        actions = manifest.get('actions', [])
        
        if manifest.get('connector_type') in ['action', 'both'] and not actions:
            errors.append("Connector type is 'action' or 'both' but no actions defined")
        
        action_ids = []
        for i, action in enumerate(actions):
            action_id = action.get('id')
            if not action_id:
                errors.append(f"Action at index {i} missing 'id' field")
            elif action_id in action_ids:
                errors.append(f"Duplicate action ID: {action_id}")
            else:
                action_ids.append(action_id)
        
        return errors


def validate_custom_connector_manifest(manifest: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """
    Validate a manifest for a user-contributed (custom) connector.
    
    In addition to the standard schema validation, this ensures that:
      - The manifest is valid according to MANIFEST_SCHEMA
      - The connector ID does not conflict with any built-in connector IDs
    
    Args:
        manifest: Manifest dictionary to validate
        
    Returns:
        Tuple of (is_valid, list_of_errors)
    """
    validator = ManifestValidator()
    is_valid, errors = validator.validate(manifest)
    
    # If schema validation failed, return early
    if not is_valid:
        return is_valid, errors
    
    connector_id = manifest.get('id')
    if not connector_id:
        return False, errors + ['Manifest must include an "id" field']
    
    # Check for conflicts with built-in connectors registered in ConnectorRegistry
    try:
        from .base import ConnectorRegistry
        
        registry = ConnectorRegistry()
        if registry.get(connector_id):
            errors.append(
                f'Connector id "{connector_id}" conflicts with an existing built-in connector. '
                f'Please choose a different id (e.g., prefix with "custom_").'
            )
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning(
            f"Error while checking custom connector id conflicts: {str(exc)}",
            exc_info=exc,
            extra={'connector_id': connector_id}
        )
    
    return (len(errors) == 0, errors)
    
    def _validate_triggers(self, manifest: Dict[str, Any]) -> List[str]:
        """Validate triggers array"""
        errors = []
        triggers = manifest.get('triggers', [])
        
        if manifest.get('connector_type') in ['trigger', 'both'] and not triggers:
            errors.append("Connector type is 'trigger' or 'both' but no triggers defined")
        
        trigger_ids = []
        for i, trigger in enumerate(triggers):
            trigger_id = trigger.get('id')
            if not trigger_id:
                errors.append(f"Trigger at index {i} missing 'id' field")
            elif trigger_id in trigger_ids:
                errors.append(f"Duplicate trigger ID: {trigger_id}")
            else:
                trigger_ids.append(trigger_id)
        
        return errors
    
    def _validate_auth_config(self, manifest: Dict[str, Any]) -> List[str]:
        """Validate auth_config"""
        errors = []
        auth_config = manifest.get('auth_config')
        
        if auth_config:
            auth_type = auth_config.get('type')
            if auth_type == 'api_key':
                fields = auth_config.get('fields', [])
                if not any(f.get('name') == 'api_key' for f in fields):
                    errors.append("auth_config type is 'api_key' but no 'api_key' field defined")
        
        return errors

