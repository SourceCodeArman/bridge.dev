import client from '../client';
import { API_ENDPOINTS } from '@/lib/constants';
import type { PaginatedResponse, Run, RunStep, RunLog, RunListParams } from '@/types';

export const runService = {
    /**
     * List runs with optional filters
     */
    list: async (params?: RunListParams) => {
        const response = await client.get<PaginatedResponse<Run>>(API_ENDPOINTS.RUNS.LIST, {
            params,
        });
        return response.data;
    },

    /**
     * Get a single run by ID
     */
    get: async (id: string) => {
        const response = await client.get<Run>(API_ENDPOINTS.RUNS.DETAIL(id));
        return response.data;
    },

    /**
     * Get steps for a specific run
     */
    getSteps: async (runId: string) => {
        const response = await client.get<RunStep[]>(API_ENDPOINTS.RUNS.STEPS(runId));
        return response.data;
    },

    /**
     * Get logs for a specific run
     */
    getLogs: async (runId: string) => {
        const response = await client.get<RunLog[]>(API_ENDPOINTS.RUNS.LOGS(runId));
        return response.data;
    },

    /**
     * Replay a completed or failed run
     */
    replay: async (id: string) => {
        const response = await client.post<Run>(API_ENDPOINTS.RUNS.REPLAY(id));
        return response.data;
    },

    /**
     * Cancel a running workflow
     */
    cancel: async (id: string) => {
        const response = await client.post<Run>(API_ENDPOINTS.RUNS.CANCEL(id));
        return response.data;
    },
};
