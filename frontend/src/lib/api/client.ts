import axios, { AxiosError, type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, API_ENDPOINTS } from '@/lib/constants';
import { STORAGE_KEYS, getItem, removeItem, setItem } from '@/lib/utils/storage';
import type { ApiError, RefreshTokenResponse } from '@/types';

// Retry configuration
const RETRY_CONFIG = {
    maxRetries: 3,
    retryDelay: 1000, // Base delay in ms
    retryableStatuses: [408, 429, 500, 502, 503, 504],
    retryableMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'],
} as const;

// Extended request config with retry tracking
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
    _retryCount?: number;
}

/**
 * Calculate exponential backoff delay
 */
const getRetryDelay = (retryCount: number, baseDelay: number): number => {
    // Exponential backoff with jitter
    const delay = baseDelay * Math.pow(2, retryCount);
    const jitter = delay * 0.1 * Math.random();
    return delay + jitter;
};

/**
 * Determine if request should be retried
 */
const shouldRetryRequest = (error: AxiosError, config: ExtendedAxiosRequestConfig): boolean => {
    const retryCount = config._retryCount || 0;

    // Max retries exceeded
    if (retryCount >= RETRY_CONFIG.maxRetries) {
        return false;
    }

    // Network errors (no response)
    if (!error.response) {
        return true;
    }

    // Check if status code is retryable
    if (!RETRY_CONFIG.retryableStatuses.includes(error.response.status as (typeof RETRY_CONFIG.retryableStatuses)[number])) {
        return false;
    }

    // Check if method is retryable (skip POST by default to avoid duplicate submissions)
    const method = config.method?.toUpperCase() || 'GET';
    if (!(RETRY_CONFIG.retryableMethods as readonly string[]).includes(method)) {
        return false;
    }

    return true;
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const apiClient: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 30000,
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = getItem<string>(STORAGE_KEYS.AUTH_TOKEN);
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Add Workspace ID header
        // For MVP/Dev, we can fallback to a known ID if not in storage, but ideally it comes from storage
        // Assuming 'ws-1' is the dev workspace ID based on previous context or we can fetch it.
        // For now, let's try to get from storage or default to a safe value/let backend fallback.
        // Actually, the backend fallback logic seems to efficiently find the first workspace.
        // BUT, if the user has multiple, we need to be specific.
        // Let's assume the frontend should store current workspace ID.

        // Use a hardcoded dev ID if not found, or relied on backend default. 
        // Given the error, backend default MIGHT exist but maybe the user has no workspace or logic failed?
        // Wait, the "You do not have permission" suggests IsWorkspaceMember failed.
        // That middleware *finds* a workspace. If it found one, but user isn't member, then 403.
        // If it didn't find one, request.workspace is None.
        // IsWorkspaceMember: if not workspace -> return True (lines 38-40). 
        // Wait! BasePermission IsWorkspaceMember:
        // if not workspace: return True (line 40)
        // So if NO workspace found, it passes? 
        // Ah, look at perform_create in CredentialViewSet: "Workspace context required".
        // But the error is 403 permission denied.

        // Let's explicitly header it.
        const workspaceId = getItem<string>('current_workspace_id');
        if (workspaceId && config.headers) {
            config.headers['X-Workspace-Id'] = workspaceId;
        }

        return config;
    },
    (error: AxiosError) => {
        return Promise.reject(error);
    }
);

// Variable to track refresh token request to avoid multiple simultaneous refresh calls
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: unknown) => void }> = [];

const processQueue = (error: unknown = null, token: string | null = null) => {
    failedQueue.forEach((promise) => {
        if (error) {
            promise.reject(error);
        } else if (token) {
            promise.resolve(token);
        }
    });
    failedQueue = [];
};

// Response interceptor for error handling, retry logic, and token refresh
apiClient.interceptors.response.use(
    (response: AxiosResponse) => {
        return response;
    },
    async (error: AxiosError) => {
        const originalRequest = error.config as ExtendedAxiosRequestConfig;

        if (!originalRequest) {
            return Promise.reject(error);
        }

        // Handle 401 Unauthorized errors (token refresh)
        if (error.response?.status === 401 && !originalRequest._retry) {
            const refreshToken = getItem<string>(STORAGE_KEYS.REFRESH_TOKEN);

            if (!refreshToken) {
                // No refresh token, clear auth and redirect
                removeItem(STORAGE_KEYS.AUTH_TOKEN);
                removeItem(STORAGE_KEYS.REFRESH_TOKEN);
                removeItem(STORAGE_KEYS.USER);
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
                return Promise.reject(error);
            }

            if (isRefreshing) {
                // Already refreshing, queue this request
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        if (originalRequest.headers) {
                            originalRequest.headers.Authorization = `Bearer ${token}`;
                        }
                        return apiClient(originalRequest);
                    })
                    .catch((err) => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // Attempt to refresh the token
                const response = await axios.post<RefreshTokenResponse>(
                    `${API_BASE_URL}${API_ENDPOINTS.AUTH.REFRESH}`,
                    { refresh: refreshToken }
                );

                const newAccessToken = response.data.access;
                setItem(STORAGE_KEYS.AUTH_TOKEN, newAccessToken);

                // Update the authorization header
                if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                }

                // Process queued requests
                processQueue(null, newAccessToken);
                isRefreshing = false;

                // Retry the original request
                return apiClient(originalRequest);
            } catch (refreshError) {
                // Refresh failed, clear auth and redirect
                processQueue(refreshError, null);
                isRefreshing = false;

                removeItem(STORAGE_KEYS.AUTH_TOKEN);
                removeItem(STORAGE_KEYS.REFRESH_TOKEN);
                removeItem(STORAGE_KEYS.USER);

                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }

                return Promise.reject(refreshError);
            }
        }

        // Handle retry logic for transient errors
        if (shouldRetryRequest(error, originalRequest)) {
            const retryCount = (originalRequest._retryCount || 0) + 1;
            originalRequest._retryCount = retryCount;

            const delay = getRetryDelay(retryCount, RETRY_CONFIG.retryDelay);

            console.warn(`Retrying request (attempt ${retryCount}/${RETRY_CONFIG.maxRetries}): ${originalRequest.url}`);

            await sleep(delay);
            return apiClient(originalRequest);
        }

        // Transform error to ApiError format
        const errorData = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;
        const apiError: ApiError = {
            message: errorData?.message || error.message || 'An error occurred',
            errors: errorData?.errors,
            status: error.response?.status,
        };

        return Promise.reject(apiError);
    }
);

export default apiClient;
export { RETRY_CONFIG };
