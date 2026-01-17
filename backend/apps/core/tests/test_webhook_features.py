import base64
import uuid
from unittest.mock import patch

from django.test import Client, TestCase
from django.urls import reverse
from rest_framework import status

from apps.accounts.models import Organization, User, Workspace
from apps.core.models import Workflow, WorkflowVersion


class WebhookTriggerFeatureTests(TestCase):
    def setUp(self):
        # Patch rate limiter
        self.rate_limit_patcher = patch(
            "apps.core.rate_limiter.RateLimiter.check_rate_limit"
        )
        self.mock_rate_limit = self.rate_limit_patcher.start()
        self.mock_rate_limit.return_value = (True, 100)

        self.record_run_patcher = patch("apps.core.rate_limiter.RateLimiter.record_run")
        self.mock_record_run = self.record_run_patcher.start()

        self.concurrency_patcher = patch(
            "apps.core.concurrency.ConcurrencyManager.can_start_run"
        )
        self.mock_concurrency = self.concurrency_patcher.start()
        self.mock_concurrency.return_value = True

        # Setup basic data
        self.workspace_owner = User.objects.create_user(
            username="owner",
            email="owner@example.com",
            password="password",
        )
        self.organization = Organization.objects.create(
            name="Test Org", slug="test-org", created_by=self.workspace_owner
        )
        self.workspace = Workspace.objects.create(
            name="Test Workspace", slug="test-workspace", organization=self.organization
        )
        self.client = Client()

        # Create a workflow
        self.workflow = Workflow.objects.create(
            name="Webhook Workflow",
            workspace=self.workspace,
            created_by=self.workspace_owner,
            is_active=True,
        )

    def tearDown(self):
        self.rate_limit_patcher.stop()
        self.record_run_patcher.stop()
        self.concurrency_patcher.stop()

    def create_workflow_version(self, webhook_config):
        webhook_id = str(uuid.uuid4())
        definition = {
            "nodes": [
                {
                    "id": webhook_id,
                    "type": "webhook",
                    "data": {"config": webhook_config},
                }
            ],
            "edges": [],
        }

        version = WorkflowVersion.objects.create(
            workflow=self.workflow,
            definition=definition,
            version_number=1,
            is_active=True,
        )
        self.workflow.current_version = version
        self.workflow.save()

        return webhook_id

    def test_basic_webhook(self):
        webhook_id = self.create_workflow_version({"http_method": "POST"})
        url = reverse("core:webhook-trigger", kwargs={"webhook_id": webhook_id})

        response = self.client.post(
            url, {"key": "value"}, content_type="application/json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_ip_whitelist_success(self):
        webhook_id = self.create_workflow_version({"ip_whitelist": "127.0.0.1"})
        url = reverse("core:webhook-trigger", kwargs={"webhook_id": webhook_id})

        # Determine strictness of IP check in implementation
        # (It uses REMOTE_ADDR which Client sets to 127.0.0.1 by default usually)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_ip_whitelist_block(self):
        webhook_id = self.create_workflow_version({"ip_whitelist": "10.0.0.1"})
        url = reverse("core:webhook-trigger", kwargs={"webhook_id": webhook_id})

        # Client default is 127.0.0.1, so it should be blocked
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_ignore_bots(self):
        webhook_id = self.create_workflow_version({"ignore_bots": True})
        url = reverse("core:webhook-trigger", kwargs={"webhook_id": webhook_id})

        # Simulate Googlebot
        response = self.client.get(
            url,
            HTTP_USER_AGENT="Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json().get("status"), "ignored")

    def test_basic_auth_success(self):
        webhook_id = self.create_workflow_version(
            {
                "authentication": "Basic Auth",
                "auth_username": "user",
                "auth_password": "pass",
            }
        )
        url = reverse("core:webhook-trigger", kwargs={"webhook_id": webhook_id})

        credentials = "user:pass"
        b64_creds = base64.b64encode(credentials.encode()).decode()
        auth_header = f"Basic {b64_creds}"

        response = self.client.get(url, HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_basic_auth_fail(self):
        webhook_id = self.create_workflow_version(
            {
                "authentication": "Basic Auth",
                "auth_username": "user",
                "auth_password": "pass",
            }
        )
        url = reverse("core:webhook-trigger", kwargs={"webhook_id": webhook_id})

        credentials = "user:wrongpass"
        b64_creds = base64.b64encode(credentials.encode()).decode()
        auth_header = f"Basic {b64_creds}"

        response = self.client.get(url, HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_header_auth_success(self):
        webhook_id = self.create_workflow_version(
            {
                "authentication": "Header Auth",
                "auth_header_name": "X-Secret",
                "auth_header_value": "super-secret",
            }
        )
        url = reverse("core:webhook-trigger", kwargs={"webhook_id": webhook_id})

        response = self.client.get(url, HTTP_X_SECRET="super-secret")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_response_customization(self):
        webhook_id = self.create_workflow_version(
            {
                "respond": "Immediately",
                "response_code": 202,
                "response_data": '{"custom": "data"}',
                "response_headers": [{"name": "X-Custom", "value": "Test"}],
            }
        )
        url = reverse("core:webhook-trigger", kwargs={"webhook_id": webhook_id})

        response = self.client.get(url)
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json(), {"custom": "data"})
        self.assertEqual(response.headers.get("X-Custom"), "Test")
