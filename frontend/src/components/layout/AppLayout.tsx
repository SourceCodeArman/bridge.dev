import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/ui/sidebar'; // This acts as the provider
import { AppSidebar } from '@/components/layout/Sidebar';
import { Toaster } from '@/components/ui/toaster';
import { useState } from 'react';

export default function AppLayout() {
    const [open, setOpen] = useState(false);

    return (
        <Sidebar open={open} setOpen={setOpen}>
            <div className="flex h-screen w-full bg-card flex-col md:flex-row overflow-hidden border border-border m-0 text-left">
                <AppSidebar />
                <main className="flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out overflow-y-auto bg-background rounded-l-xl shadow-sm">
                    <div className="flex-1 text-foreground">
                        <Outlet />
                    </div>
                </main>
                <Toaster />
            </div>
        </Sidebar>
    );
}
