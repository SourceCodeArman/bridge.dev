import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authService } from '@/lib/api';
import { STORAGE_KEYS, getItem, setItem, removeItem } from '@/lib/utils/storage';
import type { User, LoginRequest, RegisterRequest, ApiError } from '@/types';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    error: ApiError | null;
    login: (data: LoginRequest) => Promise<void>;
    register: (data: RegisterRequest) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<ApiError | null>(null);

    // Check for existing auth on mount
    useEffect(() => {
        const initAuth = async () => {
            const token = getItem<string>(STORAGE_KEYS.AUTH_TOKEN);
            const savedUser = getItem<User>(STORAGE_KEYS.USER);

            if (token && savedUser) {
                setUser(savedUser);
                // Optionally verify token is still valid
                try {
                    const currentUser = await authService.getCurrentUser();
                    setUser(currentUser);
                    setItem(STORAGE_KEYS.USER, currentUser);
                } catch {
                    // Token invalid, clear auth
                    removeItem(STORAGE_KEYS.AUTH_TOKEN);
                    removeItem(STORAGE_KEYS.REFRESH_TOKEN);
                    removeItem(STORAGE_KEYS.USER);
                    setUser(null);
                }
            }
            setLoading(false);
        };

        initAuth();
    }, []);

    const login = async (data: LoginRequest) => {
        try {
            setLoading(true);
            setError(null);
            const response = await authService.login(data);

            setItem(STORAGE_KEYS.AUTH_TOKEN, response.access);
            setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refresh);
            setItem(STORAGE_KEYS.USER, response.user);
            setUser(response.user);
        } catch (err) {
            const apiError = err as ApiError;
            setError(apiError);
            throw apiError;
        } finally {
            setLoading(false);
        }
    };

    const register = async (data: RegisterRequest) => {
        try {
            setLoading(true);
            setError(null);
            const response = await authService.register(data);

            // Backend returns nested structure: {status, data: {user, tokens}, message}
            const { user, tokens } = response.data;

            setItem(STORAGE_KEYS.AUTH_TOKEN, tokens.access);
            setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh);
            setItem(STORAGE_KEYS.USER, user);
            setUser(user);
        } catch (err) {
            const apiError = err as ApiError;
            setError(apiError);
            throw apiError;
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        authService.logout().catch(console.error);
        removeItem(STORAGE_KEYS.AUTH_TOKEN);
        removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        removeItem(STORAGE_KEYS.USER);
        setUser(null);
        setError(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                error,
                login,
                register,
                logout,
                isAuthenticated: !!user,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
