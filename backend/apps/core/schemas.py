"""
JSON schemas for step inputs and outputs.

Defines schemas for validation of step data based on step type.
"""
from typing import Dict, Any

# Base schema for all step inputs/outputs
BASE_SCHEMA = {
    'type': 'object',
    'properties': {},
    'additionalProperties': True
}

# Schema registry for different step types
# This will be expanded in Phase 2 with connector-specific schemas
STEP_SCHEMAS: Dict[str, Dict[str, Any]] = {
    'http': {
        'inputs': {
            'type': 'object',
            'properties': {
                'url': {'type': 'string', 'format': 'uri'},
                'method': {'type': 'string', 'enum': ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']},
                'headers': {'type': 'object', 'additionalProperties': {'type': 'string'}},
                'body': {'type': ['object', 'string', 'null']},
            },
            'required': ['url', 'method'],
            'additionalProperties': True
        },
        'outputs': {
            'type': 'object',
            'properties': {
                'status_code': {'type': 'integer'},
                'headers': {'type': 'object', 'additionalProperties': {'type': 'string'}},
                'body': {'type': ['object', 'string', 'null']},
            },
            'additionalProperties': True
        }
    },
    'slack': {
        'inputs': {
            'type': 'object',
            'properties': {
                'channel': {'type': 'string'},
                'message': {'type': 'string'},
                'blocks': {'type': 'array', 'items': {'type': 'object'}},
            },
            'required': ['channel', 'message'],
            'additionalProperties': True
        },
        'outputs': {
            'type': 'object',
            'properties': {
                'ts': {'type': 'string'},
                'channel': {'type': 'string'},
                'message': {'type': 'object'},
            },
            'additionalProperties': True
        }
    },
    'llm': {
        'inputs': {
            'type': 'object',
            'properties': {
                'prompt': {'type': 'string'},
                'model': {'type': 'string'},
                'temperature': {'type': 'number', 'minimum': 0, 'maximum': 2},
                'max_tokens': {'type': 'integer', 'minimum': 1},
            },
            'required': ['prompt'],
            'additionalProperties': True
        },
        'outputs': {
            'type': 'object',
            'properties': {
                'text': {'type': 'string'},
                'model': {'type': 'string'},
                'usage': {'type': 'object'},
            },
            'additionalProperties': True
        }
    },
}


def get_step_input_schema(step_type: str) -> Dict[str, Any]:
    """
    Get input schema for a step type.
    
    Args:
        step_type: Type of step (e.g., 'http', 'slack', 'llm')
        
    Returns:
        JSON schema dictionary for step inputs
    """
    if step_type in STEP_SCHEMAS:
        return STEP_SCHEMAS[step_type].get('inputs', BASE_SCHEMA)
    return BASE_SCHEMA


def get_step_output_schema(step_type: str) -> Dict[str, Any]:
    """
    Get output schema for a step type.
    
    Args:
        step_type: Type of step (e.g., 'http', 'slack', 'llm')
        
    Returns:
        JSON schema dictionary for step outputs
    """
    if step_type in STEP_SCHEMAS:
        return STEP_SCHEMAS[step_type].get('outputs', BASE_SCHEMA)
    return BASE_SCHEMA


def register_step_schema(step_type: str, input_schema: Dict[str, Any], output_schema: Dict[str, Any]):
    """
    Register schemas for a step type.
    
    This can be used by connectors in Phase 2 to register their schemas.
    
    Args:
        step_type: Type of step
        input_schema: JSON schema for inputs
        output_schema: JSON schema for outputs
    """
    STEP_SCHEMAS[step_type] = {
        'inputs': input_schema,
        'outputs': output_schema
    }

