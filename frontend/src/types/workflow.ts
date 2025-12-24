import type { User, Workspace } from './api';

// Workflow types
export interface WorkflowDefinition {
    id: string;
    name: string;
    description?: string;
    status: 'draft' | 'active' | 'paused';
    version: number;
    created_at: string;
    updated_at: string;
    created_by: User;
    workspace: Workspace;
    graph: WorkflowDefinitionGraph;
}

export interface WorkflowDefinitionGraph {
    nodes: WorkflowDefinitionNode[];
    edges: WorkflowDefinitionEdge[];
}

export interface WorkflowDefinitionNode {
    id: string;
    type: string;
    connector_id: string;
    config: Record<string, unknown>;
    position: { x: number; y: number };
}

export interface WorkflowDefinitionEdge {
    id: string;
    source: string;
    target: string;
}

// Run types
export interface WorkflowRun {
    id: string;
    workflow: string; // Workflow ID
    status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
    trigger_type: 'manual' | 'webhook' | 'cron';
    started_at: string;
    completed_at?: string;
    duration_ms?: number;
    error_message?: string;
}

export interface WorkflowRunStep {
    id: string;
    run: string;
    node_id: string;
    status: 'pending' | 'running' | 'success' | 'failed';
    started_at: string;
    completed_at?: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

export interface WorkflowRunLog {
    id: string;
    run: string;
    step?: string;
    level: 'debug' | 'info' | 'warning' | 'error';
    message: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
}

export interface WorkflowRunTrace {
    run: WorkflowRun;
    steps: WorkflowRunStep[];
    logs: WorkflowRunLog[];
}

// Credential types
export interface WorkflowCredential {
    id: string;
    name: string;
    connector_type: string;
    is_valid: boolean;
    created_at: string;
    updated_at: string;
    workspace: string;
}

// Connector types
export interface WorkflowConnector {
    id: string;
    name: string;
    type: string;
    category: string;
    icon_url?: string;
    description: string;
    manifest: WorkflowConnectorManifest;
}

export interface WorkflowConnectorManifest {
    version: string;
    actions: WorkflowConnectorAction[];
    auth_type: 'none' | 'api_key' | 'oauth2';
}

export interface WorkflowConnectorAction {
    id: string;
    name: string;
    description: string;
    input_schema: JSONSchema;
    output_schema: JSONSchema;
}

export interface JSONSchema {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
}

// Template types
export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    tags: string[];
    graph: WorkflowDefinitionGraph;
    usage_count: number;
    created_at: string;
}

// Alert types
export interface AlertConfiguration {
    id: string;
    workflow: string;
    enabled: boolean;
    channels: ('email' | 'slack' | 'webhook')[];
    conditions: {
        on_failure: boolean;
        on_timeout: boolean;
    };
    throttle_minutes: number;
}

export interface AlertHistory {
    id: string;
    configuration: string;
    run: string;
    channel: string;
    sent_at: string;
    status: 'sent' | 'failed';
}

// Request/Response types
export interface ListWorkflowsParams {
    page?: number;
    page_size?: number;
    status?: WorkflowDefinition['status'];
    search?: string;
    ordering?: string;
}

export interface CreateWorkflowRequest {
    name: string;
    description?: string;
    graph?: WorkflowDefinitionGraph;
}

export interface UpdateWorkflowRequest {
    name?: string;
    description?: string;
    graph?: WorkflowDefinitionGraph;
    status?: WorkflowDefinition['status'];
}

export interface ListRunsParams {
    page?: number;
    page_size?: number;
    workflow?: string;
    status?: WorkflowRun['status'];
    ordering?: string;
}

export interface CreateWorkflowCredentialRequest {
    name: string;
    connector_type: string;
    credentials: Record<string, string>;
}

export interface UpdateWorkflowCredentialRequest {
    name?: string;
    credentials?: Record<string, string>;
}

export interface ListTemplatesParams {
    page?: number;
    page_size?: number;
    category?: string;
    search?: string;
}
