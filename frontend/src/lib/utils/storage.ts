const STORAGE_KEYS = {
    AUTH_TOKEN: 'bridge_auth_token',
    REFRESH_TOKEN: 'bridge_refresh_token',
    USER: 'bridge_user',
} as const;

export function setItem<T>(key: string, value: T): void {
    try {
        const serialized = JSON.stringify(value);
        localStorage.setItem(key, serialized);
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

export function getItem<T>(key: string): T | null {
    try {
        const serialized = localStorage.getItem(key);
        if (serialized === null) return null;
        return JSON.parse(serialized) as T;
    } catch (error) {
        console.error('Error reading from localStorage:', error);
        return null;
    }
}

export function removeItem(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.error('Error removing from localStorage:', error);
    }
}

export function clear(): void {
    try {
        localStorage.clear();
    } catch (error) {
        console.error('Error clearing localStorage:', error);
    }
}

export { STORAGE_KEYS };

/**
 * Decode JWT token and check if it's expired.
 * Returns true if token is expired or invalid.
 */
export function isTokenExpired(token: string | null): boolean {
    if (!token) return true;

    try {
        // JWT format: header.payload.signature
        const parts = token.split('.');
        if (parts.length !== 3) return true;

        // Decode payload (base64url)
        const payload = parts[1]!; // Safe because we checked parts.length === 3
        const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));

        // Check expiry (exp is in seconds, Date.now() is in milliseconds)
        if (!decoded.exp) return true;

        // Add 30 second buffer before actual expiry
        const expiryTime = decoded.exp * 1000;
        return Date.now() >= expiryTime - 30000;
    } catch {
        return true;
    }
}
