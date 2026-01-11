"""
Connector-related views.

ViewSets for Connector, CustomConnector, and CustomConnectorVersion models.
"""

from django.db import transaction
from django.db.models import Q
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.core.exceptions import ValidationError

from apps.accounts.permissions import IsWorkspaceMember, IsWorkspaceAdmin
from apps.common.logging_utils import get_logger
from ..models import Connector, CustomConnector, CustomConnectorVersion
from ..serializers import (
    ConnectorSerializer,
    ConnectorSummarySerializer,
    CustomConnectorSerializer,
    CustomConnectorVersionSerializer,
    FormSchemaSerializer,
)

logger = get_logger(__name__)


class ConnectorViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for system connectors.
    """

    queryset = Connector.objects.filter(is_active=True)
    serializer_class = ConnectorSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ["display_name", "slug"]

    def list(self, request, *args, **kwargs):
        """List all available connectors with minimal data for performance"""
        # Get system connectors with lightweight serializer
        system_connectors = self.get_queryset()
        serializer = ConnectorSummarySerializer(system_connectors, many=True)
        connectors_data = list(serializer.data)

        # Append database-backed custom connectors for this workspace (approved only)
        workspace = getattr(request, "workspace", None)
        if workspace:
            custom_connectors = CustomConnector.objects.filter(
                workspace=workspace,
                status="approved",
                current_version__isnull=False,
                current_version__status="approved",
            ).select_related("current_version")

            for custom in custom_connectors:
                connectors_data.append(
                    {
                        "id": custom.slug or str(custom.id),
                        "slug": custom.slug,
                        "display_name": custom.display_name,
                        "icon_url_light": custom.icon_url_light,
                        "icon_url_dark": custom.icon_url_dark,
                        "is_custom": True,
                    }
                )

        return Response(
            {
                "status": "success",
                "data": {"connectors": connectors_data, "count": len(connectors_data)},
                "message": "Connectors retrieved successfully",
            }
        )

    def retrieve(self, request, pk=None):
        """
        Get details for a specific connector (system or custom).
        """
        # 1. Try to find a system connector first
        try:
            instance = self.get_queryset().get(pk=pk)
            serializer = self.get_serializer(instance)
            return Response(
                {
                    "status": "success",
                    "data": serializer.data,
                    "message": "Connector retrieved successfully",
                }
            )
        except (Connector.DoesNotExist, ValidationError):
            # 2. If not found, look for a custom connector in the workspace
            workspace = getattr(request, "workspace", None)
            if workspace:
                try:
                    # pk could be ID or Slug
                    # Safely construct query based on whether input is a valid UUID
                    import uuid

                    query = Q(slug=pk)
                    try:
                        uuid_obj = uuid.UUID(str(pk))
                        query |= Q(id=uuid_obj)
                    except (ValueError, TypeError):
                        pass

                    custom = CustomConnector.objects.get(
                        query,
                        workspace=workspace,
                        status="approved",
                        current_version__isnull=False,
                    )

                    # Convert to unified connector format
                    manifest = custom.current_version.manifest or {}
                    data = {
                        "id": manifest.get("id") or custom.slug,
                        "name": manifest.get("name") or custom.display_name,
                        "version": manifest.get("version"),
                        "description": manifest.get("description")
                        or custom.description,
                        "author": manifest.get("author") or custom.created_by.email
                        if custom.created_by
                        else None,
                        "connector_type": manifest.get("connector_type"),
                        "actions": manifest.get("actions", []),
                        "triggers": manifest.get("triggers", []),
                        "auth_config": manifest.get("auth_config", {}),
                        "manifest": manifest,  # Include full manifest
                        "is_custom": True,
                        "is_active": True,
                        "icon_url": None,  # or use custom icon if supported
                    }

                    return Response(
                        {
                            "status": "success",
                            "data": data,
                            "message": "Connector retrieved successfully",
                        }
                    )
                except (CustomConnector.DoesNotExist, ValidationError):
                    pass

            return Response(
                {"status": "error", "message": "Connector not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

    @action(
        detail=True,
        methods=["get"],
        url_path="actions/(?P<action_id>[^/.]+)/form_schema",
    )
    def action_form_schema(self, request, pk=None, action_id=None):
        """
        Get form schema for a connector action.

        GET /api/v1/core/connectors/{id}/actions/{action_id}/form_schema/
        """
        from ..node_editor import NodeEditor

        try:
            editor = NodeEditor()
            form_schema = editor.get_form_schema(pk, action_id)

            # Get available credentials for this connector in the workspace
            workspace = getattr(request, "workspace", None)
            if workspace:
                credentials = editor.get_credential_fields(pk, str(workspace.id))
                form_schema["available_credentials"] = credentials

            serializer = FormSchemaSerializer(form_schema)
            return Response(
                {
                    "status": "success",
                    "data": serializer.data,
                    "message": "Form schema retrieved successfully",
                }
            )
        except ValueError as e:
            return Response(
                {"status": "error", "message": str(e)}, status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(
                f"Error getting form schema for connector {pk}, action {action_id}: {str(e)}",
                exc_info=e,
                extra={"connector_id": pk, "action_id": action_id},
            )
            return Response(
                {
                    "status": "error",
                    "message": f"Error retrieving form schema: {str(e)}",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class CustomConnectorViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing custom (user-contributed) connectors.

    Connectors are scoped to a workspace and managed by workspace admins.
    """

    parser_classes = (MultiPartParser, FormParser, JSONParser)
    serializer_class = CustomConnectorSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        """Filter custom connectors by workspace."""
        workspace = getattr(self.request, "workspace", None)

        # Fallback: try to resolve workspace from user's organization if not set by middleware
        if not workspace and self.request.user.is_authenticated:
            from apps.accounts.models import OrganizationMember

            membership = OrganizationMember.objects.filter(
                user=self.request.user, is_active=True
            ).first()
            if membership:
                workspace = membership.organization.workspaces.first()

        if workspace:
            return CustomConnector.objects.filter(workspace=workspace)
        return CustomConnector.objects.none()

    def get_permissions(self):
        """
        Require workspace admin privileges for write operations.
        """
        base_perms = [IsAuthenticated(), IsWorkspaceMember()]
        admin_actions = {"update", "partial_update", "destroy"}
        if self.action in admin_actions:
            base_perms.append(IsWorkspaceAdmin())
        return base_perms

    def perform_create(self, serializer):
        """Set workspace and created_by from request context."""
        workspace = getattr(self.request, "workspace", None)

        # Fallback: try to resolve workspace from user's organization if not set by middleware
        if not workspace and self.request.user.is_authenticated:
            from apps.accounts.models import OrganizationMember

            membership = OrganizationMember.objects.filter(
                user=self.request.user, is_active=True
            ).first()
            if membership:
                workspace = membership.organization.workspaces.first()

        if not workspace:
            raise ValidationError("Workspace context required")

        serializer.save(
            workspace=workspace,
            created_by=self.request.user
            if self.request.user.is_authenticated
            else None,
        )

    @action(detail=True, methods=["get"])
    def versions(self, request, pk=None):
        """
        List versions for a given custom connector.

        GET /api/v1/core/custom-connectors/{id}/versions/
        """
        connector = self.get_object()
        versions = connector.versions.all().order_by("-created_at")
        serializer = CustomConnectorVersionSerializer(versions, many=True)
        return Response(
            {
                "status": "success",
                "data": serializer.data,
                "message": "Connector versions retrieved successfully",
            }
        )

    @action(detail=False, methods=["post"], parser_classes=[MultiPartParser])
    def test_upload(self, request):
        """Test endpoint for file upload"""
        import os
        from django.conf import settings
        from supabase import create_client
        import uuid

        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"error": "No file provided"}, status=400)

        try:
            supabase_url = settings.SUPABASE_URL
            supabase_key = (
                settings.SUPABASE_SERVICE_KEY
                or settings.SUPABASE_KEY
                or os.environ.get("SUPABASE_API_KEY")
            )

            if not supabase_url or not supabase_key:
                return Response({"error": "Supabase not configured"}, status=500)

            supabase = create_client(supabase_url, supabase_key)
            file_ext = os.path.splitext(file_obj.name)[1]
            file_path = f"test-uploads/{uuid.uuid4()}{file_ext}"

            file_content = file_obj.read()

            supabase.storage.from_("custom-connector-icons").upload(
                file_path,
                file_content,
                {"content-type": file_obj.content_type},
            )

            url = supabase.storage.from_("custom-connector-icons").get_public_url(
                file_path
            )
            return Response({"status": "success", "url": url})

        except Exception as e:
            import traceback

            return Response(
                {"error": str(e), "trace": traceback.format_exc()}, status=500
            )


class CustomConnectorVersionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing custom connector versions.

    Supports creating new versions and driving the review/approval workflow.
    """

    serializer_class = CustomConnectorVersionSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        """Filter versions by workspace via connector and optional connector filter."""
        workspace = getattr(self.request, "workspace", None)
        if not workspace:
            return CustomConnectorVersion.objects.none()

        queryset = CustomConnectorVersion.objects.filter(connector__workspace=workspace)

        connector_id = self.request.query_params.get("connector")
        if connector_id:
            queryset = queryset.filter(connector_id=connector_id)

        return queryset

    def get_permissions(self):
        """
        Require workspace admin privileges for mutating and review actions.
        """
        base_perms = [IsAuthenticated(), IsWorkspaceMember()]
        admin_actions = {
            "update",
            "partial_update",
            "destroy",
            "submit_for_review",
            "approve",
            "reject",
        }
        if self.action in admin_actions:
            base_perms.append(IsWorkspaceAdmin())
        return base_perms

    def perform_create(self, serializer):
        """Set created_by from request user."""
        serializer.save(
            created_by=self.request.user if self.request.user.is_authenticated else None
        )

    @action(detail=True, methods=["post"])
    def submit_for_review(self, request, pk=None):
        """
        Move a version from draft to pending_review.

        POST /api/v1/core/custom-connector-versions/{id}/submit_for_review/
        """
        version = self.get_object()

        if version.status not in ["draft", "rejected"]:
            return Response(
                {
                    "status": "error",
                    "message": f'Cannot submit version in status "{version.status}" for review',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        version.status = "pending_review"
        version.save(update_fields=["status", "created_at"])

        serializer = self.get_serializer(version)
        return Response(
            {
                "status": "success",
                "data": serializer.data,
                "message": "Version submitted for review",
            }
        )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """
        Approve a version and set it as the connector's current_version.

        POST /api/v1/core/custom-connector-versions/{id}/approve/
        """
        version = self.get_object()
        connector = version.connector

        if version.status not in ["pending_review", "draft"]:
            return Response(
                {
                    "status": "error",
                    "message": f'Cannot approve version in status "{version.status}"',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Mark this version as approved and deprecate previous approved version if any
        with transaction.atomic():
            # Deprecate other approved versions for this connector
            connector.versions.filter(status="approved").exclude(id=version.id).update(
                status="deprecated"
            )

            version.status = "approved"
            version.save(update_fields=["status"])

            connector.status = "approved"
            connector.current_version = version
            connector.save(update_fields=["status", "current_version", "updated_at"])

        serializer = self.get_serializer(version)
        return Response(
            {
                "status": "success",
                "data": serializer.data,
                "message": "Version approved successfully",
            }
        )

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        """
        Reject a version in the review workflow.

        POST /api/v1/core/custom-connector-versions/{id}/reject/
        Body (optional): {"reason": "string"}
        """
        version = self.get_object()

        if version.status not in ["pending_review", "draft"]:
            return Response(
                {
                    "status": "error",
                    "message": f'Cannot reject version in status "{version.status}"',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = request.data.get("reason")
        if reason:
            # Append rejection reason to changelog for traceability
            prefix = version.changelog + "\n\n" if version.changelog else ""
            version.changelog = f"{prefix}Rejected: {reason}"

        version.status = "rejected"
        version.save(update_fields=["status", "changelog"])

        serializer = self.get_serializer(version)
        return Response(
            {
                "status": "success",
                "data": serializer.data,
                "message": "Version rejected",
            }
        )
