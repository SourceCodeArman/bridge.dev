import client from '../client';
import { API_ENDPOINTS } from '@/lib/constants';
import type { PaginatedResponse, Run, RunStep, RunLog, RunListParams } from '@/types';
import { MOCK_RUNS_RESPONSE, MOCK_RUNS, MOCK_RUN_STEPS, MOCK_RUN_LOGS } from '@/lib/mockData';

export const runService = {
    /**
     * List runs with optional filters
     */
    list: async (params?: RunListParams) => {
        await new Promise(resolve => setTimeout(resolve, 600));
        return MOCK_RUNS_RESPONSE;
    },

    /**
     * Get a single run by ID
     */
    get: async (id: string) => {
        await new Promise(resolve => setTimeout(resolve, 300));
        const run = MOCK_RUNS.find(r => r.id === id);
        if (!run) throw new Error("Run not found");
        return run;
    },

    /**
     * Get steps for a specific run
     */
    getSteps: async (runId: string) => {
        await new Promise(resolve => setTimeout(resolve, 400));
        return MOCK_RUN_STEPS;
    },

    /**
     * Get logs for a specific run
     */
    getLogs: async (runId: string) => {
        await new Promise(resolve => setTimeout(resolve, 300));
        return MOCK_RUN_LOGS;
    },

    /**
     * Replay a completed or failed run
     */
    replay: async (id: string) => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const run = MOCK_RUNS.find(r => r.id === id);
        if (!run) throw new Error("Run not found");
        return {
            ...run,
            id: `run-replay-${Date.now()}`,
            status: 'pending',
            started_at: new Date().toISOString(),
            completed_at: undefined,
            steps: []
        } as Run;
    },

    /**
     * Cancel a running workflow
     */
    cancel: async (id: string) => {
        await new Promise(resolve => setTimeout(resolve, 500));
        const run = MOCK_RUNS.find(r => r.id === id);
        if (!run) throw new Error("Run not found");
        return { ...run, status: 'cancelled' };
    },
};
