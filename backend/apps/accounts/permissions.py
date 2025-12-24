"""
Custom permission classes for RBAC and workspace access control
"""
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied
from .models import Workspace, OrganizationMember
from .rbac_models import UserRole, Permission


class IsWorkspaceMember(permissions.BasePermission):
    """
    Permission to check if user is a member of the workspace's organization.
    
    This is the base permission - user must be a member of the organization
    that owns the workspace.
    """
    
    def has_permission(self, request, view):
        """
        Check if user has access to the workspace.
        """
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Get workspace from request (set by WorkspaceMiddleware)
        workspace = getattr(request, 'workspace', None)
        
        if not workspace:
            # If no workspace in request, check if view has workspace_lookup_field
            workspace_lookup = getattr(view, 'workspace_lookup_field', None)
            if workspace_lookup:
                workspace_id = view.kwargs.get(workspace_lookup)
                if workspace_id:
                    try:
                        workspace = Workspace.objects.get(id=workspace_id)
                    except Workspace.DoesNotExist:
                        return False
        
        if not workspace:
            # No workspace context - allow for now (can be restricted later)
            return True
        
        # Check if user is a member of the organization
        return OrganizationMember.objects.filter(
            user=request.user,
            organization=workspace.organization,
            is_active=True
        ).exists()
    
    def has_object_permission(self, request, view, obj):
        """
        Check if user has permission for a specific object.
        
        If object has a workspace attribute, check membership.
        """
        # Try to get workspace from object
        workspace = getattr(obj, 'workspace', None)
        
        if workspace:
            return OrganizationMember.objects.filter(
                user=request.user,
                organization=workspace.organization,
                is_active=True
            ).exists()
        
        # Fall back to has_permission
        return self.has_permission(request, view)


class HasPermission(permissions.BasePermission):
    """
    Permission to check if user has a specific permission in the workspace.
    
    Usage:
        permission_classes = [IsWorkspaceMember, HasPermission]
        
        class MyViewSet:
            required_permission = 'workflow.create'
    """
    
    def has_permission(self, request, view):
        """
        Check if user has the required permission in the workspace.
        """
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Get required permission from view
        required_permission = getattr(view, 'required_permission', None)
        if not required_permission:
            # No permission required
            return True
        
        # Get workspace from request
        workspace = getattr(request, 'workspace', None)
        if not workspace:
            return False
        
        # Check if user has the permission via their role
        try:
            user_role = UserRole.objects.get(
                user=request.user,
                workspace=workspace,
                is_active=True
            )
            
            # Check if role has the required permission
            return user_role.role.permissions.filter(
                codename=required_permission
            ).exists()
        except UserRole.DoesNotExist:
            return False
    
    def has_object_permission(self, request, view, obj):
        """
        Check permission for a specific object.
        """
        # Try to get workspace from object
        workspace = getattr(obj, 'workspace', None)
        if not workspace:
            return self.has_permission(request, view)
        
        # Check permission in object's workspace
        required_permission = getattr(view, 'required_permission', None)
        if not required_permission:
            return True
        
        try:
            user_role = UserRole.objects.get(
                user=request.user,
                workspace=workspace,
                is_active=True
            )
            return user_role.role.permissions.filter(
                codename=required_permission
            ).exists()
        except UserRole.DoesNotExist:
            return False


class IsWorkspaceAdmin(permissions.BasePermission):
    """
    Permission to check if user is a workspace administrator.
    
    Checks if user has the 'admin' role in the workspace.
    """
    
    def has_permission(self, request, view):
        """
        Check if user is workspace admin.
        """
        if not request.user or not request.user.is_authenticated:
            return False
        
        workspace = getattr(request, 'workspace', None)
        if not workspace:
            return False
        
        try:
            user_role = UserRole.objects.get(
                user=request.user,
                workspace=workspace,
                is_active=True
            )
            return user_role.role.codename == 'admin'
        except UserRole.DoesNotExist:
            return False
    
    def has_object_permission(self, request, view, obj):
        """
        Check if user is admin for object's workspace.
        """
        workspace = getattr(obj, 'workspace', None)
        if not workspace:
            return self.has_permission(request, view)
        
        try:
            user_role = UserRole.objects.get(
                user=request.user,
                workspace=workspace,
                is_active=True
            )
            return user_role.role.codename == 'admin'
        except UserRole.DoesNotExist:
            return False


class HasCredentialPermission(permissions.BasePermission):
    """
    Permission to check if user has credential-related permissions in the workspace.
    
    Checks for credential.create, credential.read, credential.update, credential.delete
    permissions based on the action being performed.
    """
    
    def has_permission(self, request, view):
        """
        Check if user has the required credential permission in the workspace.
        """
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Get workspace from request
        workspace = getattr(request, 'workspace', None)
        if not workspace:
            return False
        
        # Map view actions to permission codenames
        action_permissions = {
            'list': 'credential.read',
            'retrieve': 'credential.read',
            'create': 'credential.create',
            'update': 'credential.update',
            'partial_update': 'credential.update',
            'destroy': 'credential.delete',
        }
        
        # Get the action from view
        action = getattr(view, 'action', None)
        if action is None:
            # For ViewSet, check method
            if request.method == 'GET':
                action = 'retrieve' if view.kwargs.get('pk') else 'list'
            elif request.method == 'POST':
                action = 'create'
            elif request.method in ['PUT', 'PATCH']:
                action = 'update'
            elif request.method == 'DELETE':
                action = 'destroy'
        
        required_permission = action_permissions.get(action)
        if not required_permission:
            # Unknown action, default to read permission
            required_permission = 'credential.read'
        
        # Check if user has the permission via their role
        try:
            user_role = UserRole.objects.get(
                user=request.user,
                workspace=workspace,
                is_active=True
            )
            
            # Check if role has the required permission
            return user_role.role.permissions.filter(
                codename=required_permission
            ).exists()
        except UserRole.DoesNotExist:
            return False
    
    def has_object_permission(self, request, view, obj):
        """
        Check permission for a specific credential object.
        """
        # Get workspace from credential
        workspace = getattr(obj, 'workspace', None)
        if not workspace:
            return self.has_permission(request, view)
        
        # Map view actions to permission codenames
        action_permissions = {
            'retrieve': 'credential.read',
            'update': 'credential.update',
            'partial_update': 'credential.update',
            'destroy': 'credential.delete',
        }
        
        action = getattr(view, 'action', None)
        if action is None:
            if request.method == 'GET':
                action = 'retrieve'
            elif request.method in ['PUT', 'PATCH']:
                action = 'update'
            elif request.method == 'DELETE':
                action = 'destroy'
        
        required_permission = action_permissions.get(action, 'credential.read')
        
        try:
            user_role = UserRole.objects.get(
                user=request.user,
                workspace=workspace,
                is_active=True
            )
            return user_role.role.permissions.filter(
                codename=required_permission
            ).exists()
        except UserRole.DoesNotExist:
            return False

