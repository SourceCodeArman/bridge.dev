"""
Permission classes for core app collaboration features.
"""
from rest_framework import permissions
from apps.accounts.permissions import IsWorkspaceMember, HasPermission
from apps.accounts.rbac_models import UserRole


class CanCommentOnWorkflow(permissions.BasePermission):
    """
    Permission to check if user can comment on a workflow.
    
    Requires workspace membership and either 'workflow.comment' permission
    or 'workflow.edit' permission.
    """
    
    def has_permission(self, request, view):
        """Check if user can comment"""
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Must be workspace member
        workspace = getattr(request, 'workspace', None)
        if not workspace:
            return False
        
        # Check if user has comment or edit permission
        try:
            user_role = UserRole.objects.get(
                user=request.user,
                workspace=workspace,
                is_active=True
            )
            
            # Check for comment or edit permission
            return user_role.role.permissions.filter(
                codename__in=['workflow.comment', 'workflow.edit']
            ).exists()
        except UserRole.DoesNotExist:
            return False
    
    def has_object_permission(self, request, view, obj):
        """Check permission for specific workflow version"""
        # Get workspace from workflow version
        workflow = getattr(obj, 'workflow_version', None)
        if workflow:
            workflow = workflow.workflow
        else:
            workflow = getattr(obj, 'workflow', None)
        
        if not workflow:
            return self.has_permission(request, view)
        
        workspace = workflow.workspace
        
        try:
            user_role = UserRole.objects.get(
                user=request.user,
                workspace=workspace,
                is_active=True
            )
            return user_role.role.permissions.filter(
                codename__in=['workflow.comment', 'workflow.edit']
            ).exists()
        except UserRole.DoesNotExist:
            return False


class CanEditWorkflow(permissions.BasePermission):
    """
    Permission to check if user can edit a workflow.
    
    Requires workspace membership and 'workflow.edit' permission.
    """
    
    def has_permission(self, request, view):
        """Check if user can edit"""
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
            return user_role.role.permissions.filter(
                codename='workflow.edit'
            ).exists()
        except UserRole.DoesNotExist:
            return False
    
    def has_object_permission(self, request, view, obj):
        """Check permission for specific workflow"""
        workflow = getattr(obj, 'workflow_version', None)
        if workflow:
            workflow = workflow.workflow
        else:
            workflow = getattr(obj, 'workflow', None)
        
        if not workflow:
            return self.has_permission(request, view)
        
        workspace = workflow.workspace
        
        try:
            user_role = UserRole.objects.get(
                user=request.user,
                workspace=workspace,
                is_active=True
            )
            return user_role.role.permissions.filter(
                codename='workflow.edit'
            ).exists()
        except UserRole.DoesNotExist:
            return False


