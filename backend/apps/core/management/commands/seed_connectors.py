"""
Management command to seed system connectors into database.
"""

import json
import os
from pathlib import Path
from django.core.management.base import BaseCommand
from apps.core.models import Connector


class Command(BaseCommand):
    help = "Seed system connectors from manifest files into database"

    def handle(self, *args, **options):
        """Read connector manifests and create database entries"""

        # Get the connectors directory path
        # Path is: commands/seed_connectors.py -> management/commands -> management -> core -> apps -> backend
        # We want: backend/apps/core/connectors
        connectors_dir = Path(__file__).resolve().parent.parent.parent / "connectors"

        if not connectors_dir.exists():
            self.stdout.write(
                self.style.ERROR(f"Connectors directory not found: {connectors_dir}")
            )
            return

        created_count = 0
        updated_count = 0
        skipped_count = 0

        # Iterate through all connector directories
        for connector_path in connectors_dir.iterdir():
            if not connector_path.is_dir() or connector_path.name.startswith("__"):
                continue

            manifest_file = connector_path / "manifest.json"

            if not manifest_file.exists():
                continue

            try:
                # Read the manifest
                with open(manifest_file, "r") as f:
                    manifest = json.load(f)

                # Extract data from manifest
                slug = manifest.get("id")
                display_name = manifest.get("name")
                description = manifest.get("description", "")
                version = manifest.get("version", "1.0.0")
                connector_type = manifest.get("connector_type", "action")

                if not slug or not display_name:
                    self.stdout.write(
                        self.style.WARNING(
                            f"Skipping {connector_path.name}: missing id or name in manifest"
                        )
                    )
                    skipped_count += 1
                    continue

                # Check if connector already exists
                connector, created = Connector.objects.update_or_create(
                    slug=slug,
                    defaults={
                        "display_name": display_name,
                        "description": description,
                        "version": version,
                        "connector_type": connector_type,
                        "manifest": manifest,
                        "is_active": True,
                    },
                )

                if created:
                    created_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"✓ Created: {display_name} ({slug}) [{connector_type}]"
                        )
                    )
                else:
                    updated_count += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f"↻ Updated: {display_name} ({slug}) [{connector_type}]"
                        )
                    )

            except json.JSONDecodeError as e:
                self.stdout.write(
                    self.style.ERROR(
                        f"✗ Failed to parse {connector_path.name}/manifest.json: {e}"
                    )
                )
                skipped_count += 1
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"✗ Error processing {connector_path.name}: {e}")
                )
                skipped_count += 1

        # Print summary
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("═" * 60))
        self.stdout.write(self.style.SUCCESS(f"Created: {created_count}"))
        self.stdout.write(self.style.WARNING(f"Updated: {updated_count}"))
        if skipped_count > 0:
            self.stdout.write(self.style.ERROR(f"Skipped: {skipped_count}"))
        self.stdout.write(self.style.SUCCESS("═" * 60))
