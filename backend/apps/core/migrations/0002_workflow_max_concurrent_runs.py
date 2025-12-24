# Generated migration for adding max_concurrent_runs field to Workflow model

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='workflow',
            name='max_concurrent_runs',
            field=models.PositiveIntegerField(blank=True, default=None, help_text='Maximum concurrent runs for this workflow (uses default from settings if not set)', null=True),
        ),
    ]

