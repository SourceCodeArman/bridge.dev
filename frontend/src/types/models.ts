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
    last_run_at?: string;
    trigger_type?: string;
}

export interface WorkflowVersion {
    id: string;
    workflow_id: string;
    version_number: number;
    graph: WorkflowGraph;
    created_at: string;
    is_active: boolean;
    created_manually: boolean;
    version_label?: string;
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

export interface CreateWorkflowRequest {
    name: string;
    description?: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    trigger?: Trigger;
    is_active?: boolean;
}

export interface UpdateWorkflowRequest {
    name?: string;
    description?: string;
    definition: { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
    trigger?: Trigger;
    is_active?: boolean;
}

export interface WorkflowListParams {
    page?: number;
    page_size?: number;
    is_active?: boolean;
}

// Run Types
export interface Run {
    id: string;
    workflow_id: string;
    workflow_version_id: string;
    workflow_name?: string;
    status: RunStatus;
    started_at: string;
    completed_at?: string;
    trigger_type: TriggerType;
    payload: Record<string, unknown>;
    steps: RunStep[];
    error?: string;
    duration_ms?: number;
}

export type RunStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
export type TriggerType = 'manual' | 'webhook' | 'schedule' | 'event';

export interface RunStep {
    id: string;
    run_id: string;
    node_id: string;
    node_name?: string;
    status: RunStatus;
    started_at: string;
    completed_at?: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    error?: string;
    retry_count: number;
    duration_ms?: number;
}

export interface RunLog {
    id: string;
    run_id: string;
    step_id?: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
}

export interface RunListParams {
    page?: number;
    page_size?: number;
    workflow_id?: string;
    status?: RunStatus;
    start_date?: string;
    end_date?: string;
}

// Connector Types
export interface Connector {
    id: string;
    display_name: string;
    description: string;
    type: string;
    connector_type: 'agent-tool' | 'agent-model' | 'agent-memory' | 'agent' | 'action' | 'trigger' | 'condition' | 'custom';
    icon?: string;
    icon_url_light?: string;
    icon_url_dark?: string;
    manifest: ConnectorManifest;
    is_custom: boolean;
    is_active: boolean;
    slug?: string;
    version?: string;
}

export interface ConnectorManifest {
    name: string;
    version: string;
    description: string;
    auth: AuthConfig;
    actions: Record<string, ConnectorAction>;
    triggers?: Record<string, unknown>; // Added for completeness based on SheetConnectorManifest
    ui?: {
        nodeSize?: { width: number; height: number };
        outputHandles?: number;
        handles?: { left?: number; right?: number; top?: number; bottom?: number; }; // Granular handle counts
        handleNames?: Record<string, string>; // Map of "side-index" to name (e.g., "left-0": "My Input")
        handleLocations?: string[]; // Legacy
        handleStyling?: any;
        customRadius?: string;
    };
    connector_type?: string;
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

export interface JSONSchema {
    type?: string;
    properties?: Record<string, any>;
    required?: string[];
    description?: string;
    [key: string]: any;
}

export interface ConnectorAction {
    id: string;
    name: string;
    description: string;
    input_schema: JSONSchema;
    output_schema: JSONSchema;
}

export interface ConnectorListParams {
    page?: number;
    page_size?: number;
    type?: string;
    is_custom?: boolean;
}

// Credential Types
export interface Credential {
    id: string;
    name: string;
    connector_id: string;
    connector_name?: string;
    workspace_id: string;
    created_at: string;
    updated_at: string;
    is_active: boolean;
    last_used_at?: string;
}

export interface CreateCredentialRequest {
    name: string;
    connector_id: string;
    credentials: Record<string, unknown>;
}

export interface UpdateCredentialRequest {
    name?: string;
    credentials?: Record<string, unknown>;
    is_active?: boolean;
}

export interface CredentialListParams {
    page?: number;
    page_size?: number;
    connector_id?: string;
}

// Trigger Types
export interface Trigger {
    id: string;
    workflow_id: string;
    type: TriggerType;
    config: Record<string, unknown>;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface CreateTriggerRequest {
    workflow_id: string;
    type: TriggerType;
    config: Record<string, unknown>;
    is_active?: boolean;
}

export interface UpdateTriggerRequest {
    type?: TriggerType;
    config?: Record<string, unknown>;
    is_active?: boolean;
}

export interface TriggerListParams {
    page?: number;
    page_size?: number;
    workflow_id?: string;
    type?: TriggerType;
}

// Template Types
export interface Template {
    id: string;
    name: string;
    description: string;
    category: string;
    tags: string[];
    graph: WorkflowGraph;
    preview_image?: string;
    usage_count: number;
    created_at: string;
}

export interface TemplateListParams {
    page?: number;
    page_size?: number;
    category?: string;
    search?: string;
}

export interface CloneTemplateRequest {
    name: string;
    workspace_id?: string;
}

// Alert Types
export type AlertChannel = 'email' | 'slack' | 'webhook';
export type AlertEvent = 'run_failed' | 'run_timeout' | 'workflow_disabled' | 'credential_expired';

export interface Alert {
    id: string;
    name: string;
    workflow_id?: string;
    event: AlertEvent;
    channel: AlertChannel;
    config: Record<string, unknown>;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    last_triggered_at?: string;
}

export interface CreateAlertRequest {
    name: string;
    workflow_id?: string;
    event: AlertEvent;
    channel: AlertChannel;
    config: Record<string, unknown>;
    is_active?: boolean;
}

export interface UpdateAlertRequest {
    name?: string;
    event?: AlertEvent;
    channel?: AlertChannel;
    config?: Record<string, unknown>;
    is_active?: boolean;
}

export interface AlertListParams {
    page?: number;
    page_size?: number;
    workflow_id?: string;
    channel?: AlertChannel;
}

// User Types
export interface UserProfile {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
    timezone?: string;
    created_at: string;
    updated_at: string;
}

export interface UpdateProfileRequest {
    first_name?: string;
    last_name?: string;
    timezone?: string;
}

export interface ChangePasswordRequest {
    current_password: string;
    new_password: string;
    new_password_confirm: string;
}

// Workspace Types
export interface WorkspaceMember {
    id: string;
    user_id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: WorkspaceRole;
    joined_at: string;
}

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface InviteMemberRequest {
    email: string;
    role: WorkspaceRole;
}

export interface UpdateMemberRoleRequest {
    role: WorkspaceRole;
}

// Error Reporting Types
export interface ErrorReport {
    error_type: string;
    message: string;
    stack?: string;
    url: string;
    user_agent: string;
    timestamp: string;
    context?: Record<string, unknown>;
}
