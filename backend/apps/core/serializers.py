"""
Serializers for core app
"""
from rest_framework import serializers
from .models import Workflow, WorkflowVersion, Run, RunStep, Trigger, Credential, CredentialUsage, RunLog, RunTrace
from .encryption import get_encryption_service


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


class WebhookTriggerSerializer(serializers.Serializer):
    """Serializer for webhook trigger payload"""
    # Allow any JSON data - validation will be done by the workflow definition
    def to_internal_value(self, data):
        # Accept any JSON structure
        if isinstance(data, dict):
            return data
        return super().to_internal_value(data)
    
    def to_representation(self, instance):
        return instance


class ManualTriggerSerializer(serializers.Serializer):
    """Serializer for manual trigger request"""
    input_data = serializers.DictField(
        required=False,
        default=dict,
        help_text='Input data for the workflow run'
    )
    
    def validate_input_data(self, value):
        """Validate input_data is a dictionary"""
        if not isinstance(value, dict):
            raise serializers.ValidationError('input_data must be a dictionary')
        return value


class CredentialListSerializer(serializers.ModelSerializer):
    """Serializer for listing credentials (masked data)"""
    workspace_name = serializers.CharField(source='workspace.name', read_only=True)
    created_by_email = serializers.CharField(source='created_by.email', read_only=True)
    
    class Meta:
        model = Credential
        fields = (
            'id', 'name', 'credential_type', 'workspace', 'workspace_name',
            'created_by', 'created_by_email', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')


class CredentialCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating credentials (includes plaintext data)"""
    data = serializers.DictField(
        write_only=True,
        help_text='Plaintext credential data to encrypt and store'
    )
    
    class Meta:
        model = Credential
        fields = ('name', 'credential_type', 'workspace', 'data')
    
    def validate_data(self, value):
        """Validate that data is a dictionary"""
        if not isinstance(value, dict):
            raise serializers.ValidationError('data must be a dictionary')
        if not value:
            raise serializers.ValidationError('data cannot be empty')
        return value
    
    def create(self, validated_data):
        """Create credential with encrypted data"""
        data = validated_data.pop('data')
        encryption_service = get_encryption_service()
        
        # Encrypt the data
        encrypted_data = encryption_service.encrypt_dict(data)
        
        # Set created_by from request user
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        
        # Create credential with encrypted data
        credential = Credential.objects.create(
            **validated_data,
            encrypted_data=encrypted_data
        )
        
        return credential


class CredentialUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating credentials"""
    data = serializers.DictField(
        required=False,
        write_only=True,
        help_text='Plaintext credential data to encrypt and store (optional)'
    )
    
    class Meta:
        model = Credential
        fields = ('name', 'data')
    
    def validate_data(self, value):
        """Validate that data is a dictionary"""
        if value is not None and not isinstance(value, dict):
            raise serializers.ValidationError('data must be a dictionary')
        return value
    
    def update(self, instance, validated_data):
        """Update credential, encrypting data if provided"""
        data = validated_data.pop('data', None)
        
        if data is not None:
            # Encrypt the new data
            encryption_service = get_encryption_service()
            instance.encrypted_data = encryption_service.encrypt_dict(data)
        
        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance


class CredentialDetailSerializer(serializers.ModelSerializer):
    """Serializer for credential detail view (includes decrypted data)"""
    workspace_name = serializers.CharField(source='workspace.name', read_only=True)
    created_by_email = serializers.CharField(source='created_by.email', read_only=True)
    data = serializers.SerializerMethodField()
    
    class Meta:
        model = Credential
        fields = (
            'id', 'name', 'credential_type', 'workspace', 'workspace_name',
            'created_by', 'created_by_email', 'data', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')
    
    def get_data(self, obj):
        """Decrypt and return credential data"""
        try:
            encryption_service = get_encryption_service()
            return encryption_service.decrypt_dict(obj.encrypted_data)
        except Exception as e:
            # If decryption fails, return error indicator
            return {'_error': f'Failed to decrypt: {str(e)}'}


class CredentialUsageSerializer(serializers.ModelSerializer):
    """Serializer for credential usage tracking"""
    credential_name = serializers.CharField(source='credential.name', read_only=True)
    workflow_name = serializers.CharField(source='workflow.name', read_only=True)
    
    class Meta:
        model = CredentialUsage
        fields = (
            'id', 'credential', 'credential_name', 'workflow', 'workflow_name',
            'last_used_at', 'usage_count', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at', 'last_used_at', 'usage_count')


class RunLogSerializer(serializers.ModelSerializer):
    """Serializer for RunLog entries"""
    step_id = serializers.CharField(source='step.step_id', read_only=True, allow_null=True)
    run_id = serializers.UUIDField(source='run.id', read_only=True)
    
    class Meta:
        model = RunLog
        fields = (
            'id', 'run_id', 'step_id', 'level', 'message',
            'timestamp', 'correlation_id', 'extra_data', 'created_at'
        )
        read_only_fields = ('id', 'created_at')


class TraceStepSerializer(serializers.Serializer):
    """Serializer for step trace data"""
    step_id = serializers.CharField()
    step_type = serializers.CharField()
    status = serializers.CharField()
    started_at = serializers.DateTimeField(allow_null=True)
    completed_at = serializers.DateTimeField(allow_null=True)
    duration_seconds = serializers.FloatField(allow_null=True)
    error_message = serializers.CharField(allow_null=True)
    inputs_keys = serializers.ListField(child=serializers.CharField())
    outputs_keys = serializers.ListField(child=serializers.CharField())
    logs = RunLogSerializer(many=True)
    log_summary = serializers.DictField()


class RunTraceSerializer(serializers.ModelSerializer):
    """Serializer for RunTrace"""
    run_id = serializers.UUIDField(source='run.id', read_only=True)
    workflow_name = serializers.CharField(source='run.workflow_version.workflow.name', read_only=True)
    trace_data = serializers.JSONField()
    
    class Meta:
        model = RunTrace
        fields = (
            'id', 'run_id', 'workflow_name', 'trace_data',
            'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

