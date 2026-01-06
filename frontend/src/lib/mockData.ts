import type {
    Run,
    RunStep,
    RunLog,
    Template,
    UserProfile,
    PaginatedResponse,
    Workflow,
    Credential,
    Connector,
    Alert
} from '@/types';

// Mock User Profile
export const MOCK_USER_PROFILE: UserProfile = {
    id: 'user-PRO-123',
    email: 'arman.ghevondyan@bridge.dev',
    first_name: 'Arman',
    last_name: 'Ghevondyan',
    avatar_url: 'https://github.com/shadcn.png',
    timezone: 'America/Los_Angeles',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-06-01T12:00:00Z',
};

// Mock Workflows (for reference)
export const MOCK_WORKFLOWS: Workflow[] = [
    {
        id: 'wf-1',
        name: 'Customer Onboarding',
        description: 'Process new customer signups and send welcome emails',
        is_active: true,
        created_at: '2023-01-10T10:00:00Z',
        updated_at: '2023-01-12T10:00:00Z',
        workspace_id: 'ws-1',
        trigger_type: 'webhook',
    },
    {
        id: 'wf-2',
        name: 'Daily Report Generator',
        description: 'Generate and slack daily metrics',
        is_active: true,
        created_at: '2023-02-15T09:00:00Z',
        updated_at: '2023-02-15T09:00:00Z',
        workspace_id: 'ws-1',
        trigger_type: 'schedule',
    }
];

// Mock Runs
export const MOCK_RUNS: Run[] = [
    {
        id: 'run-abc-123',
        workflow_id: 'wf-1',
        workflow_version_id: 'fv-1',
        workflow_name: 'Customer Onboarding',
        status: 'success',
        started_at: '2023-10-27T10:00:00Z',
        completed_at: '2023-10-27T10:00:05Z',
        trigger_type: 'webhook',
        payload: { email: 'test@example.com', name: 'John Doe' },
        steps: [],
        duration_ms: 5000,
    },
    {
        id: 'run-def-456',
        workflow_id: 'wf-2',
        workflow_version_id: 'fv-2',
        workflow_name: 'Daily Report Generator',
        status: 'running',
        started_at: '2023-10-27T11:00:00Z',
        trigger_type: 'schedule',
        payload: {},
        steps: [],
        duration_ms: 0,
    },
    {
        id: 'run-ghi-789',
        workflow_id: 'wf-1',
        workflow_version_id: 'fv-1',
        workflow_name: 'Customer Onboarding',
        status: 'failed',
        started_at: '2023-10-27T09:30:00Z',
        completed_at: '2023-10-27T09:30:10Z',
        trigger_type: 'webhook',
        payload: { email: 'invalid-email' },
        error: 'Invalid email format',
        steps: [],
        duration_ms: 10000,
    },
    {
        id: 'run-jkl-012',
        workflow_id: 'wf-1',
        workflow_version_id: 'fv-1',
        workflow_name: 'Customer Onboarding',
        status: 'pending',
        started_at: '2023-10-27T11:05:00Z',
        trigger_type: 'webhook',
        payload: { email: 'pending@example.com' },
        steps: [],
        duration_ms: 0,
    },
    {
        id: 'run-mno-345',
        workflow_id: 'wf-2',
        workflow_version_id: 'fv-2',
        workflow_name: 'Daily Report Generator',
        status: 'cancelled',
        started_at: '2023-10-26T23:00:00Z',
        completed_at: '2023-10-26T23:05:00Z',
        trigger_type: 'schedule',
        payload: {},
        steps: [],
        duration_ms: 300000,
    }
];

export const MOCK_RUN_STEPS: RunStep[] = [
    {
        id: 'step-1',
        run_id: 'run-abc-123',
        node_id: 'node-trigger',
        node_name: 'Webhook Trigger',
        status: 'success',
        started_at: '2023-10-27T10:00:00Z',
        completed_at: '2023-10-27T10:00:01Z',
        input: { method: 'POST', body: { email: 'test@example.com' } },
        output: { email: 'test@example.com' },
        retry_count: 0,
        duration_ms: 1000,
    },
    {
        id: 'step-2',
        run_id: 'run-abc-123',
        node_id: 'node-enrich',
        node_name: 'Enrich Data',
        status: 'success',
        started_at: '2023-10-27T10:00:01Z',
        completed_at: '2023-10-27T10:00:03Z',
        input: { email: 'test@example.com' },
        output: { company: 'Example Corp', role: 'Developer' },
        retry_count: 0,
        duration_ms: 2000,
    },
    {
        id: 'step-3',
        run_id: 'run-abc-123',
        node_id: 'node-email',
        node_name: 'Send Email',
        status: 'success',
        started_at: '2023-10-27T10:00:03Z',
        completed_at: '2023-10-27T10:00:05Z',
        input: { to: 'test@example.com', subject: 'Welcome!' },
        output: { messageId: 'msg-123' },
        retry_count: 0,
        duration_ms: 2000,
    }
];

export const MOCK_RUN_LOGS: RunLog[] = [
    {
        id: 'log-1',
        run_id: 'run-abc-123',
        level: 'info',
        message: 'Workflow started via Webhook',
        timestamp: '2023-10-27T10:00:00Z',
    },
    {
        id: 'log-2',
        run_id: 'run-abc-123',
        level: 'info',
        message: 'Enriching data for user...',
        timestamp: '2023-10-27T10:00:01Z',
    },
    {
        id: 'log-3',
        run_id: 'run-abc-123',
        level: 'info',
        message: 'Email sent successfully',
        timestamp: '2023-10-27T10:00:05Z',
    }
];

// Mock Templates
export const MOCK_TEMPLATES: Template[] = [
    {
        id: 'tpl-1',
        name: 'Slack Notification Bot',
        description: 'Listen for webhooks and post messages to Slack channels.',
        category: 'productivity',
        tags: ['slack', 'webhook', 'bot'],
        graph: { nodes: [], edges: [] },
        usage_count: 1250,
        created_at: '2023-05-20T10:00:00Z',
        updated_at: '2023-08-01T10:00:00Z',
        version: '1.2.0',
        preview_image_url: 'https://placehold.co/600x400/2a2a2a/FFF?text=Slack+Bot',
    },
    {
        id: 'tpl-2',
        name: 'Lead Enrichment Pipeline',
        description: 'Enrich new CRM leads with Clearbit data and score them.',
        category: 'sales',
        tags: ['crm', 'enrichment', 'sales'],
        graph: { nodes: [], edges: [] },
        usage_count: 850,
        created_at: '2023-06-15T10:00:00Z',
        updated_at: '2023-07-20T10:00:00Z',
        version: '2.0.0',
        preview_image_url: 'https://placehold.co/600x400/2a2a2a/FFF?text=Lead+Enrichment',
    },
    {
        id: 'tpl-3',
        name: 'Customer Support Auto-Responder',
        description: 'Automatically categorize and respond to common support tickets using AI.',
        category: 'support',
        tags: ['ai', 'support', 'automation'],
        graph: { nodes: [], edges: [] },
        usage_count: 2100,
        created_at: '2023-04-10T10:00:00Z',
        updated_at: '2023-09-01T10:00:00Z',
        version: '1.0.5',
        preview_image_url: 'https://placehold.co/600x400/2a2a2a/FFF?text=Support+AI',
    },
    {
        id: 'tpl-4',
        name: 'Daily Standup Report',
        description: 'Collect updates from team members and compile a daily summary.',
        category: 'productivity',
        tags: ['agile', 'reporting', 'slack'],
        graph: { nodes: [], edges: [] },
        usage_count: 500,
        created_at: '2023-07-01T10:00:00Z',
        updated_at: '2023-07-01T10:00:00Z',
        version: '1.0.0',
        preview_image_url: 'https://placehold.co/600x400/2a2a2a/FFF?text=Daily+Standup',
    },
    {
        id: 'tpl-5',
        name: 'E-commerce Order Sync',
        description: 'Sync Shopify orders to Google Sheets and notify shipping team.',
        category: 'sales',
        tags: ['shopify', 'sheets', 'ecommerce'],
        graph: { nodes: [], edges: [] },
        usage_count: 320,
        created_at: '2023-08-15T12:00:00Z',
        updated_at: '2023-08-15T12:00:00Z',
        version: '1.1.0',
        preview_image_url: 'https://placehold.co/600x400/2a2a2a/FFF?text=Order+Sync',
    }
];

export const MOCK_RUNS_RESPONSE: PaginatedResponse<Run> = {
    count: MOCK_RUNS.length,
    next: null,
    previous: null,
    results: MOCK_RUNS,
};

export const MOCK_TEMPLATES_RESPONSE: PaginatedResponse<Template> = {
    count: MOCK_TEMPLATES.length,
    next: null,
    previous: null,
    results: MOCK_TEMPLATES,
};

// Mock Credentials
export const MOCK_CREDENTIALS: Credential[] = [
    {
        id: 'cred-1',
        name: 'Stripe Production',
        connector_id: 'conn-stripe',
        connector_name: 'Stripe',
        workspace_id: 'ws-1',
        is_active: true,
        created_at: '2023-01-15T10:00:00Z',
        updated_at: '2023-01-15T10:00:00Z',
        last_used_at: '2023-10-27T10:00:00Z',
    },
    {
        id: 'cred-2',
        name: 'Slack Bot Token',
        connector_id: 'conn-slack',
        connector_name: 'Slack',
        workspace_id: 'ws-1',
        is_active: true,
        created_at: '2023-02-20T14:30:00Z',
        updated_at: '2023-02-20T14:30:00Z',
        last_used_at: '2023-10-26T15:45:00Z',
    },
    {
        id: 'cred-3',
        name: 'OpenAI API Key',
        connector_id: 'conn-openai',
        connector_name: 'OpenAI',
        workspace_id: 'ws-1',
        is_active: true,
        created_at: '2023-03-10T09:15:00Z',
        updated_at: '2023-09-01T11:20:00Z',
        last_used_at: '2023-10-27T09:30:00Z',
    },
    {
        id: 'cred-4',
        name: 'Internal Database',
        connector_id: 'conn-postgres',
        connector_name: 'PostgreSQL',
        workspace_id: 'ws-1',
        is_active: false,
        created_at: '2023-04-05T16:00:00Z',
        updated_at: '2023-08-10T10:00:00Z',
        last_used_at: '2023-08-09T18:00:00Z',
    }
];

export const MOCK_CREDENTIALS_RESPONSE: PaginatedResponse<Credential> = {
    count: MOCK_CREDENTIALS.length,
    next: null,
    previous: null,
    results: MOCK_CREDENTIALS,
};

// Mock Connectors for Dropdowns
export const MOCK_CONNECTORS: Connector[] = [
    {
        id: 'conn-stripe',
        name: 'stripe',
        display_name: 'Stripe',
        description: 'Payment processing platform.',
        tags: ['payment', 'finance'],
        manifest: {
            auth: {
                type: 'api_key',
                fields: [
                    { name: 'api_key', label: 'API Key', type: 'password', required: true }
                ]
            }
        },
        version: '1.0.0',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
    } as any, // lazy typing for mock
    {
        id: 'conn-slack',
        name: 'slack',
        display_name: 'Slack',
        description: 'Team communication and collaboration.',
        tags: ['productivity', 'messaging'],
        manifest: {
            auth: {
                type: 'oauth2',
                fields: [
                    { name: 'client_id', label: 'Client ID', type: 'text', required: true },
                    { name: 'client_secret', label: 'Client Secret', type: 'password', required: true }
                ]
            }
        },
        version: '1.2.0',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
    } as any,
    {
        id: 'conn-openai',
        name: 'openai',
        display_name: 'OpenAI',
        description: 'AI models for text generation and more.',
        tags: ['ai', 'llm'],
        manifest: {
            auth: {
                type: 'api_key',
                fields: [
                    { name: 'api_key', label: 'API Key', type: 'password', required: true },
                    { name: 'org_id', label: 'Organization ID', type: 'text', required: false }
                ]
            }
        },
        version: '1.0.0',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
    } as any,
];

export const MOCK_CONNECTORS_RESPONSE: PaginatedResponse<Connector> = {
    count: MOCK_CONNECTORS.length,
    next: null,
    previous: null,
    results: MOCK_CONNECTORS,
};

// Mock Alerts
export const MOCK_ALERTS: Alert[] = [
    {
        id: 'alert-1',
        name: 'Critical Run Failures',
        event: 'run_failed',
        channel: 'slack',
        is_active: true,
        config: { webhook_url: 'https://hooks.slack.com/...' },
        created_at: '2023-06-01T10:00:00Z',
        updated_at: '2023-06-01T10:00:00Z',
        last_triggered_at: '2023-10-27T09:30:00Z'
    },
    {
        id: 'alert-2',
        name: 'Timeout Notifications',
        event: 'run_timeout',
        channel: 'email',
        workflow_id: 'wf-1',
        is_active: true,
        config: { recipients: ['admin@bridge.dev'] },
        created_at: '2023-07-15T14:00:00Z',
        updated_at: '2023-07-15T14:00:00Z',
    },
    {
        id: 'alert-3',
        name: 'Credential Expiry Webhook',
        event: 'credential_expired',
        channel: 'webhook',
        is_active: false,
        config: { url: 'https://my-server.com/webhook/creds' },
        created_at: '2023-08-20T16:00:00Z',
        updated_at: '2023-08-20T16:00:00Z',
    }
];

export const MOCK_ALERTS_RESPONSE: PaginatedResponse<Alert> = {
    count: MOCK_ALERTS.length,
    next: null,
    previous: null,
    results: MOCK_ALERTS,
};
