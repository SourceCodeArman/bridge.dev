"""
Tests for workflow templates.
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.core.models import WorkflowTemplate, Workflow
from apps.accounts.models import Workspace
from apps.core.utils.template_cloner import TemplateCloner

User = get_user_model()


class WorkflowTemplateTestCase(TestCase):
    """Test cases for WorkflowTemplate model"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )
        self.workspace = Workspace.objects.create(
            name='Test Workspace',
            created_by=self.user
        )
        self.template = WorkflowTemplate.objects.create(
            name='Test Template',
            description='Test description',
            category='webhook',
            definition={
                'nodes': [
                    {
                        'id': 'node_1',
                        'type': 'webhook',
                        'data': {
                            'action_id': 'receive',
                            'api_key': '{{credential.api_key}}'
                        }
                    }
                ],
                'edges': []
            },
            is_public=True,
            created_by=self.user
        )
    
    def test_template_creation(self):
        """Test template creation"""
        self.assertEqual(self.template.name, 'Test Template')
        self.assertEqual(self.template.category, 'webhook')
        self.assertTrue(self.template.is_public)
        self.assertEqual(self.template.usage_count, 0)
    
    def test_increment_usage(self):
        """Test usage count increment"""
        initial_count = self.template.usage_count
        self.template.increment_usage()
        self.assertEqual(self.template.usage_count, initial_count + 1)


class TemplateClonerTestCase(TestCase):
    """Test cases for TemplateCloner"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )
        self.workspace = Workspace.objects.create(
            name='Test Workspace',
            created_by=self.user
        )
        self.template = WorkflowTemplate.objects.create(
            name='Test Template',
            description='Test description',
            category='webhook',
            definition={
                'nodes': [
                    {
                        'id': 'node_1',
                        'type': 'webhook',
                        'data': {
                            'action_id': 'receive',
                            'api_key': '{{credential.api_key}}',
                            'token': '{{credential.token}}'
                        }
                    }
                ],
                'edges': []
            },
            is_public=True,
            created_by=self.user
        )
        self.cloner = TemplateCloner()
    
    def test_clone_template(self):
        """Test cloning a template"""
        workflow = self.cloner.clone_template(
            template=self.template,
            workspace=self.workspace,
            user=self.user
        )
        
        self.assertIsInstance(workflow, Workflow)
        self.assertEqual(workflow.name, self.template.name)
        self.assertEqual(workflow.workspace, self.workspace)
        self.assertEqual(workflow.status, 'draft')
        
        # Check that draft version was created
        version = workflow.versions.first()
        self.assertIsNotNone(version)
        self.assertFalse(version.is_active)
        
        # Check that usage count was incremented
        self.template.refresh_from_db()
        self.assertEqual(self.template.usage_count, 1)
    
    def test_replace_placeholders(self):
        """Test credential placeholder replacement"""
        data = {
            'api_key': '{{credential.api_key}}',
            'token': '{{credential.token}}',
            'normal_field': 'value'
        }
        result = self.cloner._replace_placeholders(data)
        
        self.assertIn('[Please configure api_key]', result['api_key'])
        self.assertIn('[Please configure token]', result['token'])
        self.assertEqual(result['normal_field'], 'value')
    
    def test_clone_with_custom_name(self):
        """Test cloning with custom workflow name"""
        custom_name = 'My Custom Workflow'
        workflow = self.cloner.clone_template(
            template=self.template,
            workspace=self.workspace,
            user=self.user,
            workflow_name=custom_name
        )
        
        self.assertEqual(workflow.name, custom_name)


