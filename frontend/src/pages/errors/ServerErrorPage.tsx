import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function ServerErrorPage() {
    const handleRetry = () => {
        window.location.reload();
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50 p-8">
            <div className="max-w-md text-center">
                {/* Error Icon */}
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
                    <svg
                        className="h-10 w-10 text-red-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                </div>

                <h1 className="text-4xl font-bold text-neutral-900 mb-2">
                    500
                </h1>
                <h2 className="text-xl font-semibold text-neutral-700 mb-4">
                    Server Error
                </h2>

                <p className="text-neutral-600 mb-8">
                    Something went wrong on our end. Our team has been notified and is working to fix the issue.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button onClick={handleRetry}>
                        Try Again
                    </Button>
                    <Button variant="outline" asChild>
                        <Link to="/">
                            Go to Dashboard
                        </Link>
                    </Button>
                </div>

                <p className="mt-8 text-sm text-neutral-500">
                    If the problem persists, please contact{' '}
                    <a
                        href="mailto:support@bridge.dev"
                        className="text-neutral-900 underline hover:no-underline"
                    >
                        support@bridge.dev
                    </a>
                </p>
            </div>
        </div>
    );
}

export default ServerErrorPage;
