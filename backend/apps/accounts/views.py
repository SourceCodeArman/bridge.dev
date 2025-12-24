"""
Authentication views for Bridge.dev

JWT token views for login, refresh, and verification.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
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

