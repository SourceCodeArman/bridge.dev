from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.accounts.models import (
    Organization,
    Workspace,
    OrganizationMember,
    UserRole,
    Role,
)
from django.db import transaction

User = get_user_model()


class Command(BaseCommand):
    help = (
        "Fixes user accounts by ensuring they have a default organization and workspace"
    )

    def handle(self, *args, **options):
        users = User.objects.all()
        for user in users:
            self.stdout.write(f"Checking user: {user.email}")

            # Check if user has any organization membership
            if not OrganizationMember.objects.filter(
                user=user, is_active=True
            ).exists():
                self.stdout.write(
                    f"  - No active organization membership found. Creating defaults..."
                )

                with transaction.atomic():
                    # Create Organization
                    org_name = f"{user.first_name or user.username}'s Org"
                    base_slug = user.username.split("@")[0]
                    slug = base_slug
                    counter = 1
                    while Organization.objects.filter(slug=slug).exists():
                        slug = f"{base_slug}-{counter}"
                        counter += 1

                    org = Organization.objects.create(
                        name=org_name, slug=slug, created_by=user
                    )

                    # Add user to Organization
                    OrganizationMember.objects.create(
                        user=user, organization=org, is_active=True
                    )

                    # Create Default Workspace
                    workspace = Workspace.objects.create(
                        name="Default Workspace",
                        slug="default",
                        organization=org,
                        created_by=user,
                    )

                    # Assign Admin Role
                    try:
                        admin_role = Role.objects.get(codename="admin")
                        UserRole.objects.create(
                            user=user,
                            workspace=workspace,
                            role=admin_role,
                            is_active=True,
                        )
                        self.stdout.write(
                            f"  - Created Org '{org.name}', Workspace '{workspace.name}', and assigned Admin role."
                        )
                    except Role.DoesNotExist:
                        self.stdout.write(
                            self.style.WARNING(
                                "  - Admin role not found! Run 'python manage.py setup_roles' first."
                            )
                        )
            else:
                self.stdout.write(
                    f"  - User has active organization membership. Checking workspace role..."
                )

                membership = OrganizationMember.objects.filter(
                    user=user, is_active=True
                ).first()
                if membership:
                    org = membership.organization
                    workspace = org.workspaces.first()

                    if workspace:
                        if not UserRole.objects.filter(
                            user=user, workspace=workspace, is_active=True
                        ).exists():
                            self.stdout.write(
                                f"  - No UserRole found for workspace '{workspace.name}'. Creating Admin role..."
                            )
                            try:
                                admin_role = Role.objects.get(codename="admin")
                                UserRole.objects.create(
                                    user=user,
                                    workspace=workspace,
                                    role=admin_role,
                                    is_active=True,
                                )
                                self.stdout.write(f"    - Assigned Admin role.")
                            except Role.DoesNotExist:
                                self.stdout.write(
                                    self.style.WARNING("    - Admin role not found!")
                                )
                        else:
                            self.stdout.write(f"    - UserRole exists. All good.")
                    else:
                        self.stdout.write(
                            self.style.WARNING(
                                f"    - Organization '{org.name}' has no workspaces!"
                            )
                        )
