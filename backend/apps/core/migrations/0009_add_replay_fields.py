# Generated manually for replay functionality

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0008_alert_system'),
    ]

    operations = [
        migrations.AddField(
            model_name='run',
            name='original_run',
            field=models.ForeignKey(
                blank=True,
                help_text='Original run this replay is based on (null for original runs)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='replay_runs',
                to='core.run'
            ),
        ),
        migrations.AddField(
            model_name='run',
            name='replay_from_step_id',
            field=models.CharField(
                blank=True,
                help_text='Step ID to replay from (for partial replays)',
                max_length=100,
                null=True
            ),
        ),
        migrations.AddField(
            model_name='run',
            name='replay_type',
            field=models.CharField(
                blank=True,
                choices=[('full', 'Full Replay'), ('partial', 'Partial Replay')],
                db_index=True,
                help_text='Type of replay (full or partial)',
                max_length=20,
                null=True
            ),
        ),
        migrations.AddField(
            model_name='run',
            name='saved_input_data',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='Saved input data from original run for replay purposes'
            ),
        ),
        migrations.AddIndex(
            model_name='run',
            index=models.Index(
                fields=['original_run', 'created_at'],
                name='core_run_original_created_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='run',
            index=models.Index(
                fields=['replay_type', 'created_at'],
                name='core_run_replay_type_created_idx'
            ),
        ),
    ]


