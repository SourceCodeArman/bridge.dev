import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import DocsLayout from '@/components/layout/DocsLayout';
import { ROUTES } from './routes';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import DocsHomePage from '@/pages/docs/DocsHomePage';
import GettingStartedPage from '@/pages/docs/GettingStartedPage';
import ApiDocsPage from '@/pages/docs/ApiDocsPage';
import ConnectorsDocsPage from '@/pages/docs/ConnectorsDocsPage';
import WorkflowsDocsPage from '@/pages/docs/WorkflowsDocsPage';
import FaqPage from '@/pages/docs/FaqPage';
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
        path: '/forgot-password',
        element: <ForgotPasswordPage />,
    },
    {
        path: '/reset-password',
        element: <ResetPasswordPage />,
    },
    {
        element: (
            <ProtectedRoute>
                <AppLayout />
            </ProtectedRoute>
        ),
        children: [
            {
                path: ROUTES.DASHBOARD,
                element: <DashboardPage />,
            },
        ]
    },
    // Documentation routes (public, no auth required)
    {
        element: <DocsLayout />,
        children: [
            {
                path: ROUTES.DOCS,
                element: <DocsHomePage />,
            },
            {
                path: ROUTES.DOCS_GETTING_STARTED,
                element: <GettingStartedPage />,
            },
            {
                path: ROUTES.DOCS_API,
                element: <ApiDocsPage />,
            },
            {
                path: ROUTES.DOCS_CONNECTORS,
                element: <ConnectorsDocsPage />,
            },
            {
                path: ROUTES.DOCS_WORKFLOWS,
                element: <WorkflowsDocsPage />,
            },
            {
                path: ROUTES.DOCS_FAQ,
                element: <FaqPage />,
            },
        ],
    },
    {
        path: '*',
        element: <NotFoundPage />,
    },
]);

