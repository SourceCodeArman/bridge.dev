import { CodeBlock } from "@/components/docs/CodeBlock";
import {
    UserPlus,
    LayoutDashboard,
    Play,
    Plug,
    Terminal,
    CheckCircle2,
    Clock,
    type LucideIcon
} from "lucide-react";
import { ROUTES } from "@/router/routes";
import { DocsPagination } from "@/components/docs/DocsPagination";

// Reusable Step Component
function Step({
    number,
    title,
    icon: Icon,
    children,
    isLast = false
}: {
    number: number;
    title: string;
    icon: LucideIcon;
    children: React.ReactNode;
    isLast?: boolean;
}) {
    return (
        <div className="relative pb-12 last:pb-0">
            {!isLast && (
                <div className="absolute top-12 left-6 -ml-px h-full w-px bg-card" aria-hidden="true" />
            )}
            <div className="relative flex gap-6 group">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-background group-hover:border-border group-hover:bg-card transition-colors">
                    <Icon className="h-6 w-6 text-muted-foreground group-hover:text-foreground" />
                </div>
                <div className="flex-1 pt-1.5">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-card text-xs font-mono text-muted-foreground border border-border">
                            {number}
                        </span>
                        <h2 className="text-xl font-semibold text-foreground m-0 border-none pb-0">
                            {title}
                        </h2>
                    </div>
                    <div className="text-muted-foreground leading-relaxed">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function GettingStartedPage() {
    return (
        <div className="max-w-7xl mx-auto space-y-16">
            {/* Header / Hero */}
            <div className="space-y-6 pb-8 border-b border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded">Guide</span>
                    <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> 5 min read
                    </span>
                </div>

                <div className="space-y-4">
                    <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                        Getting Started with Bridge
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
                        Welcome to Bridge! This guide will walk you through setting up your
                        account and creating your first workflow in just a few minutes.
                    </p>
                </div>
            </div>

            {/* Steps Container */}
            <div className="space-y-2">
                <Step number={1} title="Account Setup" icon={UserPlus}>
                    <p className="mb-4">
                        If you haven't already, create your Bridge account to get started.
                        We keep it simple—you just need a few details:
                    </p>
                    <ul className="grid gap-3 sm:grid-cols-2">
                        {[
                            "Valid email address",
                            "Secure password (8+ chars)",
                            "Workspace name",
                            "Team invites (optional)"
                        ].map((item) => (
                            <li key={item} className="flex items-center gap-2 text-sm text-foreground bg-card/50 p-3 rounded-lg border border-border">
                                <CheckCircle2 className="h-4 w-4 text-green-500/80" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </Step>

                <Step number={2} title="Understanding the Dashboard" icon={LayoutDashboard}>
                    <p className="mb-4">
                        Your dashboard is mission control. It gives you a bird's-eye view of your automation ecosystem.
                    </p>
                    <div className="grid gap-4 md:grid-cols-3 my-6">
                        <div className="bg-background/50 p-4 rounded-xl border border-border hover:border-border transition-colors">
                            <h3 className="text-foreground font-medium mb-2 text-sm uppercase tracking-wider">Stats</h3>
                            <p className="text-sm">Real-time metrics on workflow performance and success rates.</p>
                        </div>
                        <div className="bg-background/50 p-4 rounded-xl border border-border hover:border-border transition-colors">
                            <h3 className="text-foreground font-medium mb-2 text-sm uppercase tracking-wider">Recent Runs</h3>
                            <p className="text-sm">Live feed of your latest automation executions and logs.</p>
                        </div>
                        <div className="bg-background/50 p-4 rounded-xl border border-border hover:border-border transition-colors">
                            <h3 className="text-foreground font-medium mb-2 text-sm uppercase tracking-wider">Quick Actions</h3>
                            <p className="text-sm">One-click shortcuts to build workflows or manage keys.</p>
                        </div>
                    </div>
                </Step>

                <Step number={3} title="Creating Your First Workflow" icon={Play}>
                    <p className="mb-6">
                        Let's build something! A workflow consists of a <strong>Trigger</strong> (what starts it) and <strong>Actions</strong> (what it does).
                    </p>
                    <div className="bg-background rounded-lg border border-border overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-background/50">
                            <div className="flex gap-1.5">
                                <div className="h-2.5 w-2.5 rounded-full bg-red-500/20" />
                                <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/20" />
                                <div className="h-2.5 w-2.5 rounded-full bg-green-500/20" />
                            </div>
                            <span className="text-xs text-muted-foreground font-mono ml-2">Simple Workflow Logic</span>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="h-8 w-8 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold border border-blue-500/30">1</div>
                                <div className="text-sm text-foreground">Click <strong>"Create Workflow"</strong> in the top right</div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="h-8 w-8 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold border border-purple-500/30">2</div>
                                <div className="text-sm text-foreground">Choose a <strong>Trigger</strong> (e.g., Webhook, Schedule)</div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="h-8 w-8 rounded bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-bold border border-orange-500/30">3</div>
                                <div className="text-sm text-foreground">Add an <strong>Action</strong> (e.g., Send Email, Update Database)</div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="h-8 w-8 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold border border-emerald-500/30">4</div>
                                <div className="text-sm text-foreground"><strong>Publish</strong> to go live instantly</div>
                            </div>
                        </div>
                    </div>
                </Step>

                <Step number={4} title="Connecting Integrations" icon={Plug}>
                    <p className="mb-4">
                        Bridge powers up when you connect your favorite tools.
                        Navigate to <span className="text-foreground font-mono text-xs bg-card px-1.5 py-0.5 rounded">Settings → Credentials</span> to add APIs.
                    </p>
                    <p className="text-sm bg-card/30 border border-border p-4 rounded-lg italic">
                        Tip: We support OAuth for major providers like Slack, GitHub, and Google, ensuring secure access without manual token handling.
                    </p>
                </Step>

                <Step number={5} title="Using the API" icon={Terminal} isLast>
                    <p className="mb-4">
                        Every workflow is automatically API-accessible. Trigger your automations programmatically:
                    </p>
                    <CodeBlock
                        language="bash"
                        filename="trigger-workflow.sh"
                        code={`curl -X POST https://api.bridge.dev/webhooks/your-webhook-id \\
  -H "Content-Type: application/json" \\
  -d '{"event": "user.created", "data": {"name": "Alex"}}'`}
                    />
                </Step>
            </div>


            <DocsPagination
                prev={{
                    label: "Introduction",
                    href: ROUTES.DOCS,
                }}
                next={{
                    label: "API Reference",
                    href: ROUTES.DOCS_API,
                }}
            />
        </div >
    );
}
