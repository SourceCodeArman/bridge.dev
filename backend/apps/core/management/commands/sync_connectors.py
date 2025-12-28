from django.core.management.base import BaseCommand
from apps.core.models import Connector
import os
import json
from django.conf import settings


class Command(BaseCommand):
    help = "Syncs system connectors from the filesystem to the database"

    def handle(self, *args, **options):
        # Define the path to connectors directory
        # Assuming connectors are in apps/core/connectors
        connectors_dir = os.path.join(settings.BASE_DIR, "apps", "core", "connectors")

        self.stdout.write(f"Scanning for connectors in {connectors_dir}...")

        # Hardcoded icon URLs (since user mentioned they are in supabase)
        # Use placeholders for now or specific URLs if known
        ICON_URLS = {
            "openai": "https://obuldanrptloktxcffvn.supabase.co/storage/v1/object/public/imgs/openai-icon.png",  # Example
            "anthropic": "https://obuldanrptloktxcffvn.supabase.co/storage/v1/object/public/imgs/anthropic-icon.png",
            "google": "https://obuldanrptloktxcffvn.supabase.co/storage/v1/object/public/imgs/google-icon.png",
            "gemini": "https://obuldanrptloktxcffvn.supabase.co/storage/v1/object/public/imgs/gemini-icon.png",
            "deepseek": "https://obuldanrptloktxcffvn.supabase.co/storage/v1/object/public/imgs/deepseek-icon.png",
            "slack": "https://obuldanrptloktxcffvn.supabase.co/storage/v1/object/public/imgs/slack-icon.png",
            "supabase": "https://obuldanrptloktxcffvn.supabase.co/storage/v1/object/public/imgs/supabase-icon.png",
            "http": "https://obuldanrptloktxcffvn.supabase.co/storage/v1/object/public/imgs/http-icon.png",
        }

        # Mapping for generic icons if specific one is missing
        DEFAULT_ICON = "https://obuldanrptloktxcffvn.supabase.co/storage/v1/object/public/imgs/default-connector.png"

        valid_connectors = [
            "openai",
            "anthropic",
            "google",
            "gemini",
            "deepseek",
            "slack",
            "supabase",
            "http",
        ]

        count = 0
        for item in os.listdir(connectors_dir):
            if item.startswith("__") or item not in valid_connectors:
                continue

            item_path = os.path.join(connectors_dir, item)
            if os.path.isdir(item_path):
                manifest_path = os.path.join(item_path, "manifest.json")
                if os.path.exists(manifest_path):
                    try:
                        with open(manifest_path, "r") as f:
                            manifest = json.load(f)

                        slug = manifest.get("id")
                        # Ensure slug matches directory name or manifest ID
                        if not slug:
                            self.stdout.write(
                                self.style.WARNING(f"Manifest in {item} missing 'id'")
                            )
                            continue

                        # Use the icon map
                        icon_url = ICON_URLS.get(slug, DEFAULT_ICON)

                        Connector.objects.update_or_create(
                            slug=slug,
                            defaults={
                                "display_name": manifest.get("name", slug.title()),
                                "description": manifest.get("description", ""),
                                "version": manifest.get("version", "1.0.0"),
                                "manifest": manifest,
                                "icon_url": icon_url,
                                "is_active": True,
                            },
                        )
                        self.stdout.write(
                            self.style.SUCCESS(f"Synced connector: {slug}")
                        )
                        count += 1
                    except Exception as e:
                        self.stdout.write(
                            self.style.ERROR(f"Failed to sync {item}: {e}")
                        )

        self.stdout.write(self.style.SUCCESS(f"Successfully synced {count} connectors"))
