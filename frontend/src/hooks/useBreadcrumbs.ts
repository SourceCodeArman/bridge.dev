import { useLocation } from 'react-router-dom';
import { generateBreadcrumbs } from '@/lib/utils/breadcrumbs';

export const useBreadcrumbs = () => {
    const location = useLocation();
    return generateBreadcrumbs(location.pathname);
};
