"""
URL configuration for core app
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .health import health_check
from .views import (
    AlertConfigurationViewSet,
    AlertHistoryViewSet,
    ConnectorViewSet,
    CredentialViewSet,
    CustomConnectorVersionViewSet,
    CustomConnectorViewSet,
    ErrorSuggestionViewSet,
    RunLogViewSet,
    RunStepViewSet,
    RunTraceViewSet,
    RunViewSet,
    TriggerViewSet,
    WebhookTriggerView,
    WorkflowCommentViewSet,
    WorkflowPresenceViewSet,
    WorkflowTemplateViewSet,
    WorkflowVersionViewSet,
    WorkflowViewSet,
)
from .views.assistant import (
    AIAssistantChatStreamView,
    AIAssistantChatView,
    AIAssistantHistoryView,
    AIAssistantThreadDetailView,
    AIAssistantThreadsView,
)
from .views.integrations import IntegrationViewSet

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
router.register(r"integrations", IntegrationViewSet, basename="integration")
router.register(
    r"custom-connector-versions",
    CustomConnectorVersionViewSet,
    basename="customconnectorversion",
)

app_name = "core"

urlpatterns = [
    path(
        "integrations/<str:service>/callback/",
        IntegrationViewSet.as_view({"get": "generic_callback"}),
        name="integration-callback",
    ),
    path("", include(router.urls)),
    # AI Assistant endpoints
    path(
        "assistant/<uuid:workflow_id>/chat/",
        AIAssistantChatView.as_view(),
        name="aiassistant-chat",
    ),
    path(
        "assistant/<uuid:workflow_id>/chat/stream/",
        AIAssistantChatStreamView.as_view(),
        name="aiassistant-chat-stream",
    ),
    path(
        "assistant/<uuid:workflow_id>/history/",
        AIAssistantHistoryView.as_view(),
        name="aiassistant-history",
    ),
    path(
        "assistant/<uuid:workflow_id>/threads/",
        AIAssistantThreadsView.as_view(),
        name="aiassistant-threads",
    ),
    path(
        "assistant/<uuid:workflow_id>/threads/<uuid:thread_id>/",
        AIAssistantThreadDetailView.as_view(),
        name="aiassistant-thread-detail",
    ),
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
