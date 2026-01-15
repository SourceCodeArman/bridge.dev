import apiClient from '@/lib/api/client';
import type { CreateCredentialRequest, Credential, PaginatedResponse } from '@/types';

// Helper to map frontend auth types to backend credential types
const mapCredentialType = (type: string): string => {
    switch (type) {
        case 'oauth2':
        case 'oauth':
            return 'oauth_token';
        case 'api_key':
        case 'apikey':
            return 'api_key';
        case 'basic':
        case 'basic_auth':
            return 'basic_auth';
        default:
            return 'custom';
    }
};

export const credentialService = {
    list: async (page = 1, pageSize = 10) => {
        const response = await apiClient.get<PaginatedResponse<Credential>>('/api/v1/core/credentials/', {
            params: { page, page_size: pageSize }
        });
        console.log(response)
        return response.data;
    },

    get: async (id: string) => {
        const response = await apiClient.get<Credential>(`/api/v1/core/credentials/${id}/`);
        return response.data;
    },

    create: async (data: CreateCredentialRequest & { type?: string }) => {
        // Map frontend CreateCredentialRequest to backend Serializer expectation
        // Backend expects: { name, credential_type, data: { ...secrets } }
        // Frontend sends: { name, connector_id, credentials: { ...secrets }, type: "oauth2" }

        const payload = {
            name: data.name,
            credential_type: mapCredentialType(data.type || 'custom'),
            data: {
                ...data.credentials,
                // We optionally store connector_id in the encrypted data for reference
                _connector_id: data.connector_id,
                _auth_type: data.type || 'custom'
            }
        };

        const response = await apiClient.post<Credential>('/api/v1/core/credentials/', payload);
        return response.data;
    },

    update: async (id: string, data: Partial<CreateCredentialRequest>) => {
        // For updates, we primarily update name or secrets (data)
        const payload: any = {};
        if (data.name) payload.name = data.name;
        if (data.credentials) payload.data = data.credentials;

        const response = await apiClient.patch<Credential>(`/api/v1/core/credentials/${id}/`, payload);
        return response.data;
    },

    delete: async (id: string) => {
        await apiClient.delete(`/api/v1/core/credentials/${id}/`);
    },
};