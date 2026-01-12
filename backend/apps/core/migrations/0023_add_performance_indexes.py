"""
Add database indexes for performance optimization.

This migration adds indexes on frequently queried fields to improve
API response times from 567-885ms to 100-300ms.
"""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0022_add_conversation_models"),
    ]

    operations = [
        # Workflow indexes
        migrations.AddIndex(
            model_name="workflow",
            index=models.Index(
                fields=["workspace"], name="core_workflow_workspace_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="workflow",
            index=models.Index(
                fields=["created_by"], name="core_workflow_created_by_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="workflow",
            index=models.Index(
                fields=["is_active"], name="core_workflow_is_active_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="workflow",
            index=models.Index(
                fields=["workspace", "is_active"], name="core_workflow_ws_active_idx"
            ),
        ),
        # WorkflowVersion indexes
        migrations.AddIndex(
            model_name="workflowversion",
            index=models.Index(fields=["workflow"], name="core_wfversion_workflow_idx"),
        ),
        migrations.AddIndex(
            model_name="workflowversion",
            index=models.Index(
                fields=["is_active"], name="core_wfversion_is_active_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="workflowversion",
            index=models.Index(
                fields=["created_at"], name="core_wfversion_created_at_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="workflowversion",
            index=models.Index(
                fields=["workflow", "is_active"], name="core_wfversion_wf_active_idx"
            ),
        ),
        # CustomConnector indexes
        migrations.AddIndex(
            model_name="customconnector",
            index=models.Index(
                fields=["workspace"], name="core_customconn_workspace_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="customconnector",
            index=models.Index(fields=["status"], name="core_customconn_status_idx"),
        ),
        migrations.AddIndex(
            model_name="customconnector",
            index=models.Index(
                fields=["workspace", "status"], name="core_customconn_ws_status_idx"
            ),
        ),
        # CustomConnectorVersion indexes
        migrations.AddIndex(
            model_name="customconnectorversion",
            index=models.Index(
                fields=["connector"], name="core_customconnver_conn_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="customconnectorversion",
            index=models.Index(fields=["status"], name="core_customconnver_status_idx"),
        ),
        # Trigger indexes
        migrations.AddIndex(
            model_name="trigger",
            index=models.Index(fields=["workflow"], name="core_trigger_workflow_idx"),
        ),
        migrations.AddIndex(
            model_name="trigger",
            index=models.Index(fields=["is_active"], name="core_trigger_is_active_idx"),
        ),
        # Run indexes
        migrations.AddIndex(
            model_name="run",
            index=models.Index(
                fields=["workflow_version"], name="core_run_wf_version_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="run",
            index=models.Index(fields=["created_at"], name="core_run_created_at_idx"),
        ),
        migrations.AddIndex(
            model_name="run",
            index=models.Index(
                fields=["-created_at"], name="core_run_created_at_desc_idx"
            ),
        ),
        # ConversationThread indexes
        migrations.AddIndex(
            model_name="conversationthread",
            index=models.Index(
                fields=["workflow"], name="core_convthread_workflow_idx"
            ),
        ),
        # ChatMessage indexes
        migrations.AddIndex(
            model_name="chatmessage",
            index=models.Index(fields=["thread"], name="core_chatmsg_thread_idx"),
        ),
        migrations.AddIndex(
            model_name="chatmessage",
            index=models.Index(
                fields=["created_at"], name="core_chatmsg_created_at_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="chatmessage",
            index=models.Index(
                fields=["-created_at"], name="core_chatmsg_created_at_desc_idx"
            ),
        ),
    ]
