"""
Validators for step inputs and outputs using JSON schemas.
"""
import jsonschema
from typing import Dict, Any, Optional
from apps.common.logging_utils import get_logger
from .schemas import get_step_input_schema, get_step_output_schema

logger = get_logger(__name__)


class SchemaValidationError(Exception):
    """Exception raised when schema validation fails"""
    pass


def validate_step_inputs(step_type: str, inputs: Dict[str, Any]) -> None:
    """
    Validate step inputs against schema.
    
    Args:
        step_type: Type of step
        inputs: Input data dictionary
        
    Raises:
        SchemaValidationError: If validation fails
    """
    schema = get_step_input_schema(step_type)
    
    try:
        jsonschema.validate(instance=inputs, schema=schema)
        logger.debug(
            f"Validated inputs for step type {step_type}",
            extra={'step_type': step_type}
        )
    except jsonschema.ValidationError as e:
        error_msg = f"Input validation failed for step type {step_type}: {e.message}"
        logger.warning(
            error_msg,
            extra={
                'step_type': step_type,
                'validation_error': str(e),
                'error_path': list(e.path) if e.path else []
            }
        )
        raise SchemaValidationError(error_msg) from e
    except jsonschema.SchemaError as e:
        error_msg = f"Schema error for step type {step_type}: {str(e)}"
        logger.error(error_msg, extra={'step_type': step_type})
        raise SchemaValidationError(error_msg) from e


def validate_step_outputs(step_type: str, outputs: Dict[str, Any]) -> None:
    """
    Validate step outputs against schema.
    
    Args:
        step_type: Type of step
        outputs: Output data dictionary
        
    Raises:
        SchemaValidationError: If validation fails
    """
    schema = get_step_output_schema(step_type)
    
    try:
        jsonschema.validate(instance=outputs, schema=schema)
        logger.debug(
            f"Validated outputs for step type {step_type}",
            extra={'step_type': step_type}
        )
    except jsonschema.ValidationError as e:
        error_msg = f"Output validation failed for step type {step_type}: {e.message}"
        logger.warning(
            error_msg,
            extra={
                'step_type': step_type,
                'validation_error': str(e),
                'error_path': list(e.path) if e.path else []
            }
        )
        raise SchemaValidationError(error_msg) from e
    except jsonschema.SchemaError as e:
        error_msg = f"Schema error for step type {step_type}: {str(e)}"
        logger.error(error_msg, extra={'step_type': step_type})
        raise SchemaValidationError(error_msg) from e

