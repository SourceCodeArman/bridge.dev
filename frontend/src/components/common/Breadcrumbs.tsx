import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
    label: string;
    href: string;
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[];
}

export const Breadcrumbs = ({ items }: BreadcrumbsProps) => {
    if (items.length === 0) return null;

    return (
        <nav className="flex items-center space-x-2 text-sm text-zinc-400">
            {items.map((item, index) => (
                <div key={item.href} className="flex items-center">
                    {index > 0 && <ChevronRight className="mx-2 h-4 w-4" />}
                    {index === items.length - 1 ? (
                        <span className="font-medium text-zinc-100">{item.label}</span>
                    ) : (
                        <Link
                            to={item.href}
                            className="transition-colors hover:text-zinc-100"
                        >
                            {item.label}
                        </Link>
                    )}
                </div>
            ))}
        </nav>
    );
};
