"""
Serializers for accounts app
"""
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User, Organization, Workspace
from .rbac_models import Role, Permission


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration"""
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True, required=True)
    
    class Meta:
        model = User
        fields = ('email', 'password', 'password_confirm', 'first_name', 'last_name')
        extra_kwargs = {
            'email': {'required': True},
            'first_name': {'required': False},
            'last_name': {'required': False},
        }
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                'password': 'Password fields did not match.'
            })
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        # Generate username from email if not provided
        if not validated_data.get('username'):
            validated_data['username'] = validated_data['email']
        
        user = User.objects.create_user(
            password=password,
            **validated_data
        )
        return user


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model"""
    class Meta:
        model = User
        fields = ('id', 'email', 'first_name', 'last_name', 'created_at')
        read_only_fields = ('id', 'created_at')


class OrganizationSerializer(serializers.ModelSerializer):
    """Serializer for Organization model"""
    class Meta:
        model = Organization
        fields = ('id', 'name', 'slug', 'description', 'created_at')
        read_only_fields = ('id', 'created_at')


class WorkspaceSerializer(serializers.ModelSerializer):
    """Serializer for Workspace model"""
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    
    class Meta:
        model = Workspace
        fields = ('id', 'name', 'slug', 'description', 'organization', 'organization_name', 'created_at')
        read_only_fields = ('id', 'created_at')


class RoleSerializer(serializers.ModelSerializer):
    """Serializer for Role model"""
    class Meta:
        model = Role
        fields = ('id', 'name', 'codename', 'description')
        read_only_fields = ('id',)


class PermissionSerializer(serializers.ModelSerializer):
    """Serializer for Permission model"""
    class Meta:
        model = Permission
        fields = ('id', 'name', 'codename', 'description')
        read_only_fields = ('id',)

