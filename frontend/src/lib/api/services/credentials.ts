import apiClient from '../client';
import { API_ENDPOINTS } from '@/lib/constants';
import type {
    WorkflowCredential,
    CreateWorkflowCredentialRequest,
    UpdateWorkflowCredentialRequest,
} from '@/types';

export const credentialService = {
    /**
     * List all credentials
     */
    async listWorkflowCredentials(): Promise<WorkflowCredential[]> {
        const response = await apiClient.get<WorkflowCredential[]>(API_ENDPOINTS.CREDENTIALS.LIST);
        return response.data;
    },

    /**
     * Get a single credential by ID
     */
    async getWorkflowCredential(id: string): Promise<WorkflowCredential> {
        const response = await apiClient.get<WorkflowCredential>(API_ENDPOINTS.CREDENTIALS.DETAIL(id));
        return response.data;
    },

    /**
     * Create a new credential
     */
    async createWorkflowCredential(data: CreateWorkflowCredentialRequest): Promise<WorkflowCredential> {
        const response = await apiClient.post<WorkflowCredential>(API_ENDPOINTS.CREDENTIALS.CREATE, data);
        return response.data;
    },

    /**
     * Update an existing credential
     */
    async updateWorkflowCredential(id: string, data: UpdateWorkflowCredentialRequest): Promise<WorkflowCredential> {
        const response = await apiClient.put<WorkflowCredential>(API_ENDPOINTS.CREDENTIALS.UPDATE(id), data);
        return response.data;
    },

    /**
     * Delete a credential
     */
    async deleteWorkflowCredential(id: string): Promise<void> {
        await apiClient.delete(API_ENDPOINTS.CREDENTIALS.DELETE(id));
    },

    /**
     * Test a credential for validity
     */
    async testWorkflowCredential(id: string): Promise<{ valid: boolean; message?: string }> {
        const response = await apiClient.post<{ valid: boolean; message?: string }>(
            `${API_ENDPOINTS.CREDENTIALS.DETAIL(id)}test/`
        );
        return response.data;
    },
};
