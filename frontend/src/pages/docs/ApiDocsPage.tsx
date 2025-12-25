import { CodeBlock } from "@/components/docs/CodeBlock";
import { Server, Shield, Activity, Key, AlertCircle } from "lucide-react";
import { ROUTES } from "@/router/routes";
import { DocsPagination } from "@/components/docs/DocsPagination";

// Helper component for HTTP Methods
function MethodBadge({ method }: { method: string }) {
    const colors = {
        GET: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        POST: "bg-green-500/10 text-green-400 border-green-500/20",
        PUT: "bg-orange-500/10 text-orange-400 border-orange-500/20",
        DELETE: "bg-red-500/10 text-red-400 border-red-500/20",
    } as const;

    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${colors[method as keyof typeof colors] || "bg-neutral-800"}`}>
            {method}
        </span>
    );
}

// Endpoint Component
function Endpoint({ method, path, description, title }: { method: string, path: string, description: string, title?: string }) {
    return (
        <div className="group border border-neutral-800 rounded-lg bg-neutral-900/40 overflow-hidden hover:border-neutral-700 transition-colors">
            <div className="flex items-center gap-3 p-3 border-b border-neutral-800/50 bg-neutral-900/80">
                <MethodBadge method={method} />
                <code className="text-sm text-neutral-300 font-mono">{path}</code>
                {title && <span className="ml-auto text-xs text-neutral-500 font-medium">{title}</span>}
            </div>
            <div className="p-3">
                <p className="text-sm text-neutral-400">{description}</p>
            </div>
        </div>
    );
}

export default function ApiDocsPage() {
    return (
        <div className="max-w-7xl mx-auto space-y-16">
            {/* Header */}
            <div className="space-y-6 pb-8 border-b border-neutral-800">
                <div className="flex items-center gap-2 text-sm text-neutral-500 font-mono">
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded">REST API</span>
                    <span className="flex items-center gap-1">
                        v1.0.0
                    </span>
                </div>

                <div className="space-y-4">
                    <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                        API Reference
                    </h1>
                    <p className="text-xl text-neutral-400 max-w-2xl leading-relaxed">
                        Programmatically manage your workspaces, workflows, and runs.
                        All endpoints are prefixed with <code className="text-neutral-200 bg-neutral-800 px-1.5 py-0.5 rounded text-sm">https://api.bridge.dev/api</code>
                    </p>
                </div>
            </div>

            <div className="grid lg:grid-cols-[1fr_280px] gap-12">
                <div className="space-y-16">
                    {/* Authentication */}
                    <section id="auth" className="scroll-mt-24 space-y-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                <Shield className="h-5 w-5" />
                            </div>
                            <h2 className="text-2xl font-semibold text-neutral-200">Authentication</h2>
                        </div>

                        <p className="text-neutral-400">
                            Authenticate requests using a Bearer token in the header.
                            You can obtain a token via the login endpoint or generate a persistent API key in settings.
                        </p>

                        <div className="space-y-4">
                            <h3 className="text-lg font-medium text-neutral-200 mt-6">Login to get Token</h3>
                            <Endpoint method="POST" path="/auth/login" description="Exchange credentials for an access token." />
                            <CodeBlock
                                language="bash"
                                code={`curl -X POST https://api.bridge.dev/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{ "email": "me@example.com", "password": "..." }'`}
                            />
                        </div>
                    </section>

                    {/* Workflows */}
                    <section id="workflows" className="scroll-mt-24 space-y-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                <Server className="h-5 w-5" />
                            </div>
                            <h2 className="text-2xl font-semibold text-neutral-200">Workflows</h2>
                        </div>

                        <div className="grid gap-4">
                            <Endpoint method="GET" path="/workflows" title="List Workflows" description="Retrieve a paginated list of workflows in the workspace." />
                            <Endpoint method="GET" path="/workflows/{id}" title="Get Workflow" description="Retrieve full definition of a single workflow." />
                            <Endpoint method="POST" path="/workflows" title="Create Workflow" description="Create a new workflow with nodes and edges." />
                            <Endpoint method="PUT" path="/workflows/{id}" title="Update Workflow" description="Update a workflow definition." />
                            <Endpoint method="DELETE" path="/workflows/{id}" title="Delete Workflow" description="Permanently delete a workflow." />
                        </div>

                        <div className="mt-6">
                            <h3 className="text-sm font-medium text-neutral-300 mb-2">Example: Create Workflow</h3>
                            <CodeBlock
                                language="bash"
                                code={`curl -X POST https://api.bridge.dev/api/workflows \\
  -H "Authorization: Bearer TOKEN" \\
  -d '{
    "name": "Sync Bot",
    "definition": { ... }
  }'`}
                            />
                        </div>
                    </section>

                    {/* Runs */}
                    <section id="runs" className="scroll-mt-24 space-y-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-green-500/10 text-green-500 border border-green-500/20">
                                <Activity className="h-5 w-5" />
                            </div>
                            <h2 className="text-2xl font-semibold text-neutral-200">Runs</h2>
                        </div>

                        <div className="grid gap-4">
                            <Endpoint method="GET" path="/runs" title="List Runs" description="List execution history with filtering support." />
                            <Endpoint method="GET" path="/runs/{id}" title="Get Run" description="Get details of a specific run." />
                            <Endpoint method="POST" path="/runs/{id}/replay" title="Replay Run" description="Re-execute a run with original inputs." />
                            <Endpoint method="POST" path="/runs/{id}/cancel" title="Cancel Run" description="Stop a running execution." />
                        </div>
                    </section>

                    {/* Credentials */}
                    <section id="credentials" className="scroll-mt-24 space-y-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 border border-purple-500/20">
                                <Key className="h-5 w-5" />
                            </div>
                            <h2 className="text-2xl font-semibold text-neutral-200">Credentials</h2>
                        </div>

                        <div className="grid gap-4">
                            <Endpoint method="GET" path="/credentials" title="List Credentials" description="List stored credentials." />
                            <Endpoint method="POST" path="/credentials" title="Create Credential" description="Securely store new API keys or tokens." />
                            <Endpoint method="DELETE" path="/credentials/{id}" title="Delete Credential" description="Remove a stored credential." />
                        </div>
                    </section>

                    <DocsPagination
                        prev={{
                            label: "Getting Started",
                            href: ROUTES.DOCS_GETTING_STARTED,
                        }}
                        next={{
                            label: "Connectors",
                            href: ROUTES.DOCS_CONNECTORS,
                        }}
                    />
                </div>

                {/* Right Mini Sidebar */}
                <div className="hidden lg:block">
                    <div className="sticky top-32 space-y-8">
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-neutral-200 uppercase tracking-wider">On this page</h3>
                            <nav className="flex flex-col gap-2 text-sm text-neutral-400">
                                <a href="#auth" className="hover:text-primary transition-colors">Authentication</a>
                                <a href="#workflows" className="hover:text-primary transition-colors">Workflows</a>
                                <a href="#runs" className="hover:text-primary transition-colors">Runs</a>
                                <a href="#credentials" className="hover:text-primary transition-colors">Credentials</a>
                            </nav>
                        </div>

                        <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/50">
                            <div className="flex items-center gap-2 mb-2 text-neutral-200 font-medium">
                                <AlertCircle className="h-4 w-4 text-orange-400" />
                                Rate Limits
                            </div>
                            <p className="text-sm text-neutral-500">
                                API requests are capped at <span className="text-neutral-300">1000/hr</span> per user.
                                Monitor <code className="text-xs">X-RateLimit</code> headers.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
