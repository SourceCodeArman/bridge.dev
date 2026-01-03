import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/router/routes";
import { SidebarBody, SidebarLink, useSidebar } from "@/components/ui/sidebar";
import {
    BookOpen,
    Code,
    HelpCircle,
    Plug,
    Rocket,
    Workflow,
    ArrowLeft
} from "lucide-react";

interface DocSection {
    label: string;
    href: string;
    icon: React.ReactNode;
}

const docSections: DocSection[] = [
    {
        label: "Documentation Home",
        href: ROUTES.DOCS,
        icon: <BookOpen className="text-foreground h-5 w-5 shrink-0" />,
    },
    {
        label: "Getting Started",
        href: ROUTES.DOCS_GETTING_STARTED,
        icon: <Rocket className="text-foreground h-5 w-5 shrink-0" />,
    },
    {
        label: "API Reference",
        href: ROUTES.DOCS_API,
        icon: <Code className="text-foreground h-5 w-5 shrink-0" />,
    },
    {
        label: "Connectors",
        href: ROUTES.DOCS_CONNECTORS,
        icon: <Plug className="text-foreground h-5 w-5 shrink-0" />,
    },
    {
        label: "Workflow Examples",
        href: ROUTES.DOCS_WORKFLOWS,
        icon: <Workflow className="text-foreground h-5 w-5 shrink-0" />,
    },
    {
        label: "FAQ",
        href: ROUTES.DOCS_FAQ,
        icon: <HelpCircle className="text-foreground h-5 w-5 shrink-0" />,
    },
];

export function DocsSidebar() {
    const { open, animate } = useSidebar();

    return (
        <SidebarBody className="justify-between gap-10">
            <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
                <div className={cn("flex items-center py-4 overflow-hidden", open ? "justify-start" : "justify-center")}>
                    <h1 className="text-lg font-bold text-primary shrink-0">B</h1>
                    <motion.span
                        animate={{
                            display: animate ? (open ? "inline-block" : "none") : "inline-block",
                            opacity: animate ? (open ? 1 : 0) : 1,
                        }}
                        className="text-lg font-semibold text-foreground whitespace-pre"
                    >
                        ridge Docs
                    </motion.span>
                </div>

                <div className="mt-8 flex flex-col gap-2">
                    {docSections.map((item, idx) => (
                        <SidebarLink key={idx} link={item} />
                    ))}
                </div>
            </div>

            <div className="mt-auto border-t border-border pt-4">
                <SidebarLink
                    link={{
                        label: "Back to App",
                        href: ROUTES.DASHBOARD,
                        icon: <ArrowLeft className="text-foreground h-5 w-5 shrink-0" />
                    }}
                />
            </div>
        </SidebarBody>
    );
}
