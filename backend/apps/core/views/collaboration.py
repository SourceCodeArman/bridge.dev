"""
Collaboration-related views.

ViewSets for WorkflowComment and WorkflowPresence models.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied

from apps.accounts.permissions import IsWorkspaceMember
from apps.common.logging_utils import get_logger
from ..permissions import CanCommentOnWorkflow
from ..models import WorkflowVersion, WorkflowComment, WorkflowPresence
from ..serializers import WorkflowCommentSerializer, WorkflowPresenceSerializer

logger = get_logger(__name__)


class WorkflowCommentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for WorkflowComment model.

    Provides CRUD operations and resolve action for workflow comments.
    """

    serializer_class = WorkflowCommentSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember, CanCommentOnWorkflow]

    def get_queryset(self):
        """Filter comments by workflow version"""
        workflow_version_id = self.request.query_params.get("workflow_version", None)
        node_id = self.request.query_params.get("node_id", None)

        queryset = WorkflowComment.objects.all()

        if workflow_version_id:
            queryset = queryset.filter(workflow_version_id=workflow_version_id)

        if node_id:
            queryset = queryset.filter(node_id=node_id)

        return queryset.order_by("-created_at")

    def perform_create(self, serializer):
        """Set created_by and validate workflow version access"""
        workflow_version = serializer.validated_data.get("workflow_version")

        # Check workspace access
        workspace = workflow_version.workflow.workspace
        if not IsWorkspaceMember().has_object_permission(self.request, self, workspace):
            raise PermissionDenied("You do not have access to this workspace")

        serializer.save(created_by=self.request.user)

    def update(self, request, *args, **kwargs):
        """Update comment (only by creator)"""
        comment = self.get_object()

        # Only creator can update
        if comment.created_by != request.user:
            return Response(
                {"status": "error", "message": "You can only update your own comments"},
                status=status.HTTP_403_FORBIDDEN,
            )

        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """Delete comment (creator or admin)"""
        comment = self.get_object()
        workflow = comment.workflow_version.workflow
        workspace = workflow.workspace

        # Check if user is creator or admin
        is_creator = comment.created_by == request.user
        is_admin = False

        try:
            from apps.accounts.rbac_models import UserRole

            user_role = UserRole.objects.get(
                user=request.user, workspace=workspace, is_active=True
            )
            is_admin = user_role.role.codename == "admin"
        except Exception:
            pass

        if not (is_creator or is_admin):
            return Response(
                {
                    "status": "error",
                    "message": "You do not have permission to delete this comment",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        """
        Mark comment as resolved.

        POST /api/v1/core/comments/{id}/resolve/
        """
        comment = self.get_object()

        # Check if already resolved
        if comment.is_resolved:
            return Response(
                {"status": "error", "message": "Comment is already resolved"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Resolve comment
        comment.resolve(request.user)

        serializer = self.get_serializer(comment)
        return Response(
            {
                "status": "success",
                "data": serializer.data,
                "message": "Comment resolved successfully",
            }
        )

    @action(detail=True, methods=["post"])
    def unresolve(self, request, pk=None):
        """
        Mark comment as unresolved.

        POST /api/v1/core/comments/{id}/unresolve/
        """
        comment = self.get_object()

        if not comment.is_resolved:
            return Response(
                {"status": "error", "message": "Comment is not resolved"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Unresolve comment
        comment.unresolve()

        serializer = self.get_serializer(comment)
        return Response(
            {
                "status": "success",
                "data": serializer.data,
                "message": "Comment unresolved successfully",
            }
        )


class WorkflowPresenceViewSet(viewsets.ModelViewSet):
    """
    ViewSet for WorkflowPresence model.

    Provides presence tracking with heartbeat and list actions.
    """

    serializer_class = WorkflowPresenceSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        """Filter presence by workflow version"""
        workflow_version_id = self.request.query_params.get("workflow_version", None)

        queryset = WorkflowPresence.objects.filter(is_active=True)

        if workflow_version_id:
            queryset = queryset.filter(workflow_version_id=workflow_version_id)

        return queryset.order_by("-last_seen_at")

    def list(self, request, *args, **kwargs):
        """List active users for a workflow version"""
        queryset = self.filter_queryset(self.get_queryset())

        serializer = self.get_serializer(queryset, many=True)
        return Response(
            {
                "status": "success",
                "data": serializer.data,
                "message": "Presence retrieved successfully",
            }
        )

    def create(self, request, *args, **kwargs):
        """Create or update presence (heartbeat)"""
        workflow_version_id = request.data.get("workflow_version")
        node_id = request.data.get("node_id")

        if not workflow_version_id:
            return Response(
                {"status": "error", "message": "workflow_version is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            workflow_version = WorkflowVersion.objects.get(id=workflow_version_id)
        except WorkflowVersion.DoesNotExist:
            return Response(
                {"status": "error", "message": "Workflow version not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check workspace access
        workspace = workflow_version.workflow.workspace
        if not IsWorkspaceMember().has_object_permission(request, self, workspace):
            raise PermissionDenied("You do not have access to this workspace")

        # Get or create presence
        presence, created = WorkflowPresence.objects.get_or_create(
            workflow_version=workflow_version,
            user=request.user,
            defaults={"is_active": True},
        )

        # Update presence
        presence.update_presence(node_id=node_id)

        serializer = self.get_serializer(presence)
        return Response(
            {
                "status": "success",
                "data": serializer.data,
                "message": "Presence updated successfully",
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def destroy(self, request, *args, **kwargs):
        """Remove user's presence (on disconnect)"""
        presence = self.get_object()

        # Only user can remove their own presence
        if presence.user != request.user:
            return Response(
                {"status": "error", "message": "You can only remove your own presence"},
                status=status.HTTP_403_FORBIDDEN,
            )

        presence.deactivate()

        return Response(
            {"status": "success", "message": "Presence removed successfully"},
            status=status.HTTP_200_OK,
        )
