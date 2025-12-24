"""
Management command to seed default roles and permissions for RBAC system.
"""
from django.core.management.base import BaseCommand
from apps.accounts.rbac_models import Role, Permission, RolePermission


class Command(BaseCommand):
    help = 'Seed default roles and permissions for RBAC system'

    def handle(self, *args, **options):
        self.stdout.write('Seeding default roles and permissions...')
        
        # Define default permissions
        permissions_data = [
            # Workspace permissions
            ('workspace.view', 'View workspace'),
            ('workspace.edit', 'Edit workspace settings'),
            ('workspace.manage', 'Manage workspace (create/delete)'),
            
            # Workflow permissions
            ('workflow.view', 'View workflows'),
            ('workflow.create', 'Create workflows'),
            ('workflow.edit', 'Edit workflows'),
            ('workflow.delete', 'Delete workflows'),
            ('workflow.execute', 'Execute workflows'),
            
            # Run permissions
            ('run.view', 'View workflow runs'),
            ('run.manage', 'Manage workflow runs (cancel, retry)'),
            
            # Connector permissions
            ('connector.view', 'View connectors'),
            ('connector.manage', 'Manage connectors'),
            
            # User/Team permissions
            ('user.view', 'View users'),
            ('user.manage', 'Manage users and roles'),
        ]
        
        # Create permissions
        permissions = {}
        for codename, name in permissions_data:
            permission, created = Permission.objects.get_or_create(
                codename=codename,
                defaults={'name': name}
            )
            permissions[codename] = permission
            if created:
                self.stdout.write(self.style.SUCCESS(f'  Created permission: {name}'))
            else:
                self.stdout.write(f'  Permission already exists: {name}')
        
        # Define default roles with their permissions
        roles_data = [
            {
                'codename': 'admin',
                'name': 'Administrator',
                'description': 'Full access to all workspace resources',
                'permissions': [
                    'workspace.view', 'workspace.edit', 'workspace.manage',
                    'workflow.view', 'workflow.create', 'workflow.edit', 'workflow.delete', 'workflow.execute',
                    'run.view', 'run.manage',
                    'connector.view', 'connector.manage',
                    'user.view', 'user.manage',
                ],
            },
            {
                'codename': 'member',
                'name': 'Member',
                'description': 'Can create and execute workflows',
                'permissions': [
                    'workspace.view',
                    'workflow.view', 'workflow.create', 'workflow.edit', 'workflow.execute',
                    'run.view',
                    'connector.view',
                    'user.view',
                ],
            },
            {
                'codename': 'viewer',
                'name': 'Viewer',
                'description': 'Read-only access to workspace resources',
                'permissions': [
                    'workspace.view',
                    'workflow.view',
                    'run.view',
                    'connector.view',
                    'user.view',
                ],
            },
        ]
        
        # Create roles and assign permissions
        for role_data in roles_data:
            role, created = Role.objects.get_or_create(
                codename=role_data['codename'],
                defaults={
                    'name': role_data['name'],
                    'description': role_data['description'],
                    'is_system': True,
                }
            )
            
            if created:
                self.stdout.write(self.style.SUCCESS(f'  Created role: {role.name}'))
            else:
                self.stdout.write(f'  Role already exists: {role.name}')
                # Update description if needed
                if role.description != role_data['description']:
                    role.description = role_data['description']
                    role.save()
            
            # Assign permissions to role
            for perm_codename in role_data['permissions']:
                permission = permissions.get(perm_codename)
                if permission:
                    role_permission, created = RolePermission.objects.get_or_create(
                        role=role,
                        permission=permission
                    )
                    if created:
                        self.stdout.write(f'    Assigned permission: {permission.name} to {role.name}')
        
        self.stdout.write(self.style.SUCCESS('\nSuccessfully seeded default roles and permissions!'))

