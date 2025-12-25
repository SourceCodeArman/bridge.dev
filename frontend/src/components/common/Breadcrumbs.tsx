import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export function Breadcrumbs() {
    const location = useLocation();
    const pathnames = location.pathname.split('/').filter((x) => x);

    // Don't show breadcrumbs on dashboard home
    if (pathnames.length === 0 || (pathnames.length === 1 && pathnames[0] === 'dashboard')) {
        return null;
    }

    return (
        <nav className="flex items-center space-x-1 text-sm text-neutral-400">
            <Link
                to="/dashboard"
                className="flex items-center hover:text-neutral-200 transition-colors"
            >
                <Home className="h-4 w-4" />
            </Link>
            {pathnames.map((value, index) => {
                const to = `/${pathnames.slice(0, index + 1).join('/')}`;
                const isLast = index === pathnames.length - 1;

                return (
                    <div key={to} className="flex items-center">
                        <ChevronRight className="h-4 w-4 mx-1" />
                        {isLast ? (
                            <span className="font-medium text-neutral-200 capitalize">
                                {value.replace(/-/g, ' ')}
                            </span>
                        ) : (
                            <Link
                                to={to}
                                className="hover:text-neutral-200 transition-colors capitalize"
                            >
                                {value.replace(/-/g, ' ')}
                            </Link>
                        )}
                    </div>
                );
            })}
        </nav>
    );
}
