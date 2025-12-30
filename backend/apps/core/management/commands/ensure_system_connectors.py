from django.core.management.base import BaseCommand
from apps.core.models import Connector


class Command(BaseCommand):
    help = "Ensures system connectors (Trigger, Condition, AI Agent, etc.) exist in the database."

    def handle(self, *args, **options):
        system_connectors = [
            # --- Triggers ---
            {
                "slug": "webhook",
                "display_name": "Webhook Trigger",
                "description": "Starts workflow via webhook",
                "connector_type": "trigger",
                "icon_url": None,  # Will use frontend hardcoded icon for now or can update later
                "manifest": {
                    "id": "webhook",
                    "name": "Webhook Trigger",
                    "version": "1.0.0",
                    "connector_type": "trigger",
                    "triggers": [
                        {
                            "id": "webhook",
                            "name": "Webhook",
                            "description": "Incoming Webhook",
                        }
                    ],
                },
            },
            # --- Logic ---
            {
                "slug": "condition",
                "display_name": "If / Else",
                "description": "Conditional logic",
                "connector_type": "condition",
                "icon_url": "/if-else-icon.svg",
                "manifest": {
                    "id": "condition",
                    "name": "If / Else",
                    "version": "1.0.0",
                    "connector_type": "condition",
                },
            },
            # --- AI Agent ---
            {
                "slug": "ai-agent",
                "display_name": "AI Agent",
                "description": "AI Agent Node",
                "connector_type": "agent",
                "icon_url": None,
                "manifest": {
                    "id": "ai-agent",
                    "name": "AI Agent",
                    "version": "1.0.0",
                    "connector_type": "agent",
                },
            },
            # --- Models ---
            {
                "slug": "openai-model",
                "display_name": "OpenAI Model",
                "description": "OpenAI LLM",
                "connector_type": "model",
                "icon_url": "https://upload.wikimedia.org/wikipedia/commons/4/4d/OpenAI_Logo.svg",
                "manifest": {
                    "id": "openai-model",
                    "name": "OpenAI Model",
                    "version": "1.0.0",
                    "connector_type": "model",
                },
            },
            # --- Memories ---
            {
                "slug": "redis-memory",
                "display_name": "Redis Memory",
                "description": "Redis Chat Memory",
                "connector_type": "memory",
                "icon_url": "https://cdn.iconscout.com/icon/free/png-256/free-redis-logo-icon-download-in-svg-png-gif-file-formats--programming-langugae-free-drivers-pack-logos-icons-2666324.png",
                "manifest": {
                    "id": "redis-memory",
                    "name": "Redis Memory",
                    "version": "1.0.0",
                    "connector_type": "memory",
                },
            },
            {
                "slug": "xata-memory",
                "display_name": "Xata Memory",
                "description": "Xata Chat Memory",
                "connector_type": "memory",
                "manifest": {
                    "id": "xata-memory",
                    "name": "Xata Memory",
                    "version": "1.0.0",
                    "connector_type": "memory",
                },
            },
            {
                "slug": "motorhead-memory",
                "display_name": "Motorhead Memory",
                "description": "Motorhead Chat Memory",
                "connector_type": "memory",
                "manifest": {
                    "id": "motorhead-memory",
                    "name": "Motorhead Memory",
                    "version": "1.0.0",
                    "connector_type": "memory",
                },
            },
            {
                "slug": "mongodb-memory",
                "display_name": "MongoDB Memory",
                "description": "MongoDB Chat Memory",
                "connector_type": "memory",
                "manifest": {
                    "id": "mongodb-memory",
                    "name": "MongoDB Memory",
                    "version": "1.0.0",
                    "connector_type": "memory",
                },
            },
            {
                "slug": "postgres-memory",
                "display_name": "Postgres Memory",
                "description": "Postgres Chat Memory",
                "connector_type": "memory",
                "manifest": {
                    "id": "postgres-memory",
                    "name": "Postgres Memory",
                    "version": "1.0.0",
                    "connector_type": "memory",
                },
            },
            # --- Tools ---
            {
                "slug": "code-tool",
                "display_name": "Code Tool",
                "description": "Execute JS/Python code",
                "connector_type": "tool",
                "icon_url": None,
                "manifest": {
                    "id": "code-tool",
                    "name": "Code Tool",
                    "version": "1.0.0",
                    "connector_type": "tool",
                },
            },
            {
                "slug": "http-tool",
                "display_name": "HTTP Tool",
                "description": "Make HTTP Requests",
                "connector_type": "tool",
                "icon_url": None,
                "manifest": {
                    "id": "http-tool",
                    "name": "HTTP Tool",
                    "version": "1.0.0",
                    "connector_type": "tool",
                },
            },
            {
                "slug": "mcp-client-tool",
                "display_name": "MCP Client",
                "description": "Connect to MCP Server",
                "connector_type": "tool",
                "icon_url": None,
                "manifest": {
                    "id": "mcp-client-tool",
                    "name": "MCP Client",
                    "version": "1.0.0",
                    "connector_type": "tool",
                },
            },
            {
                "slug": "supabase-vector-store",
                "display_name": "Supabase Vector Store",
                "description": "Supabase Vector Search",
                "connector_type": "tool",
                "icon_url": "https://supabase.com/dashboard/img/supabase-logo.svg",
                "manifest": {
                    "id": "supabase-vector-store",
                    "name": "Supabase Vector Store",
                    "version": "1.0.0",
                    "connector_type": "tool",
                },
            },
            {
                "slug": "simple-vector-store",
                "display_name": "Simple Vector Store",
                "description": "In-memory Vector Search",
                "connector_type": "tool",
                "icon_url": None,
                "manifest": {
                    "id": "simple-vector-store",
                    "name": "Simple Vector Store",
                    "version": "1.0.0",
                    "connector_type": "tool",
                },
            },
            {
                "slug": "mongodb-atlas-vector-store",
                "display_name": "MongoDB Atlas Vector",
                "description": "MongoDB Atlas Vector Search",
                "connector_type": "tool",
                "icon_url": None,
                "manifest": {
                    "id": "mongodb-atlas-vector-store",
                    "name": "MongoDB Atlas Vector",
                    "version": "1.0.0",
                    "connector_type": "tool",
                },
            },
        ]

        self.stdout.write("Seeding system connectors...")

        for data in system_connectors:
            connector, created = Connector.objects.update_or_create(
                slug=data["slug"],
                defaults={
                    "display_name": data["display_name"],
                    "description": data["description"],
                    "manifest": data["manifest"],
                    "icon_url": data.get("icon_url"),
                    "is_active": True,
                },
            )
            verb = "Created" if created else "Updated"
            self.stdout.write(
                f"{verb} connector: {connector.display_name} ({data['connector_type']})"
            )

        self.stdout.write(self.style.SUCCESS("Successfully seeded system connectors."))
