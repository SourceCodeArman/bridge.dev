"""
Core app configuration
"""

from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.core"
    verbose_name = "Core"

    def ready(self):
        """Register connectors when app is ready"""
        try:
            from apps.core.connectors.base import ConnectorRegistry
            from apps.core.connectors.supabase.connector import SupabaseConnector
            from apps.core.connectors.http.connector import HTTPConnector
            from apps.core.connectors.webhook.connector import WebhookConnector
            from apps.core.connectors.slack.connector import SlackConnector
            from apps.core.connectors.google.gmail.connector import GmailConnector
            from apps.core.connectors.google.sheets.connector import (
                GoogleSheetsConnector,
            )
            from apps.core.connectors.google.calendar.connector import (
                GoogleCalendarConnector,
            )
            from apps.core.connectors.openai.connector import OpenAIConnector
            from apps.core.connectors.openai_model.connector import (
                OpenAIModelConnector,
            )
            from apps.core.connectors.simple_memory.connector import SimpleMemoryConnector
            from apps.core.connectors.anthropic.connector import AnthropicConnector
            from apps.core.connectors.gemini.connector import GeminiConnector
            from apps.core.connectors.deepseek.connector import DeepSeekConnector
            from apps.core.connectors.mongodb_memory.connector import MongoDBMemoryConnector
            from apps.core.connectors.postgres_memory.connector import PostgresMemoryConnector
            from apps.core.connectors.redis_memory.connector import RedisMemoryConnector
            from apps.core.connectors.http_tool.connector import HTTPToolConnector
            from apps.core.connectors.mcp_client_tool.connector import MCPClientConnector

            registry = ConnectorRegistry()

            # Register all connectors
            registry.register(SupabaseConnector)
            registry.register(HTTPConnector)
            registry.register(WebhookConnector)
            registry.register(SlackConnector)
            registry.register(GmailConnector)
            registry.register(GoogleSheetsConnector)
            registry.register(GoogleCalendarConnector)
            registry.register(OpenAIConnector)
            registry.register(OpenAIModelConnector)
            registry.register(SimpleMemoryConnector)
            registry.register(AnthropicConnector)
            registry.register(GeminiConnector)
            registry.register(DeepSeekConnector)
            registry.register(MongoDBMemoryConnector)
            registry.register(PostgresMemoryConnector)
            registry.register(RedisMemoryConnector)
            registry.register(HTTPToolConnector)
            registry.register(MCPClientConnector)

            # Register inbound webhook connector
            from apps.core.connectors.webhook.connector import (
                WebhookConnector as InboundWebhookConnector,
            )

            registry.register(InboundWebhookConnector)

            # Activate all active Supabase triggers
            from apps.core.supabase_trigger_handler import trigger_manager

            trigger_manager.activate_all_active_triggers()

        except Exception as e:
            import logging

            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to register connectors: {str(e)}")
