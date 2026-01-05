"""
Template-related views.

ViewSet for WorkflowTemplate model.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.common.logging_utils import get_logger
from ..models import WorkflowTemplate
from ..serializers import (
    WorkflowTemplateListSerializer,
    WorkflowTemplateDetailSerializer,
    WorkflowTemplateCreateSerializer,
)
from ..utils.template_cloner import TemplateCloner

logger = get_logger(__name__)


class WorkflowTemplateViewSet(viewsets.ModelViewSet):
    """
    ViewSet for WorkflowTemplate model.

    Provides list, retrieve, create, and clone actions for workflow templates.
    """

    permission_classes = [IsAuthenticated]
    cloner = TemplateCloner()

    def get_queryset(self):
        """Filter templates by public visibility"""
        queryset = WorkflowTemplate.objects.filter(is_public=True)

        # Filter by category if provided
        category = self.request.query_params.get("category", None)
        if category:
            queryset = queryset.filter(category=category)

        return queryset.order_by("-usage_count", "-created_at")

    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == "list":
            return WorkflowTemplateListSerializer
        elif self.action == "retrieve":
            return WorkflowTemplateDetailSerializer
        elif self.action == "create":
            return WorkflowTemplateCreateSerializer
        return WorkflowTemplateListSerializer

    def list(self, request, *args, **kwargs):
        """List public templates, filterable by category"""
        queryset = self.filter_queryset(self.get_queryset())

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(
            {
                "status": "success",
                "data": serializer.data,
                "message": "Templates retrieved successfully",
            }
        )

    def retrieve(self, request, *args, **kwargs):
        """Get template details"""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(
            {
                "status": "success",
                "data": serializer.data,
                "message": "Template retrieved successfully",
            }
        )

    def create(self, request, *args, **kwargs):
        """Create new template (admin/curation)"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        template = serializer.save(created_by=request.user)

        logger.info(
            f"Created template {template.id}",
            extra={
                "template_id": str(template.id),
                "user_id": str(request.user.id),
                "category": template.category,
            },
        )

        return Response(
            {
                "status": "success",
                "data": WorkflowTemplateDetailSerializer(template).data,
                "message": "Template created successfully",
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def clone(self, request, pk=None):
        """
        Clone template into user's workspace as draft.

        POST /api/v1/core/templates/{id}/clone/
        Body: {
            "workflow_name": "optional custom name"
        }
        """
        template = self.get_object()
        workspace = getattr(request, "workspace", None)

        if not workspace:
            return Response(
                {"status": "error", "message": "Workspace context required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        workflow_name = request.data.get("workflow_name")

        try:
            workflow = self.cloner.clone_template(
                template=template,
                workspace=workspace,
                user=request.user,
                workflow_name=workflow_name,
            )

            return Response(
                {
                    "status": "success",
                    "data": {
                        "workflow_id": str(workflow.id),
                        "workflow_name": workflow.name,
                        "template_id": str(template.id),
                        "template_name": template.name,
                    },
                    "message": "Template cloned successfully",
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            logger.error(
                f"Error cloning template {template.id}: {str(e)}",
                exc_info=e,
                extra={
                    "template_id": str(template.id),
                    "workspace_id": str(workspace.id),
                    "user_id": str(request.user.id),
                },
            )
            return Response(
                {"status": "error", "message": f"Failed to clone template: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
