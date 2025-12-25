import client from '../client';
import { API_ENDPOINTS } from '@/lib/constants';
import type {
    PaginatedResponse,
    Template,
    TemplateListParams,
    CloneTemplateRequest,
    Workflow
} from '@/types';

export const templateService = {
    /**
     * List templates with optional filters
     */
    list: async (params?: TemplateListParams) => {
        const response = await client.get<PaginatedResponse<Template>>(API_ENDPOINTS.TEMPLATES.LIST, {
            params,
        });
        return response.data;
    },

    /**
     * Get a single template by ID
     */
    get: async (id: string) => {
        const response = await client.get<Template>(API_ENDPOINTS.TEMPLATES.DETAIL(id));
        return response.data;
    },

    /**
     * Clone a template into a new workflow
     */
    clone: async (id: string, data: CloneTemplateRequest) => {
        const response = await client.post<Workflow>(API_ENDPOINTS.TEMPLATES.CLONE(id), data);
        return response.data;
    },
};
