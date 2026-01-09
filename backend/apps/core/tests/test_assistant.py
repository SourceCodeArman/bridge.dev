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
