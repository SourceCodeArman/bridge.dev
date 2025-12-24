export const generateBreadcrumbs = (pathname: string): { label: string; href: string }[] => {
    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs: { label: string; href: string }[] = [];

    // Always add home/dashboard
    breadcrumbs.push({ label: 'Dashboard', href: '/dashboard' });

    let currentPath = '';
    for (const segment of segments) {
        // Skip dashboard since we already added it
        if (segment === 'dashboard') continue;

        currentPath += `/${segment}`;

        // Convert segment to readable label
        const label = segmentToLabel(segment);
        breadcrumbs.push({ label, href: currentPath });
    }

    return breadcrumbs;
};

const segmentToLabel = (segment: string): string => {
    // Handle UUIDs - just show as "Details"
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
        return 'Details';
    }

    // Convert kebab-case or snake_case to Title Case
    return segment
        .replace(/[-_]/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

// Custom breadcrumb overrides - can be extended as needed
const customLabels: Record<string, string> = {
    '/workflows': 'Workflows',
    '/runs': 'Runs',
    '/templates': 'Templates',
    '/connectors': 'Connectors',
    '/credentials': 'Credentials',
    '/alerts': 'Alerts',
    '/settings': 'Settings',
};

export const getBreadcrumbLabel = (href: string): string => {
    return customLabels[href] || segmentToLabel(href.split('/').pop() || '');
};
