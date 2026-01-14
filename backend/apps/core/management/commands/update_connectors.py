from django.core.management.base import BaseCommand
from apps.core.models import Connector
import os
import json
from django.conf import settings


class Command(BaseCommand):
    help = "Update connector manifests in the database from local files"

    def handle(self, *args, **options):
        connectors_dir = os.path.join(settings.BASE_DIR, "apps/core/connectors")
        self.stdout.write(f"Scanning for connectors in {connectors_dir}...")

        count = 0
        for root, dirs, files in os.walk(connectors_dir):
            if "manifest.json" in files:
                manifest_path = os.path.join(root, "manifest.json")
                try:
                    with open(manifest_path, "r") as f:
                        manifest = json.load(f)

                    if "id" not in manifest:
                        self.stdout.write(
                            self.style.WARNING(
                                f"Skipping {manifest_path}: No 'id' in manifest"
                            )
                        )
                        continue

                    slug = manifest["id"]

                    defaults = {
                        "display_name": manifest.get("name", slug),
                        "description": manifest.get("description", ""),
                        "version": manifest.get("version", "1.0.0"),
                        "connector_type": manifest.get("connector_type", "action"),
                        "manifest": manifest,
                        "is_active": True,
                    }

                    obj, created = Connector.objects.update_or_create(
                        slug=slug, defaults=defaults
                    )

                    action = "Created" if created else "Updated"
                    self.stdout.write(self.style.SUCCESS(f"{action} connector: {slug}"))
                    count += 1

                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f"Error processing {manifest_path}: {str(e)}")
                    )

        self.stdout.write(
            self.style.SUCCESS(f"Successfully processed {count} connectors")
        )
