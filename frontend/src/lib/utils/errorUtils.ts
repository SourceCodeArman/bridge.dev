import type { ApiError } from '@/types';

/**
 * Error types for classification
 */
export type ErrorType =
    | 'network'
    | 'auth'
    | 'validation'
    | 'not_found'
    | 'rate_limit'
    | 'server'
    | 'timeout'
    | 'unknown';

/**
 * Detailed error information with classification
 */
export interface ClassifiedError {
    type: ErrorType;
    message: string;
    originalError: unknown;
    status?: number;
    isRetryable: boolean;
    fieldErrors?: Record<string, string[]>;
}

/**
 * Classify an error based on its properties
 */
export function classifyError(error: unknown): ClassifiedError {
    // Handle ApiError type
    if (isApiError(error)) {
        return classifyApiError(error);
    }

    // Handle native Error
    if (error instanceof Error) {
        // Network errors
        if (error.message.includes('Network Error') || error.message.includes('Failed to fetch')) {
            return {
                type: 'network',
                message: 'Unable to connect to the server. Please check your internet connection.',
                originalError: error,
                isRetryable: true,
            };
        }

        // Timeout errors
        if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
            return {
                type: 'timeout',
                message: 'The request timed out. Please try again.',
                originalError: error,
                isRetryable: true,
            };
        }

        return {
            type: 'unknown',
            message: error.message || 'An unexpected error occurred.',
            originalError: error,
            isRetryable: false,
        };
    }

    // Unknown error type
    return {
        type: 'unknown',
        message: 'An unexpected error occurred.',
        originalError: error,
        isRetryable: false,
    };
}

/**
 * Type guard for ApiError
 */
function isApiError(error: unknown): error is ApiError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as ApiError).message === 'string'
    );
}

/**
 * Classify an ApiError based on status code
 */
function classifyApiError(error: ApiError): ClassifiedError {
    const status = error.status;

    if (!status) {
        return {
            type: 'network',
            message: 'Unable to connect to the server. Please check your internet connection.',
            originalError: error,
            isRetryable: true,
        };
    }

    switch (true) {
        case status === 401:
            return {
                type: 'auth',
                message: 'Your session has expired. Please log in again.',
                originalError: error,
                status,
                isRetryable: false,
            };

        case status === 403:
            return {
                type: 'auth',
                message: 'You do not have permission to perform this action.',
                originalError: error,
                status,
                isRetryable: false,
            };

        case status === 404:
            return {
                type: 'not_found',
                message: error.message || 'The requested resource was not found.',
                originalError: error,
                status,
                isRetryable: false,
            };

        case status === 422 || status === 400:
            return {
                type: 'validation',
                message: error.message || 'Please check your input and try again.',
                originalError: error,
                status,
                isRetryable: false,
                fieldErrors: error.errors,
            };

        case status === 429:
            return {
                type: 'rate_limit',
                message: 'Too many requests. Please wait a moment and try again.',
                originalError: error,
                status,
                isRetryable: true,
            };

        case status >= 500:
            return {
                type: 'server',
                message: 'Something went wrong on our end. Please try again later.',
                originalError: error,
                status,
                isRetryable: true,
            };

        default:
            return {
                type: 'unknown',
                message: error.message || 'An unexpected error occurred.',
                originalError: error,
                status,
                isRetryable: false,
            };
    }
}

/**
 * Get a user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
    const classified = classifyError(error);
    return classified.message;
}

/**
 * Determine if an error is retryable
 */
export function shouldRetry(error: unknown): boolean {
    const classified = classifyError(error);
    return classified.isRetryable;
}

/**
 * Extract field-level errors for form validation
 */
export function getFieldErrors(error: unknown): Record<string, string> {
    const classified = classifyError(error);
    const fieldErrors = classified.fieldErrors || {};

    // Flatten array of errors to single string per field
    return Object.fromEntries(
        Object.entries(fieldErrors).map(([field, errors]) => [
            field,
            errors[0] || 'Invalid value',
        ])
    );
}

/**
 * Log error with context for debugging
 */
export function logError(error: unknown, context?: Record<string, unknown>): void {
    const classified = classifyError(error);

    console.error('Error occurred:', {
        type: classified.type,
        message: classified.message,
        status: classified.status,
        context,
        originalError: classified.originalError,
        timestamp: new Date().toISOString(),
    });
}

/**
 * Generate a unique error ID for tracking
 */
export function generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
