"""
Template cloner utility for cloning workflow templates into user workspaces.
"""
from typing import Dict, Any, Optional
from apps.common.logging_utils import get_logger
from ..models import Workflow, WorkflowVersion, WorkflowTemplate

logger = get_logger(__name__)


class TemplateCloner:
    """
    Utility for cloning workflow templates into user workspaces.
    
    Handles:
    - Creating new Workflow from template definition
    - Replacing credential placeholders with user prompts
    - Creating draft WorkflowVersion
    - Incrementing template usage count
    """
    
    # Common credential placeholder patterns
    CREDENTIAL_PLACEHOLDERS = [
        '{{credential.api_key}}',
        '{{credential.token}}',
        '{{credential.password}}',
        '{{credential.secret}}',
        '{{credential.oauth_token}}',
        '{{credential.access_token}}',
    ]
    
    def clone_template(
        self,
        template: WorkflowTemplate,
        workspace,
        user,
        workflow_name: Optional[str] = None
    ) -> Workflow:
        """
        Clone a template into a user's workspace.
        
        Args:
            template: WorkflowTemplate to clone
            workspace: Target workspace
            user: User creating the workflow
            workflow_name: Optional custom name (uses template name if not provided)
            
        Returns:
            Created Workflow instance
        """
        # Create workflow from template
        workflow = Workflow.objects.create(
            name=workflow_name or template.name,
            description=template.description,
            workspace=workspace,
            status='draft',
            created_by=user
        )
        
        # Clone and process definition
        definition = self._process_definition(template.definition)
        
        # Create draft version
        WorkflowVersion.objects.create(
            workflow=workflow,
            version_number=1,
            definition=definition,
            is_active=False,  # Draft version
            created_by=user
        )
        
        # Increment template usage count
        template.increment_usage()
        
        logger.info(
            f"Cloned template {template.id} to workflow {workflow.id}",
            extra={
                'template_id': str(template.id),
                'workflow_id': str(workflow.id),
                'workspace_id': str(workspace.id),
                'user_id': str(user.id)
            }
        )
        
        return workflow
    
    def _process_definition(self, definition: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process template definition to replace credential placeholders.
        
        Args:
            definition: Template workflow definition
            
        Returns:
            Processed definition with placeholders replaced
        """
        import copy
        import json
        
        # Deep copy to avoid modifying original
        processed = copy.deepcopy(definition)
        
        # Process nodes
        if 'nodes' in processed:
            for node in processed['nodes']:
                if 'data' in node:
                    node['data'] = self._replace_placeholders(node['data'])
        
        # Process edges (usually don't contain credentials, but check anyway)
        if 'edges' in processed:
            for edge in processed['edges']:
                edge = self._replace_placeholders(edge)
        
        return processed
    
    def _replace_placeholders(self, data: Any) -> Any:
        """
        Recursively replace credential placeholders in data structure.
        
        Args:
            data: Data structure (dict, list, or value)
            
        Returns:
            Data with placeholders replaced
        """
        if isinstance(data, dict):
            return {
                key: self._replace_placeholders(value)
                for key, value in data.items()
            }
        elif isinstance(data, list):
            return [
                self._replace_placeholders(item)
                for item in data
            ]
        elif isinstance(data, str):
            # Replace placeholder strings with prompts
            for placeholder in self.CREDENTIAL_PLACEHOLDERS:
                if placeholder in data:
                    # Replace with a user-friendly prompt
                    credential_type = placeholder.split('.')[-1].rstrip('}}')
                    data = data.replace(
                        placeholder,
                        f"[Please configure {credential_type}]"
                    )
            return data
        else:
            return data


