"""
Authentication views for Bridge.dev

JWT token views for login, refresh, and verification.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView
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
            user = User.objects.get(email=request.data.get('email'))
            response.data['user'] = {
                'id': str(user.id),
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
            }
        
        return response


@api_view(['POST'])
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
        
        return Response({
            'status': 'success',
            'data': {
                'user': {
                    'id': str(user.id),
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                },
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                }
            },
            'message': 'User registered successfully'
        }, status=status.HTTP_201_CREATED)
    
    return Response({
        'status': 'error',
        'data': serializer.errors,
        'message': 'Registration failed'
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def request_password_reset(request):
    """
    Request password reset email.
    
    Sends a password reset token to the user's email.
    """
    from django.contrib.auth.tokens import PasswordResetTokenGenerator
    
    email = request.data.get('email')
    
    if not email:
        return Response({
            'status': 'error',
            'message': 'Email is required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user = User.objects.get(email=email)
        
        # Generate password reset token
        token_generator = PasswordResetTokenGenerator()
        token = token_generator.make_token(user)
        
        # TODO: Send email with reset link
        # For now, just return success
        # In production, you would send an email like:
        # reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}&uid={user.id}"
        
        return Response({
            'status': 'success',
            'message': 'Password reset email sent'
        }, status=status.HTTP_200_OK)
        
    except User.DoesNotExist:
        # Return success even if user doesn't exist (security best practice)
        return Response({
            'status': 'success',
            'message': 'Password reset email sent'
        }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password(request):
    """
    Reset password using token.
    
    Validates the token and updates the user's password.
    """
    from django.contrib.auth.tokens import PasswordResetTokenGenerator
    
    token = request.data.get('token')
    password = request.data.get('password')
    user_id = request.data.get('uid')
    
    if not all([token, password, user_id]):
        return Response({
            'status': 'error',
            'message': 'Token, password, and user ID are required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user = User.objects.get(id=user_id)
        
        # Validate token
        token_generator = PasswordResetTokenGenerator()
        if not token_generator.check_token(user, token):
            return Response({
                'status': 'error',
                'message': 'Invalid or expired token'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update password
        user.set_password(password)
        user.save()
        
        return Response({
            'status': 'success',
            'message': 'Password reset successfully'
        }, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        return Response({
            'status': 'error',
            'message': 'Invalid or expired token'
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    """
    Get current authenticated user.
    """
    user = request.user
    return Response({
        'id': str(user.id),
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
    })
