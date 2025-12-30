"""
Condition Connector implementation.

Provides conditional logic for workflow branching.
"""

from typing import Dict, Any
import re
from apps.core.connectors.base import BaseConnector
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


class ConditionConnector(BaseConnector):
    """
    Condition Connector for workflow branching.

    Evaluates conditional expressions to determine workflow paths.
    """

    def __init__(self, config: Dict[str, Any]):
        """Initialize Condition connector"""
        super().__init__(config)

    def get_manifest(self) -> Dict[str, Any]:
        """Get connector manifest"""
        import json
        import os

        manifest_path = os.path.join(os.path.dirname(__file__), "manifest.json")
        with open(manifest_path, "r") as f:
            return json.load(f)

    def _initialize(self) -> None:
        """Initialize Condition connector"""
        logger.info("Condition connector initialized successfully")

    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute Condition action.

        Args:
            action_id: Action ID ('evaluate')
            inputs: Action inputs

        Returns:
            Dictionary with action outputs
        """
        if action_id == "evaluate":
            return self._execute_evaluate(inputs)
        else:
            raise ValueError(f"Unknown action: {action_id}")

    def _execute_evaluate(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluate a conditional expression.

        Args:
            inputs: Evaluation parameters (left_value, operator, right_value)

        Returns:
            Dictionary with result and branch
        """
        left_value = inputs.get("left_value")
        operator = inputs.get("operator")
        right_value = inputs.get("right_value")

        if operator is None:
            raise ValueError("operator is required")

        logger.info(f"Evaluating condition: {left_value} {operator} {right_value}")

        try:
            result = False

            # Evaluate based on operator
            if operator == "==":
                result = left_value == right_value
            elif operator == "!=":
                result = left_value != right_value
            elif operator == ">":
                result = float(left_value) > float(right_value)
            elif operator == "<":
                result = float(left_value) < float(right_value)
            elif operator == ">=":
                result = float(left_value) >= float(right_value)
            elif operator == "<=":
                result = float(left_value) <= float(right_value)
            elif operator == "contains":
                result = str(right_value) in str(left_value)
            elif operator == "matches":
                # Regular expression matching
                result = bool(re.search(str(right_value), str(left_value)))
            elif operator == "is_empty":
                result = not left_value or (
                    isinstance(left_value, (str, list, dict)) and len(left_value) == 0
                )
            elif operator == "is_not_empty":
                result = bool(left_value) and (
                    not isinstance(left_value, (str, list, dict)) or len(left_value) > 0
                )
            else:
                raise ValueError(f"Unsupported operator: {operator}")

            branch = "true" if result else "false"

            logger.info(f"Condition evaluated to: {result} (branch: {branch})")

            return {"result": result, "branch": branch}

        except ValueError as e:
            # Re-raise ValueError for invalid operators or comparisons
            raise
        except Exception as e:
            error_msg = f"Condition evaluation failed: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)
