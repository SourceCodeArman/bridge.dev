"""
Views for AI Assistant chat functionality.
"""

import json
from django.http import StreamingHttpResponse
from rest_framework.views import APIView
from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.common.logging_utils import get_logger
from ..models import Workflow, ConversationThread, ChatMessage
from ..serializers import (
    ConversationThreadSerializer,
    ConversationThreadListSerializer,
    ChatMessageSerializer,
    AIChatRequestSerializer,
    CreateThreadSerializer,
)
from ..assistant_service import AssistantService

logger = get_logger(__name__)


class AIAssistantBaseView(APIView):
    """Base view for AI Assistant endpoints."""

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


class AIAssistantChatView(AIAssistantBaseView):
    """
    Handle non-streaming chat messages.

    POST /api/v1/core/assistant/{workflow_id}/chat/
    Body: {
        "message": "string",
        "llm_provider": "gemini|openai|anthropic|deepseek",
        "include_workflow_context": true,
        "thread_id": "optional-uuid"
    }
    """

    def post(self, request, workflow_id=None):
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
                thread_id=serializer.validated_data.get("thread_id"),
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


class AIAssistantChatStreamView(AIAssistantBaseView):
    """
    Handle streaming chat messages with Server-Sent Events.

    POST /api/v1/core/assistant/{workflow_id}/chat/stream/
    Body: {
        "message": "string",
        "llm_provider": "gemini|openai|anthropic|deepseek",
        "include_workflow_context": true,
        "thread_id": "optional-uuid"
    }

    Returns: Server-Sent Events stream
    """

    def post(self, request, workflow_id=None):
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

        thread_id = serializer.validated_data.get("thread_id")

        def event_stream():
            try:
                yield "data: {\"type\": \"start\"}\n\n"

                for chunk in self.assistant_service.chat_stream(
                    workflow=workflow,
                    user_message=serializer.validated_data["message"],
                    llm_provider=serializer.validated_data.get("llm_provider", "gemini"),
                    include_workflow_context=serializer.validated_data.get("include_workflow_context", True),
                    thread_id=thread_id,
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


class AIAssistantHistoryView(AIAssistantBaseView):
    """
    Get or clear conversation history for a specific thread.

    GET /api/v1/core/assistant/{workflow_id}/history/
    Query params:
        - limit: Number of messages to return (default: 50)
        - thread_id: Optional thread ID (defaults to active thread)

    DELETE /api/v1/core/assistant/{workflow_id}/history/
    Query params:
        - thread_id: Optional thread ID (defaults to active thread)
    """

    def get(self, request, workflow_id=None):
        workflow = self._get_workflow(workflow_id)
        if not workflow:
            return Response(
                {"status": "error", "message": "Workflow not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        thread_id = request.query_params.get("thread_id")

        try:
            if thread_id:
                thread = ConversationThread.objects.get(id=thread_id, workflow=workflow)
            else:
                thread = ConversationThread.objects.filter(
                    workflow=workflow, is_active=True
                ).first()

            if not thread:
                return Response({
                    "status": "success",
                    "data": {"thread": None, "messages": [], "total": 0},
                })
        except ConversationThread.DoesNotExist:
            return Response({
                "status": "success",
                "data": {"thread": None, "messages": [], "total": 0},
            })

        limit = int(request.query_params.get("limit", 50))
        offset = int(request.query_params.get("offset", 0))

        messages = thread.messages.order_by("-created_at")[offset:offset + limit]
        messages = list(reversed(messages))

        return Response({
            "status": "success",
            "data": {
                "thread": ConversationThreadListSerializer(thread).data,
                "messages": ChatMessageSerializer(messages, many=True).data,
                "total": thread.messages.count(),
            },
        })

    def delete(self, request, workflow_id=None):
        workflow = self._get_workflow(workflow_id)
        if not workflow:
            return Response(
                {"status": "error", "message": "Workflow not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        thread_id = request.query_params.get("thread_id")

        try:
            if thread_id:
                thread = ConversationThread.objects.get(id=thread_id, workflow=workflow)
            else:
                thread = ConversationThread.objects.filter(
                    workflow=workflow, is_active=True
                ).first()

            if not thread:
                return Response({
                    "status": "success",
                    "message": "No conversation history to clear",
                })

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


class AIAssistantThreadsView(AIAssistantBaseView):
    """
    Manage conversation threads for a workflow.

    GET /api/v1/core/assistant/{workflow_id}/threads/
    Returns list of all threads for the workflow.

    POST /api/v1/core/assistant/{workflow_id}/threads/
    Body: { "title": "optional title" }
    Creates a new thread and sets it as active.
    """

    def get(self, request, workflow_id=None):
        workflow = self._get_workflow(workflow_id)
        if not workflow:
            return Response(
                {"status": "error", "message": "Workflow not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        threads = self.assistant_service.list_threads(workflow)

        return Response({
            "status": "success",
            "data": {
                "threads": ConversationThreadListSerializer(threads, many=True).data,
                "total": len(threads),
            },
        })

    def post(self, request, workflow_id=None):
        workflow = self._get_workflow(workflow_id)
        if not workflow:
            return Response(
                {"status": "error", "message": "Workflow not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = CreateThreadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"status": "error", "data": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        thread = self.assistant_service.create_new_thread(
            workflow=workflow,
            title=serializer.validated_data.get("title"),
        )

        return Response({
            "status": "success",
            "data": {
                "thread": ConversationThreadSerializer(thread).data,
            },
        }, status=status.HTTP_201_CREATED)


class AIAssistantThreadDetailView(AIAssistantBaseView):
    """
    Manage a specific conversation thread.

    GET /api/v1/core/assistant/{workflow_id}/threads/{thread_id}/
    Returns thread details with message count.

    PATCH /api/v1/core/assistant/{workflow_id}/threads/{thread_id}/
    Body: { "is_active": true } or { "title": "new title" }
    Updates thread (e.g., switch to this thread).

    DELETE /api/v1/core/assistant/{workflow_id}/threads/{thread_id}/
    Deletes the thread and all its messages.
    """

    def get(self, request, workflow_id=None, thread_id=None):
        workflow = self._get_workflow(workflow_id)
        if not workflow:
            return Response(
                {"status": "error", "message": "Workflow not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            thread = ConversationThread.objects.get(id=thread_id, workflow=workflow)
        except ConversationThread.DoesNotExist:
            return Response(
                {"status": "error", "message": "Thread not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response({
            "status": "success",
            "data": {
                "thread": ConversationThreadSerializer(thread).data,
                "message_count": thread.messages.count(),
            },
        })

    def patch(self, request, workflow_id=None, thread_id=None):
        workflow = self._get_workflow(workflow_id)
        if not workflow:
            return Response(
                {"status": "error", "message": "Workflow not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            thread = ConversationThread.objects.get(id=thread_id, workflow=workflow)
        except ConversationThread.DoesNotExist:
            return Response(
                {"status": "error", "message": "Thread not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Update title if provided
        if "title" in request.data:
            thread.title = request.data["title"]

        # Switch to this thread if is_active is true
        if request.data.get("is_active"):
            thread.is_active = True

        thread.save()

        return Response({
            "status": "success",
            "data": {
                "thread": ConversationThreadSerializer(thread).data,
            },
        })

    def delete(self, request, workflow_id=None, thread_id=None):
        workflow = self._get_workflow(workflow_id)
        if not workflow:
            return Response(
                {"status": "error", "message": "Workflow not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            thread = ConversationThread.objects.get(id=thread_id, workflow=workflow)
        except ConversationThread.DoesNotExist:
            return Response(
                {"status": "error", "message": "Thread not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        was_active = thread.is_active
        thread.delete()

        # If deleted thread was active, activate the most recent remaining thread
        if was_active:
            remaining_thread = ConversationThread.objects.filter(
                workflow=workflow
            ).order_by("-updated_at").first()
            if remaining_thread:
                remaining_thread.is_active = True
                remaining_thread.save()

        return Response({
            "status": "success",
            "message": "Thread deleted successfully",
        })
