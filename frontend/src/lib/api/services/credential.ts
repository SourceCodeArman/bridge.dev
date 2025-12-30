import client from '../client';
import { API_ENDPOINTS } from '@/lib/constants';
import type { PaginatedResponse, Credential, CreateCredentialRequest } from '@/types';

export const credentialService = {
    list: async (page = 1, pageSize = 10) => {
        const response = await client.get<PaginatedResponse<Credential>>(API_ENDPOINTS.CREDENTIALS.LIST, {
            params: { page, page_size: pageSize },
        });
        return response.data;
    },

    get: async (id: string) => {
        const response = await client.get<Credential>(API_ENDPOINTS.CREDENTIALS.DETAIL(id));
        return response.data;
    },

    create: async (data: CreateCredentialRequest) => {
        const response = await client.post<Credential>(API_ENDPOINTS.CREDENTIALS.LIST, data);
        return response.data;
    },

    update: async (id: string, data: Partial<CreateCredentialRequest>) => {
        const response = await client.patch<Credential>(API_ENDPOINTS.CREDENTIALS.DETAIL(id), data);
        return response.data;
    },

    delete: async (id: string) => {
        await client.delete(API_ENDPOINTS.CREDENTIALS.DETAIL(id));
    },
};