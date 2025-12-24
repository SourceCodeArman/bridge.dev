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
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">Hello!</h2>
                        <p className="text-gray-500">Sign Up to Get Started</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="flex justify-between w-full">
                            <div className="space-y-2">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <Input
                                        name="first_name"
                                        type="text"
                                        placeholder="First Name"
                                        value={formData.first_name}
                                        onChange={handleChange}
                                        error={!!fieldErrors.first_name}
                                        disabled={loading}
                                        className="pl-12 h-14 rounded-xl bg-gray-50 border-gray-200"
                                        autoComplete="given-name"
                                    />
                                </div>
                                {fieldErrors.first_name && (
                                    <p className="text-sm text-destructive">{fieldErrors.first_name[0]}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <Input
                                        name="last_name"
                                        type="text"
                                        placeholder="Last Name"
                                        value={formData.last_name}
                                        onChange={handleChange}
                                        error={!!fieldErrors.last_name}
                                        disabled={loading}
                                        className="pl-12 h-14 rounded-xl bg-gray-50 border-gray-200"
                                        autoComplete="family-name"
                                    />
                                </div>
                                {fieldErrors.last_name && (
                                    <p className="text-sm text-destructive">{fieldErrors.last_name[0]}</p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <Input
                                    name="email"
                                    type="email"
                                    placeholder="Email Address"
                                    value={formData.email}
                                    onChange={handleChange}
                                    error={!!fieldErrors.email}
                                    disabled={loading}
                                    className="pl-12 h-14 rounded-xl bg-gray-50 border-gray-200"
                                    autoComplete="email"
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
                                    name="password"
                                    type="password"
                                    placeholder="Password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    error={!!fieldErrors.password}
                                    disabled={loading}
                                    className="pl-12 h-14 rounded-xl bg-gray-50 border-gray-200"
                                    autoComplete="new-password"
                                />
                            </div>
                            {fieldErrors.password && (
                                <p className="text-sm text-destructive">{fieldErrors.password[0]}</p>
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
                                    name="password_confirm"
                                    type="password"
                                    placeholder="Confirm Password"
                                    value={formData.password_confirm}
                                    onChange={handleChange}
                                    error={!!fieldErrors.password_confirm}
                                    disabled={loading}
                                    className="pl-12 h-14 rounded-xl bg-gray-50 border-gray-200"
                                    autoComplete="new-password"
                                />
                            </div>
                            {fieldErrors.password_confirm && (
                                <p className="text-sm text-destructive">{fieldErrors.password_confirm[0]}</p>
                            )}
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-14 rounded-xl text-base font-semibold bg-blue-600 hover:bg-blue-700"
                            loading={loading}
                            disabled={loading}
                        >
                            {loading ? 'Creating account...' : 'Register'}
                        </Button>

                        <div className="text-center text-sm text-gray-600">
                            Already have an account?{' '}
                            <Link to={ROUTES.LOGIN} className="text-blue-600 hover:text-blue-700 font-semibold">
                                Sign In
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
