import apiClient from '../client';
import { API_ENDPOINTS } from '@/lib/constants';
import type {
    WorkflowDefinition,
    CreateWorkflowRequest,
    UpdateWorkflowRequest,
    ListWorkflowsParams,
    PaginatedResponse,
} from '@/types';

export const workflowService = {
    /**
     * List all workflows with optional filtering
     */
    async listWorkflowDefinitions(params?: ListWorkflowDefinitionsParams): Promise<PaginatedResponse<WorkflowDefinition>> {
        const response = await apiClient.get<PaginatedResponse<WorkflowDefinition>>(
            API_ENDPOINTS.WORKFLOWS.LIST,
            { params }
        );
        return response.data;
    },

    /**
     * Get a single workflow by ID
     */
    async getWorkflowDefinition(id: string): Promise<WorkflowDefinition> {
        const response = await apiClient.get<WorkflowDefinition>(API_ENDPOINTS.WORKFLOWS.DETAIL(id));
        return response.data;
    },

    /**
     * Create a new workflow
     */
    async createWorkflowDefinition(data: CreateWorkflowDefinitionRequest): Promise<WorkflowDefinition> {
        const response = await apiClient.post<WorkflowDefinition>(API_ENDPOINTS.WORKFLOWS.CREATE, data);
        return response.data;
    },

    /**
     * Update an existing workflow
     */
    async updateWorkflowDefinition(id: string, data: UpdateWorkflowDefinitionRequest): Promise<WorkflowDefinition> {
        const response = await apiClient.put<WorkflowDefinition>(API_ENDPOINTS.WORKFLOWS.UPDATE(id), data);
        return response.data;
    },

    /**
     * Delete a workflow
     */
    async deleteWorkflowDefinition(id: string): Promise<void> {
        await apiClient.delete(API_ENDPOINTS.WORKFLOWS.DELETE(id));
    },

    /**
     * Publish a workflow (make it active)
     */
    async publishWorkflowDefinition(id: string): Promise<WorkflowDefinition> {
        const response = await apiClient.post<WorkflowDefinition>(`${API_ENDPOINTS.WORKFLOWS.DETAIL(id)}publish/`);
        return response.data;
    },

    /**
     * Duplicate a workflow
     */
    async duplicateWorkflowDefinition(id: string): Promise<WorkflowDefinition> {
        const response = await apiClient.post<WorkflowDefinition>(`${API_ENDPOINTS.WORKFLOWS.DETAIL(id)}duplicate/`);
        return response.data;
    },
};
