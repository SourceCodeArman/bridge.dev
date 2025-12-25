import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
    const handleGoBack = () => {
        window.history.back();
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50 p-8">
            <div className="max-w-md text-center">
                {/* 404 Illustration */}
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-neutral-200">
                    <svg
                        className="h-10 w-10 text-neutral-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                </div>

                <h1 className="text-6xl font-bold text-neutral-900 mb-2">
                    404
                </h1>
                <h2 className="text-xl font-semibold text-neutral-700 mb-4">
                    Page Not Found
                </h2>

                <p className="text-neutral-600 mb-8">
                    The page you're looking for doesn't exist or has been moved.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button asChild>
                        <Link to="/">
                            Go to Dashboard
                        </Link>
                    </Button>
                    <Button variant="outline" onClick={handleGoBack}>
                        Go Back
                    </Button>
                </div>

                <div className="mt-8 text-sm text-neutral-500">
                    <p>Looking for something specific?</p>
                    <div className="mt-2 flex flex-wrap gap-2 justify-center">
                        <Link
                            to="/workflows"
                            className="text-neutral-900 underline hover:no-underline"
                        >
                            Workflows
                        </Link>
                        <span className="text-neutral-300">•</span>
                        <Link
                            to="/connectors"
                            className="text-neutral-900 underline hover:no-underline"
                        >
                            Connectors
                        </Link>
                        <span className="text-neutral-300">•</span>
                        <Link
                            to="/settings"
                            className="text-neutral-900 underline hover:no-underline"
                        >
                            Settings
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
