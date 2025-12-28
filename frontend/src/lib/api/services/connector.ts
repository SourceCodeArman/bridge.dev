import apiClient from '../client';
import { API_ENDPOINTS } from '@/lib/constants';
import type { Connector } from '../../../types/models';

export const connectorService = {
    list: async (): Promise<Connector[]> => {
        const { data } = await apiClient.get<{ data: { connectors: Connector[] } }>(API_ENDPOINTS.CONNECTORS.LIST);
        return data.data.connectors;
    },

    get: async (id: string): Promise<Connector> => {
        const { data } = await apiClient.get<{ data: Connector }>(API_ENDPOINTS.CONNECTORS.DETAIL(id));
        return data.data;
    },
};
