import apiClient from '../client';
import { API_ENDPOINTS } from '@/lib/constants';
import type { Connector, ConnectorManifest } from '@/types';

export const connectorService = {
    /**
     * List all available connectors
     */
    async listConnectors(): Promise<Connector[]> {
        const response = await apiClient.get<Connector[]>(API_ENDPOINTS.CONNECTORS.LIST);
        return response.data;
    },

    /**
     * Get a single connector by ID
     */
    async getConnector(id: string): Promise<Connector> {
        const response = await apiClient.get<Connector>(API_ENDPOINTS.CONNECTORS.DETAIL(id));
        return response.data;
    },

    /**
     * Get the manifest for a connector
     */
    async getConnectorManifest(id: string): Promise<ConnectorManifest> {
        const response = await apiClient.get<ConnectorManifest>(
            `${API_ENDPOINTS.CONNECTORS.DETAIL(id)}manifest/`
        );
        return response.data;
    },
};
