import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Workflow,
    PlayCircle,
    LayoutTemplate,
    Plug,
    Key,
    Bell,
    Settings,
} from 'lucide-react';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from "@/components/ui/sidebar";

const navigationItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Workflows', href: '/workflows', icon: Workflow },
    { name: 'Runs', href: '/runs', icon: PlayCircle },
    { name: 'Templates', href: '/templates', icon: LayoutTemplate },
    { name: 'Connectors', href: '/connectors', icon: Plug },
    { name: 'Credentials', href: '/credentials', icon: Key },
    { name: 'Alerts', href: '/alerts', icon: Bell },
    { name: 'Settings', href: '/settings', icon: Settings },
];

export function AppSidebar() {
    const location = useLocation();

    return (
        <Sidebar collapsible="icon" variant="sidebar">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <div>
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
                                    <Workflow className="h-5 w-5 text-white" />
                                </div>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-semibold">Bridge.dev</span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        No-code integration
                                    </span>
                                </div>
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Application</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navigationItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = location.pathname === item.href;
                                return (
                                    <SidebarMenuItem key={item.name}>
                                        <SidebarMenuButton asChild tooltip={item.name} isActive={isActive}>
                                            <NavLink to={item.href}>
                                                <Icon />
                                                <span>{item.name}</span>
                                            </NavLink>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter>
                <div className="text-xs text-muted-foreground px-2">
                    v1.0.0
                </div>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    );
}
