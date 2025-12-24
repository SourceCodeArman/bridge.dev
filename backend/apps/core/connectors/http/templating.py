"""
URL templating utilities for HTTP connector.

Supports Jinja2-style templating with variable substitution from previous steps.
"""
from typing import Dict, Any, Optional
from jinja2 import Template, Environment, BaseLoader
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


class StepContextLoader(BaseLoader):
    """Jinja2 loader that provides step context variables."""
    
    def __init__(self, step_context: Dict[str, Any]):
        """
        Initialize loader with step context.
        
        Args:
            step_context: Dictionary containing step outputs, e.g.:
                {
                    'step1': {'output': {'field': 'value'}},
                    'step2': {'output': {'other': 'data'}}
                }
        """
        self.step_context = step_context
    
    def get_source(self, environment, template):
        """Return template source (not used, but required by BaseLoader)"""
        return template, None, lambda: True


def render_template(template_string: str, step_context: Optional[Dict[str, Any]] = None) -> str:
    """
    Render a template string with step context variables.
    
    Supports syntax like:
    - {{step1.output.field}} - Access output from step1
    - {{step2.output.data.value}} - Nested access
    - {{variable}} - Direct variable access (from step_context root)
    
    Args:
        template_string: Template string to render
        step_context: Dictionary containing step outputs and variables
        
    Returns:
        Rendered string
        
    Raises:
        Exception: If template rendering fails
    """
    if not template_string:
        return template_string
    
    if step_context is None:
        step_context = {}
    
    try:
        # Create Jinja2 environment with step context
        loader = StepContextLoader(step_context)
        env = Environment(loader=loader, autoescape=False)
        template = env.from_string(template_string)
        
        # Render with step context
        rendered = template.render(**step_context)
        
        logger.debug(
            f"Rendered template: {template_string[:100]}...",
            extra={'template_length': len(template_string)}
        )
        
        return rendered
        
    except Exception as e:
        logger.error(
            f"Template rendering failed: {str(e)}",
            extra={'template': template_string[:200], 'error': str(e)}
        )
        raise Exception(f"Template rendering failed: {str(e)}")


def extract_template_variables(template_string: str) -> list:
    """
    Extract variable names from a template string.
    
    Args:
        template_string: Template string
        
    Returns:
        List of variable names found in template
    """
    if not template_string:
        return []
    
    # Simple regex-based extraction
    import re
    pattern = r'\{\{([^}]+)\}\}'
    matches = re.findall(pattern, template_string)
    return [m.strip() for m in matches]

