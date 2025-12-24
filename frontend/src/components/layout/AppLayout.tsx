import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { AppSidebar } from './Sidebar';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { UserMenu } from '@/components/common/UserMenu';
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs';
import { Bell, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Footer } from './Footer';

export const AppLayout = () => {
    const breadcrumbs = useBreadcrumbs();

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                {/* Header/Navbar */}
                <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                        <SidebarTrigger className="-ml-1" />
                        <Separator orientation="vertical" className="mr-2 h-4" />
                        <Breadcrumbs items={breadcrumbs} />
                    </div>

                    {/* Center - Search (placeholder) */}
                    <div className="ml-auto flex items-center gap-2">
                        <div className="relative hidden md:block">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="w-64 rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                        </div>

                        {/* Notifications button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="relative text-muted-foreground hover:text-foreground"
                        >
                            <Bell className="h-5 w-5" />
                            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
                        </Button>

                        {/* User menu */}
                        <UserMenu />
                    </div>
                </header>

                {/* Main content */}
                <main className="flex flex-1 flex-col gap-4 p-4 pt-0">
                    <div className="flex-1 rounded-xl bg-card p-6 shadow-sm border border-border">
                        <Outlet />
                    </div>
                </main>

                {/* Footer */}
                <Footer />
            </SidebarInset>
        </SidebarProvider>
    );
};
