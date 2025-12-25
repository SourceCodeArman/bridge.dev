import client from '../client';
import { API_ENDPOINTS } from '@/lib/constants';
import type {
    PaginatedResponse,
    Trigger,
    CreateTriggerRequest,
    UpdateTriggerRequest,
    TriggerListParams
} from '@/types';

export const triggerService = {
    /**
     * List triggers with optional filters
     */
    list: async (params?: TriggerListParams) => {
        const response = await client.get<PaginatedResponse<Trigger>>(API_ENDPOINTS.TRIGGERS.LIST, {
            params,
        });
        return response.data;
    },

    /**
     * Get a single trigger by ID
     */
    get: async (id: string) => {
        const response = await client.get<Trigger>(API_ENDPOINTS.TRIGGERS.DETAIL(id));
        return response.data;
    },

    /**
     * Create a new trigger
     */
    create: async (data: CreateTriggerRequest) => {
        const response = await client.post<Trigger>(API_ENDPOINTS.TRIGGERS.CREATE, data);
        return response.data;
    },

    /**
   * Update an existing trigger
     */
    update: async (id: string, data: UpdateTriggerRequest) => {
        const response = await client.patch<Trigger>(API_ENDPOINTS.TRIGGERS.UPDATE(id), data);
        return response.data;
    },

    /**
     * Delete a trigger
     */
    delete: async (id: string) => {
        await client.delete(API_ENDPOINTS.TRIGGERS.DELETE(id));
    },

    /**
     * Activate a trigger
     */
    activate: async (id: string) => {
        const response = await client.post<Trigger>(API_ENDPOINTS.TRIGGERS.ACTIVATE(id));
        return response.data;
    },

    /**
     * Deactivate a trigger
     */
    deactivate: async (id: string) => {
        const response = await client.post<Trigger>(API_ENDPOINTS.TRIGGERS.DEACTIVATE(id));
        return response.data;
    },
};
