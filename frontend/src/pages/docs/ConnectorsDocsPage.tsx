import { CodeBlock } from "@/components/docs/CodeBlock";
import { Badge } from "@/components/ui/badge";
import {
    Slack,
    Mail,
    Table,
    Bot,
    BrainCircuit,
    Globe,
    Webhook,
    Database,
    Search,
    Plug,
    type LucideIcon
} from "lucide-react";
import { ROUTES } from "@/router/routes";
import { DocsPagination } from "@/components/docs/DocsPagination";

interface Connector {
    name: string;
    description: string;
    category: string;
    authType: string;
    actions: string[];
    icon: LucideIcon;
    color: string;
}

const connectors: Connector[] = [
    {
        name: "Slack",
        description: "Send messages, create channels, and interact with Slack workspaces.",
        category: "Communication",
        authType: "OAuth",
        actions: ["Send Message", "Create Channel", "Upload File", "Add Reaction"],
        icon: Slack,
        color: "text-purple-400 bg-purple-400/10 border-purple-400/20",
    },
    {
        name: "Gmail",
        description: "Send and read emails directly using the Gmail API integration.",
        category: "Email",
        authType: "OAuth",
        actions: ["Send Email", "Read Emails", "Create Draft", "Add Label"],
        icon: Mail,
        color: "text-red-400 bg-red-400/10 border-red-400/20",
    },
    {
        name: "Google Sheets",
        description: "Read and write data to Google Sheets spreadsheets in real-time.",
        category: "Productivity",
        authType: "OAuth",
        actions: ["Read Sheet", "Write Row", "Update Cell", "Create Sheet"],
        icon: Table,
        color: "text-green-400 bg-green-400/10 border-green-400/20",
    },
    {
        name: "OpenAI",
        description: "Generate text, images, and embeddings with GPT-4 and DALL-E.",
        category: "AI",
        authType: "API Key",
        actions: ["Chat Completion", "Text Completion", "Create Embedding"],
        icon: Bot,
        color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    },
    {
        name: "Anthropic",
        description: "Generate natural language responses with Claude models.",
        category: "AI",
        authType: "API Key",
        actions: ["Chat Completion", "Text Completion"],
        icon: BrainCircuit,
        color: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    },
    {
        name: "HTTP",
        description: "Make custom HTTP requests to any external API endpoint.",
        category: "Utility",
        authType: "Various",
        actions: ["GET", "POST", "PUT", "DELETE"],
        icon: Globe,
        color: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    },
    {
        name: "Webhook",
        description: "Send outbound webhooks or receive inbound events.",
        category: "Utility",
        authType: "None",
        actions: ["Send Webhook"],
        icon: Webhook,
        color: "text-pink-400 bg-pink-400/10 border-pink-400/20",
    },
    {
        name: "Supabase",
        description: "Listen to Postgres database changes and query data instantly.",
        category: "Database",
        authType: "API Key",
        actions: ["Listen Events", "Query Data", "Insert Row", "Update Row"],
        icon: Database,
        color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    },
];

export default function ConnectorsDocsPage() {
    return (
        <div className="max-w-7xl mx-auto space-y-16">
            {/* Header */}
            <div className="space-y-6 pb-8 border-b border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded">Reference</span>
                </div>

                <div className="space-y-4">
                    <h1 className="text-4xl font-bold tracking-tight bg-linear-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                        Connectors
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-3xl leading-relaxed">
                        Integrate Bridge with your favorite tools. Our pre-built connectors handle authentication
                        and schema validation so you can focus on building automation logic.
                    </p>
                </div>
            </div>

            {/* Config Section */}
            <div className="grid md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-8">
                    <section>
                        <h2 className="text-2xl font-semibold text-foreground mb-6">Available Integrations</h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {connectors.map((connector) => {
                                const Icon = connector.icon;
                                return (
                                    <div key={connector.name} className="group flex flex-col p-5 rounded-xl border border-border bg-background/50 hover:bg-background hover:border-border transition-all">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className={`p-2.5 rounded-lg border ${connector.color}`}>
                                                <Icon className="h-6 w-6" />
                                            </div>
                                            <Badge variant="secondary" className="bg-card text-muted-foreground hover:bg-neutral-700">
                                                {connector.category}
                                            </Badge>
                                        </div>

                                        <h3 className="font-semibold text-foreground mb-2">{connector.name}</h3>
                                        <p className="text-sm text-muted-foreground mb-4 flex-1">
                                            {connector.description}
                                        </p>

                                        <div className="space-y-3 pt-4 border-t border-border">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                                                <Plug className="h-3 w-3" />
                                                Auth: {connector.authType}
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {connector.actions.slice(0, 3).map((action) => (
                                                    <span key={action} className="px-1.5 py-0.5 text-[10px] uppercase tracking-wide bg-card text-muted-foreground rounded border border-border">
                                                        {action}
                                                    </span>
                                                ))}
                                                {connector.actions.length > 3 && (
                                                    <span className="px-1.5 py-0.5 text-[10px] bg-card text-muted-foreground rounded border border-border">
                                                        +{connector.actions.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-8">
                    <div className="p-6 rounded-xl border border-border bg-background/50">
                        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                            <Search className="h-4 w-4 text-primary" />
                            How to Configure
                        </h3>
                        <ol className="space-y-4">
                            <li className="flex gap-3">
                                <span className="shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-card text-xs font-mono text-muted-foreground border border-border">1</span>
                                <span className="text-sm text-muted-foreground">Go to <span className="text-foreground">Settings → Credentials</span></span>
                            </li>
                            <li className="flex gap-3">
                                <span className="shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-card text-xs font-mono text-muted-foreground border border-border">2</span>
                                <span className="text-sm text-muted-foreground">Click "Add Credential" and choose your service</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-card text-xs font-mono text-muted-foreground border border-border">3</span>
                                <span className="text-sm text-muted-foreground">Complete the OAuth flow or paste your API Key</span>
                            </li>
                        </ol>
                    </div>

                    <div className="p-6 rounded-xl border border-blue-500/20 bg-blue-500/5">
                        <h3 className="font-semibold text-blue-400 mb-2">Need a custom integration?</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            You can build custom connectors using our HTTP connector or request a new integration.
                        </p>
                        <button className="text-xs bg-blue-500/10 text-blue-400 px-3 py-2 rounded-lg hover:bg-blue-500/20 transition-colors w-full border border-blue-500/20 font-medium">
                            Request Integration
                        </button>
                    </div>
                </div>
            </div>

            <section className="space-y-8 pt-8 border-t border-border">
                <h2 className="text-2xl font-semibold text-foreground">Configuration Examples</h2>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Slack className="h-5 w-5 text-purple-400" />
                            <h3 className="font-medium text-foreground">Slack Message</h3>
                        </div>
                        <CodeBlock
                            language="json"
                            code={`{
  "connector": "slack",
  "action": "send_message",
  "config": {
    "channel": "#general",
    "message": "Hello from Bridge!"
  }
}`}
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Bot className="h-5 w-5 text-emerald-400" />
                            <h3 className="font-medium text-foreground">OpenAI Chat</h3>
                        </div>
                        <CodeBlock
                            language="json"
                            code={`{
  "connector": "openai",
  "action": "chat_completion",
  "config": {
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "{{input}}"}
    ]
  }
}`}
                        />
                    </div>
                </div>
            </section>

            <DocsPagination
                prev={{
                    label: "API Reference",
                    href: ROUTES.DOCS_API,
                }}
                next={{
                    label: "Workflow Examples",
                    href: ROUTES.DOCS_WORKFLOWS,
                }}
            />
        </div >
    );
}
