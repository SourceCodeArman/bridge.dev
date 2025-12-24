"""
Management command to seed initial workflow templates.
"""
from django.core.management.base import BaseCommand
from apps.core.models import WorkflowTemplate


class Command(BaseCommand):
    help = 'Seed initial workflow templates'

    def handle(self, *args, **options):
        """Create initial templates"""
        
        templates_data = [
            {
                'name': 'Webhook → LLM → Slack',
                'description': 'Receive webhook, process with LLM, and send notification to Slack',
                'category': 'webhook',
                'definition': {
                    'nodes': [
                        {
                            'id': 'node_1',
                            'type': 'webhook',
                            'data': {
                                'action_id': 'receive',
                                'path': '/webhook/{{credential.api_key}}'
                            },
                            'position': {'x': 100, 'y': 100}
                        },
                        {
                            'id': 'node_2',
                            'type': 'openai',
                            'data': {
                                'action_id': 'generate_text',
                                'prompt': 'Summarize the following webhook payload: {{node_1.output.body}}',
                                'model': 'gpt-3.5-turbo',
                                'api_key': '{{credential.api_key}}'
                            },
                            'position': {'x': 400, 'y': 100}
                        },
                        {
                            'id': 'node_3',
                            'type': 'slack',
                            'data': {
                                'action_id': 'send_message',
                                'channel': '#notifications',
                                'message': '{{node_2.output.text}}',
                                'token': '{{credential.token}}'
                            },
                            'position': {'x': 700, 'y': 100}
                        }
                    ],
                    'edges': [
                        {'source': 'node_1', 'target': 'node_2', 'sourceHandle': None, 'targetHandle': None},
                        {'source': 'node_2', 'target': 'node_3', 'sourceHandle': None, 'targetHandle': None}
                    ]
                }
            },
            {
                'name': 'DB Trigger → Sheets',
                'description': 'Listen to Supabase database changes and write to Google Sheets',
                'category': 'database',
                'definition': {
                    'nodes': [
                        {
                            'id': 'node_1',
                            'type': 'supabase',
                            'data': {
                                'action_id': 'listen_to_changes',
                                'table': 'users',
                                'event': 'INSERT',
                                'supabase_url': '{{credential.supabase_url}}',
                                'supabase_key': '{{credential.supabase_key}}'
                            },
                            'position': {'x': 100, 'y': 100}
                        },
                        {
                            'id': 'node_2',
                            'type': 'google_sheets',
                            'data': {
                                'action_id': 'append_row',
                                'spreadsheet_id': '{{credential.spreadsheet_id}}',
                                'sheet_name': 'Users',
                                'values': ['{{node_1.output.new.id}}', '{{node_1.output.new.email}}'],
                                'access_token': '{{credential.access_token}}'
                            },
                            'position': {'x': 400, 'y': 100}
                        }
                    ],
                    'edges': [
                        {'source': 'node_1', 'target': 'node_2', 'sourceHandle': None, 'targetHandle': None}
                    ]
                }
            },
            {
                'name': 'HTTP → LLM → HTTP',
                'description': 'Receive HTTP request, process with LLM, and send HTTP response',
                'category': 'automation',
                'definition': {
                    'nodes': [
                        {
                            'id': 'node_1',
                            'type': 'http',
                            'data': {
                                'action_id': 'request',
                                'url': 'https://api.example.com/data',
                                'method': 'GET',
                                'headers': {'Authorization': 'Bearer {{credential.token}}'}
                            },
                            'position': {'x': 100, 'y': 100}
                        },
                        {
                            'id': 'node_2',
                            'type': 'openai',
                            'data': {
                                'action_id': 'generate_text',
                                'prompt': 'Analyze this data: {{node_1.output.body}}',
                                'model': 'gpt-3.5-turbo',
                                'api_key': '{{credential.api_key}}'
                            },
                            'position': {'x': 400, 'y': 100}
                        },
                        {
                            'id': 'node_3',
                            'type': 'http',
                            'data': {
                                'action_id': 'request',
                                'url': 'https://api.example.com/process',
                                'method': 'POST',
                                'body': {'analysis': '{{node_2.output.text}}'},
                                'headers': {'Content-Type': 'application/json'}
                            },
                            'position': {'x': 700, 'y': 100}
                        }
                    ],
                    'edges': [
                        {'source': 'node_1', 'target': 'node_2', 'sourceHandle': None, 'targetHandle': None},
                        {'source': 'node_2', 'target': 'node_3', 'sourceHandle': None, 'targetHandle': None}
                    ]
                }
            }
        ]
        
        created_count = 0
        for template_data in templates_data:
            template, created = WorkflowTemplate.objects.get_or_create(
                name=template_data['name'],
                defaults={
                    'description': template_data['description'],
                    'category': template_data['category'],
                    'definition': template_data['definition'],
                    'is_public': True
                }
            )
            
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Created template: {template.name}')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f'Template already exists: {template.name}')
                )
        
        self.stdout.write(
            self.style.SUCCESS(f'\nSuccessfully seeded {created_count} new templates')
        )


