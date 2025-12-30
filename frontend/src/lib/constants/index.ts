export const API_ENDPOINTS = {
    AUTH: {
        LOGIN: '/api/v1/auth/login/',
        REGISTER: '/api/v1/auth/register/',
        LOGOUT: '/api/v1/auth/logout/',
        REFRESH: '/api/v1/auth/refresh/',
        ME: '/api/v1/auth/me/',
        CHANGE_PASSWORD: '/api/v1/auth/change-password/',
    },
    WORKFLOWS: {
        LIST: '/api/v1/core/workflows/',
        DETAIL: (id: string) => `/api/v1/core/workflows/${id}/`,
        CREATE: '/api/v1/core/workflows/',
        UPDATE: (id: string) => `/api/v1/core/workflows/${id}/`,
        DELETE: (id: string) => `/api/v1/core/workflows/${id}/`,
        ACTIVATE: (id: string) => `/api/v1/core/workflows/${id}/activate/`,
        DEACTIVATE: (id: string) => `/api/v1/core/workflows/${id}/deactivate/`,
        DRAFTS: (id: string) => `/api/v1/core/workflows/${id}/drafts/`,
        PUBLISH_VERSION: (id: string) => `/api/v1/core/workflows/${id}/publish_version/`,
    },
    RUNS: {
        LIST: '/api/v1/core/runs/',
        DETAIL: (id: string) => `/api/v1/core/runs/${id}/`,
        STEPS: (id: string) => `/api/v1/core/runs/${id}/steps/`,
        LOGS: (id: string) => `/api/v1/core/runs/${id}/logs/`,
        REPLAY: (id: string) => `/api/v1/core/runs/${id}/replay/`,
        CANCEL: (id: string) => `/api/v1/core/runs/${id}/cancel/`,
    },
    CONNECTORS: {
        LIST: '/api/v1/core/connectors/',
        DETAIL: (id: string) => `/api/v1/core/connectors/${id}/`,
    },
    CUSTOM_CONNECTORS: {
        LIST: '/api/v1/core/custom-connectors/',
        DETAIL: (id: string) => `/api/v1/core/custom-connectors/${id}/`,
    },
    CUSTOM_CONNECTOR_VERSIONS: {
        LIST: '/api/v1/core/custom-connector-versions/',
        DETAIL: (id: string) => `/api/v1/core/custom-connector-versions/${id}/`,
    },
    CREDENTIALS: {
        LIST: '/api/v1/core/credentials/',
        CREATE: '/api/v1/core/credentials/',
        DETAIL: (id: string) => `/api/v1/core/credentials/${id}/`,
        UPDATE: (id: string) => `/api/v1/core/credentials/${id}/`,
        DELETE: (id: string) => `/api/v1/core/credentials/${id}/`,
        TEST: (id: string) => `/api/v1/core/credentials/${id}/test/`,
    },
    TRIGGERS: {
        LIST: '/api/v1/core/triggers/',
        DETAIL: (id: string) => `/api/v1/core/triggers/${id}/`,
        CREATE: '/api/v1/core/triggers/',
        UPDATE: (id: string) => `/api/v1/core/triggers/${id}/`,
        DELETE: (id: string) => `/api/v1/core/triggers/${id}/`,
        ACTIVATE: (id: string) => `/api/v1/core/triggers/${id}/activate/`,
        DEACTIVATE: (id: string) => `/api/v1/core/triggers/${id}/deactivate/`,
    },
    TEMPLATES: {
        LIST: '/api/v1/core/templates/',
        DETAIL: (id: string) => `/api/v1/core/templates/${id}/`,
        CLONE: (id: string) => `/api/v1/core/templates/${id}/clone/`,
    },
    ALERTS: {
        LIST: '/api/v1/core/alerts/',
        DETAIL: (id: string) => `/api/v1/core/alerts/${id}/`,
        CREATE: '/api/v1/core/alerts/',
        UPDATE: (id: string) => `/api/v1/core/alerts/${id}/`,
        DELETE: (id: string) => `/api/v1/core/alerts/${id}/`,
        TEST: (id: string) => `/api/v1/core/alerts/${id}/test/`,
    },
    USERS: {
        PROFILE: '/api/v1/users/profile/',
        UPDATE_PROFILE: '/api/v1/users/profile/',
        AVATAR: '/api/v1/users/avatar/',
    },
    WORKSPACES: {
        LIST: '/api/v1/workspaces/',
        DETAIL: (id: string) => `/api/v1/workspaces/${id}/`,
        MEMBERS: (id: string) => `/api/v1/workspaces/${id}/members/`,
        INVITE: (id: string) => `/api/v1/workspaces/${id}/invite/`,
        REMOVE_MEMBER: (id: string, userId: string) => `/api/v1/workspaces/${id}/members/${userId}/`,
    },
    ERROR_REPORTING: {
        REPORT: '/api/v1/errors/report/',
    },
} as const;

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Bridge.dev';
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
