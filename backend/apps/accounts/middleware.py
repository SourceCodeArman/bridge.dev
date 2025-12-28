"""
Middleware for workspace scoping and context management
"""

from django.utils.deprecation import MiddlewareMixin
from .models import Workspace


class WorkspaceMiddleware(MiddlewareMixin):
    """
    Middleware to extract and validate workspace from request.

    Workspace can be specified via:
    - X-Workspace-Id header (preferred)
    - workspace_id query parameter
    - workspace_slug query parameter (requires organization context)
    """

    def process_request(self, request):
        """
        Extract workspace from request and attach to request object.
        """
        workspace = None
        workspace_id = None

        # Try to get workspace ID from header
        workspace_id = request.headers.get("X-Workspace-Id") or request.GET.get(
            "workspace_id"
        )

        if workspace_id:
            try:
                workspace = Workspace.objects.get(id=workspace_id)
            except (Workspace.DoesNotExist, ValueError):
                workspace = None

        # If no workspace ID, try workspace slug (requires organization context)
        if not workspace:
            workspace_slug = request.GET.get("workspace_slug")
            # For now, we'll need organization context to resolve by slug
            # This can be enhanced later with organization header/context

        # If no workspace context, try to find a default one for authenticated users
        if not workspace and request.user.is_authenticated:
            from .models import OrganizationMember

            # Find the first active organization membership
            membership = OrganizationMember.objects.filter(
                user=request.user, is_active=True
            ).first()

            if membership:
                # Find the first workspace in that organization
                workspace = membership.organization.workspaces.first()

        # Attach workspace to request
        request.workspace = workspace

        # Also attach workspace_id for convenience
        request.workspace_id = str(workspace.id) if workspace else None

        return None
