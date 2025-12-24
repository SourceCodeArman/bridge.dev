import apiClient from '../client';
import { API_ENDPOINTS } from '@/lib/constants';
import type {
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    User,
} from '@/types';

export const authService = {
    /**
     * Login with email and password
     */
    async login(data: LoginRequest): Promise<LoginResponse> {
        const response = await apiClient.post<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, data);
        return response.data;
    },

    /**
     * Register a new user
     */
    async register(data: RegisterRequest): Promise<RegisterResponse> {
        const response = await apiClient.post<RegisterResponse>(API_ENDPOINTS.AUTH.REGISTER, data);
        return response.data;
    },

    /**
     * Logout the current user
     */
    async logout(): Promise<void> {
        await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
    },

    /**
     * Refresh the access token
     */
    async refreshToken(data: RefreshTokenRequest): Promise<RefreshTokenResponse> {
        const response = await apiClient.post<RefreshTokenResponse>(API_ENDPOINTS.AUTH.REFRESH, data);
        return response.data;
    },

    /**
     * Get current user profile
     */
    async getCurrentUser(): Promise<User> {
        const response = await apiClient.get<User>(API_ENDPOINTS.AUTH.ME);
        return response.data;
    },
};
