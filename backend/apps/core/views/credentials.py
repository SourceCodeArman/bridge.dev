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
