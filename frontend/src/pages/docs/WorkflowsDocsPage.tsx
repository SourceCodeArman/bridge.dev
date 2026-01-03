import { CodeBlock } from "@/components/docs/CodeBlock";
import { Badge } from "@/components/ui/badge";
import {
    Clock,
    Database,
    MessageSquare,
    Bot,
    Calendar,
    CheckCircle2,
    type LucideIcon
} from "lucide-react";
import { ROUTES } from "@/router/routes";
import { DocsPagination } from "@/components/docs/DocsPagination";

interface WorkflowExample {
    title: string;
    description: string;
    difficulty: "Beginner" | "Intermediate" | "Advanced";
    tags: string[];
    icon: LucideIcon;
    color: string;
}

const examples: WorkflowExample[] = [
    {
        title: "Webhook to Slack Notification",
        description: "Receive a webhook event and instantly pipe formatted data to a Slack channel.",
        difficulty: "Beginner",
        tags: ["Webhook", "Slack"],
        icon: MessageSquare,
        color: "text-purple-400 bg-purple-400/10 border-purple-400/20"
    },
    {
        title: "Database Change Alert",
        description: "Monitor Supabase for new user records and send a welcome email via Gmail.",
        difficulty: "Intermediate",
        tags: ["Supabase", "Gmail"],
        icon: Database,
        color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
    },
    {
        title: "AI Support Router",
        description: "Use GPT-4 to analyze ticket sentiment and route urgency to the right team.",
        difficulty: "Advanced",
        tags: ["OpenAI", "Slack", "HTTP"],
        icon: Bot,
        color: "text-blue-400 bg-blue-400/10 border-blue-400/20"
    },
    {
        title: "Scheduled Data Sync",
        description: "Fetch data from an external API every hour and upsert into Google Sheets.",
        difficulty: "Intermediate",
        tags: ["HTTP", "Google Sheets", "Cron"],
        icon: Calendar,
        color: "text-orange-400 bg-orange-400/10 border-orange-400/20"
    },
];

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
    return (
        <div className="relative pb-10 last:pb-0">
            <div className="absolute top-8 left-4 -ml-px h-full w-px bg-card last:hidden" />
            <div className="flex gap-4">
                <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-card border border-border text-sm font-bold text-foreground">
                    {number}
                </div>
                <div className="flex-1 pt-1">
                    <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
                    <div className="text-muted-foreground space-y-3">{children}</div>
                </div>
            </div>
        </div>
    );
}

export default function WorkflowsDocsPage() {
    return (
        <div className="max-w-7xl mx-auto space-y-16">
            {/* Header */}
            <div className="space-y-6 pb-8 border-b border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded">Tutorials</span>
                    <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> 10 min read
                    </span>
                </div>

                <div className="space-y-4">
                    <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                        Workflow Examples
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-3xl leading-relaxed">
                        Learn by doing. Explore these common patterns to understand how to build
                        powerful automations with Bridge.
                    </p>
                </div>
            </div>

            {/* Examples Grid */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold text-foreground">Featured Templates</h2>
                <div className="grid md:grid-cols-2 gap-4">
                    {examples.map((example) => {
                        const Icon = example.icon;
                        return (
                            <div key={example.title} className="group p-6 rounded-xl border border-border bg-background/50 hover:bg-background hover:border-border transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-2 rounded-lg border ${example.color}`}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <Badge variant="outline" className={`
                                        ${example.difficulty === 'Beginner' ? 'text-green-400 border-green-400/20 bg-green-400/10' : ''}
                                        ${example.difficulty === 'Intermediate' ? 'text-yellow-400 border-yellow-400/20 bg-yellow-400/10' : ''}
                                        ${example.difficulty === 'Advanced' ? 'text-red-400 border-red-400/20 bg-red-400/10' : ''}
                                    `}>
                                        {example.difficulty}
                                    </Badge>
                                </div>
                                <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-foreground transition-colors">
                                    {example.title}
                                </h3>
                                <p className="text-sm text-muted-foreground mb-4 h-10">
                                    {example.description}
                                </p>
                                <div className="flex gap-2">
                                    {example.tags.map(tag => (
                                        <span key={tag} className="text-[10px] px-2 py-1 rounded bg-neutral-950 border border-border text-muted-foreground font-mono">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </section>

            {/* Tutorial Section */}
            <section className="space-y-8 pt-12 border-t border-border">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold text-foreground">Deep Dive: Webhook to Slack</h2>
                    <Badge variant="secondary" className="bg-card text-muted-foreground">10 min build</Badge>
                </div>

                <div className="bg-background/30 p-8 rounded-2xl border border-border">
                    <Step number={1} title="Create the Workflow">
                        <p>
                            Start by creating a new workflow and adding a <span className="text-foreground font-mono bg-card px-1 rounded">Webhook Trigger</span> node.
                            This will generate a unique URL that you can send data to.
                        </p>
                    </Step>

                    <Step number={2} title="Add Slack Action">
                        <p>
                            Search for "Slack" in the node library and add a <span className="text-foreground font-medium">Send Message</span> action.
                            Connect the trigger's output to the Slack action's input.
                        </p>
                    </Step>

                    <Step number={3} title="Configure Message Payload">
                        <p>
                            Map the incoming data to the message body. Use template syntax to reference webhook fields dynamically:
                        </p>
                        <div className="mt-4">
                            <CodeBlock
                                language="handlebars"
                                code={`Alert! New User Signed Up:
Name: {{trigger.body.name}}
Email: {{trigger.body.email}}`}
                            />
                        </div>
                    </Step>

                    <Step number={4} title="Test & Deploy">
                        <p>
                            Use the <span className="text-foreground font-medium">Test Run</span> button to simulate a webhook event.
                            If successful, click <strong>Publish</strong> to go live.
                        </p>
                    </Step>
                </div>
            </section>

            {/* Advanced Tutorial */}
            <section className="space-y-8 pt-12 border-t border-border">
                <h2 className="text-2xl font-semibold text-foreground">Blueprint: AI Ticket Router</h2>
                <div className="grid lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <p className="text-muted-foreground leading-relaxed">
                            This advanced workflow demonstrates how to chain AI reasoning with logic.
                            It takes raw support emails, classifies them using an LLM, and dispatches them to specific Slack channels.
                        </p>
                        <ul className="space-y-2">
                            <li className="flex items-center gap-2 text-sm text-foreground">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span>Zero-code classification logic</span>
                            </li>
                            <li className="flex items-center gap-2 text-sm text-foreground">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span>Dynamic routing based on AI output</span>
                            </li>
                        </ul>
                    </div>

                    <CodeBlock
                        language="json"
                        code={`{
  "nodes": [
    { "id": "trigger", "type": "webhook" },
    { 
      "id": "ai_classifier",
      "type": "openai",
      "config": {
        "prompt": "Classify: {{trigger.body.text}}"
      }
    },
    {
      "id": "router",
      "type": "switch",
      "config": {
        "cases": {
            "billing": "channel_billing",
            "tech": "channel_tech"
        }
      }
    }
  ]
}`}
                    />
                </div>
            </section>

            <DocsPagination
                prev={{
                    label: "Connectors",
                    href: ROUTES.DOCS_CONNECTORS,
                }}
                next={{
                    label: "FAQ",
                    href: ROUTES.DOCS_FAQ,
                }}
            />
        </div>
    );
}
