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
        } catch (err) {
            setError('Failed to reset password. The link may have expired.');
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
                            <h2 className="text-3xl font-bold text-gray-900">Password Reset Successful</h2>
                            <p className="text-gray-500">
                                Your password has been updated. Redirecting you to login...
                            </p>
                            <Alert variant="success" className="mx-auto max-w-sm">
                                <AlertDescription>
                                    You can now log in with your new password.
                                </AlertDescription>
                            </Alert>
                            <div className="pt-4">
                                <Link to={ROUTES.LOGIN}>
                                    <Button className="w-full h-14 rounded-xl text-base font-semibold bg-blue-600 hover:bg-blue-700">
                                        Continue to Login
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-3xl font-bold text-gray-900 mb-2">Reset Password</h2>
                                <p className="text-gray-500">Create a new strong password for your account</p>
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
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                            </svg>
                                        </div>
                                        <Input
                                            id="password"
                                            type="password"
                                            placeholder="New Password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            error={!!fieldErrors.password}
                                            disabled={loading || !token}
                                            className="pl-12 h-14 rounded-xl bg-gray-50 border-gray-200"
                                            autoComplete="new-password"
                                            autoFocus
                                        />
                                    </div>
                                    {fieldErrors.password && (
                                        <div className="space-y-1">
                                            {fieldErrors.password.map((err, idx) => (
                                                <p key={idx} className="text-sm text-destructive">{err}</p>
                                            ))}
                                        </div>
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
                                            id="confirmPassword"
                                            type="password"
                                            placeholder="Confirm New Password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            error={!!fieldErrors.confirmPassword}
                                            disabled={loading || !token}
                                            className="pl-12 h-14 rounded-xl bg-gray-50 border-gray-200"
                                            autoComplete="new-password"
                                        />
                                    </div>
                                    {fieldErrors.confirmPassword && (
                                        <p className="text-sm text-destructive">{fieldErrors.confirmPassword[0]}</p>
                                    )}
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full h-14 rounded-xl text-base font-semibold bg-blue-600 hover:bg-blue-700"
                                    loading={loading}
                                    disabled={loading || !token}
                                >
                                    {loading ? 'Resetting password...' : 'Reset Password'}
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
