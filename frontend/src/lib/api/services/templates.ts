import apiClient from '../client';
import type {
    WorkflowTemplate,
    ListTemplatesParams,
    PaginatedResponse,
    WorkflowDefinition,
} from '@/types';

export const templateService = {
    /**
     * List all workflow templates
     */
    async listTemplates(params?: ListTemplatesParams): Promise<PaginatedResponse<WorkflowTemplate>> {
        const response = await apiClient.get<PaginatedResponse<WorkflowTemplate>>(
            '/api/v1/core/templates/',
            { params }
        );
        return response.data;
    },

    /**
     * Get a single template by ID
     */
    async getTemplate(id: string): Promise<WorkflowTemplate> {
        const response = await apiClient.get<WorkflowTemplate>(`/api/v1/core/templates/${id}/`);
        return response.data;
    },

    /**
     * Clone a template to create a new workflow
     */
    async cloneTemplate(id: string, name?: string): Promise<WorkflowDefinition> {
        const response = await apiClient.post<WorkflowDefinition>(
            `/api/v1/core/templates/${id}/clone/`,
            name ? { name } : {}
        );
        return response.data;
    },
};
