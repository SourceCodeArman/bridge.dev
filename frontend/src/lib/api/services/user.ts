import client from '../client';
import { API_ENDPOINTS } from '@/lib/constants';
import type {
    UserProfile,
    UpdateProfileRequest,
    ChangePasswordRequest
} from '@/types';

export const userService = {
    /**
     * Get current user profile
     */
    getProfile: async () => {
        const response = await client.get<UserProfile>(API_ENDPOINTS.USERS.PROFILE);
        return response.data;
    },

    /**
     * Update user profile
     */
    updateProfile: async (data: UpdateProfileRequest) => {
        const response = await client.patch<UserProfile>(API_ENDPOINTS.USERS.UPDATE_PROFILE, data);
        return response.data;
    },

    /**
     * Change password
     */
    changePassword: async (data: ChangePasswordRequest) => {
        const response = await client.post<{ message: string }>(
            API_ENDPOINTS.AUTH.CHANGE_PASSWORD,
            data
        );
        return response.data;
    },

    /**
     * Upload avatar
     */
    uploadAvatar: async (file: File) => {
        const formData = new FormData();
        formData.append('avatar', file);

        const response = await client.post<{ avatar_url: string }>(
            API_ENDPOINTS.USERS.AVATAR,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
        return response.data;
    },

    /**
     * Delete avatar
     */
    deleteAvatar: async () => {
        await client.delete(API_ENDPOINTS.USERS.AVATAR);
    },
};
