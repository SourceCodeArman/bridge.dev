import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NetworkErrorPage() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isRetrying, setIsRetrying] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            // Auto-reload when coming back online
            window.location.reload();
        };

        const handleOffline = () => {
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const handleRetry = () => {
        setIsRetrying(true);
        setTimeout(() => {
            window.location.reload();
        }, 500);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-8">
            <div className="max-w-md text-center">
                {/* Network Icon */}
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
                    <svg
                        className="h-10 w-10 text-amber-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3"
                        />
                    </svg>
                </div>

                <h1 className="text-2xl font-bold text-neutral-900 mb-2">
                    Connection Lost
                </h1>

                <p className="text-neutral-600 mb-4">
                    {isOnline
                        ? "We're having trouble connecting to the server."
                        : "You appear to be offline. Please check your internet connection."
                    }
                </p>

                {/* Online Status Indicator */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    <span
                        className={`h-2 w-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'
                            }`}
                    />
                    <span className="text-sm text-muted-foreground">
                        {isOnline ? 'Online' : 'Offline'}
                    </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button onClick={handleRetry} disabled={isRetrying}>
                        {isRetrying ? 'Retrying...' : 'Retry Connection'}
                    </Button>
                    <Button variant="outline" asChild>
                        <Link to="/">
                            Go to Dashboard
                        </Link>
                    </Button>
                </div>

                <p className="mt-8 text-sm text-muted-foreground">
                    This page will automatically reconnect when your connection is restored.
                </p>
            </div>
        </div>
    );
}

export default NetworkErrorPage;
