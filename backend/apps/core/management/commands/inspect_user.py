from django.contrib.auth import get_user_model
from apps.accounts.models import Workspace, UserRole, OrganizationMember

User = get_user_model()

USER_ID = "738819c1-418e-491b-89ab-bf4c25a65467"
WORKSPACE_ID = "cfdf7694-7135-4637-b415-b0240c6f406d"

try:
    user = User.objects.get(id=USER_ID)
    workspace = Workspace.objects.get(id=WORKSPACE_ID)

    print(f"User: {user.email} (ID: {user.id})")
    print(f"Workspace: {workspace.name} (ID: {workspace.id})")
    print(f"Workspace Org: {workspace.organization.name}")

    # Check Org Membership
    is_member = OrganizationMember.objects.filter(
        user=user, organization=workspace.organization, is_active=True
    ).exists()
    print(f"Is Org Member: {is_member}")

    # Check User Role
    try:
        user_role = UserRole.objects.get(user=user, workspace=workspace, is_active=True)
        print(f"User Role: {user_role.role.name} ({user_role.role.codename})")

        # Check Permissions
        perms = user_role.role.permissions.values_list("codename", flat=True)
        print(f"Permissions: {list(perms)}")
        print(f"Has credential.create: {'credential.create' in perms}")

    except UserRole.DoesNotExist:
        print("User Role: NONE (This is likely the issue!)")

except Exception as e:
    print(f"Error: {e}")
