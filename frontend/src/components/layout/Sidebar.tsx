import { motion } from "motion/react";
import {
    BookOpen,
    Calendar,
    Home,
    Inbox,
    LayoutTemplate,
    Settings,
    Users,
} from "lucide-react"
import { SidebarBody, SidebarLink, useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils";

// Menu items.
const items = [
    {
        label: "Home",
        href: "/dashboard",
        icon: <Home className="text-foreground h-5 w-5 shrink-0" />,
    },
    {
        label: "Workflows",
        href: "/workflows",
        icon: <Inbox className="text-foreground h-5 w-5 shrink-0" />,
    },
    {
        label: "Connectors",
        href: "/connectors",
        icon: <Calendar className="text-foreground h-5 w-5 shrink-0" />,
    },
    {
        label: "Templates",
        href: "/templates",
        icon: <LayoutTemplate className="text-foreground h-5 w-5 shrink-0" />,
    },
    {
        label: "Docs",
        href: "/docs",
        icon: <BookOpen className="text-foreground h-5 w-5 shrink-0" />,
    },
    {
        label: "Workspace",
        href: "/workspace",
        icon: <Users className="text-foreground h-5 w-5 shrink-0" />,
    },
    {
        label: "Settings",
        href: "/settings",
        icon: <Settings className="text-foreground h-5 w-5 shrink-0" />,
    },
]


export function AppSidebar() {
    const { open, animate } = useSidebar();
    return (
        <SidebarBody className="justify-between gap-10 bg-sidebar">
            <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
                <div className={cn("flex items-end justify-start py-4 overflow-hidden")}>
                    <h1 className="text-2xl font-bold text-primary shrink-0 transform transition duration-150">B</h1>
                    <motion.span
                        animate={{
                            display: animate ? (open ? "inline-block" : "none") : "inline-block",
                            opacity: animate ? (open ? 1 : 0) : 1,
                        }}
                        className="text-2xl font-semibold text-sidebar-foreground group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block p-0! m-0!"
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
