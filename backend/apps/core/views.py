"""
Views for core app

Read-only ViewSets for workflow models with workspace scoping.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.accounts.permissions import IsWorkspaceMember
from .models import Workflow, WorkflowVersion, Run, RunStep, Trigger
from .serializers import (
    WorkflowSerializer, WorkflowVersionSerializer,
    RunSerializer, RunStepSerializer, TriggerSerializer
)


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

