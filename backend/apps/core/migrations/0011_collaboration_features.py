# Generated migration for collaboration features

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0010_workflow_templates'),
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='WorkflowComment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('node_id', models.CharField(
                    blank=True,
                    db_index=True,
                    help_text='ID of node being commented on',
                    max_length=100,
                    null=True
                )),
                ('edge_id', models.CharField(
                    blank=True,
                    db_index=True,
                    help_text='ID of edge being commented on (if commenting on edge)',
                    max_length=100,
                    null=True
                )),
                ('content', models.TextField(help_text='Comment content')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('resolved_at', models.DateTimeField(
                    blank=True,
                    db_index=True,
                    help_text='When comment was marked as resolved',
                    null=True
                )),
                ('created_by', models.ForeignKey(
                    help_text='User who created this comment',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='workflow_comments',
                    to='accounts.user'
                )),
                ('resolved_by', models.ForeignKey(
                    blank=True,
                    help_text='User who resolved this comment',
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='resolved_comments',
                    to='accounts.user'
                )),
                ('workflow_version', models.ForeignKey(
                    help_text='Workflow version this comment belongs to',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='comments',
                    to='core.workflowversion'
                )),
            ],
            options={
                'verbose_name': 'Workflow Comment',
                'verbose_name_plural': 'Workflow Comments',
                'db_table': 'core_workflowcomment',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='WorkflowPresence',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('node_id', models.CharField(
                    blank=True,
                    help_text='Currently focused node ID',
                    max_length=100,
                    null=True
                )),
                ('last_seen_at', models.DateTimeField(
                    auto_now=True,
                    db_index=True,
                    help_text='Last time user was seen (auto-updated)'
                )),
                ('is_active', models.BooleanField(
                    db_index=True,
                    default=True,
                    help_text='Whether user is currently active'
                )),
                ('user', models.ForeignKey(
                    help_text='User with presence',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='workflow_presence',
                    to='accounts.user'
                )),
                ('workflow_version', models.ForeignKey(
                    help_text='Workflow version being viewed',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='presence',
                    to='core.workflowversion'
                )),
            ],
            options={
                'verbose_name': 'Workflow Presence',
                'verbose_name_plural': 'Workflow Presences',
                'db_table': 'core_workflowpresence',
            },
        ),
        migrations.AddIndex(
            model_name='workflowcomment',
            index=models.Index(fields=['workflow_version', 'node_id'], name='core_workflowcomment_version_node_idx'),
        ),
        migrations.AddIndex(
            model_name='workflowcomment',
            index=models.Index(fields=['workflow_version', 'created_at'], name='core_workflowcomment_version_created_idx'),
        ),
        migrations.AddIndex(
            model_name='workflowcomment',
            index=models.Index(fields=['workflow_version', 'resolved_at'], name='core_workflowcomment_version_resolved_idx'),
        ),
        migrations.AddIndex(
            model_name='workflowpresence',
            index=models.Index(fields=['workflow_version', 'is_active'], name='core_workflowpresence_version_active_idx'),
        ),
        migrations.AddIndex(
            model_name='workflowpresence',
            index=models.Index(fields=['workflow_version', 'last_seen_at'], name='core_workflowpresence_version_seen_idx'),
        ),
        migrations.AddIndex(
            model_name='workflowpresence',
            index=models.Index(fields=['user', 'is_active'], name='core_workflowpresence_user_active_idx'),
        ),
        migrations.AddConstraint(
            model_name='workflowpresence',
            constraint=models.UniqueConstraint(fields=['workflow_version', 'user'], name='core_workflowpresence_version_user_unique'),
        ),
    ]


