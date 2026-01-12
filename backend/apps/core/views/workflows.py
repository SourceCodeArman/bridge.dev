"""
Workflow-related views.

ViewSets for Workflow and WorkflowVersion models.
"""

from django.db import models
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied

from apps.accounts.permissions import IsWorkspaceMember
from apps.common.logging_utils import get_logger
from ..models import Workflow, WorkflowVersion, Trigger, Run
from ..serializers import (
    WorkflowSerializer,
    WorkflowListSerializer,
    WorkflowVersionSerializer,
    RunSerializer,
    WorkflowGenerateRequestSerializer,
    NodeValidationRequestSerializer,
    NodeValidationResponseSerializer,
)

logger = get_logger(__name__)


class WorkflowViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Workflow model

    Filters workflows by workspace from request context.
    """

    serializer_class = WorkflowSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get_serializer_class(self):
        """Use lightweight serializer for list view, full serializer for others"""
        if self.action == "list":
            return WorkflowListSerializer
        return WorkflowSerializer

    def _get_workspace_context(self):
        """
        Helper to get workspace context, with fallback to default workspace for authenticated users.
        """
        workspace = getattr(self.request, "workspace", None)

        # If no workspace context but user is authenticated, try to find a default one
        if not workspace and self.request.user.is_authenticated:
            from apps.accounts.models import OrganizationMember

            # Find the first active organization membership
            membership = OrganizationMember.objects.filter(
                user=self.request.user, is_active=True
            ).first()

            if membership:
                # Find the first workspace in that organization
                workspace = membership.organization.workspaces.first()
                # Attach to request for subsequent use
                self.request.workspace = workspace
                self.request.workspace_id = str(workspace.id) if workspace else None

        return workspace

    def perform_create(self, serializer):
        workspace = self._get_workspace_context()
        if not workspace:
            raise PermissionDenied("Workspace context required")
        serializer.save(workspace=workspace, created_by=self.request.user)

    def get_queryset(self):
        """Filter workflows by workspace with optimized query"""
        from django.db.models import Prefetch, OuterRef, Subquery

        workspace = self._get_workspace_context()
        if workspace:
            # For list view, we only need minimal data
            # Check if this is a list action
            is_list_action = getattr(self, "action", None) == "list"

            if is_list_action:
                # Minimal query for list view - only what WorkflowListSerializer needs
                latest_run_subquery = (
                    Run.objects.filter(workflow_version__workflow=OuterRef("pk"))
                    .order_by("-created_at")
                    .values("created_at")[:1]
                )

                return (
                    Workflow.objects.filter(workspace=workspace)
                    .select_related("workspace", "created_by")
                    .prefetch_related(
                        # Only prefetch active versions for version number
                        Prefetch(
                            "versions",
                            queryset=WorkflowVersion.objects.filter(
                                is_active=True
                            ).only("id", "version_number", "workflow_id")[:1],
                            to_attr="active_versions_cache",
                        ),
                        # Only prefetch active triggers for trigger type
                        Prefetch(
                            "triggers",
                            queryset=Trigger.objects.filter(is_active=True).only(
                                "id", "trigger_type", "workflow_id"
                            )[:1],
                            to_attr="active_triggers_cache",
                        ),
                    )
                    .annotate(last_run_timestamp=Subquery(latest_run_subquery))
                    .only(
                        "id",
                        "name",
                        "description",
                        "status",
                        "is_active",
                        "created_at",
                        "updated_at",
                        "workspace_id",
                        "created_by_id",
                    )
                )
            else:
                # Full query for detail view
                latest_run_subquery = (
                    Run.objects.filter(workflow_version__workflow=OuterRef("pk"))
                    .order_by("-created_at")
                    .values("created_at")[:1]
                )

                return (
                    Workflow.objects.filter(workspace=workspace)
                    .select_related("workspace", "created_by")
                    .prefetch_related(
                        Prefetch(
                            "versions",
                            queryset=WorkflowVersion.objects.filter(is_active=True)
                            .only(
                                "id",
                                "version_number",
                                "workflow_id",
                                "is_active",
                                "created_at",
                            )
                            .order_by("-version_number"),
                            to_attr="active_versions_cache",
                        ),
                        Prefetch(
                            "versions",
                            queryset=WorkflowVersion.objects.only(
                                "id",
                                "version_number",
                                "workflow_id",
                                "is_active",
                                "created_at",
                            ).order_by("-created_at")[:1],
                            to_attr="latest_version_cache",
                        ),
                        Prefetch(
                            "triggers",
                            queryset=Trigger.objects.filter(is_active=True).only(
                                "id", "trigger_type", "workflow_id", "is_active"
                            ),
                            to_attr="active_triggers_cache",
                        ),
                    )
                    .annotate(last_run_timestamp=Subquery(latest_run_subquery))
                )
        # If no workspace context, return empty queryset
        return Workflow.objects.none()

    @action(detail=True, methods=["get"])
    def versions(self, request, pk=None):
        """Get all versions of a workflow"""
        workflow = self.get_object()
        versions = workflow.versions.all()
        serializer = WorkflowVersionSerializer(versions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def runs(self, request, pk=None):
        """Get all runs for a workflow"""
        workflow = self.get_object()
        active_version = workflow.get_active_version()
        if not active_version:
            return Response({"runs": []})

        runs = active_version.runs.all()[:50]  # Limit to recent 50 runs
        serializer = RunSerializer(runs, many=True)
        return Response({"runs": serializer.data})

    @action(detail=True, methods=["get", "post"])
    def drafts(self, request, pk=None):
        """
        Get or save workflow draft.

        GET /api/v1/workflows/{id}/drafts/ - Get current version
        POST /api/v1/workflows/{id}/drafts/ - Save to current version
        Body: {"definition": {...}}
        """
        # Optimize query to avoid N+1 - use select_related for current_version
        workflow = (
            Workflow.objects.select_related("current_version")
            .only("id", "name", "workspace_id", "current_version_id")
            .get(pk=pk)
        )

        if request.method == "GET":
            # Get current version
            current_version = workflow.current_version

            if not current_version:
                return Response(
                    {"status": "success", "data": None, "message": "No version found"}
                )

            serializer = WorkflowVersionSerializer(current_version)
            return Response(
                {
                    "status": "success",
                    "data": serializer.data,
                    "message": "Version retrieved successfully",
                }
            )

        elif request.method == "POST":
            # Validate definition
            definition = request.data.get("definition")
            if not definition:
                return Response(
                    {"status": "error", "message": "definition is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Validate graph structure
            from ..utils.graph_validation import validate_workflow_graph

            is_valid, errors = validate_workflow_graph(definition)

            if not is_valid:
                return Response(
                    {
                        "status": "error",
                        "data": {"validation_errors": errors},
                        "message": "Workflow graph validation failed",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Validate node configurations
            from ..node_editor import NodeEditor

            editor = NodeEditor()
            node_validation_errors = []

            nodes = definition.get("nodes", [])
            for node in nodes:
                node_data = node.get("data", {})
                connector_id = node_data.get("connectorType")
                action_id = node_data.get("action_id")

                if connector_id and action_id:
                    validation_result = editor.validate_node_config(
                        connector_id, action_id, node_data
                    )

                    if not validation_result["valid"]:
                        node_id = node.get("id", "unknown")
                        for error in validation_result["errors"]:
                            node_validation_errors.append(f"Node {node_id}: {error}")
                        for field, field_errors in validation_result[
                            "field_errors"
                        ].items():
                            for error in field_errors:
                                node_validation_errors.append(
                                    f"Node {node_id}, field {field}: {error}"
                                )

            # Note: We found validation errors, but we still allow saving as a draft
            # This enables users to save incomplete work
            if node_validation_errors:
                print(
                    f"Draft saved with {len(node_validation_errors)} validation errors"
                )

            # Get or create current version
            current_version = workflow.current_version

            if current_version:
                # Update existing current version
                print(f"DEBUG: Updating current version {current_version.id}")
                current_version.definition = definition
                current_version.save(update_fields=["definition", "updated_at"])
                print("DEBUG: Saved current version")
            else:
                # Create first version (version 1)
                print("DEBUG: Creating first version")
                current_version = WorkflowVersion.objects.create(
                    workflow=workflow,
                    version_number=1,
                    definition=definition,
                    is_active=False,
                    created_by=request.user,
                )

                # Set as current version
                workflow.current_version = current_version
                workflow.save(update_fields=["current_version", "updated_at"])

            return Response(
                {
                    "status": "success",
                    "saved": True,
                    "message": "Draft saved successfully",
                },
                status=status.HTTP_200_OK,
            )

    @action(detail=True, methods=["post"])
    def generate_draft(self, request, pk=None):
        """
        Generate a workflow draft from a natural language prompt.

        POST /api/v1/core/workflows/{id}/generate_draft/
        Body: {
            "prompt": "string",
            "llm_provider": "openai|anthropic|gemini|deepseek"
        }
        """
        from ..workflow_generator import WorkflowGenerator

        # Validate request
        serializer = WorkflowGenerateRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "data": serializer.errors,
                    "message": "Validation failed",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        prompt = serializer.validated_data["prompt"]
        llm_provider = serializer.validated_data.get("llm_provider", "openai")

        workflow = self.get_object()
        workspace = getattr(request, "workspace", None)

        try:
            generator = WorkflowGenerator()
            workflow_definition = generator.generate_from_prompt(
                prompt=prompt,
                llm_provider=llm_provider,
                workspace_id=str(workspace.id) if workspace else None,
            )

            # Validate generated graph
            from ..utils.graph_validation import validate_workflow_graph

            is_valid, errors = validate_workflow_graph(workflow_definition)

            if not is_valid:
                return Response(
                    {
                        "status": "error",
                        "data": {
                            "validation_errors": errors,
                            "definition": workflow_definition,
                        },
                        "message": "Generated workflow failed validation",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Validate node configurations
            from ..node_editor import NodeEditor

            editor = NodeEditor()
            node_validation_errors = []

            nodes = workflow_definition.get("nodes", [])
            for node in nodes:
                node_data = node.get("data", {})
                connector_id = node_data.get("connectorType")
                action_id = node_data.get("action_id")

                if connector_id and action_id:
                    validation_result = editor.validate_node_config(
                        connector_id, action_id, node_data
                    )

                    if not validation_result["valid"]:
                        node_id = node.get("id", "unknown")
                        for error in validation_result["errors"]:
                            node_validation_errors.append(f"Node {node_id}: {error}")

            # Note: We allow saving even with some validation warnings for generated workflows
            # The user can fix them in the editor

            # Get or create draft version
            draft_version = (
                workflow.versions.filter(is_active=False)
                .order_by("-created_at")
                .first()
            )

            if draft_version:
                # Update existing draft
                draft_version.definition = workflow_definition
                draft_version.save(update_fields=["definition", "updated_at"])
            else:
                # Create new draft version
                max_version = (
                    workflow.versions.aggregate(
                        max_version=models.Max("version_number")
                    )["max_version"]
                    or 0
                )

                draft_version = WorkflowVersion.objects.create(
                    workflow=workflow,
                    version_number=max_version + 1,
                    definition=workflow_definition,
                    is_active=False,
                    created_by=request.user,
                )

            serializer_response = WorkflowVersionSerializer(draft_version)
            return Response(
                {
                    "status": "success",
                    "data": {
                        "version": serializer_response.data,
                        "validation_warnings": node_validation_errors
                        if node_validation_errors
                        else [],
                    },
                    "message": "Workflow draft generated successfully",
                },
                status=status.HTTP_201_CREATED,
            )

        except ValueError as e:
            return Response(
                {"status": "error", "message": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error(
                f"Error generating workflow draft: {str(e)}",
                exc_info=e,
                extra={"workflow_id": pk, "llm_provider": llm_provider},
            )
            return Response(
                {
                    "status": "error",
                    "message": f"Error generating workflow draft: {str(e)}",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"])
    def validate_node(self, request, pk=None):
        """
        Validate a node configuration against connector manifest.

        POST /api/v1/core/workflows/{id}/validate_node/
        Body: {
            "connector_id": "string",
            "action_id": "string",
            "config": {}
        }
        """
        from ..node_editor import NodeEditor

        # Validate request
        serializer = NodeValidationRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "data": serializer.errors,
                    "message": "Validation request failed",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        connector_id = serializer.validated_data["connector_id"]
        action_id = serializer.validated_data["action_id"]
        config = serializer.validated_data["config"]

        try:
            editor = NodeEditor()
            validation_result = editor.validate_node_config(
                connector_id, action_id, config
            )

            # Validate credential references if any
            workspace = getattr(request, "workspace", None)
            if workspace:
                for field_name, field_value in config.items():
                    if (
                        field_name.endswith("_credential_id")
                        or field_name == "credential_id"
                    ):
                        if field_value:
                            from ..models import Credential

                            try:
                                Credential.objects.get(
                                    id=field_value, workspace=workspace
                                )
                            except Credential.DoesNotExist:
                                if field_name not in validation_result["field_errors"]:
                                    validation_result["field_errors"][field_name] = []
                                validation_result["field_errors"][field_name].append(
                                    f"Credential {field_value} not found in workspace"
                                )
                                validation_result["valid"] = False

            response_serializer = NodeValidationResponseSerializer(validation_result)

            return Response(
                {
                    "status": "success" if validation_result["valid"] else "error",
                    "data": response_serializer.data,
                    "message": "Node validation completed"
                    if validation_result["valid"]
                    else "Node validation failed",
                }
            )
        except Exception as e:
            logger.error(
                f"Error validating node: {str(e)}",
                exc_info=e,
                extra={
                    "workflow_id": pk,
                    "connector_id": connector_id,
                    "action_id": action_id,
                },
            )
            return Response(
                {"status": "error", "message": f"Error validating node: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"])
    def publish_version(self, request, pk=None):
        """
        Publish a workflow version (activate it).

        POST /api/v1/workflows/{id}/publish_version/
        Body: {"version_id": "uuid"} or {"definition": {...}} (creates new version)
        """
        workflow = self.get_object()

        version_id = request.data.get("version_id")
        definition = request.data.get("definition")

        if version_id:
            # Activate existing version
            try:
                version = workflow.versions.get(id=version_id)
            except WorkflowVersion.DoesNotExist:
                return Response(
                    {"status": "error", "message": "Version not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Validate definition if provided
            if definition:
                from ..utils.graph_validation import validate_workflow_graph

                is_valid, errors = validate_workflow_graph(definition)
                if not is_valid:
                    return Response(
                        {
                            "status": "error",
                            "data": {"validation_errors": errors},
                            "message": "Workflow graph validation failed",
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Validate node configurations
                from ..node_editor import NodeEditor

                editor = NodeEditor()
                node_validation_errors = []

                nodes = definition.get("nodes", [])
                for node in nodes:
                    node_data = node.get("data", {})
                    connector_id = node_data.get("connectorType")
                    action_id = node_data.get("action_id")

                    if connector_id and action_id:
                        validation_result = editor.validate_node_config(
                            connector_id, action_id, node_data
                        )

                        if not validation_result["valid"]:
                            node_id = node.get("id", "unknown")
                            for error in validation_result["errors"]:
                                node_validation_errors.append(
                                    f"Node {node_id}: {error}"
                                )
                            for field, field_errors in validation_result[
                                "field_errors"
                            ].items():
                                for error in field_errors:
                                    node_validation_errors.append(
                                        f"Node {node_id}, field {field}: {error}"
                                    )

                if node_validation_errors:
                    return Response(
                        {
                            "status": "error",
                            "data": {
                                "validation_errors": errors + node_validation_errors
                            },
                            "message": "Node configuration validation failed",
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                version.definition = definition

        elif definition:
            # Create and activate new version
            from ..utils.graph_validation import validate_workflow_graph

            is_valid, errors = validate_workflow_graph(definition)
            if not is_valid:
                return Response(
                    {
                        "status": "error",
                        "data": {"validation_errors": errors},
                        "message": "Workflow graph validation failed",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Validate node configurations
            from ..node_editor import NodeEditor

            editor = NodeEditor()
            node_validation_errors = []

            nodes = definition.get("nodes", [])
            for node in nodes:
                node_data = node.get("data", {})
                connector_id = node_data.get("connectorType")
                action_id = node_data.get("action_id")

                if connector_id and action_id:
                    validation_result = editor.validate_node_config(
                        connector_id, action_id, node_data
                    )

                    if not validation_result["valid"]:
                        node_id = node.get("id", "unknown")
                        for error in validation_result["errors"]:
                            node_validation_errors.append(f"Node {node_id}: {error}")
                        for field, field_errors in validation_result[
                            "field_errors"
                        ].items():
                            for error in field_errors:
                                node_validation_errors.append(
                                    f"Node {node_id}, field {field}: {error}"
                                )

            if node_validation_errors:
                return Response(
                    {
                        "status": "error",
                        "data": {"validation_errors": errors + node_validation_errors},
                        "message": "Node configuration validation failed",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Deactivate current active version
            workflow.versions.filter(is_active=True).update(is_active=False)

            # Create new active version
            max_version = (
                workflow.versions.aggregate(max_version=models.Max("version_number"))[
                    "max_version"
                ]
                or 0
            )

            version = WorkflowVersion.objects.create(
                workflow=workflow,
                version_number=max_version + 1,
                definition=definition,
                is_active=True,
                created_by=request.user,
            )
        else:
            return Response(
                {
                    "status": "error",
                    "message": "Either version_id or definition is required",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Deactivate other versions
        workflow.versions.exclude(id=version.id).filter(is_active=True).update(
            is_active=False
        )

        # Activate this version
        version.is_active = True
        version.save(update_fields=["is_active", "updated_at"])

        # Update workflow status to active
        if workflow.status != "active":
            workflow.status = "active"
            workflow.save(update_fields=["status", "updated_at"])

        serializer = WorkflowVersionSerializer(version)
        return Response(
            {
                "status": "success",
                "data": serializer.data,
                "message": "Version published successfully",
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["patch"])
    def activate(self, request, pk=None):
        """
        Activate or deactivate workflow.

        PATCH /api/v1/workflows/{id}/activate/
        Body: {"is_active": true/false}
        """
        workflow = self.get_object()
        is_active = request.data.get("is_active")

        if is_active is None:
            return Response(
                {"status": "error", "message": "is_active field required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate workflow if activating
        if is_active and not workflow.is_active:
            is_valid, errors = workflow.validate_for_activation()
            if not is_valid:
                return Response(
                    {
                        "status": "error",
                        "message": "Workflow has validation errors",
                        "data": {"validation_errors": errors},
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        workflow.is_active = is_active
        workflow.save(update_fields=["is_active", "updated_at"])

        serializer = WorkflowSerializer(workflow, context={"request": request})
        return Response(
            {
                "status": "success",
                "data": serializer.data,
                "message": f"Workflow {'activated' if is_active else 'deactivated'} successfully",
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="versions")
    def create_version(self, request, pk=None):
        """
        Create new version snapshot.

        POST /api/v1/workflows/{id}/versions/
        Body: {"version_label": "Before major refactor"}
        """
        workflow = self.get_object()
        current_version = workflow.current_version

        if not current_version:
            return Response(
                {"status": "error", "message": "No current version to snapshot"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create new version as snapshot
        max_version = (
            workflow.versions.aggregate(max_version=models.Max("version_number"))[
                "max_version"
            ]
            or 0
        )

        new_version = WorkflowVersion.objects.create(
            workflow=workflow,
            version_number=max_version + 1,
            definition=current_version.definition.copy(),
            created_manually=True,
            version_label=request.data.get("version_label", ""),
            created_by=request.user,
            is_active=False,
        )

        serializer = WorkflowVersionSerializer(new_version)
        return Response(
            {
                "status": "success",
                "data": serializer.data,
                "message": "Version created successfully",
            },
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="versions/(?P<version_id>[^/.]+)/restore",
    )
    def restore_version(self, request, pk=None, version_id=None):
        """
        Restore a previous version.

        POST /api/v1/workflows/{id}/versions/{version_id}/restore/
        """
        workflow = self.get_object()

        try:
            version_to_restore = workflow.versions.get(id=version_id)
        except WorkflowVersion.DoesNotExist:
            return Response(
                {"status": "error", "message": "Version not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        current_version = workflow.current_version
        if not current_version:
            return Response(
                {"status": "error", "message": "No current version exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Copy definition from old version to current version
        current_version.definition = version_to_restore.definition.copy()
        current_version.save(update_fields=["definition", "updated_at"])

        serializer = WorkflowVersionSerializer(current_version)
        return Response(
            {
                "status": "success",
                "data": serializer.data,
                "message": f"Restored from version {version_to_restore.version_number}",
            },
            status=status.HTTP_200_OK,
        )


class WorkflowVersionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for WorkflowVersion model
    """

    serializer_class = WorkflowVersionSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        """Filter versions by workspace via workflow"""
        workspace = getattr(self.request, "workspace", None)
        if workspace:
            return WorkflowVersion.objects.filter(workflow__workspace=workspace)
        return WorkflowVersion.objects.none()
