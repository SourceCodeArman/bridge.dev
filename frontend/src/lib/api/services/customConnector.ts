import apiClient from '../client';
import { API_ENDPOINTS } from '@/lib/constants';
import type { Connector, ConnectorManifest } from '../../../types/models';

export interface CreateCustomConnectorData {
    slug: string;
    display_name: string;
    description: string;
    visibility: 'private' | 'workspace' | 'public';
}

export interface CreateCustomConnectorVersionData {
    connector: string;
    version: string;
    manifest: Record<string, unknown>;
}

export const customConnectorService = {
    create: async (data: CreateCustomConnectorData | FormData) => {
        const response = await apiClient.post(API_ENDPOINTS.CUSTOM_CONNECTORS.LIST, data, {
            headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : undefined
        });
        return response.data;
    },

    createVersion: async (data: CreateCustomConnectorVersionData) => {
        const response = await apiClient.post(API_ENDPOINTS.CUSTOM_CONNECTOR_VERSIONS.LIST, data);
        return response.data;
    },

    list: async (): Promise<Connector[]> => {
        const response = await apiClient.get(API_ENDPOINTS.CUSTOM_CONNECTORS.LIST);
        // Standard DRF pagination returns { count: number, results: any[] }
        const results = response.data.results || [];

        // Map backend CustomConnector to frontend Connector interface
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return results.map((c: any): Connector => ({
            id: c.id,
            slug: c.slug,
            display_name: c.display_name,
            description: c.description,
            type: c.current_version_info?.manifest?.connector_type || 'custom',
            connector_type: c.current_version_info?.manifest?.connector_type || 'custom',
            icon_url_light: c.icon_url_light,
            icon_url_dark: c.icon_url_dark,
            is_custom: true,
            is_active: true, // Custom connectors are active by default in the list
            manifest: c.current_version_info?.manifest || {} as ConnectorManifest,
            version: c.current_version_info?.version || 'draft'
        }));
    }
};
