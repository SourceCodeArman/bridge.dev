import client from '../client';
import { API_ENDPOINTS } from '@/lib/constants';
import type {
    PaginatedResponse,
    Workspace,
    WorkspaceMember,
    InviteMemberRequest,
    UpdateMemberRoleRequest
} from '@/types';

export const workspaceService = {
    /**
     * List workspaces for current user
     */
    list: async () => {
        const response = await client.get<PaginatedResponse<Workspace>>(API_ENDPOINTS.WORKSPACES.LIST);
        return response.data;
    },

    /**
     * Get a single workspace by ID
     */
    get: async (id: string) => {
        const response = await client.get<Workspace>(API_ENDPOINTS.WORKSPACES.DETAIL(id));
        return response.data;
    },

    /**
     * Get members of a workspace
     */
    getMembers: async (workspaceId: string) => {
        const response = await client.get<WorkspaceMember[]>(
            API_ENDPOINTS.WORKSPACES.MEMBERS(workspaceId)
        );
        return response.data;
    },

    /**
     * Invite a member to workspace
     */
    inviteMember: async (workspaceId: string, data: InviteMemberRequest) => {
        const response = await client.post<WorkspaceMember>(
            API_ENDPOINTS.WORKSPACES.INVITE(workspaceId),
            data
        );
        return response.data;
    },

    /**
     * Remove a member from workspace
     */
    removeMember: async (workspaceId: string, userId: string) => {
        await client.delete(API_ENDPOINTS.WORKSPACES.REMOVE_MEMBER(workspaceId, userId));
    },

    /**
     * Update a member's role
     */
    updateMemberRole: async (workspaceId: string, userId: string, data: UpdateMemberRoleRequest) => {
        const response = await client.patch<WorkspaceMember>(
            API_ENDPOINTS.WORKSPACES.REMOVE_MEMBER(workspaceId, userId),
            data
        );
        return response.data;
    },
};
