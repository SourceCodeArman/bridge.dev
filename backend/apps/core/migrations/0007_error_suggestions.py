# Generated migration for ErrorSuggestion model

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0008_alert_system'),
    ]

    operations = [
        migrations.CreateModel(
            name='ErrorSuggestion',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('error_type', models.CharField(db_index=True, help_text='Category of error (e.g., authentication_error, validation_error)', max_length=100)),
                ('suggestion', models.TextField(help_text='Human-readable suggestion for fixing the error')),
                ('confidence', models.FloatField(default=0.0, help_text='Confidence score (0.0-1.0)')),
                ('actionable', models.BooleanField(default=True, help_text='Whether this suggestion can be automatically applied')),
                ('fix_data', models.JSONField(blank=True, default=dict, help_text='Structured fix data (e.g., corrected input values)')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('run_step', models.ForeignKey(help_text='Failed step this suggestion applies to', on_delete=django.db.models.deletion.CASCADE, related_name='error_suggestions', to='core.runstep')),
            ],
            options={
                'verbose_name': 'Error Suggestion',
                'verbose_name_plural': 'Error Suggestions',
                'db_table': 'core_errorsuggestion',
                'ordering': ['-confidence', '-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='errorsuggestion',
            index=models.Index(fields=['run_step', 'created_at'], name='core_errors_run_step_created_idx'),
        ),
        migrations.AddIndex(
            model_name='errorsuggestion',
            index=models.Index(fields=['error_type', 'created_at'], name='core_errors_error_type_created_idx'),
        ),
        migrations.AddIndex(
            model_name='errorsuggestion',
            index=models.Index(fields=['confidence'], name='core_errors_confidence_idx'),
        ),
    ]

