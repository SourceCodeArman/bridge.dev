# Generated migration for adding supabase_realtime trigger type

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_logging_tracing_models'),
    ]

    operations = [
        migrations.AlterField(
            model_name='trigger',
            name='trigger_type',
            field=models.CharField(
                choices=[
                    ('webhook', 'Webhook'),
                    ('cron', 'Cron'),
                    ('manual', 'Manual'),
                    ('event', 'Event'),
                    ('supabase_realtime', 'Supabase Realtime'),
                ],
                db_index=True,
                max_length=20
            ),
        ),
    ]


