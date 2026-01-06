import client from '../client';
import { API_ENDPOINTS } from '@/lib/constants';
import type {
    UserProfile,
    UpdateProfileRequest,
    ChangePasswordRequest
} from '@/types';
import { MOCK_USER_PROFILE } from '@/lib/mockData';

export const userService = {
    /**
     * Get current user profile
     */
    getProfile: async () => {
        await new Promise(resolve => setTimeout(resolve, 400));
        return MOCK_USER_PROFILE;
    },

    /**
     * Update user profile
     */
    updateProfile: async (data: UpdateProfileRequest) => {
        await new Promise(resolve => setTimeout(resolve, 800));
        return {
            ...MOCK_USER_PROFILE,
            ...data,
            updated_at: new Date().toISOString()
        };
    },

    /**
     * Change password
     */
    changePassword: async (data: ChangePasswordRequest) => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { message: "Password updated successfully" };
    },

    /**
     * Upload avatar
     */
    uploadAvatar: async (file: File) => {
        await new Promise(resolve => setTimeout(resolve, 1500));
        return { avatar_url: URL.createObjectURL(file) };
    },

    /**
     * Delete avatar
     */
    deleteAvatar: async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
    },
};
