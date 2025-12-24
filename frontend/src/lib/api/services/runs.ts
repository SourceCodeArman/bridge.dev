import apiClient from '../client';
import { API_ENDPOINTS } from '@/lib/constants';
import type {
    WorkflowRun,
    WorkflowRunTrace,
    WorkflowRunLog,
    ListRunsParams,
    PaginatedResponse,
} from '@/types';

export const runService = {
    /**
     * List all runs with optional filtering
     */
    async listWorkflowRuns(params?: ListWorkflowRunsParams): Promise<PaginatedResponse<WorkflowRun>> {
        const response = await apiClient.get<PaginatedResponse<WorkflowRun>>(
            API_ENDPOINTS.RUNS.LIST,
            { params }
        );
        return response.data;
    },

    /**
     * Get a single run by ID
     */
    async getWorkflowRun(id: string): Promise<WorkflowRun> {
        const response = await apiClient.get<WorkflowRun>(API_ENDPOINTS.RUNS.DETAIL(id));
        return response.data;
    },

    /**
     * Rerun a workflow from a previous run
     */
    async rerunWorkflow(id: string): Promise<WorkflowRun> {
        const response = await apiClient.post<WorkflowRun>(`${API_ENDPOINTS.RUNS.DETAIL(id)}rerun/`);
        return response.data;
    },

    /**
     * Cancel a running workflow
     */
    async cancelWorkflowRun(id: string): Promise<WorkflowRun> {
        const response = await apiClient.post<WorkflowRun>(`${API_ENDPOINTS.RUNS.DETAIL(id)}cancel/`);
        return response.data;
    },

    /**
     * Get logs for a specific run
     */
    async getRunLogs(runId: string): Promise<WorkflowRunLog[]> {
        const response = await apiClient.get<WorkflowRunLog[]>(`/api/v1/core/runs/${runId}/logs/`);
        return response.data;
    },

    /**
     * Get trace information for a run (steps + logs)
     */
    async getRunTrace(runId: string): Promise<WorkflowRunTrace> {
        const response = await apiClient.get<WorkflowRunTrace>(`/api/v1/core/runs/${runId}/trace/`);
        return response.data;
    },
};
