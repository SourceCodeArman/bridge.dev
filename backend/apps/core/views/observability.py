"""
Observability-related views.

ViewSets for RunLog, RunTrace, AlertConfiguration, AlertHistory, and ErrorSuggestion models.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import ValidationError

from apps.accounts.permissions import IsWorkspaceMember
from apps.common.logging_utils import get_logger
from ..models import (
    Run,
    RunStep,
    RunLog,
    RunTrace,
    AlertConfiguration,
    AlertHistory,
    ErrorSuggestion,
)
from ..serializers import (
    RunLogSerializer,
    RunTraceSerializer,
    AlertConfigurationSerializer,
    AlertHistorySerializer,
    ErrorSuggestionSerializer,
)

logger = get_logger(__name__)


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
        from ..trace_aggregator import TraceAggregator

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
