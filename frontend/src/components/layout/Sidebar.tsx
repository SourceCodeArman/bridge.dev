
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Home, Settings, Inbox, Calendar, Search, Link2, Plug, FileText } from "lucide-react"

// Menu items.
const items = [
    {
        title: "Dashboard",
        url: "/dashboard",
        icon: Home,
    },
    {
        title: "Inbox",
        url: "#",
        icon: Inbox,
    },
    {
        title: "Calendar",
        url: "#",
        icon: Calendar,
    },
    {
        title: "Search",
        url: "#",
        icon: Search,
    },
    {
        title: "Settings",
        url: "#",
        icon: Settings,
    },
]

export function AppSidebar() {
    return (
        <Sidebar collapsible="icon">
            <SidebarContent className="bg-gradient-to-b from-blue-600 to-blue-800 text-white">
                <SidebarGroup>
                    <div className="px-4 py-6 mb-4">
                        <h1 className="text-xl font-bold tracking-tight text-white group-data-[collapsible=icon]:hidden">
                            Bridge.dev
                        </h1>
                        <div className="hidden group-data-[collapsible=icon]:block font-bold text-xl text-white text-center">
                            B
                        </div>
                    </div>

                    <SidebarGroupContent>
                        <SidebarMenu>
                            {/* Dashboard */}
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="Dashboard" className="text-blue-50 hover:bg-white/10 hover:text-white active:bg-white/20 data-[active=true]:bg-white/20 data-[active=true]:text-white">
                                    <a href="/dashboard">
                                        <Home className="text-white opacity-90" />
                                        <span>Dashboard</span>
                                    </a>
                                </SidebarMenuButton>
                            </SidebarMenuItem>

                            {/* Integrations */}
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="Integrations" className="text-blue-50 hover:bg-white/10 hover:text-white active:bg-white/20">
                                    <a href="#">
                                        <Link2 className="text-white opacity-90" />
                                        <span>Integrations</span>
                                    </a>
                                </SidebarMenuButton>
                            </SidebarMenuItem>

                            {/* Connectors */}
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="Connectors" className="text-blue-50 hover:bg-white/10 hover:text-white active:bg-white/20">
                                    <a href="#">
                                        <Plug className="text-white opacity-90" />
                                        <span>Connectors</span>
                                    </a>
                                </SidebarMenuButton>
                            </SidebarMenuItem>

                            {/* Activity Logs */}
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="Activity Logs" className="text-blue-50 hover:bg-white/10 hover:text-white active:bg-white/20">
                                    <a href="#">
                                        <FileText className="text-white opacity-90" />
                                        <span>Activity Logs</span>
                                    </a>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup className="mt-auto">
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="Settings" className="text-blue-50 hover:bg-white/10 hover:text-white active:bg-white/20">
                                    <a href="#">
                                        <Settings className="text-white opacity-90" />
                                        <span>Settings</span>
                                    </a>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    )
}
