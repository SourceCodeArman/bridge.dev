import apiClient from '../client';
import { API_ENDPOINTS } from '@/lib/constants';
import type { PaginatedResponse, Connector } from '@/types';

export const connectorService = {
    list: async (): Promise<PaginatedResponse<Connector>> => {
        const response = await apiClient.get<any>(API_ENDPOINTS.CONNECTORS.LIST);
        const data = response.data;

        // Handle both response formats:
        // Standard paginated: { count, results, next, previous }
        // Custom format: { status, data: { connectors, count }, message }
        if (data.results !== undefined) {
            // Standard paginated response
            return data;
        } else if (data.data && Array.isArray(data.data.connectors)) {
            // Custom format from connectors endpoint
            return {
                count: data.data.count || 0,
                results: data.data.connectors,
                next: null,
                previous: null,
            };
        }

        // Fallback to empty response
        return {
            count: 0,
            results: [],
            next: null,
            previous: null,
        };
    },

    get: async (id: string): Promise<Connector> => {
        const response = await apiClient.get<any>(API_ENDPOINTS.CONNECTORS.DETAIL(id));
        const data = response.data;

        // Handle both response formats
        if (data.data && typeof data.data === 'object' && 'id' in data.data) {
            // Custom format from connectors endpoint
            return data.data;
        }

        // Standard format
        return data;
    },

    getBySlug: async (slug: string): Promise<Connector | undefined> => {
        try {
            const response = await connectorService.list();
            return response.results.find(c => c.slug === slug);
        } catch (error) {
            return undefined;
        }
    },

    getManifest: async (id: string): Promise<Connector> => {
        const response = await apiClient.get<any>(API_ENDPOINTS.CONNECTORS.DETAIL(id));
        const data = response.data;

        // Handle wrapped response format
        if (data.data && typeof data.data === 'object' && 'id' in data.data) {
            return data.data;
        }

        return data;
    },

    createCustom: async (data: any): Promise<Connector> => {
        const response = await apiClient.post<any>(API_ENDPOINTS.CUSTOM_CONNECTORS.LIST, data);
        const responseData = response.data;

        // Handle both response formats
        if (responseData.data && typeof responseData.data === 'object' && 'id' in responseData.data) {
            // Custom format
            return responseData.data;
        }

        // Standard format
        return responseData;
    }
};
