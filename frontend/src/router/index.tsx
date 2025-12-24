import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { ROUTES } from './routes';
import { AppLayout } from '@/components/layout/AppLayout';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import NotFoundPage from '@/pages/NotFoundPage';

export const router = createBrowserRouter([
    // Public routes
    {
        path: ROUTES.LOGIN,
        element: <LoginPage />,
    },
    {
        path: ROUTES.REGISTER,
        element: <RegisterPage />,
    },
    {
        path: '/forgot-password',
        element: <ForgotPasswordPage />,
    },
    {
        path: '/reset-password',
        element: <ResetPasswordPage />,
    },

    // Protected routes with layout
    {
        element: (
            <ProtectedRoute>
                <ErrorBoundary>
                    <AppLayout />
                </ErrorBoundary>
            </ProtectedRoute>
        ),
        children: [
            {
                path: ROUTES.HOME,
                element: <Navigate to={ROUTES.DASHBOARD} replace />,
            },
            {
                path: ROUTES.DASHBOARD,
                element: <DashboardPage />,
            },
            // Future routes will be added here in subsequent tasks
        ],
    },

    // 404 route
    {
        path: '*',
        element: <NotFoundPage />,
    },
]);

