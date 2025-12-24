
import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ROUTES } from '@/router/routes';
import type { ApiError } from '@/types';
import { AuthBackground } from '@/components/auth/AuthBackground';

export default function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, loading } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setFieldErrors({});

        // Basic validation
        const errors: Record<string, string[]> = {};
        if (!email) errors.email = ['Email is required'];
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = ['Please enter a valid email'];
        if (!password) errors.password = ['Password is required'];

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }

        try {
            await login({ email, password });

            // Redirect to the intended page or dashboard
            const from = (location.state as { from?: { pathname: string } })?.from?.pathname || ROUTES.DASHBOARD;
            navigate(from, { replace: true });
        } catch (err) {
            const apiError = err as ApiError;
            setError(apiError.message || 'Login failed. Please try again.');
            if (apiError.errors) {
                setFieldErrors(apiError.errors);
            }
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Panel - Brand Area */}
            <div className="hidden lg:flex lg:w-2/5 bg-gradient-to-br from-blue-600 to-blue-800 relative overflow-hidden">
                <AuthBackground />
                <div className="relative z-10 flex flex-col justify-center px-16 py-12 text-white">
                    <h1 className="text-4xl font-bold mb-4">Bridge.dev</h1>
                    <p className="text-xl text-blue-100 mb-8">
                        The open-source no-code integration platform
                    </p>
                    <button className="border-2 border-white/30 hover:border-white/60 rounded-lg px-6 py-3 w-fit transition-colors text-white font-medium">
                        Read More
                    </button>
                </div>
            </div>

            {/* Right Panel - Form Area */}
            <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
                <div className="w-full max-w-md">
                    <div className="mb-8">
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">Hello Again!</h2>
                        <p className="text-gray-500">Welcome Back</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <Input
                                    type="email"
                                    placeholder="Email Address"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    error={!!fieldErrors.email}
                                    disabled={loading}
                                    className="pl-12 h-14 rounded-xl bg-gray-50 border-gray-200"
                                    autoComplete="email"
                                    autoFocus
                                />
                            </div>
                            {fieldErrors.email && (
                                <p className="text-sm text-destructive">{fieldErrors.email[0]}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <Input
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    error={!!fieldErrors.password}
                                    disabled={loading}
                                    className="pl-12 h-14 rounded-xl bg-gray-50 border-gray-200"
                                    autoComplete="current-password"
                                />
                            </div>
                            {fieldErrors.password && (
                                <p className="text-sm text-destructive">{fieldErrors.password[0]}</p>
                            )}
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-14 rounded-xl text-base font-semibold bg-blue-600 hover:bg-blue-700"
                            loading={loading}
                            disabled={loading}
                        >
                            {loading ? 'Signing in...' : 'Login'}
                        </Button>

                        <div className="text-center">
                            <Link
                                to="/forgot-password"
                                className="text-gray-600 hover:text-blue-600 text-sm transition-colors"
                            >
                                Forgot Password
                            </Link>
                        </div>

                        <div className="text-center text-sm text-gray-600">
                            Don't have an account?{' '}
                            <Link to={ROUTES.REGISTER} className="text-blue-600 hover:text-blue-700 font-semibold">
                                Sign Up
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}