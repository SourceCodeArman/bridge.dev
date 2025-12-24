"""
Serializers for core app
"""
from rest_framework import serializers
from .models import Workflow, WorkflowVersion, Run, RunStep, Trigger


class WorkflowSerializer(serializers.ModelSerializer):
    """Serializer for Workflow model"""
    workspace_name = serializers.CharField(source='workspace.name', read_only=True)
    active_version_number = serializers.SerializerMethodField()
    
    class Meta:
        model = Workflow
        fields = (
            'id', 'name', 'description', 'workspace', 'workspace_name',
            'status', 'active_version_number', 'created_by', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')
    
    def get_active_version_number(self, obj):
        active_version = obj.get_active_version()
        return active_version.version_number if active_version else None


class WorkflowVersionSerializer(serializers.ModelSerializer):
    """Serializer for WorkflowVersion model"""
    workflow_name = serializers.CharField(source='workflow.name', read_only=True)
    
    class Meta:
        model = WorkflowVersion
        fields = (
            'id', 'workflow', 'workflow_name', 'version_number',
            'definition', 'is_active', 'created_by', 'created_at'
        )
        read_only_fields = ('id', 'created_at')


class RunStepSerializer(serializers.ModelSerializer):
    """Serializer for RunStep model"""
    class Meta:
        model = RunStep
        fields = (
            'id', 'run', 'step_id', 'step_type', 'status',
            'inputs', 'outputs', 'error_message',
            'started_at', 'completed_at', 'order', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')


class RunSerializer(serializers.ModelSerializer):
    """Serializer for Run model"""
    workflow_name = serializers.CharField(source='workflow_version.workflow.name', read_only=True)
    workflow_version_number = serializers.IntegerField(source='workflow_version.version_number', read_only=True)
    steps = RunStepSerializer(many=True, read_only=True)
    duration = serializers.SerializerMethodField()
    
    class Meta:
        model = Run
        fields = (
            'id', 'workflow_version', 'workflow_name', 'workflow_version_number',
            'status', 'trigger_type', 'triggered_by',
            'input_data', 'output_data', 'error_message',
            'started_at', 'completed_at', 'duration',
            'idempotency_key', 'steps', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')
    
    def get_duration(self, obj):
        return obj.duration


class TriggerSerializer(serializers.ModelSerializer):
    """Serializer for Trigger model"""
    workflow_name = serializers.CharField(source='workflow.name', read_only=True)
    
    class Meta:
        model = Trigger
        fields = (
            'id', 'workflow', 'workflow_name', 'trigger_type',
            'config', 'is_active', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

