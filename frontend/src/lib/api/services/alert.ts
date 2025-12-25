import client from '../client';
import { API_ENDPOINTS } from '@/lib/constants';
import type {
    PaginatedResponse,
    Alert,
    CreateAlertRequest,
    UpdateAlertRequest,
    AlertListParams
} from '@/types';

export const alertService = {
    /**
     * List alerts with optional filters
     */
    list: async (params?: AlertListParams) => {
        const response = await client.get<PaginatedResponse<Alert>>(API_ENDPOINTS.ALERTS.LIST, {
            params,
        });
        return response.data;
    },

    /**
     * Get a single alert by ID
     */
    get: async (id: string) => {
        const response = await client.get<Alert>(API_ENDPOINTS.ALERTS.DETAIL(id));
        return response.data;
    },

    /**
     * Create a new alert
     */
    create: async (data: CreateAlertRequest) => {
        const response = await client.post<Alert>(API_ENDPOINTS.ALERTS.CREATE, data);
        return response.data;
    },

    /**
     * Update an existing alert
     */
    update: async (id: string, data: UpdateAlertRequest) => {
        const response = await client.patch<Alert>(API_ENDPOINTS.ALERTS.UPDATE(id), data);
        return response.data;
    },

    /**
     * Delete an alert
     */
    delete: async (id: string) => {
        await client.delete(API_ENDPOINTS.ALERTS.DELETE(id));
    },

    /**
     * Test an alert configuration
     */
    test: async (id: string) => {
        const response = await client.post<{ success: boolean; message: string }>(
            API_ENDPOINTS.ALERTS.TEST(id)
        );
        return response.data;
    },
};
