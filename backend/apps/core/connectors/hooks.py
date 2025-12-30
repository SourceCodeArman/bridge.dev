"""
Lifecycle hooks for connectors.

Provides decorators and registry for connector lifecycle events.
"""
from typing import Callable, Dict, Any, List
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


class HookRegistry:
    """
    Registry for connector lifecycle hooks.
    
    Manages hooks that can be executed at various stages of connector lifecycle.
    """
    
    def __init__(self):
        """Initialize hook registry"""
        self._before_init: List[Callable] = []
        self._after_init: List[Callable] = []
        self._before_execute: List[Callable] = []
        self._after_execute: List[Callable] = []
        self._on_error: List[Callable] = []
    
    def register_before_init(self, hook: Callable):
        """Register hook to run before connector initialization"""
        self._before_init.append(hook)
    
    def register_after_init(self, hook: Callable):
        """Register hook to run after connector initialization"""
        self._after_init.append(hook)
    
    def register_before_execute(self, hook: Callable):
        """Register hook to run before connector execution"""
        self._before_execute.append(hook)
    
    def register_after_execute(self, hook: Callable):
        """Register hook to run after connector execution"""
        self._after_execute.append(hook)
    
    def register_on_error(self, hook: Callable):
        """Register hook to run on connector errors"""
        self._on_error.append(hook)
    
    def execute_before_init(self, connector, context: Dict[str, Any] = None):
        """Execute all before_init hooks"""
        context = context or {}
        for hook in self._before_init:
            try:
                hook(connector, context)
            except Exception as e:
                logger.warning(f"Error in before_init hook: {str(e)}")
    
    def execute_after_init(self, connector, context: Dict[str, Any] = None):
        """Execute all after_init hooks"""
        context = context or {}
        for hook in self._after_init:
            try:
                hook(connector, context)
            except Exception as e:
                logger.warning(f"Error in after_init hook: {str(e)}")
    
    def execute_before_execute(self, connector, action_id: str, inputs: Dict[str, Any], context: Dict[str, Any] = None):
        """Execute all before_execute hooks"""
        context = context or {}
        for hook in self._before_execute:
            try:
                hook(connector, action_id, inputs, context)
            except Exception as e:
                logger.warning(f"Error in before_execute hook: {str(e)}")
    
    def execute_after_execute(self, connector, action_id: str, inputs: Dict[str, Any], outputs: Dict[str, Any], context: Dict[str, Any] = None):
        """Execute all after_execute hooks"""
        context = context or {}
        for hook in self._after_execute:
            try:
                hook(connector, action_id, inputs, outputs, context)
            except Exception as e:
                logger.warning(f"Error in after_execute hook: {str(e)}")
    
    def execute_on_error(self, connector, error: Exception, context: Dict[str, Any] = None):
        """Execute all on_error hooks"""
        context = context or {}
        for hook in self._on_error:
            try:
                hook(connector, error, context)
            except Exception as e:
                logger.warning(f"Error in on_error hook: {str(e)}")


# Global hook registry
_hook_registry = HookRegistry()


def get_hook_registry() -> HookRegistry:
    """Get the global hook registry"""
    return _hook_registry


# Hook decorators
def before_init(func: Callable) -> Callable:
    """
    Decorator to register a function as a before_init hook.
    
    Usage:
        @before_init
        def my_hook(connector, context):
            # Do something before connector initialization
            pass
    """
    _hook_registry.register_before_init(func)
    return func


def after_init(func: Callable) -> Callable:
    """
    Decorator to register a function as an after_init hook.
    
    Usage:
        @after_init
        def my_hook(connector, context):
            # Do something after connector initialization
            pass
    """
    _hook_registry.register_after_init(func)
    return func


def before_execute(func: Callable) -> Callable:
    """
    Decorator to register a function as a before_execute hook.
    
    Usage:
        @before_execute
        def my_hook(connector, action_id, inputs, context):
            # Do something before connector execution
            pass
    """
    _hook_registry.register_before_execute(func)
    return func


def after_execute(func: Callable) -> Callable:
    """
    Decorator to register a function as an after_execute hook.
    
    Usage:
        @after_execute
        def my_hook(connector, action_id, inputs, outputs, context):
            # Do something after connector execution
            pass
    """
    _hook_registry.register_after_execute(func)
    return func


def on_error(func: Callable) -> Callable:
    """
    Decorator to register a function as an on_error hook.
    
    Usage:
        @on_error
        def my_hook(connector, error, context):
            # Handle connector errors
            pass
    """
    _hook_registry.register_on_error(func)
    return func

