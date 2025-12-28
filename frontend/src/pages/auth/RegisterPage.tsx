import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ROUTES } from '@/router/routes';
import type { ApiError } from '@/types';
import { AuthBackground } from '@/components/auth/AuthBackground';

export default function RegisterPage() {
    const navigate = useNavigate();
    const { register, loading } = useAuth();

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        password_confirm: '',
        first_name: '',
        last_name: '',
    });
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setFieldErrors({});

        // Validation
        const errors: Record<string, string[]> = {};
        if (!formData.email) errors.email = ['Email is required'];
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = ['Please enter a valid email'];

        if (!formData.first_name) errors.first_name = ['First name is required'];
        if (!formData.last_name) errors.last_name = ['Last name is required'];

        if (!formData.password) errors.password = ['Password is required'];
        else if (formData.password.length < 8) errors.password = ['Password must be at least 8 characters'];

        if (!formData.password_confirm) errors.password_confirm = ['Please confirm your password'];
        else if (formData.password !== formData.password_confirm) errors.password_confirm = ['Passwords do not match'];

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }

        try {
            await register({
                email: formData.email,
                password: formData.password,
                password_confirm: formData.password_confirm,
                first_name: formData.first_name,
                last_name: formData.last_name,
            });

            // Redirect to dashboard after successful registration
            navigate(ROUTES.DASHBOARD, { replace: true });
        } catch (err) {
            const apiError = err as ApiError;
            setError(apiError.message || 'Registration failed. Please try again.');
            if (apiError.errors) {
                setFieldErrors(apiError.errors);
            }
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
                    <h1 className="text-4xl font-bold mb-6 tracking-tight">Join Bridge.dev</h1>
                    <p className="text-xl text-neutral-300 leading-relaxed">
                        Start building powerful integrations today.
                        No coding required.
                    </p>
                </div>
            </div>

            {/* Right Column - Form */}
            <div className="flex-1 flex text-white flex-col justify-center px-4 sm:px-12 lg:px-24 bg-neutral-900">
                <div className="w-full max-w-md mx-auto space-y-8">
                    <div className="text-center lg:text-left">
                        <h2 className="text-3xl font-bold tracking-tight">Create an account</h2>
                        <p className="mt-2 text-neutral-400">
                            Enter your details to get started
                        </p>
                    </div>

                    <div className="flex justify-center">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                const randomId = Math.floor(Math.random() * 10000);
                                setFormData({
                                    first_name: 'Tester',
                                    last_name: `User${randomId}`,
                                    email: `tester_${randomId}@example.com`,
                                    password: 'Password123!',
                                    password_confirm: 'Password123!',
                                });
                            }}
                            className="text-xs border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-800"
                        >
                            Fill Test Data
                        </Button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <Alert variant="destructive" className="bg-red-500/10 border-red-500/50 text-red-200">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-300">First Name</label>
                                <Input
                                    placeholder="John"
                                    name="first_name"
                                    value={formData.first_name}
                                    onChange={handleChange}
                                    error={!!fieldErrors.first_name}
                                    disabled={loading}
                                    className="h-12 rounded-xl border-neutral-800 focus:border-primary/50 bg-neutral-900 transition-all text-white placeholder:text-neutral-500"
                                    autoComplete="given-name"
                                />
                                {fieldErrors.first_name && (
                                    <p className="text-sm text-red-400">{fieldErrors.first_name[0]}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-300">Last Name</label>
                                <Input
                                    placeholder="Doe"
                                    name="last_name"
                                    value={formData.last_name}
                                    onChange={handleChange}
                                    error={!!fieldErrors.last_name}
                                    disabled={loading}
                                    className="h-12 rounded-xl border-neutral-800 focus:border-primary/50 bg-neutral-900 transition-all text-white placeholder:text-neutral-500"
                                    autoComplete="family-name"
                                />
                                {fieldErrors.last_name && (
                                    <p className="text-sm text-red-400">{fieldErrors.last_name[0]}</p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Email</label>
                            <Input
                                type="email"
                                placeholder="name@example.com"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                error={!!fieldErrors.email}
                                disabled={loading}
                                className="h-12 rounded-xl border-neutral-800 focus:border-primary/50 bg-neutral-900 transition-all text-white placeholder:text-neutral-500"
                                autoComplete="email"
                            />
                            {fieldErrors.email && (
                                <p className="text-sm text-red-400">{fieldErrors.email[0]}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Password</label>
                            <Input
                                type="password"
                                placeholder="Create a password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                error={!!fieldErrors.password}
                                disabled={loading}
                                className="h-12 rounded-xl border-neutral-800 focus:border-primary/50 bg-neutral-900 transition-all text-white placeholder:text-neutral-500"
                                autoComplete="new-password"
                            />
                            {fieldErrors.password && (
                                <p className="text-sm text-red-400">{fieldErrors.password[0]}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300">Confirm Password</label>
                            <Input
                                type="password"
                                placeholder="Confirm your password"
                                name="password_confirm"
                                value={formData.password_confirm}
                                onChange={handleChange}
                                error={!!fieldErrors.password_confirm}
                                disabled={loading}
                                className="h-12 rounded-xl border-neutral-800 focus:border-primary/50 bg-neutral-900 transition-all text-white placeholder:text-neutral-500"
                                autoComplete="new-password"
                            />
                            {fieldErrors.password_confirm && (
                                <p className="text-sm text-red-400">{fieldErrors.password_confirm[0]}</p>
                            )}
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12 rounded-xl text-base font-semibold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            disabled={loading}
                        >
                            {loading ? 'Creating account...' : 'Create Account'}
                        </Button>

                        <div className="text-center text-sm text-neutral-400">
                            Already have an account?{' '}
                            <Link to={ROUTES.LOGIN} className="text-primary hover:text-primary/80 font-medium transition-colors">
                                Sign In
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
