"""
Views for core app

Read-only ViewSets for workflow models with workspace scoping.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError
from apps.accounts.permissions import IsWorkspaceMember
from apps.common.logging_utils import get_logger
from .models import Workflow, WorkflowVersion, Run, RunStep, Trigger
from .serializers import (
    WorkflowSerializer, WorkflowVersionSerializer,
    RunSerializer, RunStepSerializer, TriggerSerializer,
    WebhookTriggerSerializer, ManualTriggerSerializer
)
from .orchestrator import RunOrchestrator
from .utils import generate_idempotency_key, validate_webhook_signature
from .tasks import execute_workflow_run

logger = get_logger(__name__)


class WorkflowViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for Workflow model
    
    Filters workflows by workspace from request context.
    """
    serializer_class = WorkflowSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]
    
    def get_queryset(self):
        """Filter workflows by workspace"""
        workspace = getattr(self.request, 'workspace', None)
        if workspace:
            return Workflow.objects.filter(workspace=workspace)
        # If no workspace context, return empty queryset
        return Workflow.objects.none()
    
    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        """Get all versions of a workflow"""
        workflow = self.get_object()
        versions = workflow.versions.all()
        serializer = WorkflowVersionSerializer(versions, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def runs(self, request, pk=None):
        """Get all runs for a workflow"""
        workflow = self.get_object()
        active_version = workflow.get_active_version()
        if not active_version:
            return Response({'runs': []})
        
        runs = active_version.runs.all()[:50]  # Limit to recent 50 runs
        serializer = RunSerializer(runs, many=True)
        return Response({'runs': serializer.data})


class WorkflowVersionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for WorkflowVersion model
    """
    serializer_class = WorkflowVersionSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]
    
    def get_queryset(self):
        """Filter versions by workspace via workflow"""
        workspace = getattr(self.request, 'workspace', None)
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
        workspace = getattr(self.request, 'workspace', None)
        if workspace:
            return Run.objects.filter(
                workflow_version__workflow__workspace=workspace
            )
        return Run.objects.none()
    
    @action(detail=True, methods=['get'])
    def steps(self, request, pk=None):
        """Get all steps for a run"""
        run = self.get_object()
        steps = run.steps.all()
        serializer = RunStepSerializer(steps, many=True)
        return Response({'steps': serializer.data})


class RunStepViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for RunStep model
    """
    serializer_class = RunStepSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]
    
    def get_queryset(self):
        """Filter steps by workspace via run"""
        workspace = getattr(self.request, 'workspace', None)
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
        workspace = getattr(self.request, 'workspace', None)
        if workspace:
            return Trigger.objects.filter(workflow__workspace=workspace)
        return Trigger.objects.none()
    
    @action(detail=True, methods=['post'])
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
                {
                    'status': 'error',
                    'message': 'Trigger is not active'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate input data
        serializer = ManualTriggerSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    'status': 'error',
                    'data': serializer.errors,
                    'message': 'Validation failed'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        input_data = serializer.validated_data.get('input_data', {})
        
        # Get active workflow version
        workflow_version = trigger.workflow.get_active_version()
        if not workflow_version:
            return Response(
                {
                    'status': 'error',
                    'message': 'Workflow has no active version'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Generate idempotency key
            idempotency_key = generate_idempotency_key(
                trigger_id=str(trigger.id),
                payload=input_data
            )
            
            # Create and enqueue run
            orchestrator = RunOrchestrator()
            run = orchestrator.create_run(
                workflow_version=workflow_version,
                trigger_type='manual',
                input_data=input_data,
                triggered_by=request.user,
                idempotency_key=idempotency_key,
                check_limits=True
            )
            
            # Enqueue execution
            execute_workflow_run.delay(str(run.id))
            
            logger.info(
                f"Manually triggered workflow {trigger.workflow.id} via trigger {trigger.id}",
                extra={
                    'trigger_id': str(trigger.id),
                    'workflow_id': str(trigger.workflow.id),
                    'run_id': str(run.id),
                    'user_id': str(request.user.id) if request.user.is_authenticated else None
                }
            )
            
            return Response(
                {
                    'status': 'success',
                    'data': {
                        'run_id': str(run.id),
                        'status': run.status
                    },
                    'message': 'Workflow run created successfully'
                },
                status=status.HTTP_201_CREATED
            )
            
        except ValidationError as e:
            return Response(
                {
                    'status': 'error',
                    'message': str(e)
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(
                f"Error triggering workflow: {str(e)}",
                exc_info=e,
                extra={
                    'trigger_id': str(trigger.id),
                    'user_id': str(request.user.id) if request.user.is_authenticated else None
                }
            )
            return Response(
                {
                    'status': 'error',
                    'message': 'An error occurred while triggering the workflow'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
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
            trigger = get_object_or_404(Trigger, id=trigger_id, trigger_type='webhook')
            
            # Check if trigger is active
            if not trigger.is_active:
                return Response(
                    {
                        'status': 'error',
                        'message': 'Trigger is not active'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate webhook payload
            serializer = WebhookTriggerSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    {
                        'status': 'error',
                        'data': serializer.errors,
                        'message': 'Validation failed'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            payload = serializer.validated_data
            
            # Validate webhook signature if configured
            config = trigger.config or {}
            secret = config.get('secret')
            if secret:
                signature = request.META.get('HTTP_X_WEBHOOK_SIGNATURE', '')
                if not signature:
                    return Response(
                        {
                            'status': 'error',
                            'message': 'Missing webhook signature'
                        },
                        status=status.HTTP_401_UNAUTHORIZED
                    )
                
                try:
                    if not validate_webhook_signature(
                        request.body,
                        signature,
                        secret
                    ):
                        return Response(
                            {
                                'status': 'error',
                                'message': 'Invalid webhook signature'
                            },
                            status=status.HTTP_401_UNAUTHORIZED
                        )
                except Exception as e:
                    logger.error(
                        f"Error validating webhook signature: {str(e)}",
                        exc_info=e,
                        extra={'trigger_id': str(trigger.id)}
                    )
                    return Response(
                        {
                            'status': 'error',
                            'message': 'Error validating signature'
                        },
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
            
            # Get active workflow version
            workflow_version = trigger.workflow.get_active_version()
            if not workflow_version:
                return Response(
                    {
                        'status': 'error',
                        'message': 'Workflow has no active version'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Generate idempotency key
            idempotency_key = generate_idempotency_key(
                trigger_id=str(trigger.id),
                payload=payload
            )
            
            # Create and enqueue run
            orchestrator = RunOrchestrator()
            run = orchestrator.create_run(
                workflow_version=workflow_version,
                trigger_type='webhook',
                input_data=payload,
                triggered_by=None,  # Webhooks are not user-initiated
                idempotency_key=idempotency_key,
                check_limits=True
            )
            
            # Enqueue execution
            execute_workflow_run.delay(str(run.id))
            
            logger.info(
                f"Webhook triggered workflow {trigger.workflow.id} via trigger {trigger.id}",
                extra={
                    'trigger_id': str(trigger.id),
                    'workflow_id': str(trigger.workflow.id),
                    'run_id': str(run.id)
                }
            )
            
            return Response(
                {
                    'status': 'success',
                    'data': {
                        'run_id': str(run.id),
                        'status': run.status
                    },
                    'message': 'Webhook received and workflow run created'
                },
                status=status.HTTP_201_CREATED
            )
            
        except ValidationError as e:
            return Response(
                {
                    'status': 'error',
                    'message': str(e)
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(
                f"Error handling webhook: {str(e)}",
                exc_info=e,
                extra={'trigger_id': trigger_id}
            )
            return Response(
                {
                    'status': 'error',
                    'message': 'An error occurred while processing the webhook'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

