import { MOCK_CONNECTORS_RESPONSE } from '@/lib/mockData';
import type { PaginatedResponse, Connector } from '@/types';

const SIMULATED_DELAY = 600;

export const connectorService = {
    list: async (): Promise<PaginatedResponse<Connector>> => {
        // console.log('Mocking connector list with params:', params);
        await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
        return MOCK_CONNECTORS_RESPONSE;
    },

    get: async (id: string): Promise<Connector> => {
        await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
        const connector = MOCK_CONNECTORS_RESPONSE.results.find(c => c.id === id);
        if (!connector) throw new Error('Connector not found');
        return connector;
    },

    getBySlug: async (slug: string): Promise<Connector | undefined> => {
        await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
        return MOCK_CONNECTORS_RESPONSE.results.find(c => c.slug === slug);
    },

    // Add create for custom connectors if needed, mocked
    createCustom: async (data: any): Promise<Connector> => {
        await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
        return {
            ...MOCK_CONNECTORS_RESPONSE.results[0],
            ...data,
            id: 'conn-custom-' + Date.now()
        };
    }
};
