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
        "include_workflow_context": true
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
        "include_workflow_context": true
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


class AIAssistantHistoryView(AIAssistantBaseView):
    """
    Get or clear conversation history.

    GET /api/v1/core/assistant/{workflow_id}/history/
    Query params:
        - limit: Number of messages to return (default: 50)

    DELETE /api/v1/core/assistant/{workflow_id}/history/
    """

    def get(self, request, workflow_id=None):
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
