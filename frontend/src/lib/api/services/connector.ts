import apiClient from '../client';
import { API_ENDPOINTS } from '@/lib/constants';
import type { PaginatedResponse, Connector } from '@/types';

export const connectorService = {
    list: async (): Promise<PaginatedResponse<Connector>> => {
        const response = await apiClient.get<PaginatedResponse<Connector>>(API_ENDPOINTS.CONNECTORS.LIST);
        return response.data;
    },

    get: async (id: string): Promise<Connector> => {
        const response = await apiClient.get<Connector>(API_ENDPOINTS.CONNECTORS.DETAIL(id));
        return response.data;
    },

    getBySlug: async (slug: string): Promise<Connector | undefined> => {
        try {
            const response = await apiClient.get<PaginatedResponse<Connector>>(API_ENDPOINTS.CONNECTORS.LIST);
            return response.data.results.find(c => c.slug === slug);
        } catch (error) {
            return undefined;
        }
    },

    createCustom: async (data: any): Promise<Connector> => {
        const response = await apiClient.post<Connector>(API_ENDPOINTS.CUSTOM_CONNECTORS.LIST, data);
        return response.data;
    }
};
