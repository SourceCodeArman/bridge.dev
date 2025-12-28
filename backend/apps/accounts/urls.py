"""
URL configuration for accounts app
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from rest_framework import routers
from .views import (
    CustomTokenObtainPairView,
    register,
    request_password_reset,
    reset_password,
    me,
    WorkspaceViewSet,
)

app_name = "accounts"

router = routers.DefaultRouter()
router.register(r"workspaces", WorkspaceViewSet, basename="workspace")

urlpatterns = [
    path("login/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("register/", register, name="register"),
    path(
        "password-reset/request/", request_password_reset, name="request_password_reset"
    ),
    path("password-reset/confirm/", reset_password, name="reset_password"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    path("me/", me, name="me"),
] + router.urls
