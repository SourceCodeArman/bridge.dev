# Generated migration for workflow templates

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0009_add_replay_fields'),
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='WorkflowTemplate',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(help_text='Template name', max_length=200)),
                ('description', models.TextField(blank=True, help_text='Template description')),
                ('category', models.CharField(
                    choices=[
                        ('webhook', 'Webhook'),
                        ('database', 'Database'),
                        ('automation', 'Automation'),
                        ('integration', 'Integration'),
                        ('notification', 'Notification'),
                        ('data-processing', 'Data Processing'),
                    ],
                    db_index=True,
                    help_text='Template category',
                    max_length=50
                )),
                ('definition', models.JSONField(help_text='Workflow graph definition (nodes and edges)')),
                ('is_public', models.BooleanField(
                    db_index=True,
                    default=True,
                    help_text='Whether template is available to all workspaces'
                )),
                ('usage_count', models.PositiveIntegerField(
                    default=0,
                    help_text='Number of times this template has been cloned'
                )),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(
                    blank=True,
                    help_text='User who created this template',
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='created_templates',
                    to='accounts.user'
                )),
            ],
            options={
                'verbose_name': 'Workflow Template',
                'verbose_name_plural': 'Workflow Templates',
                'db_table': 'core_workflowtemplate',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='workflowtemplate',
            index=models.Index(fields=['category', 'is_public'], name='core_workflowtemplate_category_public_idx'),
        ),
        migrations.AddIndex(
            model_name='workflowtemplate',
            index=models.Index(fields=['is_public', 'created_at'], name='core_workflowtemplate_public_created_idx'),
        ),
        migrations.AddIndex(
            model_name='workflowtemplate',
            index=models.Index(fields=['category', 'created_at'], name='core_workflowtemplate_category_created_idx'),
        ),
    ]


