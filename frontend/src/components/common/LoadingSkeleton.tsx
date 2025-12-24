interface SkeletonProps {
    className?: string;
}

const Skeleton = ({ className = '' }: SkeletonProps) => (
    <div
        className={`animate-pulse rounded-md bg-muted/50 ${className}`}
        style={{
            backgroundImage: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.05), transparent)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
        }}
    />
);

export const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
    <div className="space-y-3">
        <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-full" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-12 w-full" />
            </div>
        ))}
    </div>
);

export const CardSkeleton = ({ cards = 3 }: { cards?: number }) => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-lg border border-border bg-card p-6">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-32 w-full" />
            </div>
        ))}
    </div>
);

export const PageSkeleton = () => (
    <div className="flex h-screen bg-background">
        {/* Sidebar skeleton */}
        <div className="w-64 border-r border-border bg-muted/20 p-4">
            <Skeleton className="mb-6 h-8 w-32" />
            <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                ))}
            </div>
        </div>

        {/* Main content skeleton */}
        <div className="flex-1 p-8">
            <Skeleton className="mb-6 h-10 w-64" />
            <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
            </div>
        </div>
    </div>
);

export const FormSkeleton = ({ fields = 4 }: { fields?: number }) => (
    <div className="space-y-6">
        {Array.from({ length: fields }).map((_, i) => (
            <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
            </div>
        ))}
        <Skeleton className="h-10 w-32" />
    </div>
);

// Add shimmer keyframes to global styles if not already present
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `;
    document.head.appendChild(style);
}
