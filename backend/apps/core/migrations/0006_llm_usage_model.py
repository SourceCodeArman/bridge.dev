# Generated migration for LLMUsage model

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_add_supabase_realtime_trigger_type'),
    ]

    operations = [
        migrations.CreateModel(
            name='LLMUsage',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('provider', models.CharField(choices=[('openai', 'OpenAI'), ('anthropic', 'Anthropic'), ('gemini', 'Gemini'), ('deepseek', 'DeepSeek')], db_index=True, help_text='LLM provider name', max_length=20)),
                ('model', models.CharField(help_text='Model name used (e.g., gpt-3.5-turbo, claude-3-5-sonnet)', max_length=100)),
                ('input_tokens', models.PositiveIntegerField(default=0, help_text='Number of input tokens used')),
                ('output_tokens', models.PositiveIntegerField(default=0, help_text='Number of output tokens generated')),
                ('total_tokens', models.PositiveIntegerField(default=0, help_text='Total tokens used (input + output)')),
                ('estimated_cost', models.DecimalField(blank=True, decimal_places=6, help_text='Estimated cost in USD (if calculable)', max_digits=10, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('run_step', models.ForeignKey(help_text='Workflow step that used the LLM', on_delete=django.db.models.deletion.CASCADE, related_name='llm_usage', to='core.runstep')),
            ],
            options={
                'verbose_name': 'LLM Usage',
                'verbose_name_plural': 'LLM Usages',
                'db_table': 'core_llmusage',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='llmusage',
            index=models.Index(fields=['run_step', 'created_at'], name='core_llmusage_run_step_created_idx'),
        ),
        migrations.AddIndex(
            model_name='llmusage',
            index=models.Index(fields=['provider', 'created_at'], name='core_llmusage_provider_created_idx'),
        ),
        migrations.AddIndex(
            model_name='llmusage',
            index=models.Index(fields=['provider', 'model'], name='core_llmusage_provider_model_idx'),
        ),
    ]

