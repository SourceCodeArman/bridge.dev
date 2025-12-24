# Generated migration for RunLog and RunTrace models

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_credential_models'),
    ]

    operations = [
        migrations.CreateModel(
            name='RunLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('level', models.CharField(choices=[('DEBUG', 'Debug'), ('INFO', 'Info'), ('WARNING', 'Warning'), ('ERROR', 'Error'), ('CRITICAL', 'Critical')], db_index=True, max_length=20)),
                ('message', models.TextField(help_text='Log message')),
                ('timestamp', models.DateTimeField(auto_now_add=True, db_index=True, help_text='Log timestamp')),
                ('correlation_id', models.CharField(blank=True, db_index=True, help_text='Correlation ID for tracing', max_length=255)),
                ('extra_data', models.JSONField(blank=True, default=dict, help_text='Additional log data (JSON)')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('run', models.ForeignKey(help_text='Workflow run this log belongs to', on_delete=django.db.models.deletion.CASCADE, related_name='logs', to='core.run')),
                ('step', models.ForeignKey(blank=True, help_text='Step this log belongs to (null for run-level logs)', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='logs', to='core.runstep')),
            ],
            options={
                'verbose_name': 'Run Log',
                'verbose_name_plural': 'Run Logs',
                'db_table': 'core_runlog',
                'ordering': ['-timestamp'],
            },
        ),
        migrations.CreateModel(
            name='RunTrace',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('trace_data', models.JSONField(default=dict, help_text='Complete trace structure (JSON)')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('run', models.OneToOneField(help_text='Workflow run this trace belongs to', on_delete=django.db.models.deletion.CASCADE, related_name='trace', to='core.run')),
            ],
            options={
                'verbose_name': 'Run Trace',
                'verbose_name_plural': 'Run Traces',
                'db_table': 'core_runtrace',
                'ordering': ['-updated_at'],
            },
        ),
        migrations.AddIndex(
            model_name='runlog',
            index=models.Index(fields=['run', 'timestamp'], name='core_runlog_run_timestamp_idx'),
        ),
        migrations.AddIndex(
            model_name='runlog',
            index=models.Index(fields=['step', 'timestamp'], name='core_runlog_step_timestamp_idx'),
        ),
        migrations.AddIndex(
            model_name='runlog',
            index=models.Index(fields=['run', 'level'], name='core_runlog_run_level_idx'),
        ),
        migrations.AddIndex(
            model_name='runlog',
            index=models.Index(fields=['correlation_id', 'timestamp'], name='core_runlog_correlation_idx'),
        ),
        migrations.AddIndex(
            model_name='runlog',
            index=models.Index(fields=['run', 'step', 'timestamp'], name='core_runlog_run_step_timestamp_idx'),
        ),
        migrations.AddIndex(
            model_name='runtrace',
            index=models.Index(fields=['run'], name='core_runtrace_run_idx'),
        ),
        migrations.AddIndex(
            model_name='runtrace',
            index=models.Index(fields=['updated_at'], name='core_runtrace_updated_at_idx'),
        ),
    ]

