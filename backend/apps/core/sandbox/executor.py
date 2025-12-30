"""
Sandbox executor for isolated connector execution.

Wraps connector execution with resource limits, network policies, and monitoring.
"""
import subprocess
import sys
import os
import tempfile
import shutil
from typing import Dict, Any, Optional
from apps.common.logging_utils import get_logger
from .resource_limits import ResourceLimits
from .policies import NetworkPolicy, SecretPolicy
from .monitoring import SandboxMonitor

logger = get_logger(__name__)


class SandboxExecutor:
    """
    Executor for running connectors in a sandboxed environment.
    
    Provides isolation, resource limits, and policy enforcement.
    """
    
    def __init__(
        self,
        resource_limits: Optional[ResourceLimits] = None,
        network_policy: Optional[NetworkPolicy] = None,
        secret_policy: Optional[SecretPolicy] = None
    ):
        """
        Initialize sandbox executor.
        
        Args:
            resource_limits: Resource limits configuration
            network_policy: Network access policy
            secret_policy: Secret access policy
        """
        self.resource_limits = resource_limits or ResourceLimits()
        self.network_policy = network_policy or NetworkPolicy()
        self.secret_policy = secret_policy or SecretPolicy()
    
    def execute_connector(
        self,
        connector_class,
        config: Dict[str, Any],
        action_id: str,
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute a connector in the sandbox.
        
        Args:
            connector_class: Connector class to instantiate
            config: Connector configuration
            action_id: Action ID to execute
            inputs: Action inputs
            
        Returns:
            Action outputs
            
        Raises:
            Exception: If execution fails or violates policies
        """
        monitor = SandboxMonitor()
        monitor.start()
        
        try:
            # Validate network access in inputs/config
            self._validate_network_access(inputs, config)
            
            # Validate secret access
            self._validate_secret_access(config)
            
            # Create connector instance
            connector = connector_class(config)
            
            # Apply resource limits (if running in subprocess)
            # Note: For in-process execution, limits are advisory
            # For true isolation, use subprocess execution
            
            # Initialize connector
            connector.initialize()
            
            # Execute action
            outputs = connector.execute(action_id, inputs)
            
            # Record successful execution
            monitor.stop()
            
            logger.info(
                f"Sandbox execution completed successfully",
                extra={
                    'connector_id': connector.connector_id,
                    'action_id': action_id,
                    'metrics': monitor.get_metrics()
                }
            )
            
            return outputs
            
        except Exception as e:
            monitor.record_error(e)
            monitor.stop()
            
            logger.error(
                f"Sandbox execution failed: {str(e)}",
                exc_info=e,
                extra={
                    'metrics': monitor.get_metrics()
                }
            )
            raise
    
    def execute_in_subprocess(
        self,
        script_path: str,
        args: list = None,
        env: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Execute a script in a subprocess with full isolation.
        
        Args:
            script_path: Path to script to execute
            args: Script arguments
            env: Environment variables
            
        Returns:
            Execution results
        """
        monitor = SandboxMonitor()
        monitor.start()
        
        try:
            # Create temporary directory for execution
            temp_dir = tempfile.mkdtemp(prefix='sandbox_')
            
            try:
                # Prepare environment
                process_env = os.environ.copy()
                if env:
                    process_env.update(env)
                
                # Start process
                process = subprocess.Popen(
                    [sys.executable, script_path] + (args or []),
                    cwd=temp_dir,
                    env=process_env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    preexec_fn=self._setup_subprocess_limits
                )
                
                monitor.process_id = process.pid
                
                # Set up timeout
                cancel_timeout = self.resource_limits.create_timeout_handler(process)
                
                try:
                    # Wait for completion
                    stdout, stderr = process.communicate(
                        timeout=self.resource_limits.max_time_seconds
                    )
                    
                    # Collect metrics
                    monitor._collect_metrics()
                    
                    # Check return code
                    if process.returncode != 0:
                        error_msg = stderr.decode('utf-8', errors='ignore')
                        raise Exception(f"Process failed with code {process.returncode}: {error_msg}")
                    
                    # Parse output
                    output = stdout.decode('utf-8', errors='ignore')
                    result = {'output': output, 'return_code': process.returncode}
                    
                finally:
                    cancel_timeout()
                    if process.poll() is None:
                        process.kill()
                
            finally:
                # Cleanup temp directory
                shutil.rmtree(temp_dir, ignore_errors=True)
            
            monitor.stop()
            
            logger.info(
                f"Subprocess execution completed",
                extra={
                    'script_path': script_path,
                    'metrics': monitor.get_metrics()
                }
            )
            
            return result
            
        except subprocess.TimeoutExpired:
            monitor.record_error(Exception("Execution timeout"))
            monitor.stop()
            raise Exception(f"Execution exceeded time limit of {self.resource_limits.max_time_seconds}s")
        except Exception as e:
            monitor.record_error(e)
            monitor.stop()
            raise
    
    def _setup_subprocess_limits(self):
        """Setup resource limits for subprocess (called via preexec_fn)"""
        try:
            self.resource_limits.apply_limits()
        except Exception as e:
            logger.error(f"Failed to setup subprocess limits: {str(e)}", exc_info=e)
    
    def _validate_network_access(self, inputs: Dict[str, Any], config: Dict[str, Any]):
        """
        Validate network access in inputs and config.
        
        Args:
            inputs: Action inputs
            config: Connector config
            
        Raises:
            ValueError: If network access is not allowed
        """
        # Check for URLs in inputs
        urls_to_check = []
        
        # Check inputs
        if 'url' in inputs:
            urls_to_check.append(inputs['url'])
        if 'endpoint' in inputs:
            urls_to_check.append(inputs['endpoint'])
        
        # Check config
        if 'base_url' in config:
            urls_to_check.append(config['base_url'])
        if 'api_url' in config:
            urls_to_check.append(config['api_url'])
        
        # Validate each URL
        for url in urls_to_check:
            if isinstance(url, str) and (url.startswith('http://') or url.startswith('https://')):
                if not self.network_policy.is_allowed(url):
                    raise ValueError(
                        f"Network access to {url} is not allowed by sandbox policy"
                    )
    
    def _validate_secret_access(self, config: Dict[str, Any]):
        """
        Validate secret access in config.
        
        Args:
            config: Connector config
            
        Raises:
            ValueError: If secret access is not allowed
        """
        credential_id = config.get('credential_id')
        if credential_id:
            if not self.secret_policy.is_allowed(credential_id):
                raise ValueError(
                    f"Access to credential {credential_id} is not allowed by sandbox policy"
                )


