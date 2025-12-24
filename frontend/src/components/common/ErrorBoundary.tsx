import React, { Component, type ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    override render() {
        if (this.state.hasError && this.state.error) {
            if (this.props.fallback) {
                return this.props.fallback(this.state.error, this.handleReset);
            }

            return (
                <div className="flex min-h-screen items-center justify-center bg-background p-4">
                    <div className="w-full max-w-md space-y-4">
                        <Alert variant="destructive">
                            <h2 className="text-lg font-semibold">Something went wrong</h2>
                            <p className="mt-2 text-sm text-muted-foreground">{this.state.error.message}</p>
                        </Alert>
                        <Button onClick={this.handleReset} className="w-full">
                            Try again
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
