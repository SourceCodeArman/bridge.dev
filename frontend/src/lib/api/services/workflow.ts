import client from '../client';
import { API_ENDPOINTS } from '@/lib/constants';
import type { PaginatedResponse, Workflow, CreateWorkflowRequest, UpdateWorkflowRequest, WorkflowListParams } from '@/types';

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

    delete: async (id: string) => {
        await client.delete(API_ENDPOINTS.WORKFLOWS.DETAIL(id));
    },
};
