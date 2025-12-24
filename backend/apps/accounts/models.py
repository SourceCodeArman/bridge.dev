"""
Account models for Bridge.dev

Includes User, Organization, and Workspace models for multi-tenancy.
"""
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
import uuid


class User(AbstractUser):
    """
    Extended user model for Bridge.dev
    
    Uses AbstractUser to maintain compatibility with Django's auth system
    while allowing custom fields.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Override username to make it optional (we'll use email for auth)
    username = models.CharField(max_length=150, unique=True, null=True, blank=True)
    
    # Fix related_name conflicts with Django's auth system
    groups = models.ManyToManyField(
        'auth.Group',
        verbose_name='groups',
        blank=True,
        help_text='The groups this user belongs to.',
        related_name='bridge_user_set',
        related_query_name='bridge_user',
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        verbose_name='user permissions',
        blank=True,
        help_text='Specific permissions for this user.',
        related_name='bridge_user_set',
        related_query_name='bridge_user',
    )
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    
    class Meta:
        db_table = 'accounts_user'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return self.email


class Organization(models.Model):
    """
    Organization model for multi-tenancy
    
    Organizations contain multiple workspaces and users can belong to
    multiple organizations.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True, max_length=200, db_index=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_organizations'
    )
    
    class Meta:
        db_table = 'accounts_organization'
        verbose_name = 'Organization'
        verbose_name_plural = 'Organizations'
        ordering = ['name']
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return self.name


class OrganizationMember(models.Model):
    """
    Junction table for User-Organization many-to-many relationship
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='organization_memberships')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='members')
    joined_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'accounts_organizationmember'
        verbose_name = 'Organization Member'
        verbose_name_plural = 'Organization Members'
        unique_together = [['user', 'organization']]
        indexes = [
            models.Index(fields=['user', 'organization']),
            models.Index(fields=['organization', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.user.email} in {self.organization.name}"


class Workspace(models.Model):
    """
    Workspace model
    
    Workspaces are scoped under organizations and represent isolated
    environments for workflows and resources.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, db_index=True)
    description = models.TextField(blank=True)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='workspaces'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_workspaces'
    )
    
    class Meta:
        db_table = 'accounts_workspace'
        verbose_name = 'Workspace'
        verbose_name_plural = 'Workspaces'
        unique_together = [['organization', 'slug']]
        ordering = ['organization', 'name']
        indexes = [
            models.Index(fields=['organization', 'slug']),
            models.Index(fields=['organization', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.organization.name} / {self.name}"
    
    def get_user_role(self, user):
        """Get the active role for a user in this workspace"""
        from .rbac_models import UserRole
        try:
            return UserRole.objects.get(
                user=user,
                workspace=self,
                is_active=True
            ).role
        except UserRole.DoesNotExist:
            return None
    
    def has_user(self, user):
        """Check if user has access to this workspace"""
        # User must be a member of the organization
        return OrganizationMember.objects.filter(
            user=user,
            organization=self.organization,
            is_active=True
        ).exists()


# Import RBAC models to ensure they're registered with Django
from .rbac_models import Permission, Role, RolePermission, UserRole  # noqa: F401, E402

