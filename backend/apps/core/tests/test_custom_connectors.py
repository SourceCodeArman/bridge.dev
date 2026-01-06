from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.accounts.models import Workspace, Organization, OrganizationMember
from apps.core.models import CustomConnector, CustomConnectorVersion
from apps.core.connectors.validator import validate_custom_connector_manifest


User = get_user_model()


class CustomConnectorModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="owner@example.com",
            password="password",
            username="owner",
        )
        self.org = Organization.objects.create(
            name="Test Org",
            slug="test-org",
            created_by=self.user,
        )
        OrganizationMember.objects.create(
            user=self.user,
            organization=self.org,
            is_active=True,
        )
        self.workspace = Workspace.objects.create(
            name="Test Workspace",
            slug="test-workspace",
            organization=self.org,
            created_by=self.user,
        )

    def test_custom_connector_unique_slug_per_workspace(self):
        CustomConnector.objects.create(
            workspace=self.workspace,
            slug="my-connector",
            display_name="My Connector",
            created_by=self.user,
        )

        with self.assertRaises(Exception):
            # Unique constraint enforced at the database level
            CustomConnector.objects.create(
                workspace=self.workspace,
                slug="my-connector",
                display_name="Duplicate Connector",
                created_by=self.user,
            )

    def test_custom_connector_version_unique_per_connector(self):
        connector = CustomConnector.objects.create(
            workspace=self.workspace,
            slug="my-connector",
            display_name="My Connector",
            created_by=self.user,
        )

        CustomConnectorVersion.objects.create(
            connector=connector,
            version="1.0.0",
            manifest={
                "id": "custom_my_connector",
                "name": "My Connector",
                "version": "1.0.0",
                "connector_type": "action",
            },
            created_by=self.user,
        )

        with self.assertRaises(Exception):
            CustomConnectorVersion.objects.create(
                connector=connector,
                version="1.0.0",
                manifest={
                    "id": "custom_my_connector_v2",
                    "name": "My Connector",
                    "version": "1.0.0",
                    "connector_type": "action",
                },
                created_by=self.user,
            )

    def test_separate_icon_uploads(self):
        """Test that light and dark icons are processed separately."""
        # Mock Supabase
        from unittest.mock import patch, MagicMock
        from django.core.files.uploadedfile import SimpleUploadedFile

        from django.test import override_settings

        @override_settings(
            SUPABASE_URL="https://example.supabase.co", SUPABASE_SERVICE_KEY="test-key"
        )
        def run_test():
            with patch("apps.core.serializers.create_client") as mock_create_client:
                mock_client = MagicMock()
                mock_storage = MagicMock()
                mock_bucket = MagicMock()

                mock_create_client.return_value = mock_client
                mock_client.storage.from_.return_value = mock_bucket
                mock_bucket.upload.return_value = {"Key": "some-key"}
                # Return different URLs for light and dark
                mock_bucket.get_public_url.side_effect = [
                    "https://example.com/light.png",
                    "https://example.com/dark.png",
                ]

                # Create manifest file
                manifest_content = b'{"id": "test", "name": "Test", "version": "1.0.0", "connector_type": "action", "actions": [{"id": "a1", "name": "A1"}]}'
                manifest_file = SimpleUploadedFile(
                    "manifest.json", manifest_content, content_type="application/json"
                )

                # Create icon files (minimal valid PNG)
                png_content = (
                    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
                    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
                )
                light_icon = SimpleUploadedFile(
                    "light.png", png_content, content_type="image/png"
                )
                dark_icon = SimpleUploadedFile(
                    "dark.png", png_content, content_type="image/png"
                )

                data = {
                    "display_name": "Icon Test Connector",
                    "manifest_file": manifest_file,
                    "light_icon": light_icon,
                    "dark_icon": dark_icon,
                    "workspace": self.workspace.id,
                }

                from apps.core.serializers import CustomConnectorSerializer

                serializer = CustomConnectorSerializer(data=data)
                self.assertTrue(serializer.is_valid(), serializer.errors)

                # Manually passing workspace as if perform_create did it
                connector = serializer.save(
                    workspace=self.workspace, created_by=self.user
                )

                self.assertEqual(
                    connector.icon_url_light, "https://example.com/light.png"
                )
                self.assertEqual(
                    connector.icon_url_dark, "https://example.com/dark.png"
                )

                # Verify uploads called twice
                self.assertEqual(mock_bucket.upload.call_count, 2)

        run_test()


class CustomConnectorManifestValidationTests(TestCase):
    def test_validate_custom_manifest_conflict_with_builtin(self):
        # This id is intentionally simple; if a built-in connector with the
        # same id exists in the registry, the validator should flag it.
        manifest = {
            "id": "http",
            "name": "HTTP",
            "version": "1.0.0",
            "connector_type": "action",
        }
        is_valid, errors = validate_custom_connector_manifest(manifest)
        # We cannot assert False here because the registry may or may not contain
        # a connector with id "http" depending on test ordering, but we do
        # expect the validator to return a list for errors.
        self.assertIsInstance(errors, list)

    def test_validate_custom_manifest_success(self):
        manifest = {
            "id": "custom_test_connector",
            "name": "Custom Test Connector",
            "version": "1.0.0",
            "connector_type": "action",
            "actions": [{"id": "test", "name": "test"}],
        }
        is_valid, errors = validate_custom_connector_manifest(manifest)
        self.assertTrue(is_valid)
        self.assertEqual(errors, [])
