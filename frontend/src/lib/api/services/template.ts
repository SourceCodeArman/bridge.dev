import client from '../client';
import { API_ENDPOINTS } from '@/lib/constants';
import type {
    PaginatedResponse,
    Template,
    TemplateListParams,
    CloneTemplateRequest,
    Workflow
} from '@/types';
import { MOCK_TEMPLATES, MOCK_TEMPLATES_RESPONSE } from '@/lib/mockData';

export const templateService = {
    /**
     * List templates with optional filters
     */
    list: async (params?: TemplateListParams) => {
        // Mock delay
        await new Promise(resolve => setTimeout(resolve, 500));
        return MOCK_TEMPLATES_RESPONSE;
    },

    /**
     * Get a single template by ID
     */
    get: async (id: string) => {
        await new Promise(resolve => setTimeout(resolve, 300));
        const template = MOCK_TEMPLATES.find(t => t.id === id);
        if (!template) throw new Error("Template not found");
        return template;
    },

    /**
     * Clone a template into a new workflow
     */
    clone: async (id: string, data: CloneTemplateRequest) => {
        await new Promise(resolve => setTimeout(resolve, 800));
        return {
            id: 'new-wf-from-template',
            name: data.workflow_name || 'Cloned Workflow',
            description: 'Created from template',
            is_active: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            workspace_id: 'ws-1',
            trigger_type: 'manual'
        } as Workflow;
    },
};
