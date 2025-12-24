import apiClient from '../client';
import type {
    AlertConfiguration,
    AlertHistory,
    PaginatedResponse,
} from '@/types';

export const alertService = {
    /**
     * List all alert configurations
     */
    async listAlertConfigs(): Promise<AlertConfiguration[]> {
        const response = await apiClient.get<AlertConfiguration[]>('/api/v1/core/alert-configurations/');
        return response.data;
    },

    /**
     * Get a single alert configuration by ID
     */
    async getAlertConfig(id: string): Promise<AlertConfiguration> {
        const response = await apiClient.get<AlertConfiguration>(`/api/v1/core/alert-configurations/${id}/`);
        return response.data;
    },

    /**
     * Create a new alert configuration
     */
    async createAlertConfig(data: Partial<AlertConfiguration>): Promise<AlertConfiguration> {
        const response = await apiClient.post<AlertConfiguration>('/api/v1/core/alert-configurations/', data);
        return response.data;
    },

    /**
     * Update an existing alert configuration
     */
    async updateAlertConfig(id: string, data: Partial<AlertConfiguration>): Promise<AlertConfiguration> {
        const response = await apiClient.put<AlertConfiguration>(
            `/api/v1/core/alert-configurations/${id}/`,
            data
        );
        return response.data;
    },

    /**
     * Delete an alert configuration
     */
    async deleteAlertConfig(id: string): Promise<void> {
        await apiClient.delete(`/api/v1/core/alert-configurations/${id}/`);
    },

    /**
     * Get alert history
     */
    async getAlertHistory(params?: {
        page?: number;
        page_size?: number;
        workflow?: string;
    }): Promise<PaginatedResponse<AlertHistory>> {
        const response = await apiClient.get<PaginatedResponse<AlertHistory>>(
            '/api/v1/core/alert-history/',
            { params }
        );
        return response.data;
    },
};
