import client from '../client';
import { API_ENDPOINTS } from '@/lib/constants';
import type { PaginatedResponse, Run, RunListParams } from '@/types';

export const runService = {
    list: async (params?: RunListParams) => {
        const response = await client.get<PaginatedResponse<Run>>(API_ENDPOINTS.RUNS.LIST, {
            params,
        });
        return response.data;
    },

    get: async (id: string) => {
        const response = await client.get<Run>(API_ENDPOINTS.RUNS.DETAIL(id));
        return response.data;
    },
};
