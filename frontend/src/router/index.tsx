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
import WorkflowsPage from '@/pages/workflow/WorkflowsPage';
import WorkflowCanvas from '@/pages/workflow/WorkflowCanvas';
import DocsHomePage from '@/pages/docs/DocsHomePage';
import GettingStartedPage from '@/pages/docs/GettingStartedPage';
import ApiDocsPage from '@/pages/docs/ApiDocsPage';
import ConnectorsDocsPage from '@/pages/docs/ConnectorsDocsPage';
import WorkflowsDocsPage from '@/pages/docs/WorkflowsDocsPage';
import FaqPage from '@/pages/docs/FaqPage';
import NotFoundPage from '@/pages/NotFoundPage';
import TestPage from '@/pages/workflow/TestPage';

export const router = createBrowserRouter([
    {
        path: ROUTES.TEST,
        element: <TestPage />,
    },
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
        path: ROUTES.FORGOT_PASSWORD,
        element: <ForgotPasswordPage />,
    },
    {
        path: ROUTES.RESET_PASSWORD,
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
            {
                path: ROUTES.WORKFLOWS,
                element: <WorkflowsPage />,
            },
            {
                path: ROUTES.WORKFLOWS_CREATE,
                element: <WorkflowCanvas />,
            },
            {
                path: ROUTES.WORKFLOWS_DETAIL,
                element: <WorkflowCanvas />,
            },
            {
                path: ROUTES.WORKFLOWS_EDIT,
                element: <WorkflowCanvas />,
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

