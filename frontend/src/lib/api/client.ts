import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, API_ENDPOINTS } from '@/lib/constants';
import { STORAGE_KEYS, getItem, removeItem, setItem } from '@/lib/utils/storage';
import type { ApiError, RefreshTokenResponse } from '@/types';

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

// Response interceptor for error handling and token refresh
apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Handle 401 Unauthorized errors
        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
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
