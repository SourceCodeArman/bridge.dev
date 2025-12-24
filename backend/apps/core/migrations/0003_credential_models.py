# Generated migration for Credential and CredentialUsage models

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_workflow_max_concurrent_runs'),
        ('accounts', '0002_role_permission_rolepermission_role_permissions_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='Credential',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(help_text='Human-readable name for the credential', max_length=200)),
                ('credential_type', models.CharField(choices=[('api_key', 'API Key'), ('oauth_token', 'OAuth Token'), ('basic_auth', 'Basic Auth'), ('custom', 'Custom')], db_index=True, help_text='Type of credential', max_length=50)),
                ('encrypted_data', models.TextField(help_text='Encrypted credential data (JSON)')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_credentials', to='accounts.user')),
                ('workspace', models.ForeignKey(help_text='Workspace this credential belongs to', on_delete=django.db.models.deletion.CASCADE, related_name='credentials', to='accounts.workspace')),
            ],
            options={
                'verbose_name': 'Credential',
                'verbose_name_plural': 'Credentials',
                'db_table': 'core_credential',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='CredentialUsage',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('last_used_at', models.DateTimeField(blank=True, help_text='Last time this credential was used', null=True)),
                ('usage_count', models.PositiveIntegerField(default=0, help_text='Number of times this credential has been used')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('credential', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='usage_records', to='core.credential')),
                ('workflow', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='credential_usage', to='core.workflow')),
            ],
            options={
                'verbose_name': 'Credential Usage',
                'verbose_name_plural': 'Credential Usages',
                'db_table': 'core_credentialusage',
            },
        ),
        migrations.AddIndex(
            model_name='credential',
            index=models.Index(fields=['workspace', 'credential_type'], name='core_creden_workspa_idx'),
        ),
        migrations.AddIndex(
            model_name='credential',
            index=models.Index(fields=['workspace', 'created_at'], name='core_creden_workspa_created_idx'),
        ),
        migrations.AddIndex(
            model_name='credential',
            index=models.Index(fields=['workspace', 'name'], name='core_creden_workspa_name_idx'),
        ),
        migrations.AddIndex(
            model_name='credentialusage',
            index=models.Index(fields=['credential', 'workflow'], name='core_creden_credent_idx'),
        ),
        migrations.AddIndex(
            model_name='credentialusage',
            index=models.Index(fields=['workflow', 'last_used_at'], name='core_creden_workflo_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='credentialusage',
            unique_together={('credential', 'workflow')},
        ),
    ]

