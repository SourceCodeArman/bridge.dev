"""
URL configuration for core app
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    WorkflowViewSet,
    WorkflowVersionViewSet,
    RunViewSet,
    RunStepViewSet,
    TriggerViewSet,
    WebhookTriggerView,
    CredentialViewSet,
    ConnectorViewSet,
    RunLogViewSet,
    RunTraceViewSet,
    AlertConfigurationViewSet,
    AlertHistoryViewSet,
    ErrorSuggestionViewSet,
    WorkflowTemplateViewSet,
    WorkflowCommentViewSet,
    WorkflowPresenceViewSet,
    CustomConnectorViewSet,
    CustomConnectorVersionViewSet,
    AIAssistantViewSet,
)
from .health import health_check

router = DefaultRouter()
router.register(r"workflows", WorkflowViewSet, basename="workflow")
router.register(
    r"workflow-versions", WorkflowVersionViewSet, basename="workflowversion"
)
router.register(r"runs", RunViewSet, basename="run")
router.register(r"steps", RunStepViewSet, basename="runstep")
router.register(r"triggers", TriggerViewSet, basename="trigger")
router.register(r"credentials", CredentialViewSet, basename="credential")
router.register(r"connectors", ConnectorViewSet, basename="connector")

router.register(r"run-logs", RunLogViewSet, basename="runlog")
router.register(r"run-traces", RunTraceViewSet, basename="runtrace")
router.register(
    r"alert-configurations", AlertConfigurationViewSet, basename="alertconfiguration"
)
router.register(r"alert-history", AlertHistoryViewSet, basename="alerthistory")
router.register(
    r"error-suggestions", ErrorSuggestionViewSet, basename="errorsuggestion"
)
router.register(r"templates", WorkflowTemplateViewSet, basename="workflowtemplate")
router.register(r"comments", WorkflowCommentViewSet, basename="workflowcomment")
router.register(r"presence", WorkflowPresenceViewSet, basename="workflowpresence")
router.register(
    r"custom-connectors", CustomConnectorViewSet, basename="customconnector"
)
router.register(
    r"custom-connector-versions",
    CustomConnectorVersionViewSet,
    basename="customconnectorversion",
)

app_name = "core"

# AI Assistant endpoints with explicit URL patterns
ai_assistant_view = AIAssistantViewSet.as_view({
    'post': 'chat',
})
ai_assistant_stream_view = AIAssistantViewSet.as_view({
    'post': 'chat_stream',
})
ai_assistant_history_view = AIAssistantViewSet.as_view({
    'get': 'history',
    'delete': 'clear_history',
})

urlpatterns = [
    path("", include(router.urls)),
    path("assistant/<uuid:workflow_id>/chat/", ai_assistant_view, name="aiassistant-chat"),
    path("assistant/<uuid:workflow_id>/chat/stream/", ai_assistant_stream_view, name="aiassistant-chat-stream"),
    path("assistant/<uuid:workflow_id>/history/", ai_assistant_history_view, name="aiassistant-history"),
    path(
        "webhook/<uuid:webhook_id>/",
        WebhookTriggerView.as_view(),
        name="webhook-trigger",
    ),
    path("health/", health_check, name="health-check"),
    # Trace viewer endpoints
    path(
        "runs/<uuid:run_id>/logs/",
        RunLogViewSet.as_view({"get": "list"}),
        name="run-logs",
    ),
    path(
        "runs/<uuid:run_id>/trace/",
        RunTraceViewSet.as_view({"get": "retrieve"}),
        name="run-trace",
    ),
    path(
        "steps/<uuid:step_id>/logs/",
        RunLogViewSet.as_view({"get": "list"}),
        name="step-logs",
    ),
]
