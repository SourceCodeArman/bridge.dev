import { useCallback, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
    classifyError,
    getFieldErrors,
    shouldRetry,
    logError,
    type ClassifiedError
} from '@/lib/utils/errorUtils';

interface UseErrorHandlerOptions {
    /**
     * Whether to show toast notifications automatically
     */
    showToast?: boolean;
    /**
     * Whether to log errors to console
     */
    logErrors?: boolean;
    /**
     * Custom error handler callback
     */
    onError?: (error: ClassifiedError) => void;
}

interface UseErrorHandlerReturn {
    /**
     * Handle an error with appropriate UI feedback
     */
    handleError: (error: unknown, context?: Record<string, unknown>) => ClassifiedError;
    /**
     * Reset the error state
     */
    clearError: () => void;
    /**
     * Current error state
     */
    error: ClassifiedError | null;
    /**
     * Whether an error is currently set
     */
    hasError: boolean;
    /**
     * Get field-level errors for forms
     */
    getFieldError: (fieldName: string) => string | undefined;
    /**
     * All field errors as a map
     */
    fieldErrors: Record<string, string>;
}

/**
 * Custom hook for standardized error handling across components
 */
export function useErrorHandler(options: UseErrorHandlerOptions = {}): UseErrorHandlerReturn {
    const { showToast = true, logErrors = true, onError } = options;
    const { toast } = useToast();
    const [error, setError] = useState<ClassifiedError | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const handleError = useCallback((err: unknown, context?: Record<string, unknown>): ClassifiedError => {
        const classifiedError = classifyError(err);

        // Log the error
        if (logErrors) {
            logError(err, context);
        }

        // Set error state
        setError(classifiedError);

        // Handle field errors for validation
        if (classifiedError.type === 'validation' && classifiedError.fieldErrors) {
            setFieldErrors(getFieldErrors(err));
        } else {
            setFieldErrors({});
        }

        // Show toast notification
        if (showToast) {
            const toastVariant = classifiedError.type === 'auth' || classifiedError.type === 'server'
                ? 'destructive'
                : 'default';

            toast({
                title: getToastTitle(classifiedError.type),
                description: classifiedError.message,
                variant: toastVariant,
            });
        }

        // Call custom handler
        onError?.(classifiedError);

        return classifiedError;
    }, [showToast, logErrors, onError, toast]);

    const clearError = useCallback(() => {
        setError(null);
        setFieldErrors({});
    }, []);

    const getFieldError = useCallback((fieldName: string): string | undefined => {
        return fieldErrors[fieldName];
    }, [fieldErrors]);

    return {
        handleError,
        clearError,
        error,
        hasError: error !== null,
        getFieldError,
        fieldErrors,
    };
}

/**
 * Get appropriate toast title based on error type
 */
function getToastTitle(errorType: ClassifiedError['type']): string {
    switch (errorType) {
        case 'network':
            return 'Connection Error';
        case 'auth':
            return 'Authentication Error';
        case 'validation':
            return 'Validation Error';
        case 'not_found':
            return 'Not Found';
        case 'rate_limit':
            return 'Rate Limited';
        case 'server':
            return 'Server Error';
        case 'timeout':
            return 'Request Timeout';
        default:
            return 'Error';
    }
}

/**
 * Helper hook for retry logic with exponential backoff
 */
export function useRetry(maxRetries: number = 3, baseDelay: number = 1000) {
    const [retryCount, setRetryCount] = useState(0);
    const [isRetrying, setIsRetrying] = useState(false);

    const retry = useCallback(async <T>(
        fn: () => Promise<T>,
        onError?: (error: unknown, attempt: number) => void
    ): Promise<T> => {
        setIsRetrying(true);
        let lastError: unknown;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                setRetryCount(attempt);
                const result = await fn();
                setIsRetrying(false);
                setRetryCount(0);
                return result;
            } catch (error) {
                lastError = error;
                onError?.(error, attempt);

                if (attempt < maxRetries && shouldRetry(error)) {
                    const delay = baseDelay * Math.pow(2, attempt);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        setIsRetrying(false);
        throw lastError;
    }, [maxRetries, baseDelay]);

    const reset = useCallback(() => {
        setRetryCount(0);
        setIsRetrying(false);
    }, []);

    return {
        retry,
        retryCount,
        isRetrying,
        reset,
    };
}
