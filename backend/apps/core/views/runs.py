"""
Run-related views.

ViewSets for Run and RunStep models.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import ValidationError

from apps.accounts.permissions import IsWorkspaceMember
from apps.common.logging_utils import get_logger
from ..models import Run, RunStep
from ..serializers import RunSerializer, RunStepSerializer

logger = get_logger(__name__)


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
        from ..replay_service import ReplayService

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
        from ..replay_service import ReplayService

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
        from ..replay_service import ReplayService

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
