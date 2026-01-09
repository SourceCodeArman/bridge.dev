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

    def get_or_create_thread(self, workflow: Workflow) -> ConversationThread:
        """Get or create conversation thread for a workflow."""
        thread, created = ConversationThread.objects.get_or_create(
            workflow=workflow,
            defaults={"title": f"Chat for {workflow.name}"},
        )
        return thread

    def get_conversation_history(
        self, thread: ConversationThread, limit: int = None
    ) -> list[dict[str, str]]:
        """Get conversation history formatted for LLM."""
        limit = limit or self.MAX_HISTORY_MESSAGES
        messages = thread.messages.order_by("-created_at")[:limit]
        messages = list(reversed(messages))  # Oldest first

        return [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]

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

            context_parts.append(f"  - {label} (id: {node_id}, type: {node_type}, action: {action_id})")

        if edges:
            context_parts.append("\nConnections:")
            for edge in edges:
                context_parts.append(f"  - {edge.get('source')} -> {edge.get('target')}")

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
            connector_id = node_data.get("connector_id", "")

            if connector_id:
                if connector_id not in mapping:
                    mapping[connector_id] = []

                mapping[connector_id].append({
                    "node_id": node.get("id"),
                    "label": node_data.get("label", ""),
                    "action_id": node_data.get("action_id", ""),
                    "type": node.get("type", "action"),
                })

        return mapping

    def get_connectors_context(self) -> str:
        """Get available connectors for context."""
        connectors_info = []
        connector_ids = self.connector_registry.list_all()

        for connector_id in connector_ids[:15]:  # Limit to 15
            try:
                connector_class = self.connector_registry.get(connector_id)
                temp_instance = connector_class({})
                manifest = temp_instance.get_manifest()

                actions = []
                for action in manifest.get("actions", [])[:3]:
                    actions.append(f"{action.get('id')}: {action.get('description', action.get('name', ''))}")

                connectors_info.append(
                    f"- {manifest.get('name')} (id: {connector_id}): {', '.join(actions)}"
                )
            except Exception as e:
                logger.warning(f"Failed to load connector {connector_id}: {str(e)}")

        return "Available connectors:\n" + "\n".join(connectors_info)

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

        parts.append(self.get_connectors_context())
        parts.append("")

        parts.extend([
            "RESPONSE FORMAT:",
            "Always respond in this JSON format:",
            '{"message": "Your response to the user", "actions": []}',
            "",
            "The 'actions' array can contain structured commands:",
            '- {"type": "add_node", "connector_id": "...", "action_id": "...", "label": "...", "position": {"x": 100, "y": 100}}',
            '- {"type": "update_node", "node_id": "...", "config": {...}}',
            '- {"type": "delete_node", "node_id": "..."}',
            '- {"type": "add_edge", "source": "...", "target": "..."}',
            '- {"type": "generate_workflow", "definition": {"nodes": [...], "edges": [...]}}',
            "",
            "If no actions are needed (just answering a question), use: {\"message\": \"...\", \"actions\": []}",
            "",
            "IMPORTANT:",
            "- Always respond with valid JSON only",
            "- Be concise but helpful",
            "- When suggesting changes, explain what you're doing in the message",
            "- Reference nodes by their labels when explaining",
        ])

        return "\n".join(parts)

    def chat(
        self,
        workflow: Workflow,
        user_message: str,
        llm_provider: str = "gemini",
        include_workflow_context: bool = True,
    ) -> dict[str, Any]:
        """
        Send a message and get a response (non-streaming).

        Returns:
            Dictionary with 'message', 'actions', and 'metadata'
        """
        from django.db import transaction

        thread = self.get_or_create_thread(workflow)

        # Validate API key early
        api_key = self._get_api_key(llm_provider)
        if not api_key:
            raise ValueError(f"API key for {llm_provider} not configured. Please check environment variables.")

        with transaction.atomic():
            # Save user message
            ChatMessage.objects.create(
                thread=thread,
                role="user",
                content=user_message,
            )

            logger.info(
                "Assistant chat started",
                extra={"workflow_id": str(workflow.id), "llm_provider": llm_provider, "message_length": len(user_message)},
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
    ) -> Generator[str, None, None]:
        """
        Send a message and stream the response.

        Yields:
            SSE-formatted data strings
        """
        from django.db import transaction

        thread = self.get_or_create_thread(workflow)

        # Validate API key early
        api_key = self._get_api_key(llm_provider)
        if not api_key:
            raise ValueError(f"API key for {llm_provider} not configured. Please check environment variables.")

        with transaction.atomic():
            # Save user message
            ChatMessage.objects.create(
                thread=thread,
                role="user",
                content=user_message,
            )

            logger.info(
                "Assistant chat stream started",
                extra={"workflow_id": str(workflow.id), "llm_provider": llm_provider, "message_length": len(user_message)},
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
        outputs = connector.execute("generate_text", {
            "prompt": prompt,
            "model": model,
        })

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
            yield response[i:i + chunk_size]

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
            "message": response if response else "I encountered an error processing my response. Please try again.",
            "actions": [],
        }
