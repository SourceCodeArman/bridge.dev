import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { UserMenu } from '@/components/common/UserMenu';
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs';
import { Bell, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Navbar = () => {
    const breadcrumbs = useBreadcrumbs();

    return (
        <header className="flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-6 backdrop-blur-sm">
            {/* Left side - Breadcrumbs */}
            <div className="flex-1">
                <Breadcrumbs items={breadcrumbs} />
            </div>

            {/* Center - Search (placeholder) */}
            <div className="hidden flex-1 justify-center md:flex">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input
                        type="text"
                        placeholder="Search..."
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 py-2 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                    />
                </div>
            </div>

            {/* Right side - Actions and User Menu */}
            <div className="flex flex-1 items-center justify-end space-x-3">
                {/* Notifications button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative text-zinc-400 hover:text-zinc-100"
                >
                    <Bell className="h-5 w-5" />
                    {/* Notification badge (example) */}
                    <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
                </Button>

                {/* User menu */}
                <UserMenu />
            </div>
        </header>
    );
};
