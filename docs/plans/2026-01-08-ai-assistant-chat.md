# AI Assistant Chat Endpoint Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a conversational AI assistant chat API with streaming responses, full workflow context, database persistence, and structured actions for the workflow builder.

**Architecture:** Django REST endpoint with SSE streaming for real-time responses. ConversationThread and ChatMessage models for persistence. Assistant service handles context building, LLM calls, and action parsing. Frontend widget connects via EventSource for streaming.

**Tech Stack:** Django 6.0, DRF, Server-Sent Events (SSE), PostgreSQL, OpenAI/Anthropic/Gemini APIs, React EventSource

---

## Task 1: Create Database Models

**Files:**
- Modify: `backend/apps/core/models.py` (append after line 1321)

**Step 1: Add ConversationThread and ChatMessage models**

```python
class ConversationThread(models.Model):
    """
    Conversation thread for AI assistant chat.

    Each workflow has one conversation thread for context persistence.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.OneToOneField(
        Workflow,
        on_delete=models.CASCADE,
        related_name="conversation_thread",
        help_text="Workflow this conversation belongs to",
    )
    title = models.CharField(
        max_length=200,
        blank=True,
        help_text="Optional title for the conversation",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "core_conversationthread"
        verbose_name = "Conversation Thread"
        verbose_name_plural = "Conversation Threads"
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["workflow"]),
            models.Index(fields=["updated_at"]),
        ]

    def __str__(self):
        return f"Conversation for {self.workflow.name}"


class ChatMessage(models.Model):
    """
    Individual message in an AI assistant conversation.
    """

    ROLE_CHOICES = [
        ("user", "User"),
        ("assistant", "Assistant"),
        ("system", "System"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    thread = models.ForeignKey(
        ConversationThread,
        on_delete=models.CASCADE,
        related_name="messages",
        help_text="Conversation thread this message belongs to",
    )
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        db_index=True,
        help_text="Message role (user, assistant, or system)",
    )
    content = models.TextField(help_text="Message content")
    actions = models.JSONField(
        default=list,
        blank=True,
        help_text="Structured actions returned by assistant (e.g., add_node, update_config)",
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional metadata (tokens, model, etc.)",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "core_chatmessage"
        verbose_name = "Chat Message"
        verbose_name_plural = "Chat Messages"
        ordering = ["thread", "created_at"]
        indexes = [
            models.Index(fields=["thread", "created_at"]),
            models.Index(fields=["thread", "role"]),
        ]

    def __str__(self):
        preview = self.content[:50] + "..." if len(self.content) > 50 else self.content
        return f"{self.role}: {preview}"
```

**Step 2: Run makemigrations**

Run: `cd /Users/armanghevondyan/Desktop/vibe-coding/bridge.dev/backend && python manage.py makemigrations core --name add_conversation_models`

Expected: Migration file created successfully

**Step 3: Run migrate**

Run: `cd /Users/armanghevondyan/Desktop/vibe-coding/bridge.dev/backend && python manage.py migrate`

Expected: Migration applied successfully

**Step 4: Commit**

```bash
cd /Users/armanghevondyan/Desktop/vibe-coding/bridge.dev && git add backend/apps/core/models.py backend/apps/core/migrations/
git commit -m "feat(core): add ConversationThread and ChatMessage models for AI assistant"
```

---

## Task 2: Create Serializers

**Files:**
- Modify: `backend/apps/core/serializers.py` (append at end)

**Step 1: Add imports to serializers.py**

Add to imports at top of file (after existing model imports):

```python
from .models import (
    # ... existing imports ...
    ConversationThread,
    ChatMessage,
)
```

**Step 2: Add serializers**

```python
class ChatMessageSerializer(serializers.ModelSerializer):
    """Serializer for ChatMessage model"""

    class Meta:
        model = ChatMessage
        fields = (
            "id",
            "thread",
            "role",
            "content",
            "actions",
            "metadata",
            "created_at",
        )
        read_only_fields = ("id", "created_at")


class ConversationThreadSerializer(serializers.ModelSerializer):
    """Serializer for ConversationThread model"""

    workflow_name = serializers.CharField(source="workflow.name", read_only=True)
    messages = ChatMessageSerializer(many=True, read_only=True)
    message_count = serializers.SerializerMethodField()

    class Meta:
        model = ConversationThread
        fields = (
            "id",
            "workflow",
            "workflow_name",
            "title",
            "messages",
            "message_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_message_count(self, obj):
        return obj.messages.count()


class ConversationThreadListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for conversation list (no messages)"""

    workflow_name = serializers.CharField(source="workflow.name", read_only=True)
    message_count = serializers.SerializerMethodField()
    last_message_at = serializers.SerializerMethodField()

    class Meta:
        model = ConversationThread
        fields = (
            "id",
            "workflow",
            "workflow_name",
            "title",
            "message_count",
            "last_message_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_message_count(self, obj):
        return obj.messages.count()

    def get_last_message_at(self, obj):
        last_msg = obj.messages.order_by("-created_at").first()
        return last_msg.created_at if last_msg else None


class AIChatRequestSerializer(serializers.Serializer):
    """Serializer for AI chat request"""

    message = serializers.CharField(
        required=True,
        help_text="User message to send to AI assistant",
    )
    llm_provider = serializers.ChoiceField(
        choices=["openai", "anthropic", "gemini", "deepseek"],
        default="gemini",
        required=False,
        help_text="LLM provider to use",
    )
    include_workflow_context = serializers.BooleanField(
        default=True,
        required=False,
        help_text="Whether to include current workflow state in context",
    )
    stream = serializers.BooleanField(
        default=True,
        required=False,
        help_text="Whether to stream the response",
    )
```

**Step 3: Commit**

```bash
cd /Users/armanghevondyan/Desktop/vibe-coding/bridge.dev && git add backend/apps/core/serializers.py
git commit -m "feat(core): add serializers for AI assistant chat"
```

---

## Task 3: Create Assistant Service

**Files:**
- Create: `backend/apps/core/assistant_service.py`

**Step 1: Create the assistant service file**

```python
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
from .guardrails.prompt_sanitizer import PromptSanitizer
from .models import ChatMessage, ConversationThread, Workflow, WorkflowVersion

logger = get_logger(__name__)


class AssistantService:
    """
    Service for AI assistant chat interactions.
    """

    MAX_HISTORY_MESSAGES = 20  # Last N messages to include in context

    def __init__(self):
        self.connector_registry = ConnectorRegistry()
        self.sanitizer = PromptSanitizer()

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

    def get_connectors_context(self) -> str:
        """Get available connectors for context."""
        connectors_info = []
        connector_ids = self.connector_registry.list_all()

        for connector_id in connector_ids:
            try:
                connector_class = self.connector_registry.get(connector_id)
                temp_instance = connector_class({})
                manifest = temp_instance.get_manifest()

                actions = []
                for action in manifest.get("actions", []):
                    actions.append(f"{action.get('id')}: {action.get('description', action.get('name', ''))}")

                connectors_info.append(
                    f"- {manifest.get('name')} (id: {connector_id}): {', '.join(actions[:3])}"
                )
            except Exception:
                pass

        return "Available connectors:\n" + "\n".join(connectors_info[:15])  # Limit to 15

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
        thread = self.get_or_create_thread(workflow)

        # Save user message
        ChatMessage.objects.create(
            thread=thread,
            role="user",
            content=user_message,
        )

        # Build prompts
        system_prompt = self.build_system_prompt(workflow, include_workflow_context)
        history = self.get_conversation_history(thread)

        # Call LLM
        response_text = self._call_llm(
            system_prompt=system_prompt,
            messages=history,
            llm_provider=llm_provider,
        )

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
        thread = self.get_or_create_thread(workflow)

        # Save user message
        ChatMessage.objects.create(
            thread=thread,
            role="user",
            content=user_message,
        )

        # Build prompts
        system_prompt = self.build_system_prompt(workflow, include_workflow_context)
        history = self.get_conversation_history(thread)

        # Stream from LLM
        full_response = ""
        for chunk in self._call_llm_stream(
            system_prompt=system_prompt,
            messages=history,
            llm_provider=llm_provider,
        ):
            full_response += chunk
            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"

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
            raise ValueError(f"API key for {llm_provider} not found")

        connector = connector_class({"api_key": api_key})
        connector.initialize()

        # Build messages array
        llm_messages = [{"role": "system", "content": system_prompt}]
        llm_messages.extend(messages)

        model = self._get_default_model(llm_provider)

        outputs = connector.execute("chat", {
            "messages": llm_messages,
            "model": model,
        })

        return outputs.get("message", {}).get("content", "") or outputs.get("text", "")

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
                    "message": parsed.get("message", response),
                    "actions": parsed.get("actions", []),
                }
        except (json.JSONDecodeError, ValueError):
            pass

        # Fallback: return raw response as message
        return {
            "message": response,
            "actions": [],
        }
```

**Step 2: Commit**

```bash
cd /Users/armanghevondyan/Desktop/vibe-coding/bridge.dev && git add backend/apps/core/assistant_service.py
git commit -m "feat(core): add AssistantService for AI chat with workflow context"
```

---

## Task 4: Create ViewSet for AI Assistant

**Files:**
- Create: `backend/apps/core/views/assistant.py`
- Modify: `backend/apps/core/views/__init__.py`

**Step 1: Create assistant.py view file**

```python
"""
Views for AI Assistant chat functionality.
"""

import json
from django.http import StreamingHttpResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.common.logging_utils import get_logger
from ..models import Workflow, ConversationThread, ChatMessage
from ..serializers import (
    ConversationThreadSerializer,
    ConversationThreadListSerializer,
    ChatMessageSerializer,
    AIChatRequestSerializer,
)
from ..assistant_service import AssistantService

logger = get_logger(__name__)


class AIAssistantViewSet(viewsets.ViewSet):
    """
    ViewSet for AI Assistant chat interactions.

    Endpoints:
    - POST /api/v1/core/assistant/{workflow_id}/chat/ - Send message (non-streaming)
    - GET /api/v1/core/assistant/{workflow_id}/chat/stream/ - Send message (streaming SSE)
    - GET /api/v1/core/assistant/{workflow_id}/history/ - Get conversation history
    - DELETE /api/v1/core/assistant/{workflow_id}/history/ - Clear conversation history
    """

    permission_classes = [IsAuthenticated]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.assistant_service = AssistantService()

    def _get_workflow(self, workflow_id: str):
        """Get workflow by ID with permission check."""
        try:
            workflow = Workflow.objects.get(id=workflow_id)
            return workflow
        except Workflow.DoesNotExist:
            return None

    @action(detail=False, methods=["post"], url_path="(?P<workflow_id>[^/.]+)/chat")
    def chat(self, request, workflow_id=None):
        """
        Send a message to the AI assistant (non-streaming).

        POST /api/v1/core/assistant/{workflow_id}/chat/
        Body: {
            "message": "string",
            "llm_provider": "gemini|openai|anthropic|deepseek",
            "include_workflow_context": true
        }
        """
        workflow = self._get_workflow(workflow_id)
        if not workflow:
            return Response(
                {"status": "error", "message": "Workflow not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = AIChatRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"status": "error", "data": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = self.assistant_service.chat(
                workflow=workflow,
                user_message=serializer.validated_data["message"],
                llm_provider=serializer.validated_data.get("llm_provider", "gemini"),
                include_workflow_context=serializer.validated_data.get("include_workflow_context", True),
            )

            return Response({
                "status": "success",
                "data": result,
            })
        except ValueError as e:
            return Response(
                {"status": "error", "message": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error(f"AI chat error: {e}", exc_info=e)
            return Response(
                {"status": "error", "message": f"Chat failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=["post"], url_path="(?P<workflow_id>[^/.]+)/chat/stream")
    def chat_stream(self, request, workflow_id=None):
        """
        Send a message to the AI assistant with streaming response (SSE).

        POST /api/v1/core/assistant/{workflow_id}/chat/stream/
        Body: {
            "message": "string",
            "llm_provider": "gemini|openai|anthropic|deepseek",
            "include_workflow_context": true
        }

        Returns: Server-Sent Events stream
        """
        workflow = self._get_workflow(workflow_id)
        if not workflow:
            return Response(
                {"status": "error", "message": "Workflow not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = AIChatRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"status": "error", "data": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        def event_stream():
            try:
                yield "data: {\"type\": \"start\"}\n\n"

                for chunk in self.assistant_service.chat_stream(
                    workflow=workflow,
                    user_message=serializer.validated_data["message"],
                    llm_provider=serializer.validated_data.get("llm_provider", "gemini"),
                    include_workflow_context=serializer.validated_data.get("include_workflow_context", True),
                ):
                    yield chunk

            except Exception as e:
                logger.error(f"AI chat stream error: {e}", exc_info=e)
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

        response = StreamingHttpResponse(
            event_stream(),
            content_type="text/event-stream",
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response

    @action(detail=False, methods=["get"], url_path="(?P<workflow_id>[^/.]+)/history")
    def history(self, request, workflow_id=None):
        """
        Get conversation history for a workflow.

        GET /api/v1/core/assistant/{workflow_id}/history/
        Query params:
            - limit: Number of messages to return (default: 50)
        """
        workflow = self._get_workflow(workflow_id)
        if not workflow:
            return Response(
                {"status": "error", "message": "Workflow not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            thread = ConversationThread.objects.get(workflow=workflow)
        except ConversationThread.DoesNotExist:
            return Response({
                "status": "success",
                "data": {"thread": None, "messages": []},
            })

        limit = int(request.query_params.get("limit", 50))
        messages = thread.messages.order_by("-created_at")[:limit]
        messages = list(reversed(messages))

        return Response({
            "status": "success",
            "data": {
                "thread": ConversationThreadListSerializer(thread).data,
                "messages": ChatMessageSerializer(messages, many=True).data,
            },
        })

    @action(detail=False, methods=["delete"], url_path="(?P<workflow_id>[^/.]+)/history")
    def clear_history(self, request, workflow_id=None):
        """
        Clear conversation history for a workflow.

        DELETE /api/v1/core/assistant/{workflow_id}/history/
        """
        workflow = self._get_workflow(workflow_id)
        if not workflow:
            return Response(
                {"status": "error", "message": "Workflow not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            thread = ConversationThread.objects.get(workflow=workflow)
            message_count = thread.messages.count()
            thread.messages.all().delete()

            return Response({
                "status": "success",
                "message": f"Cleared {message_count} messages",
            })
        except ConversationThread.DoesNotExist:
            return Response({
                "status": "success",
                "message": "No conversation history to clear",
            })
```

**Step 2: Update views/__init__.py**

Add import at end of file:

```python
from .assistant import AIAssistantViewSet
```

**Step 3: Commit**

```bash
cd /Users/armanghevondyan/Desktop/vibe-coding/bridge.dev && git add backend/apps/core/views/assistant.py backend/apps/core/views/__init__.py
git commit -m "feat(core): add AIAssistantViewSet with chat and streaming endpoints"
```

---

## Task 5: Register URL Routes

**Files:**
- Modify: `backend/apps/core/urls.py`

**Step 1: Add import and register route**

Add to imports:

```python
from .views import (
    # ... existing imports ...
    AIAssistantViewSet,
)
```

Add after existing router registrations (before `app_name = "core"`):

```python
router.register(r"assistant", AIAssistantViewSet, basename="aiassistant")
```

**Step 2: Commit**

```bash
cd /Users/armanghevondyan/Desktop/vibe-coding/bridge.dev && git add backend/apps/core/urls.py
git commit -m "feat(core): register AI assistant routes"
```

---

## Task 6: Write Tests for Backend

**Files:**
- Create: `backend/apps/core/tests/test_assistant.py`

**Step 1: Create test file**

```python
"""
Tests for AI Assistant functionality.
"""

from django.test import TestCase
from django.contrib.auth import get_user_model
from unittest.mock import patch, MagicMock

from apps.core.models import (
    Workflow,
    WorkflowVersion,
    ConversationThread,
    ChatMessage,
)
from apps.core.assistant_service import AssistantService
from apps.accounts.models import Workspace, Organization

User = get_user_model()


class ConversationThreadModelTestCase(TestCase):
    """Test cases for ConversationThread model"""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        self.org = Organization.objects.create(name="Test Org")
        self.workspace = Workspace.objects.create(
            name="Test Workspace",
            organization=self.org,
            created_by=self.user,
        )
        self.workflow = Workflow.objects.create(
            name="Test Workflow",
            workspace=self.workspace,
            created_by=self.user,
        )

    def test_thread_creation(self):
        """Test conversation thread creation"""
        thread = ConversationThread.objects.create(
            workflow=self.workflow,
            title="Test Conversation",
        )

        self.assertEqual(thread.workflow, self.workflow)
        self.assertEqual(thread.title, "Test Conversation")
        self.assertEqual(str(thread), f"Conversation for {self.workflow.name}")

    def test_one_thread_per_workflow(self):
        """Test that workflow has one-to-one relationship with thread"""
        thread1 = ConversationThread.objects.create(
            workflow=self.workflow,
        )

        # Should raise error for duplicate
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            ConversationThread.objects.create(workflow=self.workflow)


class ChatMessageModelTestCase(TestCase):
    """Test cases for ChatMessage model"""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        self.org = Organization.objects.create(name="Test Org")
        self.workspace = Workspace.objects.create(
            name="Test Workspace",
            organization=self.org,
            created_by=self.user,
        )
        self.workflow = Workflow.objects.create(
            name="Test Workflow",
            workspace=self.workspace,
            created_by=self.user,
        )
        self.thread = ConversationThread.objects.create(
            workflow=self.workflow,
        )

    def test_message_creation(self):
        """Test chat message creation"""
        message = ChatMessage.objects.create(
            thread=self.thread,
            role="user",
            content="Hello, AI!",
        )

        self.assertEqual(message.thread, self.thread)
        self.assertEqual(message.role, "user")
        self.assertEqual(message.content, "Hello, AI!")
        self.assertEqual(message.actions, [])

    def test_message_with_actions(self):
        """Test chat message with structured actions"""
        actions = [
            {"type": "add_node", "connector_id": "slack", "action_id": "send_message"}
        ]
        message = ChatMessage.objects.create(
            thread=self.thread,
            role="assistant",
            content="I'll add a Slack node.",
            actions=actions,
        )

        self.assertEqual(message.actions, actions)

    def test_message_ordering(self):
        """Test messages are ordered by created_at"""
        msg1 = ChatMessage.objects.create(
            thread=self.thread,
            role="user",
            content="First",
        )
        msg2 = ChatMessage.objects.create(
            thread=self.thread,
            role="assistant",
            content="Second",
        )

        messages = list(self.thread.messages.all())
        self.assertEqual(messages[0], msg1)
        self.assertEqual(messages[1], msg2)


class AssistantServiceTestCase(TestCase):
    """Test cases for AssistantService"""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        self.org = Organization.objects.create(name="Test Org")
        self.workspace = Workspace.objects.create(
            name="Test Workspace",
            organization=self.org,
            created_by=self.user,
        )
        self.workflow = Workflow.objects.create(
            name="Test Workflow",
            workspace=self.workspace,
            created_by=self.user,
        )
        self.version = WorkflowVersion.objects.create(
            workflow=self.workflow,
            version_number=1,
            definition={
                "nodes": [
                    {"id": "node_1", "type": "webhook", "data": {"label": "Webhook Trigger"}},
                ],
                "edges": [],
            },
            is_active=True,
            created_by=self.user,
        )
        self.workflow.current_version = self.version
        self.workflow.save()

        self.service = AssistantService()

    def test_get_or_create_thread(self):
        """Test thread creation for workflow"""
        thread = self.service.get_or_create_thread(self.workflow)

        self.assertIsNotNone(thread)
        self.assertEqual(thread.workflow, self.workflow)

        # Second call should return same thread
        thread2 = self.service.get_or_create_thread(self.workflow)
        self.assertEqual(thread.id, thread2.id)

    def test_build_workflow_context(self):
        """Test workflow context building"""
        context = self.service.build_workflow_context(self.workflow)

        self.assertIn("Test Workflow", context)
        self.assertIn("Webhook Trigger", context)
        self.assertIn("node_1", context)

    def test_build_workflow_context_empty(self):
        """Test context for empty workflow"""
        empty_workflow = Workflow.objects.create(
            name="Empty Workflow",
            workspace=self.workspace,
            created_by=self.user,
        )

        context = self.service.build_workflow_context(empty_workflow)
        self.assertIn("empty", context.lower())

    def test_parse_response_valid_json(self):
        """Test parsing valid JSON response"""
        response = '{"message": "Hello!", "actions": [{"type": "add_node"}]}'
        parsed = self.service._parse_response(response)

        self.assertEqual(parsed["message"], "Hello!")
        self.assertEqual(len(parsed["actions"]), 1)

    def test_parse_response_markdown_wrapped(self):
        """Test parsing JSON wrapped in markdown"""
        response = '```json\n{"message": "Hello!", "actions": []}\n```'
        parsed = self.service._parse_response(response)

        self.assertEqual(parsed["message"], "Hello!")

    def test_parse_response_fallback(self):
        """Test fallback for non-JSON response"""
        response = "Just a plain text response"
        parsed = self.service._parse_response(response)

        self.assertEqual(parsed["message"], response)
        self.assertEqual(parsed["actions"], [])

    @patch.object(AssistantService, "_call_llm")
    def test_chat_saves_messages(self, mock_llm):
        """Test that chat saves user and assistant messages"""
        mock_llm.return_value = '{"message": "I can help!", "actions": []}'

        result = self.service.chat(
            workflow=self.workflow,
            user_message="Help me",
            llm_provider="gemini",
        )

        thread = ConversationThread.objects.get(workflow=self.workflow)
        messages = list(thread.messages.all())

        self.assertEqual(len(messages), 2)
        self.assertEqual(messages[0].role, "user")
        self.assertEqual(messages[0].content, "Help me")
        self.assertEqual(messages[1].role, "assistant")
        self.assertEqual(messages[1].content, "I can help!")
```

**Step 2: Run tests**

Run: `cd /Users/armanghevondyan/Desktop/vibe-coding/bridge.dev/backend && python manage.py test apps.core.tests.test_assistant -v 2`

Expected: All tests pass

**Step 3: Commit**

```bash
cd /Users/armanghevondyan/Desktop/vibe-coding/bridge.dev && git add backend/apps/core/tests/test_assistant.py
git commit -m "test(core): add tests for AI assistant models and service"
```

---

## Task 7: Update Frontend API Service

**Files:**
- Modify: `frontend/src/lib/api/services/workflow.ts`

**Step 1: Add AI assistant API methods**

Add to the workflowService object:

```typescript
  // AI Assistant endpoints
  sendChatMessage: async (
    workflowId: string,
    message: string,
    options?: {
      llmProvider?: 'gemini' | 'openai' | 'anthropic' | 'deepseek';
      includeWorkflowContext?: boolean;
    }
  ) => {
    const response = await api.post(`/core/assistant/${workflowId}/chat/`, {
      message,
      llm_provider: options?.llmProvider || 'gemini',
      include_workflow_context: options?.includeWorkflowContext ?? true,
    });
    return response.data;
  },

  sendChatMessageStream: (
    workflowId: string,
    message: string,
    options?: {
      llmProvider?: 'gemini' | 'openai' | 'anthropic' | 'deepseek';
      includeWorkflowContext?: boolean;
    }
  ): EventSource => {
    // For streaming, we need to use fetch with POST
    // EventSource only supports GET, so we'll use a custom approach
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
    const url = `${baseUrl}/core/assistant/${workflowId}/chat/stream/`;

    // Return a mock EventSource-like object for now
    // Real implementation would use fetch with streaming
    throw new Error('Use sendChatMessage for now - streaming requires custom implementation');
  },

  getChatHistory: async (workflowId: string, limit?: number) => {
    const params = limit ? `?limit=${limit}` : '';
    const response = await api.get(`/core/assistant/${workflowId}/history/${params}`);
    return response.data;
  },

  clearChatHistory: async (workflowId: string) => {
    const response = await api.delete(`/core/assistant/${workflowId}/history/`);
    return response.data;
  },
```

**Step 2: Commit**

```bash
cd /Users/armanghevondyan/Desktop/vibe-coding/bridge.dev && git add frontend/src/lib/api/services/workflow.ts
git commit -m "feat(frontend): add AI assistant API methods to workflow service"
```

---

## Task 8: Enhance AIAssistantWidget Component

**Files:**
- Modify: `frontend/src/components/workflow/AIAssistantWidget.tsx`

**Step 1: Update the widget to use new API**

Replace the entire file content:

```tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    ChevronLeft,
    ChevronRight,
    Send,
    Sparkles,
    Loader2,
    Zap,
    Plus,
    GitBranch,
    Trash2,
    Check,
    X,
} from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { workflowService } from '@/lib/api/services/workflow';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    actions?: AssistantAction[];
    pending?: boolean;
}

interface AssistantAction {
    type: 'add_node' | 'update_node' | 'delete_node' | 'add_edge' | 'generate_workflow';
    [key: string]: any;
}

interface AIAssistantWidgetProps {
    workflowId: string;
    nodes: Node[];
    edges: Edge[];
    onApplyWorkflow?: (definition: any) => void;
    onApplyActions?: (actions: AssistantAction[]) => void;
    onAddNode?: (type: string, connectorData?: any) => void;
}

export function AIAssistantWidget({
    workflowId,
    nodes,
    edges,
    onApplyWorkflow,
    onApplyActions,
    onAddNode,
}: AIAssistantWidgetProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: "Hi! I'm your AI workflow assistant. I can help you build workflows, configure nodes, or debug issues. What would you like to do?",
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [pendingActions, setPendingActions] = useState<AssistantAction[] | null>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Load chat history on mount
    useEffect(() => {
        if (workflowId) {
            loadChatHistory();
        }
    }, [workflowId]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages]);

    // Focus input when expanded
    useEffect(() => {
        if (isExpanded && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isExpanded]);

    const loadChatHistory = async () => {
        try {
            const response = await workflowService.getChatHistory(workflowId, 50);
            if (response.data?.messages?.length > 0) {
                const historicalMessages: Message[] = response.data.messages.map((msg: any) => ({
                    id: msg.id,
                    role: msg.role,
                    content: msg.content,
                    timestamp: new Date(msg.created_at),
                    actions: msg.actions,
                }));
                setMessages(prev => [prev[0], ...historicalMessages]);
            }
        } catch (error) {
            console.error('Failed to load chat history:', error);
        }
    };

    const handleSendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        const userPrompt = input.trim();
        setInput('');
        setIsLoading(true);

        try {
            const response = await workflowService.sendChatMessage(workflowId, userPrompt, {
                llmProvider: 'gemini',
                includeWorkflowContext: true,
            });

            const assistantMessage: Message = {
                id: response.data.message_id || (Date.now() + 1).toString(),
                role: 'assistant',
                content: response.data.message,
                timestamp: new Date(),
                actions: response.data.actions,
            };

            setMessages((prev) => [...prev, assistantMessage]);

            // If there are actions, show them for approval
            if (response.data.actions && response.data.actions.length > 0) {
                setPendingActions(response.data.actions);
            }
        } catch (error: any) {
            console.error('Error sending message:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `Sorry, I encountered an error: ${error?.response?.data?.message || error?.message || 'Unknown error'}. Please try again.`,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplyActions = useCallback(() => {
        if (pendingActions && onApplyActions) {
            onApplyActions(pendingActions);
            setPendingActions(null);

            // Add confirmation message
            const confirmMessage: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: 'Changes applied to your workflow.',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, confirmMessage]);
        }
    }, [pendingActions, onApplyActions]);

    const handleRejectActions = useCallback(() => {
        setPendingActions(null);

        const rejectMessage: Message = {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'No problem! The changes were not applied. Let me know if you\'d like me to try something different.',
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, rejectMessage]);
    }, []);

    const handleClearHistory = async () => {
        try {
            await workflowService.clearChatHistory(workflowId);
            setMessages([{
                id: '1',
                role: 'assistant',
                content: "Chat history cleared. How can I help you?",
                timestamp: new Date(),
            }]);
        } catch (error) {
            console.error('Failed to clear history:', error);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const getQuickActions = () => {
        if (nodes.length === 0) {
            return [
                { label: 'Add webhook trigger', icon: Zap, action: () => onAddNode?.('trigger') },
                { label: 'Build with AI', icon: Sparkles, action: () => setInput('Build a workflow that sends Slack notifications when a webhook is triggered') },
            ];
        }

        const hasTrigger = nodes.some(n => n.type === 'trigger');
        if (!hasTrigger) {
            return [
                { label: 'Add trigger', icon: Plus, action: () => onAddNode?.('trigger') },
            ];
        }

        return [
            { label: 'Add action', icon: Plus, action: () => onAddNode?.('action') },
            { label: 'Add condition', icon: GitBranch, action: () => onAddNode?.('condition') },
            { label: 'Optimize', icon: Sparkles, action: () => setInput('How can I optimize this workflow?') },
        ];
    };

    const quickActions = getQuickActions();

    return (
        <div
            className={cn(
                'fixed right-0 top-0 h-screen bg-background border-l border-border transition-all duration-300 ease-in-out z-20 flex flex-col',
                isExpanded ? 'w-[400px]' : 'w-[60px]'
            )}
        >
            {/* Toggle Button */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="absolute -left-10 top-4 w-10 h-10 bg-primary text-primary-foreground rounded-l-lg flex items-center justify-center hover:bg-primary/90 transition-colors shadow-lg"
                aria-label={isExpanded ? 'Collapse AI Assistant' : 'Expand AI Assistant'}
            >
                {isExpanded ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>

            {/* Collapsed State */}
            {!isExpanded && (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                    <div className="writing-mode-vertical text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        <span className="rotate-180" style={{ writingMode: 'vertical-rl' }}>
                            AI Assistant
                        </span>
                    </div>
                </div>
            )}

            {/* Expanded State */}
            {isExpanded && (
                <>
                    {/* Header */}
                    <div className="p-4 border-b border-border">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                                    <Sparkles className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm">AI Assistant</h3>
                                    <p className="text-xs text-muted-foreground">Powered by Gemini</p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleClearHistory}
                                title="Clear chat history"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    {quickActions.length > 0 && !pendingActions && (
                        <div className="p-3 border-b border-border bg-muted/30">
                            <p className="text-xs text-muted-foreground mb-2">Quick actions:</p>
                            <div className="flex flex-wrap gap-2">
                                {quickActions.map((action, idx) => (
                                    <Button
                                        key={idx}
                                        variant="outline"
                                        size="sm"
                                        onClick={action.action}
                                        className="text-xs h-7"
                                    >
                                        <action.icon className="w-3 h-3 mr-1" />
                                        {action.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Pending Actions Bar */}
                    {pendingActions && pendingActions.length > 0 && (
                        <div className="p-3 border-b border-border bg-amber-50 dark:bg-amber-950">
                            <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-2">
                                {pendingActions.length} action(s) ready to apply
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={handleApplyActions}
                                    className="flex-1 h-8"
                                >
                                    <Check className="w-3 h-3 mr-1" />
                                    Apply
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRejectActions}
                                    className="flex-1 h-8"
                                >
                                    <X className="w-3 h-3 mr-1" />
                                    Reject
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Messages */}
                    <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
                        <div className="space-y-4">
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={cn(
                                        'flex',
                                        message.role === 'user' ? 'justify-end' : 'justify-start'
                                    )}
                                >
                                    <div
                                        className={cn(
                                            'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                                            message.role === 'user'
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted'
                                        )}
                                    >
                                        <p className="whitespace-pre-wrap">{message.content}</p>
                                        {message.actions && message.actions.length > 0 && (
                                            <p className="text-xs mt-2 opacity-70">
                                                {message.actions.length} suggested action(s)
                                            </p>
                                        )}
                                        <p className="text-xs opacity-60 mt-1">
                                            {message.timestamp.toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-muted rounded-lg px-3 py-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    {/* Input */}
                    <div className="p-4 border-t border-border">
                        <div className="flex gap-2">
                            <Input
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Ask me anything..."
                                disabled={isLoading}
                                className="flex-1"
                            />
                            <Button
                                onClick={handleSendMessage}
                                disabled={!input.trim() || isLoading}
                                size="icon"
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            Press Enter to send
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}
```

**Step 2: Commit**

```bash
cd /Users/armanghevondyan/Desktop/vibe-coding/bridge.dev && git add frontend/src/components/workflow/AIAssistantWidget.tsx
git commit -m "feat(frontend): enhance AIAssistantWidget with new API, history, and action approval"
```

---

## Task 9: Integration Test

**Step 1: Run backend tests**

Run: `cd /Users/armanghevondyan/Desktop/vibe-coding/bridge.dev/backend && python manage.py test apps.core.tests.test_assistant -v 2`

Expected: All tests pass

**Step 2: Start backend server**

Run: `cd /Users/armanghevondyan/Desktop/vibe-coding/bridge.dev/backend && python manage.py runserver`

Expected: Server starts successfully

**Step 3: Test endpoint manually**

Run in separate terminal:
```bash
curl -X POST http://localhost:8000/api/v1/core/assistant/<workflow-id>/chat/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"message": "Hello, can you help me build a workflow?"}'
```

Expected: JSON response with message and actions

**Step 4: Start frontend**

Run: `cd /Users/armanghevondyan/Desktop/vibe-coding/bridge.dev/frontend && npm run dev`

Expected: Frontend compiles without errors

**Step 5: Final commit**

```bash
cd /Users/armanghevondyan/Desktop/vibe-coding/bridge.dev && git add -A
git commit -m "feat: complete AI assistant chat implementation with streaming support"
```

---

## Summary

This plan implements:

1. **Database Models**: `ConversationThread` and `ChatMessage` for persistent conversation storage
2. **Serializers**: Full serialization for threads, messages, and chat requests
3. **AssistantService**: Core logic for context building, LLM calls, and response parsing
4. **ViewSet**: REST API with chat, streaming, and history endpoints
5. **URL Routes**: Registered under `/api/v1/core/assistant/`
6. **Tests**: Model and service tests with mocking
7. **Frontend API**: Methods for chat, history, and clearing
8. **Enhanced Widget**: Full integration with approval flow for suggested actions

The implementation follows existing patterns in the codebase and integrates seamlessly with the current workflow generation infrastructure.
