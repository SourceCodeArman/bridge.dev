"""
AI Assistant service for Bridge.dev workflow builder.

Handles conversational AI interactions with full workflow context,
structured action parsing, and multi-provider LLM support.
"""

import json
import os
from typing import Any, Generator, Optional

from apps.common.logging_utils import get_logger
from .connectors.base import ConnectorRegistry
from .models import ChatMessage, ConversationThread, Workflow

logger = get_logger(__name__)


class AssistantService:
    """
    Service for AI assistant chat interactions.
    """

    MAX_HISTORY_MESSAGES = 20  # Last N messages to include in context

    def __init__(self):
        self.connector_registry = ConnectorRegistry()

    def get_or_create_thread(
        self, workflow: Workflow, thread_id: str = None
    ) -> ConversationThread:
        """
        Get or create conversation thread for a workflow.

        Args:
            workflow: The workflow to get/create thread for
            thread_id: Optional specific thread ID to use

        Returns:
            The active or specified conversation thread
        """
        if thread_id:
            try:
                return ConversationThread.objects.get(id=thread_id, workflow=workflow)
            except ConversationThread.DoesNotExist:
                pass

        # Try to get the active thread
        thread = ConversationThread.objects.filter(
            workflow=workflow, is_active=True
        ).first()

        if not thread:
            # Create a new active thread
            thread = ConversationThread.objects.create(
                workflow=workflow,
                title=f"Chat {ConversationThread.objects.filter(workflow=workflow).count() + 1}",
                is_active=True,
            )

        return thread

    def create_new_thread(
        self, workflow: Workflow, title: str = None
    ) -> ConversationThread:
        """
        Create a new conversation thread for a workflow.

        Args:
            workflow: The workflow to create thread for
            title: Optional title for the thread

        Returns:
            The newly created thread (set as active)
        """
        thread_count = ConversationThread.objects.filter(workflow=workflow).count()
        thread = ConversationThread.objects.create(
            workflow=workflow,
            title=title or f"Chat {thread_count + 1}",
            is_active=True,  # This will deactivate other threads via the save() method
        )
        return thread

    def switch_thread(self, workflow: Workflow, thread_id: str) -> ConversationThread:
        """
        Switch to a different conversation thread.

        Args:
            workflow: The workflow the thread belongs to
            thread_id: The thread ID to switch to

        Returns:
            The switched-to thread

        Raises:
            ConversationThread.DoesNotExist: If thread not found
        """
        thread = ConversationThread.objects.get(id=thread_id, workflow=workflow)
        thread.is_active = True
        thread.save()  # This will deactivate other threads
        return thread

    def list_threads(self, workflow: Workflow) -> list[ConversationThread]:
        """
        List all conversation threads for a workflow.

        Args:
            workflow: The workflow to list threads for

        Returns:
            List of threads ordered by most recent first
        """
        return list(
            ConversationThread.objects.filter(workflow=workflow).order_by("-updated_at")
        )

    def get_conversation_history(
        self, thread: ConversationThread, limit: int = None
    ) -> list[dict[str, str]]:
        """Get conversation history formatted for LLM."""
        limit = limit or self.MAX_HISTORY_MESSAGES
        messages = thread.messages.order_by("-created_at")[:limit]
        messages = list(reversed(messages))  # Oldest first

        return [{"role": msg.role, "content": msg.content} for msg in messages]

    def build_workflow_context(self, workflow: Workflow) -> str:
        """Build context string from current workflow state."""
        version = workflow.get_active_version()
        if not version:
            return "The workflow is empty (no nodes or edges)."

        definition = version.definition
        nodes = definition.get("nodes", [])
        edges = definition.get("edges", [])

        if not nodes:
            return "The workflow is empty (no nodes)."

        context_parts = [f"Current workflow: {workflow.name}"]
        context_parts.append(f"Total nodes: {len(nodes)}")
        context_parts.append(f"Total connections: {len(edges)}")
        context_parts.append("\nNodes:")

        for node in nodes:
            node_id = node.get("id", "unknown")
            node_type = node.get("type", "unknown")
            node_data = node.get("data", {})
            label = node_data.get("label", node_type)
            action_id = node_data.get("action_id", "")

            context_parts.append(
                f"  - {label} (id: {node_id}, type: {node_type}, action: {action_id})"
            )

        if edges:
            context_parts.append("\nConnections:")
            for edge in edges:
                context_parts.append(
                    f"  - {edge.get('source')} -> {edge.get('target')}"
                )

        return "\n".join(context_parts)

    def get_existing_nodes_mapping(self, workflow: Workflow) -> dict[str, list[dict]]:
        """
        Build a mapping of existing nodes in the workflow by connector ID.

        Returns:
            {
                "connector_id": [
                    {
                        "node_id": "uuid",
                        "label": "Node Label",
                        "action_id": "action_name",
                        "type": "trigger|action"
                    },
                    ...
                ],
                ...
            }
        """
        version = workflow.get_active_version()
        if not version:
            return {}

        definition = version.definition
        nodes = definition.get("nodes", [])

        mapping = {}
        for node in nodes:
            node_data = node.get("data", {})
            # Handle both snake_case (AI-generated) and camelCase (manual) field names
            connector_id = node_data.get("connector_id") or node_data.get(
                "connectorType", ""
            )
            action_id = node_data.get("action_id") or node_data.get("actionId", "")

            if connector_id:
                if connector_id not in mapping:
                    mapping[connector_id] = []

                mapping[connector_id].append(
                    {
                        "node_id": node.get("id"),
                        "label": node_data.get("label", ""),
                        "action_id": action_id,
                        "type": node.get("type", "action"),
                    }
                )

        return mapping

    def get_connectors_context(self, workspace_id: str = None) -> str:
        """Get available connectors for context from database."""
        agent_resources_info = []
        workflow_connectors_info = []
        custom_connectors_info = []

        logger.info(
            f"Building connector context from database (workspace_id={workspace_id})"
        )

        # Helper function to format connector info
        def format_connector(name: str, slug: str, manifest: dict) -> str:
            actions = []
            for action in manifest.get("actions", []):
                action_id = action.get("id")
                action_name = action.get("name", action_id)
                action_desc = action.get("description", "")
                actions.append(f"    • {action_id} - {action_name}: {action_desc}")
            if actions:
                return f"- **{name}** (id: `{slug}`)\n" + "\n".join(actions)
            return None

        # 1. Get all active connectors from database in a single query
        try:
            from .models import Connector

            # Define agent resource types
            agent_types = {"agent-model", "agent-memory", "agent-tool"}

            # Fetch all active connectors at once
            all_connectors = (
                Connector.objects.filter(is_active=True)
                .only("slug", "display_name", "manifest", "connector_type")
                .order_by("display_name")
            )

            logger.info(f"Found {all_connectors.count()} total active connectors")

            # Separate connectors by type
            for connector in all_connectors:
                try:
                    manifest = connector.manifest or {}
                    formatted = format_connector(
                        connector.display_name, connector.slug, manifest
                    )

                    if not formatted:
                        continue

                    # Categorize based on connector_type
                    if connector.connector_type in agent_types:
                        logger.debug(
                            f"Agent resource: {connector.slug} ({connector.connector_type})"
                        )
                        agent_resources_info.append(formatted)
                    else:
                        logger.debug(f"Workflow connector: {connector.slug}")
                        workflow_connectors_info.append(formatted)

                except Exception as e:
                    logger.warning(
                        f"Failed to format connector {connector.slug}: {str(e)}"
                    )

            logger.info(
                f"Categorized into {len(agent_resources_info)} agent resources "
                f"and {len(workflow_connectors_info)} workflow connectors"
            )

        except Exception as e:
            logger.error(f"Failed to load connectors from database: {str(e)}")

        # 2. Get all custom connectors for the workspace
        if workspace_id:
            logger.info(f"Loading custom connectors for workspace {workspace_id}")
            try:
                from .models import CustomConnector

                custom_connectors = (
                    CustomConnector.objects.filter(
                        workspace_id=workspace_id, status="approved"
                    )
                    .select_related("current_version")
                    .order_by("display_name")
                )

                logger.info(
                    f"Found {custom_connectors.count()} approved custom connectors"
                )

                for connector in custom_connectors:
                    try:
                        logger.debug(
                            f"Custom connector: {connector.slug} (id: {connector.id})"
                        )
                        current_version = connector.current_version
                        if current_version:
                            manifest = current_version.manifest
                            formatted = format_connector(
                                connector.display_name,
                                f"{connector.slug}` or `{str(connector.id)}",
                                manifest,
                            )
                            if formatted:
                                custom_connectors_info.append(formatted)
                    except Exception as e:
                        logger.warning(
                            f"Failed to format custom connector {connector.slug}: {str(e)}"
                        )
            except Exception as e:
                logger.error(f"Failed to load custom connectors: {str(e)}")
        else:
            logger.debug("No workspace_id provided, skipping custom connectors")

        # Build the final context with agent resources prominently displayed
        context_parts = ["**AVAILABLE CONNECTORS AND ACTIONS:**\n"]

        # Add agent resources section first (critical for AI Agent configuration)
        if agent_resources_info:
            context_parts.append(
                "**AGENT RESOURCES** (for AI Agent node configuration):"
            )
            context_parts.append(
                "Use these connectors to configure AI Agent nodes with model, memory, and tools.\n"
            )
            context_parts.extend(agent_resources_info)
            context_parts.append("")  # Empty line separator

        # Add workflow connectors
        if workflow_connectors_info:
            context_parts.append("**WORKFLOW CONNECTORS:**")
            context_parts.extend(workflow_connectors_info)

        # Add custom connectors
        if custom_connectors_info:
            context_parts.append("\n**CUSTOM CONNECTORS:**")
            context_parts.extend(custom_connectors_info)

        final_context = "\n\n".join(context_parts)

        # Log summary
        logger.info(
            f"Built connector context: "
            f"{len(agent_resources_info)} agent resources, "
            f"{len(workflow_connectors_info)} workflow connectors, "
            f"{len(custom_connectors_info)} custom connectors, "
            f"total length: {len(final_context)} chars"
        )
        logger.debug(f"Context preview (first 500 chars): {final_context[:500]}...")

        return final_context

    def build_system_prompt(
        self,
        workflow: Workflow,
        include_workflow_context: bool = True,
    ) -> str:
        """Build system prompt with full context."""
        parts = [
            "You are an AI assistant for Bridge.dev, a visual workflow automation platform.",
            "You help users build, configure, and debug workflows through natural conversation.",
            "",
            "Your capabilities:",
            "1. Generate workflow suggestions and modifications",
            "2. Explain node configurations and connector options",
            "3. Debug workflow errors and suggest fixes",
            "4. Answer questions about workflow best practices",
            "",
        ]

        if include_workflow_context:
            parts.append("CURRENT WORKFLOW STATE:")
            parts.append(self.build_workflow_context(workflow))
            parts.append("")

            # Add existing nodes mapping
            existing_nodes = self.get_existing_nodes_mapping(workflow)
            if existing_nodes:
                parts.append("EXISTING NODES BY CONNECTOR:")
                for connector_id, nodes_list in existing_nodes.items():
                    parts.append(f"  {connector_id}:")
                    for node_info in nodes_list:
                        parts.append(
                            f'    - "{node_info["label"]}" (id: {node_info["node_id"]}, action: {node_info["action_id"]})'
                        )
                parts.append("")

        # Get workspace from workflow
        workspace_id = (
            str(workflow.workspace_id) if hasattr(workflow, "workspace_id") else None
        )
        parts.append(self.get_connectors_context(workspace_id=workspace_id))
        parts.append("")

        parts.extend(
            [
                "RESPONSE FORMAT:",
                "Always respond in this JSON format:",
                '{"message": "Your response to the user", "actions": []}',
                "",
                "The 'actions' array can contain structured commands:",
                '- {"type": "add_node", "connector_slug": "...", "action_id": "...", "position": [x, y]}',
                '- {"type": "update_node", "node_id": "...", "manifest": {...}}',
                '- {"type": "delete_node", "node_id": "..."}',
                '- {"type": "add_edge", "source": "<connector_slug>_<action_id>", "target": "<connector_slug>_<action_id>", "targetHandle": "model|memory|tools (for agent resources)"}',
                "",
                "For COMPLETE WORKFLOW GENERATION, use the generate_workflow action with this n8n-compatible format:",
                '{"type": "generate_workflow", "definition": {',
                '  "nodes": [',
                '    {"id": "node_1", "name": "Node Label", "slug": "connector-slug", "action_id": "action", "position": [x, y]}',
                "  ],",
                '  "connections": {',
                '    "Source Node Label": {',
                '      "main": [{"node": "Target Node Label", "type": "main"}],',
                '      "model": [{"node": "AI Agent", "type": "model"}],',
                '      "memory": [{"node": "AI Agent", "type": "memory"}],',
                '      "tools": [{"node": "AI Agent", "type": "tools"}]',
                "    }",
                "  }",
                "}}",
                "",
                "GENERATE_WORKFLOW FORMAT RULES:",
                "- 'nodes' array: Each node has id, name (display label), slug (connector id), action_id, position [x, y]",
                "- 'connections' object: Keys are source node names, values have handle types (main, model, memory, tools)",
                "- Connection types: 'main' for regular flow, 'model'/'memory'/'tools' for AI Agent resources",
                "- Positions use ARRAY format [x, y], NOT object {x, y}",
                "",
                "NODE POSITIONING:",
                "When adding multiple nodes, position them HORIZONTALLY (left to right) for a workflow flow:",
                "- First node: [100, 200]",
                "- Second node: [350, 200]",
                "- Third node: [600, 200]",
                "- Fourth node: [850, 200]",
                "Keep y values the same for a horizontal flow. Increase x by ~250 for each subsequent node.",
                "",
                "WHEN TO USE GENERATE_WORKFLOW:",
                "When the user asks to CREATE a complete workflow (multiple nodes), prefer using 'generate_workflow' action.",
                "Use individual 'add_node' and 'add_edge' actions for ADDING nodes to an existing workflow or for single node additions.",
                "",
                "CRITICAL RULES FOR CONNECTOR SLUGS AND ACTION IDS:",
                "1. For 'connector_slug': ONLY use the slug value from 'AVAILABLE CONNECTORS' (the `id` in backticks)",
                "2. For 'action_id': ONLY use action IDs listed under that connector (the ID before the dash: • action_id - Name)",
                "3. NEVER invent or hallucinate connector slugs or action IDs",
                "4. NEVER combine connector slug and action ID (e.g. 'webhook_receive' is WRONG, use 'webhook')",
                "5. If a connector doesn't have the action you need, explain this to the user",
                "",
                "Example for add_node:",
                "  For Slack connector (id: `slack`) with actions:",
                "    • send_message - Send Message",
                "    • list_channels - List Channels",
                "  ",
                '  CORRECT: {"type": "add_node", "connector_slug": "slack", "action_id": "send_message", "position": {"x": 350, "y": 200}}',
                '  WRONG: {"connector_slug": "slack", "action_id": "send"}  ← \'send\' is not in the list!',
                '  WRONG: {"connector_slug": "slack_send_message", "action_id": "send_message"}  ← NEVER combine slug and action in connector_slug!',
                "",
                "Example for add_edge:",
                "  To connect a webhook node to a slack node:",
                '  CORRECT: {"type": "add_edge", "source": "webhook_receive", "target": "slack_send_message"}',
                "  The pattern is: <connector_slug>_<action_id>",
                "",
                "WHEN TO REUSE EXISTING NODES:",
                "- If the workflow already has a node of the required connector type (see EXISTING NODES section),",
                "  suggest using that node instead of creating a new one by returning update_node action with node_id",
                "- Only suggest add_node when a new connector type is needed that doesn't exist in the workflow",
                "",
                "AI AGENT NODE CONFIGURATION:",
                "When creating or configuring an AI Agent node (connector_slug: 'ai-agent'), you should also include:",
                "1. **Model node** (REQUIRED): Add a model connector (e.g., 'openai-model', 'anthropic-model', 'gemini-model') and connect it to the AI Agent",
                "2. **Memory node** (RECOMMENDED): Add a memory connector (e.g., 'postgres-memory', 'redis-memory', 'mongodb-memory') for conversation history",
                "3. **Tool nodes** (OPTIONAL): Add tool connectors (e.g., 'http-tool', 'code-tool', 'mcp-client-tool') for the agent to use",
                "",
                "AGENT RESOURCE POSITIONING:",
                "Agent resource nodes (model, memory, tools) must be positioned BELOW the AI Agent node, NOT to the left.",
                "If AI Agent is at position [600, 200]:",
                "  - Model node: [570, 400] (below, slightly left)",
                "  - Memory node: [680, 400] (below, slightly right)",
                "  - Tool nodes: [790, 400] (below, further right - add more tools at y: 500, 600, etc.)",
                "",
                "For AI Agent workflows, create edges connecting resource nodes to the AI Agent node:",
                '  - Model to Agent: {"type": "add_edge", "source": "openai-model_configure", "target": "ai-agent_run", "targetHandle": "model"}',
                '  - Memory to Agent: {"type": "add_edge", "source": "postgres-memory_get_history", "target": "ai-agent_run", "targetHandle": "memory"}',
                '  - Tool to Agent: {"type": "add_edge", "source": "http-tool_request", "target": "ai-agent_run", "targetHandle": "tools"}',
                "  Use the pattern: <connector_slug>_<action_id> for both source and target.",
                '  IMPORTANT: When connecting to AI Agent nodes, ALWAYS include "targetHandle" to specify the resource type (model/memory/tools).',
                "",
                'If no actions are needed (just answering a question), use: {"message": "...", "actions": []}',
                "",
                "IMPORTANT:",
                "- Always respond with valid JSON only",
                "- Be concise but helpful",
                "- When suggesting changes, explain what you're doing in the message",
                "- Reference nodes by their labels when explaining",
                "- For update_node, include the connector manifest config that matches the user request",
            ]
        )

        system_prompt = "\n".join(parts)

        logger.info(
            f"Built system prompt: {len(system_prompt)} chars, {len(parts)} sections"
        )
        logger.debug(f"Full system prompt:\n{system_prompt}")

        return system_prompt

    def chat(
        self,
        workflow: Workflow,
        user_message: str,
        llm_provider: str = "gemini",
        include_workflow_context: bool = True,
        thread_id: str = None,
    ) -> dict[str, Any]:
        """
        Send a message and get a response (non-streaming).

        Args:
            workflow: The workflow to chat about
            user_message: The user's message
            llm_provider: LLM provider to use
            include_workflow_context: Whether to include workflow state in context
            thread_id: Optional specific thread ID to use

        Returns:
            Dictionary with 'message', 'actions', and 'metadata'
        """
        from django.db import transaction

        thread = self.get_or_create_thread(workflow, thread_id=thread_id)

        # Validate API key early
        api_key = self._get_api_key(llm_provider)
        if not api_key:
            raise ValueError(
                f"API key for {llm_provider} not configured. Please check environment variables."
            )

        with transaction.atomic():
            # Save user message
            ChatMessage.objects.create(
                thread=thread,
                role="user",
                content=user_message,
            )

            logger.info(
                "Assistant chat started",
                extra={
                    "workflow_id": str(workflow.id),
                    "llm_provider": llm_provider,
                    "message_length": len(user_message),
                },
            )

            # Build prompts
            system_prompt = self.build_system_prompt(workflow, include_workflow_context)
            history = self.get_conversation_history(thread)

            try:
                # Call LLM
                response_text = self._call_llm(
                    system_prompt=system_prompt,
                    messages=history,
                    llm_provider=llm_provider,
                )
            except Exception as e:
                logger.error(f"LLM call failed: {str(e)}", exc_info=e)
                raise

            # Parse response
            parsed = self._parse_response(response_text)

            # Save assistant message
            assistant_msg = ChatMessage.objects.create(
                thread=thread,
                role="assistant",
                content=parsed["message"],
                actions=parsed["actions"],
                metadata={"llm_provider": llm_provider},
            )

        return {
            "message": parsed["message"],
            "actions": parsed["actions"],
            "message_id": str(assistant_msg.id),
            "thread_id": str(thread.id),
        }

    def chat_stream(
        self,
        workflow: Workflow,
        user_message: str,
        llm_provider: str = "gemini",
        include_workflow_context: bool = True,
        thread_id: str = None,
    ) -> Generator[str, None, None]:
        """
        Send a message and stream the response.

        Args:
            workflow: The workflow to chat about
            user_message: The user's message
            llm_provider: LLM provider to use
            include_workflow_context: Whether to include workflow state in context
            thread_id: Optional specific thread ID to use

        Yields:
            SSE-formatted data strings
        """
        from django.db import transaction

        thread = self.get_or_create_thread(workflow, thread_id=thread_id)

        # Validate API key early
        api_key = self._get_api_key(llm_provider)
        if not api_key:
            raise ValueError(
                f"API key for {llm_provider} not configured. Please check environment variables."
            )

        with transaction.atomic():
            # Save user message
            ChatMessage.objects.create(
                thread=thread,
                role="user",
                content=user_message,
            )

            logger.info(
                "Assistant chat stream started",
                extra={
                    "workflow_id": str(workflow.id),
                    "llm_provider": llm_provider,
                    "message_length": len(user_message),
                },
            )

            # Build prompts
            system_prompt = self.build_system_prompt(workflow, include_workflow_context)
            history = self.get_conversation_history(thread)

            try:
                # Stream from LLM
                full_response = ""
                for chunk in self._call_llm_stream(
                    system_prompt=system_prompt,
                    messages=history,
                    llm_provider=llm_provider,
                ):
                    full_response += chunk
                    yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
            except Exception as e:
                logger.error(f"LLM streaming call failed: {str(e)}", exc_info=e)
                raise

            # Parse complete response
            parsed = self._parse_response(full_response)

            # Save assistant message
            assistant_msg = ChatMessage.objects.create(
                thread=thread,
                role="assistant",
                content=parsed["message"],
                actions=parsed["actions"],
                metadata={"llm_provider": llm_provider},
            )

        # Send final message with actions
        yield f"data: {json.dumps({'type': 'done', 'message': parsed['message'], 'actions': parsed['actions'], 'message_id': str(assistant_msg.id), 'thread_id': str(thread.id)})}\n\n"

    def _call_llm(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        llm_provider: str,
    ) -> str:
        """Call LLM and return full response."""
        connector_class = self.connector_registry.get(llm_provider)
        if not connector_class:
            raise ValueError(f"LLM connector {llm_provider} not found")

        api_key = self._get_api_key(llm_provider)
        if not api_key:
            raise ValueError(f"API key for {llm_provider} not configured")

        connector = connector_class({"api_key": api_key})
        connector.initialize()

        # Build messages array
        llm_messages = [{"role": "system", "content": system_prompt}]
        llm_messages.extend(messages)

        # Convert messages to a single prompt string
        prompt = self._format_messages_as_prompt(llm_messages)
        model = self._get_default_model(llm_provider)

        # Most LLM connectors use "generate_text" action
        outputs = connector.execute(
            "generate_text",
            {
                "prompt": prompt,
                "model": model,
            },
        )

        return outputs.get("text", "")

    def _format_messages_as_prompt(self, messages: list[dict[str, str]]) -> str:
        """Convert message list to a single prompt string."""
        prompt_parts = []
        for msg in messages:
            role = msg.get("role", "user").upper()
            content = msg.get("content", "")
            if role == "SYSTEM":
                prompt_parts.append(content)
            else:
                prompt_parts.append(f"{role}: {content}")
        return "\n".join(prompt_parts)

    def _call_llm_stream(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        llm_provider: str,
    ) -> Generator[str, None, None]:
        """Call LLM with streaming and yield chunks."""
        # For now, fall back to non-streaming and yield all at once
        # TODO: Implement true streaming for each provider
        response = self._call_llm(system_prompt, messages, llm_provider)

        # Simulate streaming by yielding chunks
        chunk_size = 20
        for i in range(0, len(response), chunk_size):
            yield response[i : i + chunk_size]

    def _get_api_key(self, provider: str) -> Optional[str]:
        """Get API key for provider from environment."""
        key_map = {
            "gemini": "GEMINI_API_KEY",
            "openai": "OPENAI_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
            "deepseek": "DEEPSEEK_API_KEY",
        }
        env_var = key_map.get(provider.lower())
        return os.getenv(env_var) if env_var else None

    def _get_default_model(self, provider: str) -> str:
        """Get default model for provider."""
        models = {
            "openai": "gpt-4",
            "gemini": "gemini-2.0-flash",
            "anthropic": "claude-3-5-sonnet-20241022",
            "deepseek": "deepseek-chat",
        }
        return models.get(provider.lower(), "gpt-4")

    def _parse_response(self, response: str) -> dict[str, Any]:
        """Parse LLM response into message and actions."""
        response = response.strip()

        # Try to extract JSON
        try:
            # Remove markdown code blocks if present
            if response.startswith("```"):
                start = response.find("\n") + 1
                end = response.rfind("```")
                if end > start:
                    response = response[start:end].strip()

            # Find JSON object
            start_idx = response.find("{")
            end_idx = response.rfind("}") + 1
            if start_idx != -1 and end_idx > start_idx:
                json_str = response[start_idx:end_idx]
                parsed = json.loads(json_str)

                return {
                    "message": parsed.get("message", ""),
                    "actions": parsed.get("actions", []),
                }
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"Failed to parse LLM response as JSON: {str(e)[:200]}")

        # Fallback: return raw response as message (safe fallback)
        return {
            "message": response
            if response
            else "I encountered an error processing my response. Please try again.",
            "actions": [],
        }
