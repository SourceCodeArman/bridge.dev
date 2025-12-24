// API Response Types
export interface ApiResponse<T> {
    data: T;
    message?: string;
    errors?: Record<string, string[]>;
}

export interface ApiError {
    message: string;
    errors?: Record<string, string[]>;
    status?: number;
}

export interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

// Auth Types
export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    access: string;
    refresh: string;
    user: User;
}

export interface RegisterRequest {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
}

export interface RegisterResponse {
    user: User;
    access: string;
    refresh: string;
}

export interface RefreshTokenRequest {
    refresh: string;
}

export interface RefreshTokenResponse {
    access: string;
}

// User Types
export interface User {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    is_active: boolean;
    date_joined: string;
    workspace?: Workspace;
    organization?: Organization;
}

export interface Workspace {
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
}

export interface Organization {
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
}
