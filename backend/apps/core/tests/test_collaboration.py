"""
Tests for collaboration features (comments and presence).
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.core.models import WorkflowComment, WorkflowPresence, Workflow, WorkflowVersion
from apps.accounts.models import Workspace, Organization

User = get_user_model()


class WorkflowCommentTestCase(TestCase):
    """Test cases for WorkflowComment model"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )
        self.org = Organization.objects.create(name='Test Org')
        self.workspace = Workspace.objects.create(
            name='Test Workspace',
            organization=self.org,
            created_by=self.user
        )
        self.workflow = Workflow.objects.create(
            name='Test Workflow',
            workspace=self.workspace,
            created_by=self.user
        )
        self.workflow_version = WorkflowVersion.objects.create(
            workflow=self.workflow,
            version_number=1,
            definition={'nodes': [], 'edges': []},
            is_active=True,
            created_by=self.user
        )
    
    def test_comment_creation(self):
        """Test comment creation"""
        comment = WorkflowComment.objects.create(
            workflow_version=self.workflow_version,
            node_id='node_1',
            content='This is a test comment',
            created_by=self.user
        )
        
        self.assertEqual(comment.node_id, 'node_1')
        self.assertEqual(comment.content, 'This is a test comment')
        self.assertFalse(comment.is_resolved)
    
    def test_resolve_comment(self):
        """Test resolving a comment"""
        comment = WorkflowComment.objects.create(
            workflow_version=self.workflow_version,
            node_id='node_1',
            content='Test comment',
            created_by=self.user
        )
        
        self.assertFalse(comment.is_resolved)
        comment.resolve(self.user)
        
        self.assertTrue(comment.is_resolved)
        self.assertIsNotNone(comment.resolved_at)
        self.assertEqual(comment.resolved_by, self.user)
    
    def test_unresolve_comment(self):
        """Test unresolving a comment"""
        comment = WorkflowComment.objects.create(
            workflow_version=self.workflow_version,
            node_id='node_1',
            content='Test comment',
            created_by=self.user
        )
        
        comment.resolve(self.user)
        self.assertTrue(comment.is_resolved)
        
        comment.unresolve()
        self.assertFalse(comment.is_resolved)
        self.assertIsNone(comment.resolved_at)
        self.assertIsNone(comment.resolved_by)


class WorkflowPresenceTestCase(TestCase):
    """Test cases for WorkflowPresence model"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )
        self.org = Organization.objects.create(name='Test Org')
        self.workspace = Workspace.objects.create(
            name='Test Workspace',
            organization=self.org,
            created_by=self.user
        )
        self.workflow = Workflow.objects.create(
            name='Test Workflow',
            workspace=self.workspace,
            created_by=self.user
        )
        self.workflow_version = WorkflowVersion.objects.create(
            workflow=self.workflow,
            version_number=1,
            definition={'nodes': [], 'edges': []},
            is_active=True,
            created_by=self.user
        )
    
    def test_presence_creation(self):
        """Test presence creation"""
        presence = WorkflowPresence.objects.create(
            workflow_version=self.workflow_version,
            user=self.user,
            is_active=True
        )
        
        self.assertEqual(presence.user, self.user)
        self.assertTrue(presence.is_active)
    
    def test_update_presence(self):
        """Test updating presence"""
        presence = WorkflowPresence.objects.create(
            workflow_version=self.workflow_version,
            user=self.user,
            is_active=True
        )
        
        old_last_seen = presence.last_seen_at
        presence.update_presence(node_id='node_1')
        
        # last_seen_at should be updated
        presence.refresh_from_db()
        self.assertGreater(presence.last_seen_at, old_last_seen)
        self.assertEqual(presence.node_id, 'node_1')
        self.assertTrue(presence.is_active)
    
    def test_deactivate_presence(self):
        """Test deactivating presence"""
        presence = WorkflowPresence.objects.create(
            workflow_version=self.workflow_version,
            user=self.user,
            is_active=True
        )
        
        presence.deactivate()
        self.assertFalse(presence.is_active)


