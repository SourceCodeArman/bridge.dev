"""
URL configuration for core app
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    WorkflowViewSet, WorkflowVersionViewSet,
    RunViewSet, RunStepViewSet, TriggerViewSet,
    WebhookTriggerView
)
from .health import health_check

router = DefaultRouter()
router.register(r'workflows', WorkflowViewSet, basename='workflow')
router.register(r'workflow-versions', WorkflowVersionViewSet, basename='workflowversion')
router.register(r'runs', RunViewSet, basename='run')
router.register(r'run-steps', RunStepViewSet, basename='runstep')
router.register(r'triggers', TriggerViewSet, basename='trigger')

app_name = 'core'

urlpatterns = [
    path('', include(router.urls)),
    path('triggers/webhook/<uuid:trigger_id>/', WebhookTriggerView.as_view(), name='webhook-trigger'),
    path('health/', health_check, name='health-check'),
]

