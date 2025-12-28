"""
Views for core app

Read-only ViewSets for workflow models with workspace scoping.
"""

from django.db import transaction
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError
from django.db import models
from apps.accounts.permissions import (
    IsWorkspaceMember,
    HasCredentialPermission,
    IsWorkspaceAdmin,
)
from .permissions import CanCommentOnWorkflow, CanEditWorkflow
from apps.common.logging_utils import get_logger
from .models import (
    Workflow,
    WorkflowVersion,
    Run,
    RunStep,
    Trigger,
    Credential,
    CredentialUsage,
    RunLog,
    RunTrace,
    AlertConfiguration,
    AlertHistory,
    ErrorSuggestion,
    WorkflowTemplate,
    WorkflowComment,
    WorkflowPresence,
    CustomConnector,
    CustomConnectorVersion,
    Connector,
)
from .serializers import (
    WorkflowSerializer,
    WorkflowVersionSerializer,
    RunSerializer,
    RunStepSerializer,
    TriggerSerializer,
    WebhookTriggerSerializer,
    ManualTriggerSerializer,
    ConnectorSerializer,
    CredentialListSerializer,
    CredentialCreateSerializer,
    CredentialUpdateSerializer,
    CredentialDetailSerializer,
    CredentialUsageSerializer,
    RunLogSerializer,
    RunTraceSerializer,
    AlertConfigurationSerializer,
    AlertHistorySerializer,
    ErrorSuggestionSerializer,
    FormSchemaSerializer,
    NodeValidationRequestSerializer,
    NodeValidationResponseSerializer,
    WorkflowGenerateRequestSerializer,
    WorkflowTemplateListSerializer,
    WorkflowTemplateDetailSerializer,
    WorkflowTemplateCreateSerializer,
    WorkflowCommentSerializer,
    WorkflowPresenceSerializer,
    CustomConnectorSerializer,
    CustomConnectorVersionSerializer,
)
from .orchestrator import RunOrchestrator
from .utils import generate_idempotency_key, validate_webhook_signature
from .tasks import execute_workflow_run
from .supabase_trigger_handler import trigger_manager
from .utils.template_cloner import TemplateCloner

logger = get_logger(__name__)


class WorkflowViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Workflow model

    Filters workflows by workspace from request context.
    """

    serializer_class = WorkflowSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

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
        """Filter workflows by workspace"""
        workspace = self._get_workspace_context()
        if workspace:
            return Workflow.objects.filter(workspace=workspace)
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

        GET /api/v1/workflows/{id}/drafts/ - Get current draft
        POST /api/v1/workflows/{id}/drafts/ - Save draft
        Body: {"definition": {...}}
        """
        workflow = self.get_object()

        if request.method == "GET":
            # Get latest draft (inactive version)
            draft_version = (
                workflow.versions.filter(is_active=False)
                .order_by("-created_at")
                .first()
            )

            if not draft_version:
                return Response(
                    {"status": "success", "data": None, "message": "No draft found"}
                )

            serializer = WorkflowVersionSerializer(draft_version)
            return Response(
                {
                    "status": "success",
                    "data": serializer.data,
                    "message": "Draft retrieved successfully",
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
            from .utils.graph_validation import validate_workflow_graph

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
            from .node_editor import NodeEditor

            editor = NodeEditor()
            node_validation_errors = []

            nodes = definition.get("nodes", [])
            for node in nodes:
                node_type = node.get("type")
                node_data = node.get("data", {})
                action_id = node_data.get("action_id")

                if node_type and action_id:
                    validation_result = editor.validate_node_config(
                        node_type, action_id, node_data
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

            # Get or create draft version
            draft_version = (
                workflow.versions.filter(is_active=False)
                .order_by("-created_at")
                .first()
            )

            if draft_version:
                # Update existing draft
                print(f"DEBUG: Updating existing draft {draft_version.id}")
                print(
                    f"DEBUG: Old definition keys: {draft_version.definition.keys() if isinstance(draft_version.definition, dict) else 'not dict'}"
                )
                print(
                    f"DEBUG: New definition keys: {definition.keys() if isinstance(definition, dict) else 'not dict'}"
                )
                draft_version.definition = definition
                draft_version.save(update_fields=["definition", "updated_at"])
                print("DEBUG: Saved draft")
            else:
                print("DEBUG: Creating new draft")
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
                    definition=definition,
                    is_active=False,
                    created_by=request.user,
                )

            serializer = WorkflowVersionSerializer(draft_version)
            return Response(
                {
                    "status": "success",
                    "data": serializer.data,
                    "message": "Draft saved successfully",
                },
                status=status.HTTP_201_CREATED,
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
        from .workflow_generator import WorkflowGenerator

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
            from .utils.graph_validation import validate_workflow_graph

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
            from .node_editor import NodeEditor

            editor = NodeEditor()
            node_validation_errors = []

            nodes = workflow_definition.get("nodes", [])
            for node in nodes:
                node_type = node.get("type")
                node_data = node.get("data", {})
                action_id = node_data.get("action_id")

                if node_type and action_id:
                    validation_result = editor.validate_node_config(
                        node_type, action_id, node_data
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
        from .node_editor import NodeEditor

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
                            from .models import Credential

                            try:
                                credential = Credential.objects.get(
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
                from .utils.graph_validation import validate_workflow_graph

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
                from .node_editor import NodeEditor

                editor = NodeEditor()
                node_validation_errors = []

                nodes = definition.get("nodes", [])
                for node in nodes:
                    node_type = node.get("type")
                    node_data = node.get("data", {})
                    action_id = node_data.get("action_id")

                    if node_type and action_id:
                        validation_result = editor.validate_node_config(
                            node_type, action_id, node_data
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
            from .utils.graph_validation import validate_workflow_graph

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
            from .node_editor import NodeEditor

            editor = NodeEditor()
            node_validation_errors = []

            nodes = definition.get("nodes", [])
            for node in nodes:
                node_type = node.get("type")
                node_data = node.get("data", {})
                action_id = node_data.get("action_id")

                if node_type and action_id:
                    validation_result = editor.validate_node_config(
                        node_type, action_id, node_data
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

        serializer = WorkflowVersionSerializer(version)
        return Response(
            {
                "status": "success",
                "data": serializer.data,
                "message": "Version published successfully",
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


class RunViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for Run model
    """

    serializer_class = RunSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        """Filter runs by workspace via workflow version"""
        workspace = getattr(self.request, "workspace", None)
        if workspace:
            return Run.objects.filter(workflow_version__workflow__workspace=workspace)
        return Run.objects.none()

    @action(detail=True, methods=["get"])
    def steps(self, request, pk=None):
        """Get all steps for a run"""
        run = self.get_object()
        steps = run.steps.all()
        serializer = RunStepSerializer(steps, many=True)
        return Response({"steps": serializer.data})

    @action(detail=True, methods=["post"])
    def replay(self, request, pk=None):
        """
        Replay a workflow run from the beginning.

        POST /api/v1/core/runs/{id}/replay/
        """
        from .replay_service import ReplayService

        run = self.get_object()

        # Validate run is in terminal state
        if run.status not in ["completed", "failed", "cancelled"]:
            return Response(
                {
                    "status": "error",
                    "message": f"Cannot replay run: run must be in a terminal state (current: {run.status})",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            replay_service = ReplayService()
            replay_run = replay_service.replay_full_run(
                run_id=run.id,
                triggered_by=request.user if request.user.is_authenticated else None,
            )

            serializer = RunSerializer(replay_run)
            return Response(
                {
                    "status": "success",
                    "data": serializer.data,
                    "message": "Run replay initiated successfully",
                },
                status=status.HTTP_201_CREATED,
            )

        except ValidationError as e:
            return Response(
                {"status": "error", "message": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error(
                f"Error replaying run {run.id}: {str(e)}",
                exc_info=e,
                extra={"run_id": str(run.id)},
            )
            return Response(
                {
                    "status": "error",
                    "message": "An error occurred while replaying the run",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"])
    def replay_from_step(self, request, pk=None):
        """
        Replay a workflow run from a specific step.

        POST /api/v1/core/runs/{id}/replay_from_step/
        Body: {"step_id": "string"}
        """
        from .replay_service import ReplayService

        run = self.get_object()
        step_id = request.data.get("step_id")

        if not step_id:
            return Response(
                {"status": "error", "message": "step_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate run is in terminal state
        if run.status not in ["completed", "failed", "cancelled"]:
            return Response(
                {
                    "status": "error",
                    "message": f"Cannot replay run: run must be in a terminal state (current: {run.status})",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            replay_service = ReplayService()
            replay_run = replay_service.replay_from_step(
                run_id=run.id,
                step_id=step_id,
                triggered_by=request.user if request.user.is_authenticated else None,
            )

            serializer = RunSerializer(replay_run)
            return Response(
                {
                    "status": "success",
                    "data": serializer.data,
                    "message": "Partial run replay initiated successfully",
                },
                status=status.HTTP_201_CREATED,
            )

        except ValidationError as e:
            return Response(
                {"status": "error", "message": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error(
                f"Error replaying run {run.id} from step {step_id}: {str(e)}",
                exc_info=e,
                extra={"run_id": str(run.id), "step_id": step_id},
            )
            return Response(
                {
                    "status": "error",
                    "message": "An error occurred while replaying the run",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["get"])
    def replay_lineage(self, request, pk=None):
        """
        Get replay lineage for a run.

        GET /api/v1/core/runs/{id}/replay_lineage/
        """
        from .replay_service import ReplayService

        run = self.get_object()

        try:
            replay_service = ReplayService()
            lineage = replay_service.get_replay_lineage(run.id)

            return Response(
                {
                    "status": "success",
                    "data": {"lineage": lineage, "current_run_id": str(run.id)},
                    "message": "Replay lineage retrieved successfully",
                }
            )
        except Exception as e:
            logger.error(
                f"Error getting replay lineage for run {run.id}: {str(e)}",
                exc_info=e,
                extra={"run_id": str(run.id)},
            )
            return Response(
                {
                    "status": "error",
                    "message": "An error occurred while retrieving replay lineage",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class RunStepViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for RunStep model
    """

    serializer_class = RunStepSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        """Filter steps by workspace via run"""
        workspace = getattr(self.request, "workspace", None)
        if workspace:
            return RunStep.objects.filter(
                run__workflow_version__workflow__workspace=workspace
            )
        return RunStep.objects.none()


class TriggerViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for Trigger model
    """

    serializer_class = TriggerSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        """Filter triggers by workspace via workflow"""
        workspace = getattr(self.request, "workspace", None)
        if workspace:
            return Trigger.objects.filter(workflow__workspace=workspace)
        return Trigger.objects.none()

    @action(detail=True, methods=["post"])
    def manual_trigger(self, request, pk=None):
        """
        Manually trigger a workflow run.

        POST /api/v1/core/triggers/{id}/manual_trigger/
        Body: {"input_data": {...}}
        """
        trigger = self.get_object()

        # Check if trigger is active
        if not trigger.is_active:
            return Response(
                {"status": "error", "message": "Trigger is not active"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate input data
        serializer = ManualTriggerSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "data": serializer.errors,
                    "message": "Validation failed",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        input_data = serializer.validated_data.get("input_data", {})

        # Get active workflow version
        workflow_version = trigger.workflow.get_active_version()
        if not workflow_version:
            return Response(
                {"status": "error", "message": "Workflow has no active version"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Generate idempotency key
            idempotency_key = generate_idempotency_key(
                trigger_id=str(trigger.id), payload=input_data
            )

            # Create and enqueue run
            orchestrator = RunOrchestrator()
            run = orchestrator.create_run(
                workflow_version=workflow_version,
                trigger_type="manual",
                input_data=input_data,
                triggered_by=request.user,
                idempotency_key=idempotency_key,
                check_limits=True,
            )

            # Enqueue execution
            execute_workflow_run.delay(str(run.id))

            logger.info(
                f"Manually triggered workflow {trigger.workflow.id} via trigger {trigger.id}",
                extra={
                    "trigger_id": str(trigger.id),
                    "workflow_id": str(trigger.workflow.id),
                    "run_id": str(run.id),
                    "user_id": str(request.user.id)
                    if request.user.is_authenticated
                    else None,
                },
            )

            return Response(
                {
                    "status": "success",
                    "data": {"run_id": str(run.id), "status": run.status},
                    "message": "Workflow run created successfully",
                },
                status=status.HTTP_201_CREATED,
            )

        except ValidationError as e:
            return Response(
                {"status": "error", "message": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error(
                f"Error triggering workflow: {str(e)}",
                exc_info=e,
                extra={
                    "trigger_id": str(trigger.id),
                    "user_id": str(request.user.id)
                    if request.user.is_authenticated
                    else None,
                },
            )
            return Response(
                {
                    "status": "error",
                    "message": "An error occurred while triggering the workflow",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        """
        Activate a Supabase Realtime trigger.

        POST /api/v1/core/triggers/{id}/activate/
        """
        trigger = self.get_object()

        if trigger.trigger_type != "supabase_realtime":
            return Response(
                {
                    "status": "error",
                    "message": "This endpoint is only for Supabase Realtime triggers",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        success = trigger_manager.activate_trigger(trigger)

        if success:
            trigger.is_active = True
            trigger.save(update_fields=["is_active", "updated_at"])

            return Response(
                {"status": "success", "message": "Trigger activated successfully"},
                status=status.HTTP_200_OK,
            )
        else:
            return Response(
                {
                    "status": "error",
                    "message": "Failed to activate trigger. Check logs for details.",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        """
        Deactivate a Supabase Realtime trigger.

        POST /api/v1/core/triggers/{id}/deactivate/
        """
        trigger = self.get_object()

        if trigger.trigger_type != "supabase_realtime":
            return Response(
                {
                    "status": "error",
                    "message": "This endpoint is only for Supabase Realtime triggers",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        success = trigger_manager.deactivate_trigger(str(trigger.id))

        if success:
            trigger.is_active = False
            trigger.save(update_fields=["is_active", "updated_at"])

            return Response(
                {"status": "success", "message": "Trigger deactivated successfully"},
                status=status.HTTP_200_OK,
            )
        else:
            return Response(
                {
                    "status": "error",
                    "message": "Failed to deactivate trigger. Check logs for details.",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class WebhookTriggerView(APIView):
    """
    Webhook endpoint for triggering workflows.

    POST /api/v1/core/triggers/webhook/{trigger_id}/
    """

    permission_classes = []  # Public endpoint for webhooks

    def post(self, request, trigger_id):
        """
        Handle webhook trigger request.

        Args:
            request: Django request object
            trigger_id: UUID string of the trigger
        """
        try:
            trigger = get_object_or_404(Trigger, id=trigger_id, trigger_type="webhook")

            # Check if trigger is active
            if not trigger.is_active:
                return Response(
                    {"status": "error", "message": "Trigger is not active"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Validate webhook payload
            serializer = WebhookTriggerSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    {
                        "status": "error",
                        "data": serializer.errors,
                        "message": "Validation failed",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            payload = serializer.validated_data

            # Validate webhook signature if configured
            config = trigger.config or {}
            secret = config.get("secret")
            if secret:
                signature = request.META.get("HTTP_X_WEBHOOK_SIGNATURE", "")
                if not signature:
                    return Response(
                        {"status": "error", "message": "Missing webhook signature"},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )

                try:
                    if not validate_webhook_signature(request.body, signature, secret):
                        return Response(
                            {"status": "error", "message": "Invalid webhook signature"},
                            status=status.HTTP_401_UNAUTHORIZED,
                        )
                except Exception as e:
                    logger.error(
                        f"Error validating webhook signature: {str(e)}",
                        exc_info=e,
                        extra={"trigger_id": str(trigger.id)},
                    )
                    return Response(
                        {"status": "error", "message": "Error validating signature"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )

            # Get active workflow version
            workflow_version = trigger.workflow.get_active_version()
            if not workflow_version:
                return Response(
                    {"status": "error", "message": "Workflow has no active version"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Generate idempotency key
            idempotency_key = generate_idempotency_key(
                trigger_id=str(trigger.id), payload=payload
            )

            # Create and enqueue run
            orchestrator = RunOrchestrator()
            run = orchestrator.create_run(
                workflow_version=workflow_version,
                trigger_type="webhook",
                input_data=payload,
                triggered_by=None,  # Webhooks are not user-initiated
                idempotency_key=idempotency_key,
                check_limits=True,
            )

            # Enqueue execution
            execute_workflow_run.delay(str(run.id))

            logger.info(
                f"Webhook triggered workflow {trigger.workflow.id} via trigger {trigger.id}",
                extra={
                    "trigger_id": str(trigger.id),
                    "workflow_id": str(trigger.workflow.id),
                    "run_id": str(run.id),
                },
            )

            return Response(
                {
                    "status": "success",
                    "data": {"run_id": str(run.id), "status": run.status},
                    "message": "Webhook received and workflow run created",
                },
                status=status.HTTP_201_CREATED,
            )

        except ValidationError as e:
            return Response(
                {"status": "error", "message": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error(
                f"Error handling webhook: {str(e)}",
                exc_info=e,
                extra={"trigger_id": trigger_id},
            )
            return Response(
                {
                    "status": "error",
                    "message": "An error occurred while processing the webhook",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


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
        """List all available connectors"""
        # Get system connectors from the database
        system_connectors = self.get_queryset()
        serializer = self.get_serializer(system_connectors, many=True)
        connectors_data = serializer.data

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
                manifest = custom.current_version.manifest or {}
                connectors_data.append(
                    {
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
        from .node_editor import NodeEditor

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


class RunLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for querying run logs.

    Supports filtering by run, step, level, time range, and correlation_id.
    """

    serializer_class = RunLogSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        """Filter logs by workspace and query parameters"""
        workspace = getattr(self.request, "workspace", None)
        if not workspace:
            return RunLog.objects.none()

        # Base queryset filtered by workspace via run
        queryset = RunLog.objects.filter(
            run__workflow_version__workflow__workspace=workspace
        )

        # Filter by run_id
        run_id = self.request.query_params.get("run_id")
        if run_id:
            queryset = queryset.filter(run_id=run_id)

        # Filter by step_id
        step_id = self.request.query_params.get("step_id")
        if step_id:
            queryset = queryset.filter(step__step_id=step_id)

        # Filter by level
        level = self.request.query_params.get("level")
        if level:
            queryset = queryset.filter(level=level.upper())

        # Filter by correlation_id
        correlation_id = self.request.query_params.get("correlation_id")
        if correlation_id:
            queryset = queryset.filter(correlation_id=correlation_id)

        # Filter by time range
        start_time = self.request.query_params.get("start_time")
        if start_time:
            try:
                from django.utils.dateparse import parse_datetime

                start_dt = parse_datetime(start_time)
                if start_dt:
                    queryset = queryset.filter(timestamp__gte=start_dt)
            except Exception:
                pass

        end_time = self.request.query_params.get("end_time")
        if end_time:
            try:
                from django.utils.dateparse import parse_datetime

                end_dt = parse_datetime(end_time)
                if end_dt:
                    queryset = queryset.filter(timestamp__lte=end_dt)
            except Exception:
                pass

        return queryset.order_by("-timestamp")


class RunTraceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for retrieving run traces.

    Provides complete trace structure for workflow runs.
    """

    serializer_class = RunTraceSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        """Filter traces by workspace"""
        workspace = getattr(self.request, "workspace", None)
        if workspace:
            return RunTrace.objects.filter(
                run__workflow_version__workflow__workspace=workspace
            )
        return RunTrace.objects.none()

    def retrieve(self, request, pk=None):
        """Get trace for a run, building it if it doesn't exist"""
        from .trace_aggregator import TraceAggregator

        try:
            run = Run.objects.get(id=pk)

            # Check workspace access
            workspace = getattr(request, "workspace", None)
            if workspace and run.workflow_version.workflow.workspace != workspace:
                return Response(
                    {"status": "error", "message": "Run not found in workspace"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Get or build trace
            try:
                trace = RunTrace.objects.get(run=run)
            except RunTrace.DoesNotExist:
                # Build trace if it doesn't exist
                aggregator = TraceAggregator()
                trace = aggregator.update_trace(run)

            serializer = self.get_serializer(trace)
            return Response(
                {
                    "status": "success",
                    "data": serializer.data,
                    "message": "Trace retrieved successfully",
                }
            )

        except Run.DoesNotExist:
            return Response(
                {"status": "error", "message": "Run not found"},
                status=status.HTTP_404_NOT_FOUND,
            )


class AlertConfigurationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing alert configurations.

    Provides CRUD operations for workflow alert configurations.
    """

    serializer_class = AlertConfigurationSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        """Filter alert configurations by workspace"""
        workspace = getattr(self.request, "workspace", None)
        if workspace:
            return AlertConfiguration.objects.filter(workflow__workspace=workspace)
        return AlertConfiguration.objects.none()

    def perform_create(self, serializer):
        """Create alert configuration with workspace validation"""
        workflow = serializer.validated_data["workflow"]
        workspace = getattr(self.request, "workspace", None)

        if workspace and workflow.workspace != workspace:
            raise ValidationError("Workflow does not belong to workspace")

        serializer.save()

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        """Get alert history for this configuration"""
        alert_config = self.get_object()
        history = alert_config.alert_history.all()[:50]  # Limit to recent 50
        serializer = AlertHistorySerializer(history, many=True)
        return Response(
            {
                "status": "success",
                "data": serializer.data,
                "message": "Alert history retrieved successfully",
            }
        )


class AlertHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for alert history.

    Provides read access to alert sending history.
    """

    serializer_class = AlertHistorySerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        """Filter alert history by workspace"""
        workspace = getattr(self.request, "workspace", None)
        if workspace:
            return AlertHistory.objects.filter(
                alert_config__workflow__workspace=workspace
            )
        return AlertHistory.objects.none()


class ErrorSuggestionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for error suggestions.

    Provides read access to AI-generated error fix suggestions.
    """

    serializer_class = ErrorSuggestionSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        """Filter suggestions by workspace"""
        workspace = getattr(self.request, "workspace", None)
        if workspace:
            return ErrorSuggestion.objects.filter(
                run_step__run__workflow_version__workflow__workspace=workspace
            )
        return ErrorSuggestion.objects.none()

    @action(
        detail=False,
        methods=["get"],
        url_path="runs/(?P<run_id>[^/.]+)/steps/(?P<step_id>[^/.]+)",
    )
    def for_step(self, request, run_id=None, step_id=None):
        """Get suggestions for a specific step"""
        try:
            run = Run.objects.get(id=run_id)
            step = run.steps.get(step_id=step_id)

            # Check workspace access
            workspace = getattr(request, "workspace", None)
            if workspace and run.workflow_version.workflow.workspace != workspace:
                return Response(
                    {"status": "error", "message": "Step not found in workspace"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            suggestions = step.error_suggestions.all()
            serializer = self.get_serializer(suggestions, many=True)

            return Response(
                {
                    "status": "success",
                    "data": serializer.data,
                    "message": "Suggestions retrieved successfully",
                }
            )

        except (Run.DoesNotExist, RunStep.DoesNotExist):
            return Response(
                {"status": "error", "message": "Step not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

    @action(detail=True, methods=["post"])
    def apply(self, request, pk=None):
        """Apply a suggestion (update step inputs with fix_data)"""
        try:
            suggestion = self.get_object()

            if not suggestion.actionable:
                return Response(
                    {"status": "error", "message": "This suggestion is not actionable"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not suggestion.fix_data:
                return Response(
                    {
                        "status": "error",
                        "message": "No fix data available for this suggestion",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Update step inputs with fix_data
            step = suggestion.run_step
            step.inputs.update(suggestion.fix_data)
            step.save(update_fields=["inputs", "updated_at"])

            logger.info(
                f"Applied suggestion {suggestion.id} to step {step.step_id}",
                extra={
                    "suggestion_id": str(suggestion.id),
                    "step_id": step.step_id,
                    "fix_data": suggestion.fix_data,
                },
            )

            return Response(
                {
                    "status": "success",
                    "data": {
                        "suggestion_id": str(suggestion.id),
                        "step_id": step.step_id,
                        "applied_fix_data": suggestion.fix_data,
                    },
                    "message": "Suggestion applied successfully",
                }
            )

        except ErrorSuggestion.DoesNotExist:
            return Response(
                {"status": "error", "message": "Suggestion not found"},
                status=status.HTTP_404_NOT_FOUND,
            )


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
        except:
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


class CustomConnectorViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing custom (user-contributed) connectors.

    Connectors are scoped to a workspace and managed by workspace admins.
    """

    serializer_class = CustomConnectorSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        """Filter custom connectors by workspace."""
        workspace = getattr(self.request, "workspace", None)
        if workspace:
            return CustomConnector.objects.filter(workspace=workspace)
        return CustomConnector.objects.none()

    def get_permissions(self):
        """
        Require workspace admin privileges for write operations.
        """
        base_perms = [IsAuthenticated(), IsWorkspaceMember()]
        admin_actions = {"create", "update", "partial_update", "destroy"}
        if self.action in admin_actions:
            base_perms.append(IsWorkspaceAdmin())
        return base_perms

    def perform_create(self, serializer):
        """Set workspace and created_by from request context."""
        workspace = getattr(self.request, "workspace", None)
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
            "create",
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
