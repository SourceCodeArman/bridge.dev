import apiClient from '../client';

export const integrationService = {
    getGoogleAuthUrl: async (params: { client_id: string; client_secret: string; redirect_uri: string; connector_type: string }) => {
        const response = await apiClient.post<{ url: string }>('/api/v1/core/integrations/google/auth-url/', params);
        return response.data;
    },

    googleExchange: async (params: { client_id: string; client_secret: string; code: string; redirect_uri: string; connector_type: string }) => {
        const response = await apiClient.post<{ access_token: string; refresh_token: string }>('/api/v1/core/integrations/google/exchange/', params);
        return response.data;
    },
};

