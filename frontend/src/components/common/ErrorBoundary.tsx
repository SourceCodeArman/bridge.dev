import { Component, type ErrorInfo, type ReactNode } from 'react';
import { classifyError, generateErrorId, logError, type ClassifiedError } from '@/lib/utils/errorUtils';
import { Button } from '@/components/ui/button';

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorId: string | null;
    classifiedError: ClassifiedError | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public override state: State = {
        hasError: false,
        error: null,
        errorId: null,
        classifiedError: null,
    };

    public static getDerivedStateFromError(error: Error): Partial<State> {
        const errorId = generateErrorId();
        const classifiedError = classifyError(error);

        return {
            hasError: true,
            error,
            errorId,
            classifiedError,
        };
    }

    public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        logError(error, {
            componentStack: errorInfo.componentStack,
            errorId: this.state.errorId,
        });

        this.props.onError?.(error, errorInfo);
    }

    private handleRetry = () => {
        this.setState({
            hasError: false,
            error: null,
            errorId: null,
            classifiedError: null,
        });
    };

    private handleGoHome = () => {
        window.location.href = '/';
    };

    private handleGoBack = () => {
        window.history.back();
    };

    public override render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const { classifiedError, errorId, error } = this.state;
            const isDev = import.meta.env.DEV;

            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-neutral-50">
                    <div className="max-w-md">
                        {/* Error Icon */}
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                            <svg
                                className="h-8 w-8 text-red-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                        </div>

                        <h2 className="text-2xl font-bold text-neutral-900 mb-2">
                            Something went wrong
                        </h2>

                        <p className="text-neutral-600 mb-6">
                            {classifiedError?.message || 'An unexpected error occurred.'}
                        </p>

                        {/* Error ID for support */}
                        {errorId && (
                            <p className="text-xs text-neutral-400 mb-6">
                                Error ID: <code className="bg-neutral-200 px-1.5 py-0.5 rounded">{errorId}</code>
                            </p>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            {classifiedError?.isRetryable && (
                                <Button onClick={this.handleRetry}>
                                    Try Again
                                </Button>
                            )}
                            <Button variant="outline" onClick={this.handleGoBack}>
                                Go Back
                            </Button>
                            <Button variant="ghost" onClick={this.handleGoHome}>
                                Go to Dashboard
                            </Button>
                        </div>

                        {/* Development mode stack trace */}
                        {isDev && error && (
                            <details className="mt-8 text-left">
                                <summary className="cursor-pointer text-sm text-neutral-500 hover:text-neutral-700">
                                    Stack Trace (Development Only)
                                </summary>
                                <pre className="mt-2 p-4 bg-neutral-900 text-neutral-100 rounded-lg text-xs overflow-auto max-h-64">
                                    {error.stack}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
