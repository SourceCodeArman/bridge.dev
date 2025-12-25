import client from '../client';
import { API_ENDPOINTS } from '@/lib/constants';
import type { PaginatedResponse, Connector } from '@/types';

export const connectorService = {
    list: async (page = 1, pageSize = 20) => {
        const response = await client.get<PaginatedResponse<Connector>>(API_ENDPOINTS.CONNECTORS.LIST, {
            params: { page, page_size: pageSize },
        });
        return response.data;
    },

    get: async (id: string) => {
        const response = await client.get<Connector>(API_ENDPOINTS.CONNECTORS.DETAIL(id));
        return response.data;
    },
};
