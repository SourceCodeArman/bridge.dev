import client from '../client';
import { API_ENDPOINTS } from '@/lib/constants';
import type { PaginatedResponse, Workflow, CreateWorkflowRequest, UpdateWorkflowRequest, WorkflowListParams, WorkflowVersion } from '@/types';

export const workflowService = {
    list: async (params?: WorkflowListParams) => {
        const response = await client.get<PaginatedResponse<Workflow>>(API_ENDPOINTS.WORKFLOWS.LIST, {
            params,
        });
        return response.data;
    },

    get: async (id: string) => {
        const response = await client.get<Workflow>(API_ENDPOINTS.WORKFLOWS.DETAIL(id));
        return response.data;
    },

    create: async (data: CreateWorkflowRequest) => {
        const response = await client.post<Workflow>(API_ENDPOINTS.WORKFLOWS.LIST, data);
        return response.data;
    },

    update: async (id: string, data: UpdateWorkflowRequest) => {
        const response = await client.put<Workflow>(API_ENDPOINTS.WORKFLOWS.DETAIL(id), data);
        return response.data;
    },

    saveDraft: async (id: string, definition: { nodes: any[]; edges: any[] }) => {
        const response = await client.post(API_ENDPOINTS.WORKFLOWS.DRAFTS(id), { definition });
        return response.data;
    },

    getDraft: async (id: string) => {
        const response = await client.get(API_ENDPOINTS.WORKFLOWS.DRAFTS(id));
        return response.data;
    },

    delete: async (id: string) => {
        await client.delete(API_ENDPOINTS.WORKFLOWS.DETAIL(id));
    },

    // New versioning methods
    activate: async (id: string, isActive: boolean) => {
        const response = await client.patch<{ data: Workflow }>(API_ENDPOINTS.WORKFLOWS.ACTIVATE(id), { is_active: isActive });
        return response.data;
    },

    createVersion: async (id: string, versionLabel?: string) => {
        const response = await client.post<{ data: WorkflowVersion }>(API_ENDPOINTS.WORKFLOWS.VERSIONS(id), { version_label: versionLabel });
        return response.data;
    },

    restoreVersion: async (id: string, versionId: string) => {
        const response = await client.post<{ data: WorkflowVersion }>(API_ENDPOINTS.WORKFLOWS.RESTORE_VERSION(id, versionId));
        return response.data;
    },

    listVersions: async (id: string) => {
        const response = await client.get<{ data: WorkflowVersion[] }>(API_ENDPOINTS.WORKFLOWS.VERSIONS(id));
        return response.data;
    },

    // AI workflow generation
    generateFromPrompt: async (id: string, prompt: string, llmProvider: string = 'gemini') => {
        const response = await client.post<{
            status: string;
            data: {
                version: WorkflowVersion;
                validation_warnings?: string[]
            };
            message: string
        }>(API_ENDPOINTS.WORKFLOWS.GENERATE_DRAFT(id), {
            prompt,
            llm_provider: llmProvider
        });
        return response.data;
    },

    // AI Assistant endpoints
    sendChatMessage: async (
        workflowId: string,
        message: string,
        options?: {
            llmProvider?: 'gemini' | 'openai' | 'anthropic' | 'deepseek';
            includeWorkflowContext?: boolean;
        }
    ) => {
        const response = await client.post(`/api/v1/core/assistant/${workflowId}/chat/`, {
            message,
            llm_provider: options?.llmProvider || 'gemini',
            include_workflow_context: options?.includeWorkflowContext ?? true,
        });
        return response.data;
    },

    getChatHistory: async (workflowId: string, limit?: number) => {
        const params = limit ? `?limit=${limit}` : '';
        const response = await client.get(`/api/v1/core/assistant/${workflowId}/history/${params}`);
        return response.data;
    },

    clearChatHistory: async (workflowId: string) => {
        const response = await client.delete(`/api/v1/core/assistant/${workflowId}/history/`);
        return response.data;
    },
};

