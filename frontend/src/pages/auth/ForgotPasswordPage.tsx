import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ROUTES } from '@/router/routes';
import { AuthBackground } from '@/components/auth/AuthBackground';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Please enter a valid email address');
            return;
        }

        setLoading(true);

        try {
            // TODO: Implement password reset request API call
            // const response = await authService.requestPasswordReset({ email });

            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 1000));

            setSuccess(true);
        } catch (err) {
            setError('Failed to send reset email. Please try again.');
        } finally {
            setLoading(false);
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
                    {success ? (
                        <div className="text-center space-y-6">
                            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-3xl font-bold text-gray-900">Check your email</h2>
                            <p className="text-gray-500">
                                We've sent a password reset link to <br />
                                <span className="font-medium text-gray-900">{email}</span>
                            </p>
                            <Alert variant="success" className="mx-auto max-w-sm">
                                <AlertDescription>
                                    If an account exists with this email, you will receive a password reset link shortly.
                                </AlertDescription>
                            </Alert>
                            <div className="pt-4 space-y-4">
                                <p className="text-sm text-gray-600">
                                    Didn't receive the email? Check your spam folder or{' '}
                                    <button
                                        onClick={() => setSuccess(false)}
                                        className="text-blue-600 hover:underline font-medium"
                                    >
                                        try again
                                    </button>
                                </p>
                                <Link to={ROUTES.LOGIN}>
                                    <Button variant="outline" className="w-full h-14 rounded-xl">
                                        Back to login
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-3xl font-bold text-gray-900 mb-2">Forgot Password?</h2>
                                <p className="text-gray-500">Enter your email to reset your password</p>
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
                                            id="email"
                                            type="email"
                                            placeholder="Email Address"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            disabled={loading}
                                            className="pl-12 h-14 rounded-xl bg-gray-50 border-gray-200"
                                            autoComplete="email"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full h-14 rounded-xl text-base font-semibold bg-blue-600 hover:bg-blue-700"
                                    loading={loading}
                                    disabled={loading}
                                >
                                    {loading ? 'Sending...' : 'Send Reset Link'}
                                </Button>

                                <div className="text-center">
                                    <Link to={ROUTES.LOGIN} className="text-gray-600 hover:text-blue-600 font-medium flex items-center justify-center gap-2">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                        </svg>
                                        Back to Login
                                    </Link>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
