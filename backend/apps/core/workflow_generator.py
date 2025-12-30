"""
Workflow generator service for Bridge.dev.

Converts natural language prompts into workflow draft definitions using LLM connectors.
"""
import json
from typing import Dict, Any, List, Optional
from apps.common.logging_utils import get_logger
from .connectors.base import ConnectorRegistry
from .guardrails.prompt_sanitizer import PromptSanitizer

logger = get_logger(__name__)


class WorkflowGenerator:
    """
    Service for generating workflow drafts from natural language prompts.
    """
    
    def __init__(self):
        self.connector_registry = ConnectorRegistry()
        self.sanitizer = PromptSanitizer()
    
    def generate_from_prompt(
        self,
        prompt: str,
        llm_provider: str = 'openai',
        workspace_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate a workflow draft from a natural language prompt.
        
        Args:
            prompt: Natural language description of the workflow
            llm_provider: LLM provider to use ('openai', 'anthropic', 'gemini', 'deepseek')
            workspace_id: Optional workspace ID for credential lookup
            
        Returns:
            Dictionary containing workflow definition (nodes and edges)
            
        Raises:
            ValueError: If LLM provider is invalid or generation fails
        """
        # Get available connectors information
        connectors_info = self._get_connectors_info()
        
        # Sanitize connector info to remove any credential references
        connectors_info = self.sanitizer.sanitize_connector_info(connectors_info)
        
        # Build prompt for LLM
        system_prompt = self._build_system_prompt(connectors_info)
        user_prompt = f"Create a workflow for: {prompt}"
        
        # Sanitize prompts before sending
        system_prompt = self.sanitizer.sanitize_prompt(system_prompt)
        user_prompt = self.sanitizer.sanitize_prompt(user_prompt)
        
        # Validate prompts
        is_valid, error_msg = self.sanitizer.validate_prompt(system_prompt)
        if not is_valid:
            raise ValueError(f"System prompt validation failed: {error_msg}")
        
        is_valid, error_msg = self.sanitizer.validate_prompt(user_prompt)
        if not is_valid:
            raise ValueError(f"User prompt validation failed: {error_msg}")
        
        # Call LLM
        llm_response = self._call_llm(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            llm_provider=llm_provider,
            workspace_id=workspace_id
        )
        
        # Parse LLM response
        workflow_definition = self._parse_llm_response(llm_response)
        
        # Validate and enhance the generated workflow
        workflow_definition = self._validate_and_enhance_workflow(workflow_definition, connectors_info)
        
        return workflow_definition
    
    def _get_connectors_info(self) -> List[Dict[str, Any]]:
        """
        Get information about all available connectors.
        
        Returns:
            List of connector information dictionaries
        """
        connectors_info = []
        connector_ids = self.connector_registry.list_all()
        
        for connector_id in connector_ids:
            try:
                connector_class = self.connector_registry.get(connector_id)
                temp_instance = connector_class({})
                manifest = temp_instance.get_manifest()
                
                # Extract relevant information
                actions = []
                for action in manifest.get('actions', []):
                    actions.append({
                        'id': action.get('id'),
                        'name': action.get('name'),
                        'description': action.get('description'),
                        'required_fields': action.get('required_fields', [])
                    })
                
                connectors_info.append({
                    'id': connector_id,
                    'name': manifest.get('name'),
                    'description': manifest.get('description'),
                    'actions': actions
                })
            except Exception as e:
                logger.warning(
                    f"Error getting info for connector {connector_id}: {str(e)}",
                    extra={'connector_id': connector_id, 'error': str(e)}
                )
        
        return connectors_info
    
    def _build_system_prompt(self, connectors_info: List[Dict[str, Any]]) -> str:
        """
        Build system prompt for LLM workflow generation.
        
        Args:
            connectors_info: List of connector information
            
        Returns:
            System prompt string
        """
        connectors_text = "\n\n".join([
            f"**{connector['name']}** (id: {connector['id']})\n"
            f"Description: {connector.get('description', 'N/A')}\n"
            f"Actions:\n" + "\n".join([
                f"  - {action['name']} (id: {action['id']}): {action.get('description', 'N/A')}"
                for action in connector.get('actions', [])
            ])
            for connector in connectors_info
        ])
        
        return f"""You are a workflow generator for Bridge.dev, a no-code integration platform.

Available Connectors and Actions:
{connectors_text}

Generate a workflow definition in JSON format with the following structure:
{{
    "nodes": [
        {{
            "id": "node_1",
            "type": "connector_id",
            "data": {{
                "action_id": "action_id",
                "field1": "value1",
                "field2": "value2"
            }},
            "position": {{"x": 100, "y": 100}}
        }}
    ],
    "edges": [
        {{
            "source": "node_1",
            "target": "node_2",
            "sourceHandle": null,
            "targetHandle": null
        }}
    ]
}}

Rules:
1. Use valid connector IDs and action IDs from the list above
2. Include all required fields for each action
3. Connect nodes logically based on data flow
4. Generate unique node IDs (node_1, node_2, etc.)
5. Assign reasonable positions for nodes (spaced at least 200px apart)
6. Return ONLY valid JSON, no markdown formatting or explanation

Return the workflow definition as JSON."""
    
    def _call_llm(
        self,
        system_prompt: str,
        user_prompt: str,
        llm_provider: str,
        workspace_id: Optional[str] = None
    ) -> str:
        """
        Call LLM connector to generate workflow.
        
        Args:
            system_prompt: System prompt for the LLM
            user_prompt: User prompt
            llm_provider: LLM provider name
            workspace_id: Optional workspace ID for credential lookup
            
        Returns:
            LLM response text
            
        Raises:
            ValueError: If LLM call fails
        """
        # Map provider name to connector ID
        provider_to_connector = {
            'openai': 'openai',
            'anthropic': 'anthropic',
            'gemini': 'gemini',
            'deepseek': 'deepseek'
        }
        
        connector_id = provider_to_connector.get(llm_provider.lower())
        if not connector_id:
            raise ValueError(f"Invalid LLM provider: {llm_provider}. Must be one of: {list(provider_to_connector.keys())}")
        
        # Get connector class
        connector_class = self.connector_registry.get(connector_id)
        if not connector_class:
            raise ValueError(f"LLM connector {connector_id} not found")
        
        try:
            # Create connector instance (will need credentials from workspace)
            # For now, use empty config - credentials should be handled by the API layer
            connector = connector_class({})
            connector.initialize()
            
            # Determine which action to use (generate_text or chat)
            manifest = connector.get_manifest()
            actions = manifest.get('actions', [])
            
            # Prefer chat completion if available, otherwise use generate_text
            action_id = None
            for action in actions:
                if action.get('id') in ['chat', 'generate_text', 'chat_completion']:
                    action_id = action.get('id')
                    break
            
            if not action_id:
                # Fallback to first action
                action_id = actions[0].get('id') if actions else None
            
            if not action_id:
                raise ValueError(f"No suitable action found in connector {connector_id}")
            
            # Prepare inputs based on action
            if action_id == 'chat':
                # Use chat format
                inputs = {
                    'messages': [
                        {'role': 'system', 'content': system_prompt},
                        {'role': 'user', 'content': user_prompt}
                    ],
                    'model': 'gpt-4' if llm_provider == 'openai' else None  # Default model
                }
            else:
                # Use single prompt format
                inputs = {
                    'prompt': f"{system_prompt}\n\n{user_prompt}",
                    'model': 'gpt-4' if llm_provider == 'openai' else None
                }
            
            # Sanitize inputs before sending to LLM
            inputs = self.sanitizer.sanitize_data(inputs, apply_allowlist=True, apply_redaction=True)
            
            # Log sanitized inputs (for audit trail)
            logger.debug(
                "Sending sanitized inputs to LLM",
                extra={
                    'llm_provider': llm_provider,
                    'action_id': action_id,
                    'sanitized_inputs': self.sanitizer.sanitize_for_logging(inputs)
                }
            )
            
            # Execute connector action
            outputs = connector.execute(action_id, inputs)
            
            # Extract text from output
            if action_id == 'chat':
                text = outputs.get('message', {}).get('content', '') or outputs.get('text', '')
            else:
                text = outputs.get('text', '')
            
            if not text:
                raise ValueError("LLM did not return any text")
            
            return text
            
        except Exception as e:
            logger.error(
                f"Error calling LLM {llm_provider}: {str(e)}",
                exc_info=e,
                extra={'llm_provider': llm_provider, 'workspace_id': workspace_id}
            )
            raise ValueError(f"LLM generation failed: {str(e)}") from e
    
    def _parse_llm_response(self, response: str) -> Dict[str, Any]:
        """
        Parse LLM response into workflow definition.
        
        Args:
            response: LLM response text
            
        Returns:
            Workflow definition dictionary
            
        Raises:
            ValueError: If response cannot be parsed
        """
        # Try to extract JSON from response (might be wrapped in markdown)
        response = response.strip()
        
        # Remove markdown code blocks if present
        if response.startswith('```'):
            # Find the first newline after opening ```
            start_idx = response.find('\n')
            if start_idx > 0:
                response = response[start_idx + 1:]
        
        if response.endswith('```'):
            response = response[:-3]
        
        response = response.strip()
        
        # Try to parse JSON
        try:
            workflow_definition = json.loads(response)
        except json.JSONDecodeError as e:
            logger.error(
                f"Failed to parse LLM response as JSON: {str(e)}",
                extra={'response_preview': response[:500]}
            )
            raise ValueError(f"Failed to parse LLM response as JSON: {str(e)}") from e
        
        # Validate basic structure
        if not isinstance(workflow_definition, dict):
            raise ValueError("LLM response is not a JSON object")
        
        if 'nodes' not in workflow_definition:
            raise ValueError("LLM response missing 'nodes' field")
        
        if 'edges' not in workflow_definition:
            workflow_definition['edges'] = []
        
        return workflow_definition
    
    def _validate_and_enhance_workflow(
        self,
        workflow_definition: Dict[str, Any],
        connectors_info: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Validate and enhance generated workflow definition.
        
        Args:
            workflow_definition: Generated workflow definition
            connectors_info: List of connector information
            
        Returns:
            Enhanced and validated workflow definition
        """
        # Create connector ID mapping
        connector_map = {connector['id']: connector for connector in connectors_info}
        
        # Validate and enhance nodes
        nodes = workflow_definition.get('nodes', [])
        enhanced_nodes = []
        
        for i, node in enumerate(nodes):
            node_id = node.get('id')
            if not node_id:
                node_id = f"node_{i + 1}"
            
            node_type = node.get('type')
            if not node_type or node_type not in connector_map:
                # Skip invalid nodes
                logger.warning(
                    f"Skipping node with invalid connector type: {node_type}",
                    extra={'node': node}
                )
                continue
            
            # Ensure data field exists
            if 'data' not in node:
                node['data'] = {}
            
            # Ensure position exists
            if 'position' not in node:
                node['position'] = {'x': 100 + (i * 250), 'y': 100}
            
            enhanced_nodes.append(node)
        
        workflow_definition['nodes'] = enhanced_nodes
        
        # Validate edges (remove edges referencing non-existent nodes)
        node_ids = {node['id'] for node in enhanced_nodes}
        edges = workflow_definition.get('edges', [])
        enhanced_edges = [
            edge for edge in edges
            if edge.get('source') in node_ids and edge.get('target') in node_ids
        ]
        
        workflow_definition['edges'] = enhanced_edges
        
        return workflow_definition

