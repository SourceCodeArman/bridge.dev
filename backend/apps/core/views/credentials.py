"""
Credential-related views.

ViewSet for Credential model.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import ValidationError

from apps.accounts.permissions import IsWorkspaceMember, HasCredentialPermission
from apps.common.logging_utils import get_logger
from ..models import Credential
from ..serializers import (
    CredentialListSerializer,
    CredentialCreateSerializer,
    CredentialUpdateSerializer,
    CredentialDetailSerializer,
    CredentialUsageSerializer,
)
from apps.core.encryption import get_encryption_service
from apps.core.connectors.google.calendar.connector import GoogleCalendarConnector

logger = get_logger(__name__)


class CredentialViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing credentials.

    Provides CRUD operations for credentials with workspace scoping and RBAC.
    """

    permission_classes = [IsAuthenticated, IsWorkspaceMember, HasCredentialPermission]

    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == "list":
            return CredentialListSerializer
        elif self.action == "create":
            return CredentialCreateSerializer
        elif self.action in ["update", "partial_update"]:
            return CredentialUpdateSerializer
        elif self.action == "retrieve":
            return CredentialDetailSerializer
        return CredentialListSerializer

    def get_queryset(self):
        """Filter credentials by workspace"""
        workspace = getattr(self.request, "workspace", None)
        logger.info(
            f"CredentialViewSet.get_queryset: workspace={workspace}, user={self.request.user}"
        )
        if workspace:
            return Credential.objects.filter(workspace=workspace)
        return Credential.objects.none()

    def perform_create(self, serializer):
        """Set workspace from request context"""
        workspace = getattr(self.request, "workspace", None)
        if workspace:
            serializer.save(workspace=workspace)
        else:
            raise ValidationError("Workspace context required")

    @action(detail=True, methods=["get"])
    def usage_history(self, request, pk=None):
        """Get usage history for a credential"""
        credential = self.get_object()
        usage_records = credential.usage_records.all()
        serializer = CredentialUsageSerializer(usage_records, many=True)
        return Response(
            {
                "status": "success",
                "data": serializer.data,
                "message": "Usage history retrieved successfully",
            }
        )

    @action(detail=True, methods=["post"])
    def test_connection(self, request, pk=None):
        """
        Test credential connection (placeholder for future implementation).

        This would validate the credential by attempting to authenticate
        with the target service. Not implemented in MVP.
        """
        credential = self.get_object()

        # TODO: Implement actual connection testing based on credential_type
        # For now, return a placeholder response

        return Response(
            {
                "status": "success",
                "data": {
                    "credential_id": str(credential.id),
                    "credential_name": credential.name,
                    "credential_type": credential.credential_type,
                    "test_status": "not_implemented",
                    "message": "Connection testing not yet implemented",
                },
                "message": "Connection test initiated (not implemented)",
            }
        )

    @action(detail=True, methods=["get"], url_path="google/calendars")
    def list_google_calendars(self, request, pk=None):
        """List Google Calendars for a credential"""
        credential = self.get_object()

        try:
            # Decrypt credential secrets
            encryption_service = get_encryption_service()
            config = encryption_service.decrypt_dict(credential.encrypted_data)

            # Initialize connector
            connector = GoogleCalendarConnector(config)
            # We need to initialize the service
            connector._initialize()

            # List calendars
            result = connector._execute_list_calendars({"show_hidden": False})

            return Response(result)

        except Exception as e:
            logger.error(
                f"Failed to list calendars: {str(e)}",
                extra={"credential_id": str(credential.id)},
            )
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"], url_path="google/spreadsheets")
    def list_google_spreadsheets(self, request, pk=None):
        """List Google Spreadsheets for a credential"""
        credential = self.get_object()

        try:
            from apps.core.connectors.google.sheets.connector import (
                GoogleSheetsConnector,
            )

            # Decrypt credential secrets
            encryption_service = get_encryption_service()
            config = encryption_service.decrypt_dict(credential.encrypted_data)

            # Initialize connector
            connector = GoogleSheetsConnector(config)
            connector._initialize()

            # List spreadsheets
            result = connector._execute_list_spreadsheets({})

            return Response(result)

        except Exception as e:
            logger.error(
                f"Failed to list spreadsheets: {str(e)}",
                extra={"credential_id": str(credential.id)},
            )
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(
        detail=True,
        methods=["get"],
        url_path="google/spreadsheets/(?P<spreadsheet_id>[^/.]+)/worksheets",
    )
    def list_google_worksheets(self, request, pk=None, spreadsheet_id=None):
        """List worksheets (tabs) for a specific Google Spreadsheet"""
        credential = self.get_object()

        try:
            from apps.core.connectors.google.sheets.connector import (
                GoogleSheetsConnector,
            )

            # Decrypt credential secrets
            encryption_service = get_encryption_service()
            config = encryption_service.decrypt_dict(credential.encrypted_data)

            # Initialize connector
            connector = GoogleSheetsConnector(config)
            connector._initialize()

            # List worksheets for the spreadsheet
            result = connector._execute_list_worksheets(
                {"spreadsheet_id": spreadsheet_id}
            )

            return Response(result)

        except Exception as e:
            logger.error(
                f"Failed to list worksheets: {str(e)}",
                extra={
                    "credential_id": str(credential.id),
                    "spreadsheet_id": spreadsheet_id,
                },
            )
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"], url_path="ai/models")
    def list_ai_models(self, request, pk=None):
        """List AI models available for this credential's provider"""
        credential = self.get_object()

        try:
            from apps.core.encryption import get_encryption_service

            # Decrypt credential secrets
            encryption_service = get_encryption_service()
            config = encryption_service.decrypt_dict(credential.encrypted_data)
            api_key = config.get("api_key")

            if not api_key:
                return Response(
                    {"error": "No API key found in credential"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Extract connector slug from encrypted data
            connector_slug = config.get("_connector_id", "")
            # Normalize: replace underscores with hyphens
            connector_slug = connector_slug.replace("_", "-") if connector_slug else ""

            models = []

            if connector_slug in ("openai", "openai-model"):
                # Fetch models from OpenAI API
                import openai

                client = openai.OpenAI(api_key=api_key)
                response = client.models.list()

                # Filter to relevant GPT models
                gpt_prefixes = ("gpt-4", "gpt-3.5", "o1", "o3")
                for model in response.data:
                    if model.id.startswith(gpt_prefixes):
                        models.append(
                            {
                                "id": model.id,
                                "name": model.id,
                            }
                        )

                # Sort by name
                models.sort(key=lambda x: x["id"])

            elif connector_slug == "anthropic":
                from anthropic import Anthropic

                client = Anthropic(api_key=api_key)
                response = client.models.list()

                for model in response:
                    models.append(
                        {
                            "id": model.id,
                            "name": model.id,
                        }
                    )

                models.sort(key=lambda x: x["id"])

            elif connector_slug == "gemini":
                # Fetch models from Google Gemini API
                import google.generativeai as genai

                genai.configure(api_key=api_key)

                for model in genai.list_models():
                    # Filter to generative models
                    if "generateContent" in model.supported_generation_methods:
                        # Extract readable name from full model name
                        model_id = model.name.replace("models/", "")
                        models.append(
                            {
                                "id": model_id,
                                "name": model.display_name or model_id,
                            }
                        )

            elif connector_slug == "deepseek":
                from openai import OpenAI

                client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")
                response = client.models.list()

                for model in response.data:
                    models.append(
                        {
                            "id": model.id,
                            "name": model.id,
                        }
                    )

                models.sort(key=lambda x: x["id"])

            else:
                return Response(
                    {"error": f"Unknown connector: {connector_slug}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            return Response({"models": models})

        except Exception as e:
            logger.error(
                f"Failed to list AI models: {str(e)}",
                extra={"credential_id": str(credential.id)},
            )
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"], url_path="slack/channels")
    def list_slack_channels(self, request, pk=None):
        """List Slack channels for a credential"""
        credential = self.get_object()

        try:
            from apps.core.connectors.slack.connector import SlackConnector

            # Decrypt credential secrets
            encryption_service = get_encryption_service()
            config = encryption_service.decrypt_dict(credential.encrypted_data)

            # Initialize connector
            connector = SlackConnector(config)
            connector._initialize()

            # List channels
            result = connector._execute_list_channels({"types": ["public_channel"]})

            return Response(result)

        except Exception as e:
            logger.error(
                f"Failed to list slack channels: {str(e)}",
                extra={"credential_id": str(credential.id)},
            )
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
