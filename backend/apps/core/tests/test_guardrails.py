"""
Tests for LLM guardrails (secret redaction and prompt sanitization).
"""
from django.test import TestCase
from apps.core.guardrails.secret_redactor import SecretRedactor
from apps.core.guardrails.prompt_sanitizer import PromptSanitizer


class SecretRedactorTestCase(TestCase):
    """Test cases for SecretRedactor"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.redactor = SecretRedactor()
    
    def test_redact_api_key_in_string(self):
        """Test redaction of API key in string"""
        text = "api_key: fake_test_key_1234567890abcdefghijklmnopqrstuvwxyz"
        result = self.redactor.redact_string(text)
        self.assertIn("***REDACTED***", result)
        self.assertNotIn("fake_test_key_1234567890abcdefghijklmnopqrstuvwxyz", result)
    
    def test_redact_password_in_string(self):
        """Test redaction of password in string"""
        text = "password: mySecretPassword123"
        result = self.redactor.redact_string(text)
        self.assertIn("***REDACTED***", result)
        self.assertNotIn("mySecretPassword123", result)
    
    def test_redact_dict_with_secret_fields(self):
        """Test redaction of dictionary with secret field names"""
        data = {
            'name': 'test',
            'api_key': 'fake_test_key_1234567890abcdefghijklmnopqrstuvwxyz',
            'password': 'secret123',
            'normal_field': 'value'
        }
        result = self.redactor.redact_dict(data, redact_field_names=True)
        self.assertEqual(result['name'], 'test')
        self.assertEqual(result['normal_field'], 'value')
        self.assertEqual(result['api_key'], '***REDACTED***')
        self.assertEqual(result['password'], '***REDACTED***')
    
    def test_redact_nested_dict(self):
        """Test redaction of nested dictionary structures"""
        data = {
            'config': {
                'api_key': 'fake_test_key_1234567890abcdefghijklmnopqrstuvwxyz',
                'nested': {
                    'token': 'bearer_token_1234567890abcdefghijklmnopqrstuvwxyz'
                }
            }
        }
        result = self.redactor.redact_dict(data, redact_field_names=True)
        self.assertEqual(result['config']['api_key'], '***REDACTED***')
        self.assertEqual(result['config']['nested']['token'], '***REDACTED***')
    
    def test_redact_list(self):
        """Test redaction of list containing secrets"""
        data = [
            {'api_key': 'sk_test_fake1234567890abcdefghijklmnopqrstuvwxyz'},
            {'password': 'secret123'},
            {'normal': 'value'}
        ]
        result = self.redactor.redact_list(data, redact_field_names=True)
        self.assertEqual(result[0]['api_key'], '***REDACTED***')
        self.assertEqual(result[1]['password'], '***REDACTED***')
        self.assertEqual(result[2]['normal'], 'value')
    
    def test_redact_credentials(self):
        """Test redaction of credential data"""
        data = {
            'api_key': 'fake_test_key_1234567890abcdefghijklmnopqrstuvwxyz',
            'token': 'bearer_token_1234567890abcdefghijklmnopqrstuvwxyz',
            'name': 'test_credential'
        }
        result = self.redactor.redact_credentials(data)
        self.assertEqual(result['api_key'], '***REDACTED***')
        self.assertEqual(result['token'], '***REDACTED***')
        self.assertEqual(result['name'], 'test_credential')


class PromptSanitizerTestCase(TestCase):
    """Test cases for PromptSanitizer"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.sanitizer = PromptSanitizer()
    
    def test_sanitize_prompt_with_secrets(self):
        """Test sanitization of prompt containing secrets"""
        prompt = "Generate text with api_key: sk_test_fake1234567890abcdefghijklmnopqrstuvwxyz"
        result = self.sanitizer.sanitize_prompt(prompt)
        self.assertIn("***REDACTED***", result)
        self.assertNotIn("fake_test_key_1234567890abcdefghijklmnopqrstuvwxyz", result)
    
    def test_apply_allowlist(self):
        """Test field allowlist enforcement"""
        data = {
            'id': 'test',
            'name': 'test_name',
            'api_key': 'fake_test_key_1234567890abcdefghijklmnopqrstuvwxyz',
            'secret_field': 'should_be_filtered',
            'prompt': 'test prompt'
        }
        result = self.sanitizer.sanitize_data(data, apply_allowlist=True, apply_redaction=False)
        # Allowed fields should be present
        self.assertIn('id', result)
        self.assertIn('name', result)
        self.assertIn('prompt', result)
        # Non-allowed fields should be filtered out
        self.assertNotIn('secret_field', result)
        # Secret fields should be redacted even if allowed
        if 'api_key' in result:
            self.assertEqual(result['api_key'], '***REDACTED***')
    
    def test_sanitize_connector_info(self):
        """Test sanitization of connector information"""
        connector_info = [
            {
                'id': 'openai',
                'name': 'OpenAI',
                'description': 'OpenAI connector',
                'api_key': 'fake_test_key_1234567890abcdefghijklmnopqrstuvwxyz',  # Should be removed
                'actions': [
                    {
                        'id': 'generate_text',
                        'name': 'Generate Text',
                        'description': 'Generate text',
                        'required_fields': ['prompt', 'model']
                    }
                ]
            }
        ]
        result = self.sanitizer.sanitize_connector_info(connector_info)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['id'], 'openai')
        self.assertNotIn('api_key', result[0])
        self.assertIn('actions', result[0])
    
    def test_sanitize_workflow_definition(self):
        """Test sanitization of workflow definition"""
        definition = {
            'nodes': [
                {
                    'id': 'node_1',
                    'type': 'openai',
                    'data': {
                        'action_id': 'generate_text',
                        'prompt': 'test',
                        'api_key': 'sk_test_fake1234567890abcdefghijklmnopqrstuvwxyz'  # Should be redacted
                    },
                    'position': {'x': 100, 'y': 100}
                }
            ],
            'edges': []
        }
        result = self.sanitizer.sanitize_workflow_definition(definition)
        self.assertIn('nodes', result)
        self.assertIn('edges', result)
        # Check that secrets are redacted
        node_data = result['nodes'][0]['data']
        if 'api_key' in node_data:
            self.assertEqual(node_data['api_key'], '***REDACTED***')
    
    def test_validate_prompt(self):
        """Test prompt validation"""
        # Valid prompt
        is_valid, error = self.sanitizer.validate_prompt("This is a valid prompt")
        self.assertTrue(is_valid)
        self.assertIsNone(error)
        
        # Empty prompt
        is_valid, error = self.sanitizer.validate_prompt("")
        self.assertFalse(is_valid)
        self.assertIsNotNone(error)
        
        # Too long prompt
        long_prompt = "x" * 100001
        is_valid, error = self.sanitizer.validate_prompt(long_prompt)
        self.assertFalse(is_valid)
        self.assertIsNotNone(error)
    
    def test_sanitize_for_logging(self):
        """Test sanitization specifically for logging"""
        data = {
            'api_key': 'fake_test_key_1234567890abcdefghijklmnopqrstuvwxyz',
            'normal_field': 'value'
        }
        result = self.sanitizer.sanitize_for_logging(data)
        self.assertEqual(result['api_key'], '***REDACTED***')
        self.assertEqual(result['normal_field'], 'value')


