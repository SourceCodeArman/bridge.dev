// Workflow Types
export interface Workflow {
    id: string;
    name: string;
    description: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    workspace_id: string;
    current_version?: WorkflowVersion;
}

export interface WorkflowVersion {
    id: string;
    workflow_id: string;
    version_number: number;
    graph: WorkflowGraph;
    created_at: string;
    is_published: boolean;
}

export interface WorkflowGraph {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
}

export interface WorkflowNode {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
}

export interface WorkflowEdge {
    id: string;
    source: string;
    target: string;
}

// Run Types
export interface Run {
    id: string;
    workflow_id: string;
    workflow_version_id: string;
    status: RunStatus;
    started_at: string;
    completed_at?: string;
    trigger_type: TriggerType;
    payload: Record<string, unknown>;
    steps: RunStep[];
}

export type RunStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
export type TriggerType = 'manual' | 'webhook' | 'schedule' | 'event';

export interface RunStep {
    id: string;
    run_id: string;
    node_id: string;
    status: RunStatus;
    started_at: string;
    completed_at?: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    error?: string;
    retry_count: number;
}

// Connector Types
export interface Connector {
    id: string;
    name: string;
    description: string;
    type: string;
    manifest: ConnectorManifest;
    is_custom: boolean;
}

export interface ConnectorManifest {
    name: string;
    version: string;
    description: string;
    auth: AuthConfig;
    actions: ConnectorAction[];
}

export interface AuthConfig {
    type: 'none' | 'api_key' | 'oauth2' | 'basic';
    fields?: AuthField[];
}

export interface AuthField {
    name: string;
    label: string;
    type: string;
    required: boolean;
}

export interface ConnectorAction {
    id: string;
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
    output_schema: Record<string, unknown>;
}

// Credential Types
export interface Credential {
    id: string;
    name: string;
    connector_id: string;
    workspace_id: string;
    created_at: string;
    updated_at: string;
    is_active: boolean;
}

export interface CreateCredentialRequest {
    name: string;
    connector_id: string;
    credentials: Record<string, unknown>;
}

// Trigger Types
export interface Trigger {
    id: string;
    workflow_id: string;
    type: TriggerType;
    config: Record<string, unknown>;
    is_active: boolean;
}
