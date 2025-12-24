export const API_ENDPOINTS = {
    AUTH: {
        LOGIN: '/api/v1/auth/login/',
        REGISTER: '/api/v1/auth/register/',
        LOGOUT: '/api/v1/auth/logout/',
        REFRESH: '/api/v1/auth/refresh/',
        ME: '/api/v1/auth/me/',
    },
    WORKFLOWS: {
        LIST: '/api/v1/core/workflows/',
        DETAIL: (id: string) => `/api/v1/core/workflows/${id}/`,
        CREATE: '/api/v1/core/workflows/',
        UPDATE: (id: string) => `/api/v1/core/workflows/${id}/`,
        DELETE: (id: string) => `/api/v1/core/workflows/${id}/`,
    },
    RUNS: {
        LIST: '/api/v1/core/runs/',
        DETAIL: (id: string) => `/api/v1/core/runs/${id}/`,
    },
    CONNECTORS: {
        LIST: '/api/v1/core/connectors/',
        DETAIL: (id: string) => `/api/v1/core/connectors/${id}/`,
    },
    CREDENTIALS: {
        LIST: '/api/v1/core/credentials/',
        CREATE: '/api/v1/core/credentials/',
        DETAIL: (id: string) => `/api/v1/core/credentials/${id}/`,
        UPDATE: (id: string) => `/api/v1/core/credentials/${id}/`,
        DELETE: (id: string) => `/api/v1/core/credentials/${id}/`,
    },
} as const;

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Bridge.dev';
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
