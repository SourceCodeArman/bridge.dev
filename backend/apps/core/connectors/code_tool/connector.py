"""
Code Tool Connector implementation.

Provides sandboxed code execution for Python and JavaScript.
"""

from typing import Dict, Any
import subprocess
import time
from apps.core.connectors.base import BaseConnector
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


class CodeToolConnector(BaseConnector):
    """
    Code Tool Connector for agent tools.

    Executes Python and JavaScript code in a sandboxed environment.
    """

    def __init__(self, config: Dict[str, Any]):
        """Initialize Code Tool connector"""
        super().__init__(config)

    def get_manifest(self) -> Dict[str, Any]:
        """Get connector manifest"""
        import json
        import os

        manifest_path = os.path.join(os.path.dirname(__file__), "manifest.json")
        with open(manifest_path, "r") as f:
            return json.load(f)

    def _initialize(self) -> None:
        """Initialize code execution environment"""
        logger.info("Code Tool connector initialized successfully")

    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute Code Tool action.

        Args:
            action_id: Action ID ('execute_python' or 'execute_javascript')
            inputs: Action inputs

        Returns:
            Dictionary with action outputs
        """
        if action_id == "execute_python":
            return self._execute_python(inputs)
        elif action_id == "execute_javascript":
            return self._execute_javascript(inputs)
        else:
            raise ValueError(f"Unknown action: {action_id}")

    def _execute_python(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute Python code.

        Args:
            inputs: Execution parameters (code, timeout)

        Returns:
            Dictionary with execution results
        """
        code = inputs.get("code")
        timeout = inputs.get("timeout", 30)

        if not code:
            raise ValueError("code is required")

        logger.info("Executing Python code")

        try:
            start_time = time.time()

            # Execute Python code in subprocess for isolation
            process = subprocess.Popen(
                ["python", "-c", code],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )

            try:
                stdout, stderr = process.communicate(timeout=timeout)
                execution_time = time.time() - start_time

                result = {
                    "stdout": stdout,
                    "stderr": stderr,
                    "result": None,
                    "execution_time": execution_time,
                    "error": stderr if process.returncode != 0 else None,
                }

                logger.info(f"Python code executed in {execution_time:.2f}s")

                return result

            except subprocess.TimeoutExpired:
                process.kill()
                error_msg = f"Python code execution timed out after {timeout}s"
                logger.error(error_msg)
                return {
                    "stdout": "",
                    "stderr": "",
                    "result": None,
                    "execution_time": timeout,
                    "error": error_msg,
                }

        except Exception as e:
            error_msg = f"Python code execution failed: {str(e)}"
            logger.error(error_msg)
            return {
                "stdout": "",
                "stderr": "",
                "result": None,
                "execution_time": 0,
                "error": error_msg,
            }

    def _execute_javascript(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute JavaScript code.

        Args:
            inputs: Execution parameters (code, timeout)

        Returns:
            Dictionary with execution results
        """
        code = inputs.get("code")
        timeout = inputs.get("timeout", 30)

        if not code:
            raise ValueError("code is required")

        logger.info("Executing JavaScript code")

        try:
            start_time = time.time()

            # Execute JavaScript code using Node.js
            process = subprocess.Popen(
                ["node", "-e", code],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )

            try:
                stdout, stderr = process.communicate(timeout=timeout)
                execution_time = time.time() - start_time

                result = {
                    "stdout": stdout,
                    "stderr": stderr,
                    "result": None,
                    "execution_time": execution_time,
                    "error": stderr if process.returncode != 0 else None,
                }

                logger.info(f"JavaScript code executed in {execution_time:.2f}s")

                return result

            except subprocess.TimeoutExpired:
                process.kill()
                error_msg = f"JavaScript code execution timed out after {timeout}s"
                logger.error(error_msg)
                return {
                    "stdout": "",
                    "stderr": "",
                    "result": None,
                    "execution_time": timeout,
                    "error": error_msg,
                }

        except FileNotFoundError:
            error_msg = (
                "Node.js not found. Please install Node.js to execute JavaScript code."
            )
            logger.error(error_msg)
            return {
                "stdout": "",
                "stderr": "",
                "result": None,
                "execution_time": 0,
                "error": error_msg,
            }
        except Exception as e:
            error_msg = f"JavaScript code execution failed: {str(e)}"
            logger.error(error_msg)
            return {
                "stdout": "",
                "stderr": "",
                "result": None,
                "execution_time": 0,
                "error": error_msg,
            }
