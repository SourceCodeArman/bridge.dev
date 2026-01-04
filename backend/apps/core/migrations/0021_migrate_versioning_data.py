# Data migration for workflow versioning refactor

from django.db import migrations


def migrate_workflow_data(apps, schema_editor):
    """Migrate existing workflow data to new versioning structure"""
    Workflow = apps.get_model("core", "Workflow")
    WorkflowVersion = apps.get_model("core", "WorkflowVersion")

    for workflow in Workflow.objects.all():
        # Set is_active based on status (active workflows are active)
        workflow.is_active = workflow.status == "active"

        # Set current_version to active version, or latest version
        active_version = workflow.versions.filter(is_active=True).first()
        if not active_version:
            # No active version, use most recent
            active_version = workflow.versions.order_by("-created_at").first()

        workflow.current_version = active_version
        workflow.save(update_fields=["is_active", "current_version"])

    # Mark all existing versions as manually created (preserve history)
    WorkflowVersion.objects.all().update(created_manually=True)


def reverse_migrate_workflow_data(apps, schema_editor):
    """Reverse migration - reset fields to defaults"""
    Workflow = apps.get_model("core", "Workflow")
    WorkflowVersion = apps.get_model("core", "WorkflowVersion")

    # Reset is_active and current_version
    Workflow.objects.all().update(is_active=False, current_version=None)

    # Reset created_manually
    WorkflowVersion.objects.all().update(created_manually=False)


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0020_workflow_current_version_workflow_is_active_and_more"),
    ]

    operations = [
        migrations.RunPython(migrate_workflow_data, reverse_migrate_workflow_data),
    ]
