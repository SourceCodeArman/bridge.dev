import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.accounts.models import User, OrganizationMember, Workspace, Organization

email = "armanghev747@gmail.com"
try:
    user = User.objects.get(email=email)
    print(f"User found: {user.email} (ID: {user.id})")

    memberships = OrganizationMember.objects.filter(user=user)
    print(f"Memberships count: {memberships.count()}")

    for m in memberships:
        print(
            f" - Org: {m.organization.name} (ID: {m.organization.id}), Active: {m.is_active}"
        )
        workspaces = m.organization.workspaces.all()
        print(f"   Workspaces: {workspaces.count()}")
        for w in workspaces:
            print(f"    - {w.name} (ID: {w.id})")

    if memberships.count() == 0:
        print("Creating default organization and workspace...")
        org = Organization.objects.create(name="Default Org")
        workspace = Workspace.objects.create(name="Default Workspace", organization=org)
        OrganizationMember.objects.create(user=user, organization=org, role="owner")
        print("Created.")

except User.DoesNotExist:
    print("User not found.")
