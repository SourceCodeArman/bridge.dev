import { useState, type FormEvent, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ROUTES } from '@/router/routes';
import { AuthBackground } from '@/components/auth/AuthBackground';

export default function ResetPasswordPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

    useEffect(() => {
        if (!token) {
            setError('Invalid or missing reset token');
        }
    }, [token]);

    const validatePassword = (password: string): string[] => {
        const errors: string[] = [];
        if (password.length < 8) errors.push('Password must be at least 8 characters');
        if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
        if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
        if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
        return errors;
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setFieldErrors({});

        if (!token) {
            setError('Invalid reset token');
            return;
        }

        // Validation
        const errors: Record<string, string[]> = {};

        if (!password) errors.password = ['Password is required'];
        else {
            const passwordErrors = validatePassword(password);
            if (passwordErrors.length > 0) errors.password = passwordErrors;
        }

        if (!confirmPassword) errors.confirmPassword = ['Please confirm your password'];
        else if (password !== confirmPassword) {
            errors.confirmPassword = ['Passwords do not match'];
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }

        setLoading(true);

        try {
            // TODO: Implement password reset API call
            // const response = await authService.resetPassword({ token, password });

            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 1000));

            setSuccess(true);

            // Redirect to login after 2 seconds
            setTimeout(() => {
                navigate(ROUTES.LOGIN);
            }, 2000);
        } catch {
            setError('Failed to reset password. The link may have expired.');
        } finally {
            setLoading(false);
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
                        Secure your account with a new password.
                    </p>
                </div>
            </div>

            {/* Right Column - Form */}
            <div className="flex-1 flex text-foreground flex-col justify-center px-4 sm:px-12 lg:px-24 bg-background">
                <div className="w-full max-w-md mx-auto space-y-8">
                    {success ? (
                        <div className="text-center space-y-6">
                            <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-3xl font-bold tracking-tight text-foreground">Password Reset Successful</h2>
                            <p className="text-muted-foreground">
                                Your password has been updated. Redirecting you to login...
                            </p>
                            <Alert variant="default" className="mx-auto max-w-sm bg-green-500/10 border-green-500/20 text-green-200">
                                <AlertDescription>
                                    You can now log in with your new password.
                                </AlertDescription>
                            </Alert>
                            <div className="pt-4">
                                <Link to={ROUTES.LOGIN}>
                                    <Button className="w-full h-12 rounded-xl text-base font-semibold bg-primary hover:bg-primary/90 text-foreground">
                                        Continue to Login
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div className="text-center lg:text-left">
                                <h2 className="text-3xl font-bold tracking-tight">Reset Password</h2>
                                <p className="mt-2 text-muted-foreground">
                                    Create a new strong password for your account
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
                                        <label className="text-sm font-medium text-foreground">New Password</label>
                                        <Input
                                            id="password"
                                            type="password"
                                            placeholder="New Password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            error={!!fieldErrors.password}
                                            disabled={loading || !token}
                                            className="h-12 rounded-xl border-border focus:border-primary/50 bg-background transition-all text-foreground placeholder:text-muted-foreground"
                                            autoComplete="new-password"
                                            autoFocus
                                        />
                                        {fieldErrors.password && (
                                            <div className="space-y-1 mt-1">
                                                {fieldErrors.password.map((err, idx) => (
                                                    <p key={idx} className="text-sm text-red-400">{err}</p>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">Confirm New Password</label>
                                        <Input
                                            id="confirmPassword"
                                            type="password"
                                            placeholder="Confirm New Password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            error={!!fieldErrors.confirmPassword}
                                            disabled={loading || !token}
                                            className="h-12 rounded-xl bg-  neutral-950 border-border focus:border-primary/50 focus:bg-background transition-all text-foreground placeholder:text-muted-foreground"
                                            autoComplete="new-password"
                                        />
                                        {fieldErrors.confirmPassword && (
                                            <p className="text-sm text-red-400">{fieldErrors.confirmPassword[0]}</p>
                                        )}
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full h-12 rounded-xl text-base font-semibold bg-primary hover:bg-primary/90 text-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                    disabled={loading || !token}
                                >
                                    {loading ? 'Resetting password...' : 'Reset Password'}
                                </Button>

                                <div className="text-center">
                                    <Link to={ROUTES.LOGIN} className="text-muted-foreground hover:text-foreground font-medium flex items-center justify-center gap-2 transition-colors">
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
