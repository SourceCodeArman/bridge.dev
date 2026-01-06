import { MOCK_ALERTS, MOCK_ALERTS_RESPONSE } from '@/lib/mockData';
import type {
    PaginatedResponse,
    Alert,
    CreateAlertRequest,
    UpdateAlertRequest,
    AlertListParams
} from '@/types';

const SIMULATED_DELAY = 600;

export const alertService = {
    /**
     * List alerts with optional filters
     */
    list: async (params?: AlertListParams): Promise<PaginatedResponse<Alert>> => {
        await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
        return MOCK_ALERTS_RESPONSE;
    },

    /**
     * Get a single alert by ID
     */
    get: async (id: string): Promise<Alert> => {
        await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
        const alert = MOCK_ALERTS.find(a => a.id === id);
        if (!alert) throw new Error('Alert not found');
        return alert;
    },

    /**
     * Create a new alert
     */
    create: async (data: CreateAlertRequest): Promise<Alert> => {
        await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
        const newAlert: Alert = {
            id: `alert-${Date.now()}`,
            name: data.name,
            event: data.event,
            channel: data.channel,
            workflow_id: data.workflow_id,
            is_active: data.is_active ?? true,
            config: data.config,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        return newAlert;
    },

    /**
     * Update an existing alert
     */
    update: async (id: string, data: UpdateAlertRequest): Promise<Alert> => {
        await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
        const existing = MOCK_ALERTS.find(a => a.id === id);
        if (!existing) throw new Error('Alert not found');
        return { ...existing, ...data, updated_at: new Date().toISOString() };
    },

    /**
     * Delete an alert
     */
    delete: async (id: string): Promise<void> => {
        await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
        // console.log('Mock deleted alert', id);
    },

    /**
     * Test an alert configuration
     */
    test: async (id: string): Promise<{ success: boolean; message: string }> => {
        await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY * 2));
        return { success: true, message: 'Test notification sent' };
    },
};
