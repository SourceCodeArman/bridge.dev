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
        <div className="flex min-h-screen w-full bg-background">
            {/* Left Column - Branding & Animation */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-card overflow-hidden items-center justify-center">
                <div className="absolute inset-0 z-0">
                    <AuthBackground />
                    <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px]" />
                </div>
                <div className="relative z-10 p-12 text-foreground max-w-lg">
                    <h1 className="text-5xl font-bold mb-6 tracking-tight">Bridge.dev</h1>
                    <p className="text-xl text-foreground leading-relaxed">
                        The open-source no-code integration platform.
                        Connect your apps, automate your workflows, and build faster.
                    </p>
                </div>
            </div>

            {/* Right Column - Form */}
            <div className="flex-1 flex text-foreground flex-col justify-center px-4 sm:px-12 lg:px-24 bg-background">
                <div className="w-full max-w-md mx-auto space-y-8">
                    <div className="text-center lg:text-left">
                        <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
                        <p className="mt-2 text-muted-foreground">
                            Sign in to your account to continue
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <Alert variant="destructive" className="bg-red-500/10 border-red-500/50 text-red-200">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Email</label>
                                <Input
                                    type="email"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    error={!!fieldErrors.email}
                                    disabled={loading}
                                    className="h-12 rounded-xl border-border focus:border-primary/50 bg-background transition-all text-foreground placeholder:text-muted-foreground"
                                    autoComplete="email"
                                    autoFocus
                                />
                                {fieldErrors.email && (
                                    <p className="text-sm text-red-400">{fieldErrors.email[0]}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-medium text-foreground">Password</label>
                                    <Link
                                        to="/forgot-password"
                                        className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                                <Input
                                    type="password"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    error={!!fieldErrors.password}
                                    disabled={loading}
                                    className="h-12 rounded-xl border-border focus:border-primary/50 bg-background transition-all text-foreground placeholder:text-muted-foreground"
                                    autoComplete="current-password"
                                />
                                {fieldErrors.password && (
                                    <p className="text-sm text-red-400">{fieldErrors.password[0]}</p>
                                )}
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12 rounded-xl text-base font-semibold bg-primary hover:bg-primary/90 text-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            disabled={loading}
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </Button>

                        <div className="text-center text-sm text-muted-foreground">
                            Don't have an account?{' '}
                            <Link to={ROUTES.REGISTER} className="text-primary hover:text-primary/80 font-medium transition-colors">
                                Create account
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}