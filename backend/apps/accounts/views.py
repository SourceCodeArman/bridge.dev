"""
Authentication views for Bridge.dev

JWT token views for login, refresh, and verification.
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Custom token obtain view that returns user information along with tokens.
    """

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)

        if response.status_code == 200:
            # Add user information to response
            user = User.objects.get(email=request.data.get("email"))
            response.data["user"] = {
                "id": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
            }

        return response


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    """
    User registration endpoint.

    Creates a new user account and returns JWT tokens.
    """
    from .serializers import UserRegistrationSerializer

    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()

        # Generate tokens
        refresh = RefreshToken.for_user(user)

        # Create default organization and workspace
        try:
            from .models import (
                Organization,
                Workspace,
                OrganizationMember,
                UserRole,
                Role,
            )
            from django.db import transaction

            with transaction.atomic():
                # Create Organization
                org_name = (
                    f"{user.first_name}'s Org" if user.first_name else "Personal Org"
                )
                # Ensure unique slug
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
                        user=user, workspace=workspace, role=admin_role, is_active=True
                    )
                except Role.DoesNotExist:
                    # Fallback if roles aren't seeded
                    pass

        except Exception as e:
            # temporary logging for debugging
            print(f"Error creating default resources: {e}")
            # We don't fail registration if this fails, but user might have issues

        return Response(
            {
                "status": "success",
                "data": {
                    "user": {
                        "id": str(user.id),
                        "email": user.email,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                    },
                    "tokens": {
                        "access": str(refresh.access_token),
                        "refresh": str(refresh),
                    },
                },
                "message": "User registered successfully",
            },
            status=status.HTTP_201_CREATED,
        )

    return Response(
        {
            "status": "error",
            "data": serializer.errors,
            "message": "Registration failed",
        },
        status=status.HTTP_400_BAD_REQUEST,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def request_password_reset(request):
    """
    Request password reset email.

    Sends a password reset token to the user's email.
    """
    from django.contrib.auth.tokens import PasswordResetTokenGenerator

    email = request.data.get("email")

    if not email:
        return Response(
            {"status": "error", "message": "Email is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        user = User.objects.get(email=email)

        # Generate password reset token
        token_generator = PasswordResetTokenGenerator()
        token_generator.make_token(user)

        # TODO: Send email with reset link
        # For now, just return success
        # In production, you would send an email like:
        # reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}&uid={user.id}"

        return Response(
            {"status": "success", "message": "Password reset email sent"},
            status=status.HTTP_200_OK,
        )

    except User.DoesNotExist:
        # Return success even if user doesn't exist (security best practice)
        return Response(
            {"status": "success", "message": "Password reset email sent"},
            status=status.HTTP_200_OK,
        )


@api_view(["POST"])
@permission_classes([AllowAny])
def reset_password(request):
    """
    Reset password using token.

    Validates the token and updates the user's password.
    """
    from django.contrib.auth.tokens import PasswordResetTokenGenerator

    token = request.data.get("token")
    password = request.data.get("password")
    user_id = request.data.get("uid")

    if not all([token, password, user_id]):
        return Response(
            {"status": "error", "message": "Token, password, and user ID are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        user = User.objects.get(id=user_id)

        # Validate token
        token_generator = PasswordResetTokenGenerator()
        if not token_generator.check_token(user, token):
            return Response(
                {"status": "error", "message": "Invalid or expired token"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Update password
        user.set_password(password)
        user.save()

        return Response(
            {"status": "success", "message": "Password reset successfully"},
            status=status.HTTP_200_OK,
        )
    except User.DoesNotExist:
        return Response(
            {"status": "error", "message": "Invalid or expired token"},
            status=status.HTTP_400_BAD_REQUEST,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    """
    Get current authenticated user.
    """
    user = request.user
    return Response(
        {
            "id": str(user.id),
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
        }
    )


from rest_framework import viewsets
from .models import Workspace
from .serializers import WorkspaceSerializer
from .permissions import IsWorkspaceMember


class WorkspaceViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Workspace model
    """

    serializer_class = WorkspaceSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        """
        Return workspaces that the user has access to via organization membership.
        """
        if not self.request.user.is_authenticated:
            return Workspace.objects.none()

        # Get organizations the user is a member of
        from .models import OrganizationMember

        org_ids = OrganizationMember.objects.filter(
            user=self.request.user, is_active=True
        ).values_list("organization_id", flat=True)

        return Workspace.objects.filter(organization_id__in=org_ids)
