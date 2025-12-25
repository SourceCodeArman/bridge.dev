import { motion } from "motion/react";
import {
    Calendar,
    Home,
    Inbox,
    Search,
    Settings,
} from "lucide-react"
import { SidebarBody, SidebarLink, useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils";

// Menu items.
const items = [
    {
        label: "Home",
        href: "/dashboard",
        icon: <Home className="text-muted-foreground h-5 w-5 flex-shrink-0" />,
    },
    {
        label: "Workflows",
        href: "/workflows",
        icon: <Inbox className="text-muted-foreground h-5 w-5 flex-shrink-0" />,
    },
    {
        label: "Connectors",
        href: "/connectors",
        icon: <Calendar className="text-muted-foreground h-5 w-5 flex-shrink-0" />,
    },
    {
        label: "Activity",
        href: "/activity",
        icon: <Search className="text-muted-foreground h-5 w-5 flex-shrink-0" />,
    },
    {
        label: "Settings",
        href: "/settings",
        icon: <Settings className="text-muted-foreground h-5 w-5 flex-shrink-0" />,
    },
]

export function AppSidebar() {
    const { open, animate } = useSidebar();
    return (
        <SidebarBody className="justify-between gap-10">
            <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
                <div className={cn("flex items-center py-4 overflow-hidden", open ? "justify-start" : "justify-center")}>
                    <h1 className="text-lg font-bold text-primary flex-shrink-0">B</h1>
                    <motion.span
                        animate={{
                            display: animate ? (open ? "inline-block" : "none") : "inline-block",
                            opacity: animate ? (open ? 1 : 0) : 1,
                        }}
                        className="text-lg font-semibold text-neutral-200 whitespace-pre"
                    >
                        ridge
                    </motion.span>
                </div>
                <div className="mt-8 flex flex-col gap-2">
                    {items.map((item, idx) => (
                        <SidebarLink key={idx} link={item} />
                    ))}
                </div>
            </div>
        </SidebarBody>
    )
}
