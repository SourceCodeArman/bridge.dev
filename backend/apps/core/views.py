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
from apps.accounts.permissions import IsWorkspaceMember, HasCredentialPermission
from apps.common.logging_utils import get_logger
from .models import Workflow, WorkflowVersion, Run, RunStep, Trigger, Credential, CredentialUsage, RunLog, RunTrace
from .serializers import (
    WorkflowSerializer, WorkflowVersionSerializer,
    RunSerializer, RunStepSerializer, TriggerSerializer,
    WebhookTriggerSerializer, ManualTriggerSerializer,
    CredentialListSerializer, CredentialCreateSerializer,
    CredentialUpdateSerializer, CredentialDetailSerializer,
    CredentialUsageSerializer, RunLogSerializer, RunTraceSerializer
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


class CredentialViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing credentials.
    
    Provides CRUD operations for credentials with workspace scoping and RBAC.
    """
    permission_classes = [IsAuthenticated, IsWorkspaceMember, HasCredentialPermission]
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == 'list':
            return CredentialListSerializer
        elif self.action == 'create':
            return CredentialCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return CredentialUpdateSerializer
        elif self.action == 'retrieve':
            return CredentialDetailSerializer
        return CredentialListSerializer
    
    def get_queryset(self):
        """Filter credentials by workspace"""
        workspace = getattr(self.request, 'workspace', None)
        if workspace:
            return Credential.objects.filter(workspace=workspace)
        return Credential.objects.none()
    
    def perform_create(self, serializer):
        """Set workspace from request context"""
        workspace = getattr(self.request, 'workspace', None)
        if workspace:
            serializer.save(workspace=workspace)
        else:
            raise ValidationError('Workspace context required')
    
    @action(detail=True, methods=['get'])
    def usage_history(self, request, pk=None):
        """Get usage history for a credential"""
        credential = self.get_object()
        usage_records = credential.usage_records.all()
        serializer = CredentialUsageSerializer(usage_records, many=True)
        return Response({
            'status': 'success',
            'data': serializer.data,
            'message': 'Usage history retrieved successfully'
        })
    
    @action(detail=True, methods=['post'])
    def test_connection(self, request, pk=None):
        """
        Test credential connection (placeholder for future implementation).
        
        This would validate the credential by attempting to authenticate
        with the target service. Not implemented in MVP.
        """
        credential = self.get_object()
        
        # TODO: Implement actual connection testing based on credential_type
        # For now, return a placeholder response
        
        return Response({
            'status': 'success',
            'data': {
                'credential_id': str(credential.id),
                'credential_name': credential.name,
                'credential_type': credential.credential_type,
                'test_status': 'not_implemented',
                'message': 'Connection testing not yet implemented'
            },
            'message': 'Connection test initiated (not implemented)'
        })


class ConnectorViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for listing available connectors.
    
    Provides information about registered connectors and their capabilities.
    """
    permission_classes = [IsAuthenticated, IsWorkspaceMember]
    
    def list(self, request, *args, **kwargs):
        """List all available connectors"""
        from .connectors.base import ConnectorRegistry
        
        registry = ConnectorRegistry()
        connector_ids = registry.list_all()
        
        connectors = []
        for connector_id in connector_ids:
            try:
                connector_class = registry.get(connector_id)
                # Create temporary instance to get manifest
                temp_instance = connector_class({})
                manifest = temp_instance.get_manifest()
                
                # Return safe manifest (without sensitive data)
                connectors.append({
                    'id': manifest.get('id'),
                    'name': manifest.get('name'),
                    'version': manifest.get('version'),
                    'description': manifest.get('description'),
                    'author': manifest.get('author'),
                    'connector_type': manifest.get('connector_type'),
                    'actions': [
                        {
                            'id': action.get('id'),
                            'name': action.get('name'),
                            'description': action.get('description'),
                            'input_schema': action.get('input_schema'),
                            'output_schema': action.get('output_schema'),
                            'required_fields': action.get('required_fields', [])
                        }
                        for action in manifest.get('actions', [])
                    ],
                    'triggers': [
                        {
                            'id': trigger.get('id'),
                            'name': trigger.get('name'),
                            'description': trigger.get('description'),
                            'output_schema': trigger.get('output_schema')
                        }
                        for trigger in manifest.get('triggers', [])
                    ],
                    'auth_config': {
                        'type': manifest.get('auth_config', {}).get('type'),
                        'fields': manifest.get('auth_config', {}).get('fields', [])
                    }
                })
            except Exception as e:
                logger.warning(
                    f"Error getting manifest for connector {connector_id}: {str(e)}",
                    exc_info=e,
                    extra={'connector_id': connector_id}
                )
        
        return Response({
            'status': 'success',
            'data': {
                'connectors': connectors,
                'count': len(connectors)
            },
            'message': 'Connectors retrieved successfully'
        })
    
    def retrieve(self, request, pk=None):
        """Get detailed information about a specific connector"""
        from .connectors.base import ConnectorRegistry
        
        registry = ConnectorRegistry()
        connector_class = registry.get(pk)
        
        if not connector_class:
            return Response(
                {
                    'status': 'error',
                    'message': f'Connector {pk} not found'
                },
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            # Create temporary instance to get manifest
            temp_instance = connector_class({})
            manifest = temp_instance.get_manifest()
            
            return Response({
                'status': 'success',
                'data': manifest,
                'message': 'Connector retrieved successfully'
            })
        except Exception as e:
            logger.error(
                f"Error getting connector {pk}: {str(e)}",
                exc_info=e,
                extra={'connector_id': pk}
            )
            return Response(
                {
                    'status': 'error',
                    'message': f'Error retrieving connector: {str(e)}'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
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
        workspace = getattr(self.request, 'workspace', None)
        if not workspace:
            return RunLog.objects.none()
        
        # Base queryset filtered by workspace via run
        queryset = RunLog.objects.filter(
            run__workflow_version__workflow__workspace=workspace
        )
        
        # Filter by run_id
        run_id = self.request.query_params.get('run_id')
        if run_id:
            queryset = queryset.filter(run_id=run_id)
        
        # Filter by step_id
        step_id = self.request.query_params.get('step_id')
        if step_id:
            queryset = queryset.filter(step__step_id=step_id)
        
        # Filter by level
        level = self.request.query_params.get('level')
        if level:
            queryset = queryset.filter(level=level.upper())
        
        # Filter by correlation_id
        correlation_id = self.request.query_params.get('correlation_id')
        if correlation_id:
            queryset = queryset.filter(correlation_id=correlation_id)
        
        # Filter by time range
        start_time = self.request.query_params.get('start_time')
        if start_time:
            try:
                from django.utils.dateparse import parse_datetime
                start_dt = parse_datetime(start_time)
                if start_dt:
                    queryset = queryset.filter(timestamp__gte=start_dt)
            except Exception:
                pass
        
        end_time = self.request.query_params.get('end_time')
        if end_time:
            try:
                from django.utils.dateparse import parse_datetime
                end_dt = parse_datetime(end_time)
                if end_dt:
                    queryset = queryset.filter(timestamp__lte=end_dt)
            except Exception:
                pass
        
        return queryset.order_by('-timestamp')


class RunTraceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for retrieving run traces.
    
    Provides complete trace structure for workflow runs.
    """
    serializer_class = RunTraceSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]
    
    def get_queryset(self):
        """Filter traces by workspace"""
        workspace = getattr(self.request, 'workspace', None)
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
            workspace = getattr(request, 'workspace', None)
            if workspace and run.workflow_version.workflow.workspace != workspace:
                return Response(
                    {
                        'status': 'error',
                        'message': 'Run not found in workspace'
                    },
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get or build trace
            try:
                trace = RunTrace.objects.get(run=run)
            except RunTrace.DoesNotExist:
                # Build trace if it doesn't exist
                aggregator = TraceAggregator()
                trace = aggregator.update_trace(run)
            
            serializer = self.get_serializer(trace)
            return Response({
                'status': 'success',
                'data': serializer.data,
                'message': 'Trace retrieved successfully'
            })
            
        except Run.DoesNotExist:
            return Response(
                {
                    'status': 'error',
                    'message': 'Run not found'
                },
                status=status.HTTP_404_NOT_FOUND
            )

