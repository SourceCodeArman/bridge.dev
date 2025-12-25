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
        <div className="flex min-h-screen w-full bg-neutral-900">
            {/* Left Column - Branding & Animation */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-neutral-800 overflow-hidden items-center justify-center">
                <div className="absolute inset-0 z-0">
                    <AuthBackground />
                    <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-[1px]" />
                </div>
                <div className="relative z-10 p-12 text-white max-w-lg">
                    <h1 className="text-5xl font-bold mb-6 tracking-tight">Bridge.dev</h1>
                    <p className="text-xl text-neutral-300 leading-relaxed">
                        Recover access to your account and get back to building.
                    </p>
                </div>
            </div>

            {/* Right Column - Form */}
            <div className="flex-1 flex text-white flex-col justify-center px-4 sm:px-12 lg:px-24 bg-neutral-900">
                <div className="w-full max-w-md mx-auto space-y-8">
                    {success ? (
                        <div className="text-center space-y-6">
                            <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-3xl font-bold tracking-tight text-white">Check your email</h2>
                            <p className="text-neutral-400">
                                We've sent a password reset link to <br />
                                <span className="font-medium text-white">{email}</span>
                            </p>
                            <Alert variant="default" className="mx-auto max-w-sm bg-primary/10 border-primary/20 text-primary-foreground">
                                <AlertDescription>
                                    If an account exists with this email, you will receive a password reset link shortly.
                                </AlertDescription>
                            </Alert>
                            <div className="pt-4 space-y-4">
                                <p className="text-sm text-neutral-400">
                                    Didn't receive the email? Check your spam folder or{' '}
                                    <button
                                        onClick={() => setSuccess(false)}
                                        className="text-primary hover:text-primary/80 font-medium transition-colors"
                                    >
                                        try again
                                    </button>
                                </p>
                                <Link to={ROUTES.LOGIN}>
                                    <Button variant="outline" className="w-full h-12 rounded-xl border-neutral-800 text-neutral-300 hover:bg-neutral-900 hover:text-white">
                                        Back to login
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div className="text-center lg:text-left">
                                <h2 className="text-3xl font-bold tracking-tight">Forgot Password?</h2>
                                <p className="mt-2 text-neutral-400">
                                    Enter your email to reset your password
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                {error && (
                                    <Alert variant="destructive" className="bg-red-500/10 border-red-500/50 text-red-200">
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-neutral-300">Email</label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="name@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={loading}
                                        className="h-12 rounded-xl border-neutral-800 focus:border-primary/50 bg-neutral-900 transition-all text-white placeholder:text-neutral-500"
                                        autoComplete="email"
                                        autoFocus
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full h-12 rounded-xl text-base font-semibold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                    disabled={loading}
                                >
                                    {loading ? 'Sending...' : 'Send Reset Link'}
                                </Button>

                                <div className="text-center">
                                    <Link to={ROUTES.LOGIN} className="text-neutral-400 hover:text-white font-medium flex items-center justify-center gap-2 transition-colors">
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
