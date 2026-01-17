"""
Trigger-related views.

ViewSets for Trigger model and WebhookTriggerView.
"""

from django.core.exceptions import ValidationError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsWorkspaceMember
from apps.common.logging_utils import get_logger

from ..models import Trigger
from ..orchestrator import RunOrchestrator
from ..serializers import ManualTriggerSerializer, TriggerSerializer
from ..supabase_trigger_handler import trigger_manager
from ..tasks import execute_workflow_run
from ..utils import generate_idempotency_key

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

    authentication_classes = []  # Skip default JWT auth - we handle auth ourselves
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
        import base64
        import json
        import re
        import traceback

        try:
            # Find workflow with this webhook_id in its definition
            workflow_version = None
            webhook_node = None

            # Look for active workflows with current_version
            # Optimized query to reduce DB hits
            from ..models import Workflow

            # TODO: Improve this lookup with a direct mapping or cache
            active_workflows = Workflow.objects.filter(
                is_active=True, current_version__isnull=False
            ).select_related("current_version")

            for workflow in active_workflows:
                version = workflow.current_version
                definition = version.definition or {}
                nodes = definition.get("nodes", [])

                for node in nodes:
                    node_id = node.get("id")
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
            # Merge 'config' and top-level fields for backward compatibility
            webhook_config = node_data.get("config", {})

            # Helper to get config value from either location
            def get_config(key, default=None):
                return webhook_config.get(key) or node_data.get(key) or default

            # --- 1. IP Whitelist ---
            ip_whitelist = get_config("ip_whitelist")
            if ip_whitelist:
                # Get client IP
                client_ip = request.META.get("REMOTE_ADDR")
                # Handle X-Forwarded-For if behind proxy
                x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
                if x_forwarded_for:
                    client_ip = x_forwarded_for.split(",")[0].strip()

                allowed_ips = [
                    ip.strip() for ip in ip_whitelist.split(",") if ip.strip()
                ]
                if client_ip not in allowed_ips:
                    logger.warning(f"Webhook {webhook_id} blocked IP: {client_ip}")
                    return Response(
                        {"status": "error", "message": "IP not authorized"},
                        status=status.HTTP_403_FORBIDDEN,
                    )

            # --- 2. Ignore Bots ---
            if get_config("ignore_bots"):
                user_agent = request.META.get("HTTP_USER_AGENT", "")
                # Common bot patterns
                bot_pattern = re.compile(
                    r"(bot|spider|crawl|slurp|facebook)", re.IGNORECASE
                )
                if bot_pattern.search(user_agent):
                    logger.info(f"Webhook {webhook_id} ignored bot: {user_agent}")
                    # Return 200 to satisfy the bot, but don't trigger workflow
                    return Response(
                        {"status": "ignored", "message": "Bot request ignored"},
                        status=status.HTTP_200_OK,
                    )

            # --- 3. Authentication ---
            auth_type = get_config("authentication", "None")

            # Fetch and decrypt credential if authentication requires it
            credential_data = {}
            if auth_type != "None":
                credential_id = get_config("credential_id")
                if credential_id:
                    try:
                        from ..encryption import get_encryption_service
                        from ..models import Credential

                        credential = Credential.objects.get(id=credential_id)
                        encryption = get_encryption_service()
                        credential_data = encryption.decrypt_dict(
                            credential.encrypted_data
                        )
                    except Credential.DoesNotExist:
                        logger.warning(
                            f"Credential {credential_id} not found for webhook {webhook_id}"
                        )
                    except Exception as e:
                        logger.error(
                            f"Failed to decrypt credential for webhook {webhook_id}: {e}"
                        )

            if auth_type == "Basic Auth":
                auth_header = request.META.get("HTTP_AUTHORIZATION", "")
                auth_user = credential_data.get("username", "")
                auth_pass = credential_data.get("password", "")

                if not auth_header.startswith("Basic "):
                    return Response(
                        {"status": "error", "message": "Missing Authorization header"},
                        status=status.HTTP_401_UNAUTHORIZED,
                        headers={"WWW-Authenticate": 'Basic realm="Webhook"'},
                    )

                try:
                    encoded_credentials = auth_header.split(" ")[1]
                    decoded_credentials = base64.b64decode(encoded_credentials).decode(
                        "utf-8"
                    )
                    username, password = decoded_credentials.split(":", 1)

                    if username != auth_user or password != auth_pass:
                        return Response(
                            {"status": "error", "message": "Invalid credentials"},
                            status=status.HTTP_401_UNAUTHORIZED,
                            headers={"WWW-Authenticate": 'Basic realm="Webhook"'},
                        )
                except Exception:
                    return Response(
                        {"status": "error", "message": "Invalid Authorization header"},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )

            elif auth_type == "Header Auth":
                header_name = credential_data.get("header_name", "X-Auth-Token")
                header_value = credential_data.get("header_value", "")

                # Convert header name to Django META format (HTTP_HEADER_NAME)
                meta_key = (
                    f"HTTP_{header_name.upper().replace('-', '_')}"
                    if header_name
                    else ""
                )

                if not meta_key or request.META.get(meta_key) != header_value:
                    return Response(
                        {"status": "error", "message": "Invalid Authentication Header"},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )

            elif auth_type == "JWT Auth":
                import jwt

                jwt_secret = credential_data.get("jwt_secret", "")
                auth_header = request.META.get("HTTP_AUTHORIZATION", "")

                if not auth_header.startswith("Bearer "):
                    return Response(
                        {
                            "status": "error",
                            "message": "Missing or invalid Authorization header. Expected: Bearer <token>",
                        },
                        status=status.HTTP_401_UNAUTHORIZED,
                    )

                token = auth_header.split(" ")[1]
                try:
                    # Verify the JWT token
                    jwt.decode(token, jwt_secret, algorithms=["HS256"])
                except jwt.ExpiredSignatureError:
                    return Response(
                        {"status": "error", "message": "Token has expired"},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )
                except jwt.InvalidTokenError as e:
                    return Response(
                        {"status": "error", "message": f"Invalid token: {str(e)}"},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )

            # --- 4. Method Check ---
            configured_method = (
                get_config("http_method") or get_config("method") or "GET"
            ).upper()
            if request.method != configured_method:
                return Response(
                    {
                        "status": "error",
                        "message": f"Method {request.method} not allowed. Expected {configured_method}",
                    },
                    status=status.HTTP_405_METHOD_NOT_ALLOWED,
                )

            # --- 5. Verify Signature (Legacy Secret) ---
            secret = get_config("secret")
            if secret:
                signature = request.META.get("HTTP_X_WEBHOOK_SIGNATURE", "")
                # Only check signature if it's explicitly set (backward compatibility)
                # Or if we want to enforce it strictly? implementation_plan didn't specify strictness
                # but previous code enforced it. Let's keep enforcement.
                if not signature:
                    return Response(
                        {"status": "error", "message": "Missing webhook signature"},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )
                try:
                    from ..utils import validate_webhook_signature

                    if not validate_webhook_signature(request.body, signature, secret):
                        return Response(
                            {"status": "error", "message": "Invalid webhook signature"},
                            status=status.HTTP_401_UNAUTHORIZED,
                        )
                except Exception as e:
                    logger.error(f"Error validating webhook signature: {str(e)}")
                    return Response(
                        {"status": "error", "message": "Error validating signature"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )

            # --- 6. Payload Preparation ---
            # Handle Raw Body - check FIRST before accessing request.data
            is_raw_body = get_config("raw_body")

            if is_raw_body:
                # If raw body requested, use request.body directly (bypasses DRF parsing)
                try:
                    body_data = request.body.decode("utf-8")
                except Exception:
                    # If binary, keep as string representation
                    body_data = str(request.body)
            else:
                # Strict mode - only accept content types DRF can parse (JSON, form data)
                try:
                    body_data = request.data
                except Exception:
                    # Return 415 Unsupported Media Type with helpful message
                    content_type = request.content_type or "unknown"
                    return Response(
                        {
                            "status": "error",
                            "message": f"Unsupported content type: {content_type}",
                            "hint": "Enable 'Raw Body' in webhook settings to accept non-JSON content types like text/plain or XML.",
                        },
                        status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    )

            payload = {
                "method": request.method,
                "headers": dict(request.headers),
                "body": body_data,
                "query_params": dict(request.GET),
            }

            # Generate idempotency key
            from ..utils import generate_idempotency_key

            idempotency_key = generate_idempotency_key(
                trigger_id=str(webhook_id), payload=payload
            )

            # Create the run
            orchestrator = RunOrchestrator()
            run = orchestrator.create_run(
                workflow_version=workflow_version,
                trigger_type="webhook",
                input_data=payload,
                triggered_by=None,
                idempotency_key=idempotency_key,
                check_limits=True,
            )

            # --- 7. Respond Options ---
            respond_option = get_config("respond", "Immediately")

            # --- CORS Handling ---
            allowed_origins_str = get_config("allowed_origins", "")
            cors_headers = {}
            if allowed_origins_str:
                request_origin = request.META.get("HTTP_ORIGIN")
                allowed_origins = [o.strip() for o in allowed_origins_str.split(",")]

                if "*" in allowed_origins:
                    cors_headers["Access-Control-Allow-Origin"] = "*"
                elif request_origin and request_origin in allowed_origins:
                    cors_headers["Access-Control-Allow-Origin"] = request_origin

            if respond_option == "When Last Node Finishes":
                # Execute synchronously
                from ..tasks import execute_workflow_run_sync

                result = execute_workflow_run_sync(str(run.id))

                # Filter inputs/trigger step
                outputs = result.get("outputs", {})
                filtered_outputs = {
                    k: v for k, v in outputs.items() if k != str(webhook_id)
                }

                run_status = result.get("status")
                response_body = {
                    "status": "success" if run_status == "completed" else "error",
                    "data": filtered_outputs,
                }
                status_code = (
                    status.HTTP_200_OK
                    if run_status == "completed"
                    else status.HTTP_500_INTERNAL_SERVER_ERROR
                )

                return Response(response_body, status=status_code, headers=cors_headers)

            elif respond_option == "Using Respond to Webhook Node":
                # FUTURE: Wait for specific node response. For now, background it.
                from ..tasks import execute_workflow_run

                execute_workflow_run.delay(str(run.id))
                return Response(
                    {
                        "status": "accepted",
                        "message": "Workflow started (Respond Node not implemented yet)",
                    },
                    status=status.HTTP_202_ACCEPTED,
                    headers=cors_headers,
                )

            else:  # "Immediately"
                # Custom Response Logic
                from ..tasks import execute_workflow_run

                execute_workflow_run.delay(str(run.id))

                # Custom Response Code
                custom_code = get_config("response_code", 200)

                # Custom Response Data
                custom_data_raw = get_config("response_data", "success")
                # Try to parse custom data as JSON if it looks like it
                try:
                    custom_data = json.loads(custom_data_raw)
                except Exception:
                    custom_data = {"message": custom_data_raw}  # Wrap simple string

                # DEBUG: Add captured payload info for testing
                custom_data["_debug"] = {
                    "raw_body_enabled": is_raw_body,
                    "body_type": type(body_data).__name__,
                    "body_preview": str(body_data)[:200] if body_data else None,
                    "run_id": str(run.id),
                }

                # Custom Headers
                custom_headers = cors_headers.copy()
                headers_config = get_config("response_headers", [])

                if isinstance(headers_config, list):
                    for header in headers_config:
                        if isinstance(header, dict) and "name" in header:
                            key = str(header.get("name", "")).strip()
                            value = str(header.get("value", "")).strip()
                            # Prevent newline injection which can cause 500s in some WSGI servers
                            if key and "\n" not in key and "\r" not in key:
                                # Newlines in values are also problematic for headers
                                custom_headers[key] = value.replace("\n", "").replace(
                                    "\r", ""
                                )

                logger.debug(
                    f"Webhook {webhook_id} responding with {custom_code}. Headers: {custom_headers}"
                )

                # Handle 204 No Content - MUST not have a body
                try:
                    status_code = int(float(custom_code))
                except (ValueError, TypeError):
                    logger.error(
                        f"Invalid response code {custom_code}, defaulting to 200"
                    )
                    status_code = 200

                if status_code == 204:
                    return Response(
                        status=status.HTTP_204_NO_CONTENT, headers=custom_headers
                    )

                return Response(custom_data, status=status_code, headers=custom_headers)

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
            traceback.print_exc()
            return Response(
                {
                    "status": "error",
                    "message": "An error occurred while processing the webhook",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
