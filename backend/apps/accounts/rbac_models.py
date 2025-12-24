"""
RBAC (Role-Based Access Control) models for Bridge.dev

Defines Role, Permission, RolePermission, and UserRole models for
granular access control within workspaces.
"""
from django.db import models
from django.utils import timezone
import uuid


class Permission(models.Model):
    """
    Permission model for granular access control
    
    Permissions define specific actions that can be performed
    (e.g., 'workflow.create', 'workflow.execute', 'workspace.manage').
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True, db_index=True)
    codename = models.CharField(max_length=100, unique=True, db_index=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'accounts_permission'
        verbose_name = 'Permission'
        verbose_name_plural = 'Permissions'
        ordering = ['name']
        indexes = [
            models.Index(fields=['codename']),
        ]
    
    def __str__(self):
        return self.name


class Role(models.Model):
    """
    Role model for grouping permissions
    
    Roles define sets of permissions that can be assigned to users.
    Common roles: admin, member, viewer.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    codename = models.CharField(max_length=100, unique=True, db_index=True)
    description = models.TextField(blank=True)
    is_system = models.BooleanField(default=False, help_text='System roles cannot be deleted')
    permissions = models.ManyToManyField(
        Permission,
        through='RolePermission',
        related_name='roles'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'accounts_role'
        verbose_name = 'Role'
        verbose_name_plural = 'Roles'
        ordering = ['name']
        indexes = [
            models.Index(fields=['codename']),
        ]
    
    def __str__(self):
        return self.name


class RolePermission(models.Model):
    """
    Junction table for Role-Permission many-to-many relationship
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='role_permissions')
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name='permission_roles')
    granted_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'accounts_rolepermission'
        verbose_name = 'Role Permission'
        verbose_name_plural = 'Role Permissions'
        unique_together = [['role', 'permission']]
        indexes = [
            models.Index(fields=['role', 'permission']),
        ]
    
    def __str__(self):
        return f"{self.role.name} - {self.permission.name}"


class UserRole(models.Model):
    """
    UserRole model linking users to roles within workspaces
    
    This enables workspace-scoped role assignments where a user
    can have different roles in different workspaces.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='user_roles')
    workspace = models.ForeignKey('accounts.Workspace', on_delete=models.CASCADE, related_name='user_roles')
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='user_roles')
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='assigned_roles'
    )
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'accounts_userrole'
        verbose_name = 'User Role'
        verbose_name_plural = 'User Roles'
        unique_together = [['user', 'workspace', 'role']]
        indexes = [
            models.Index(fields=['user', 'workspace']),
            models.Index(fields=['workspace', 'role']),
            models.Index(fields=['workspace', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.user.email} - {self.role.name} in {self.workspace.name}"

