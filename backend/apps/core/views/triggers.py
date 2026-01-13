"""
Trigger-related views.

ViewSets for Trigger model and WebhookTriggerView.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import ValidationError

from apps.accounts.permissions import IsWorkspaceMember
from apps.common.logging_utils import get_logger
from ..models import Trigger
from ..serializers import TriggerSerializer, ManualTriggerSerializer
from ..orchestrator import RunOrchestrator
from ..utils import generate_idempotency_key, validate_webhook_signature
from ..tasks import execute_workflow_run
from ..supabase_trigger_handler import trigger_manager

logger = get_logger(__name__)


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

    Supports: GET, POST, PUT, PATCH, DELETE
    Path: /api/v1/core/webhook/{webhook_id}/
    """

    permission_classes = []  # Public endpoint for webhooks

    def get(self, request, webhook_id):
        return self._handle_request(request, webhook_id)

    def post(self, request, webhook_id):
        return self._handle_request(request, webhook_id)

    def put(self, request, webhook_id):
        return self._handle_request(request, webhook_id)

    def patch(self, request, webhook_id):
        return self._handle_request(request, webhook_id)

    def delete(self, request, webhook_id):
        return self._handle_request(request, webhook_id)

    def _handle_request(self, request, webhook_id):
        """
        Handle webhook trigger request for all methods.

        Args:
            request: Django request object
            webhook_id: UUID string of the webhook (stored in node data)
        """
        try:
            # Find workflow with this webhook_id in its definition
            workflow_version = None
            webhook_node = None

            # Look for active workflows with current_version
            from ..models import Workflow

            active_workflows = Workflow.objects.filter(
                is_active=True, current_version__isnull=False
            ).select_related("current_version")

            for workflow in active_workflows:
                version = workflow.current_version
                definition = version.definition or {}
                nodes = definition.get("nodes", [])

                for node in nodes:
                    node_data = node.get("data", {})
                    # Check if this is a webhook node with matching ID
                    # The node's id field is the webhook_id (React Flow node ID)
                    connector_type = node_data.get("connectorType")
                    node_id = node.get("id")

                    # Check if node matches the requested Webhook ID.
                    # We allow any node to be triggered if the ID matches, supporting Custom Connectors.
                    if str(node_id) == str(webhook_id):
                        workflow_version = version
                        webhook_node = node
                        break

                if workflow_version:
                    break

            if not workflow_version or not webhook_node:
                return Response(
                    {"status": "error", "message": "Webhook not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Get webhook configuration from node data
            node_data = webhook_node.get("data", {})
            webhook_config = node_data.get("config", {})

            # Validate HTTP method
            # Check in config first, then in node data directly (for different storage patterns)
            # Default to GET per webhook manifest default
            configured_method = (
                webhook_config.get("http_method")
                or webhook_config.get("method")
                or node_data.get("http_method")
                or node_data.get("method")
                or "GET"  # Default from webhook manifest
            ).upper()

            if request.method != configured_method:
                return Response(
                    {
                        "status": "error",
                        "message": f"Method {request.method} not allowed. Expected {configured_method}",
                    },
                    status=status.HTTP_405_METHOD_NOT_ALLOWED,
                )

            secret = webhook_config.get("secret")

            # Validate webhook signature if configured
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
                        extra={"webhook_id": str(webhook_id)},
                    )
                    return Response(
                        {"status": "error", "message": "Error validating signature"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )

            # Prepare webhook payload
            payload = {
                "method": request.method,
                "headers": dict(request.headers),
                "body": request.data,
                "query_params": dict(request.GET),
            }

            # Generate idempotency key
            idempotency_key = generate_idempotency_key(
                trigger_id=str(webhook_id), payload=payload
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
                f"Webhook triggered workflow {workflow_version.workflow.id} via webhook {webhook_id}",
                extra={
                    "webhook_id": str(webhook_id),
                    "workflow_id": str(workflow_version.workflow.id),
                    "run_id": str(run.id),
                },
            )

            return Response(
                {
                    "status": "success",
                    "data": {"run_id": str(run.id)},
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
                extra={"webhook_id": str(webhook_id)},
            )
            return Response(
                {
                    "status": "error",
                    "message": "An error occurred while processing the webhook",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
