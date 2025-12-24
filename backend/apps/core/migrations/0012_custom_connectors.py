from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0011_collaboration_features'),
        ('accounts', '0002_role_permission_rolepermission_role_permissions_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='CustomConnector',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('slug', models.SlugField(help_text='Unique slug for this connector within the workspace', max_length=200)),
                ('display_name', models.CharField(help_text='Human-readable name for this connector', max_length=200)),
                ('description', models.TextField(blank=True, help_text='Description of what this connector does')),
                ('visibility', models.CharField(choices=[('private', 'Private'), ('workspace', 'Workspace'), ('public', 'Public')], db_index=True, default='workspace', help_text='Visibility of this connector', max_length=20)),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('pending_review', 'Pending Review'), ('approved', 'Approved'), ('rejected', 'Rejected'), ('deprecated', 'Deprecated')], db_index=True, default='draft', help_text='Publication status of this connector', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_custom_connectors', to='accounts.user')),
                ('workspace', models.ForeignKey(help_text='Workspace this custom connector belongs to', on_delete=django.db.models.deletion.CASCADE, related_name='custom_connectors', to='accounts.workspace')),
            ],
            options={
                'verbose_name': 'Custom Connector',
                'verbose_name_plural': 'Custom Connectors',
                'db_table': 'core_customconnector',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='CustomConnectorVersion',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('version', models.CharField(help_text='Semantic version string (e.g., 1.0.0)', max_length=50)),
                ('manifest', models.JSONField(help_text='Connector manifest JSON for this version')),
                ('changelog', models.TextField(blank=True, help_text='Optional changelog or notes for this version')),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('pending_review', 'Pending Review'), ('approved', 'Approved'), ('rejected', 'Rejected'), ('deprecated', 'Deprecated')], db_index=True, default='draft', help_text='Review/approval status for this version', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_custom_connector_versions', to='accounts.user')),
                ('connector', models.ForeignKey(help_text='Custom connector this version belongs to', on_delete=django.db.models.deletion.CASCADE, related_name='versions', to='core.customconnector')),
            ],
            options={
                'verbose_name': 'Custom Connector Version',
                'verbose_name_plural': 'Custom Connector Versions',
                'db_table': 'core_customconnectorversion',
                'ordering': ['connector', '-created_at'],
            },
        ),
        migrations.AddField(
            model_name='customconnector',
            name='current_version',
            field=models.ForeignKey(blank=True, help_text='Currently active/approved version for this connector', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='core.customconnectorversion'),
        ),
        migrations.AddIndex(
            model_name='customconnector',
            index=models.Index(fields=['workspace', 'slug'], name='core_custom_workspa_idx'),
        ),
        migrations.AddIndex(
            model_name='customconnector',
            index=models.Index(fields=['workspace', 'status'], name='core_custom_workspa_3c9d9d_idx'),
        ),
        migrations.AddIndex(
            model_name='customconnector',
            index=models.Index(fields=['workspace', 'visibility'], name='core_custom_workspa_e4c0d3_idx'),
        ),
        migrations.AddIndex(
            model_name='customconnectorversion',
            index=models.Index(fields=['connector', 'version'], name='core_custom_connect_idx'),
        ),
        migrations.AddIndex(
            model_name='customconnectorversion',
            index=models.Index(fields=['connector', 'status'], name='core_custom_connect_68c2f7_idx'),
        ),
        migrations.AddIndex(
            model_name='customconnectorversion',
            index=models.Index(fields=['status', 'created_at'], name='core_custom_status__idx'),
        ),
        migrations.AlterUniqueTogether(
            name='customconnector',
            unique_together={('workspace', 'slug')},
        ),
        migrations.AlterUniqueTogether(
            name='customconnectorversion',
            unique_together={('connector', 'version')},
        ),
    ]


