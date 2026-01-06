import { MOCK_CREDENTIALS_RESPONSE, MOCK_CREDENTIALS } from '@/lib/mockData';
import type { PaginatedResponse, Credential, CreateCredentialRequest } from '@/types';

const SIMULATED_DELAY = 800;

export const credentialService = {
    list: async (page = 1, pageSize = 10) => {
        await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
        return MOCK_CREDENTIALS_RESPONSE;
    },

    get: async (id: string) => {
        await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
        const credential = MOCK_CREDENTIALS.find(c => c.id === id);
        if (!credential) throw new Error('Credential not found');
        return credential;
    },

    create: async (data: CreateCredentialRequest) => {
        await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
        const newCredential: Credential = {
            id: `cred-${Date.now()}`,
            name: data.name,
            connector_id: data.connector_id,
            connector_name: 'Mock Connector', // Ideally lookup from connector list
            workspace_id: 'ws-1',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        // In a real mock we'd push to array, but for "visualization" returning is enough
        // MOCK_CREDENTIALS.push(newCredential); 
        return newCredential;
    },

    update: async (id: string, data: Partial<CreateCredentialRequest>) => {
        await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
        const existing = MOCK_CREDENTIALS.find(c => c.id === id);
        if (!existing) throw new Error('Credential not found');
        return { ...existing, ...data };
    },

    delete: async (id: string) => {
        await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
        // console.log('Mock deleted credential', id);
    },
};