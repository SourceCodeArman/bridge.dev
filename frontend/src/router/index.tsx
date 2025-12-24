import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { ROUTES } from './routes';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import NotFoundPage from '@/pages/NotFoundPage';

export const router = createBrowserRouter([
    {
        path: ROUTES.HOME,
        element: <Navigate to={ROUTES.DASHBOARD} replace />,
    },
    {
        path: ROUTES.LOGIN,
        element: <LoginPage />,
    },
    {
        path: ROUTES.REGISTER,
        element: <RegisterPage />,
    },
    {
        path: ROUTES.DASHBOARD,
        element: (
            <ProtectedRoute>
                <DashboardPage />
            </ProtectedRoute>
        ),
    },
    {
        path: '*',
        element: <NotFoundPage />,
    },
]);
