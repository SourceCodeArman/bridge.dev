import { useState, useEffect, useRef } from "react";
import { Search, Command } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/router/routes";

interface SearchResult {
    title: string;
    description: string;
    href: string;
    category: string;
}

// Static search index - in a real app, this would be generated from content
const searchIndex: SearchResult[] = [
    {
        title: "Getting Started",
        description: "Learn how to set up your first workflow",
        href: ROUTES.DOCS_GETTING_STARTED,
        category: "Guide",
    },
    {
        title: "Authentication",
        description: "API authentication and tokens",
        href: ROUTES.DOCS_API,
        category: "API",
    },
    {
        title: "Workflows API",
        description: "Create, update, and manage workflows",
        href: ROUTES.DOCS_API,
        category: "API",
    },
    {
        title: "Runs API",
        description: "Execute and monitor workflow runs",
        href: ROUTES.DOCS_API,
        category: "API",
    },
    {
        title: "Slack Connector",
        description: "Send messages to Slack channels",
        href: ROUTES.DOCS_CONNECTORS,
        category: "Connector",
    },
    {
        title: "Gmail Connector",
        description: "Send and read emails with Gmail",
        href: ROUTES.DOCS_CONNECTORS,
        category: "Connector",
    },
    {
        title: "OpenAI Connector",
        description: "Generate text with GPT models",
        href: ROUTES.DOCS_CONNECTORS,
        category: "Connector",
    },
    {
        title: "Webhook Workflow",
        description: "Trigger workflows via webhooks",
        href: ROUTES.DOCS_WORKFLOWS,
        category: "Example",
    },
    {
        title: "Database to Slack",
        description: "Notify Slack on database changes",
        href: ROUTES.DOCS_WORKFLOWS,
        category: "Example",
    },
    {
        title: "What is a workflow?",
        description: "Understanding workflows and automation",
        href: ROUTES.DOCS_FAQ,
        category: "FAQ",
    },
    {
        title: "How do I debug a failed run?",
        description: "Troubleshooting workflow executions",
        href: ROUTES.DOCS_FAQ,
        category: "FAQ",
    },
];

interface DocsSearchProps {
    className?: string;
}

export function DocsSearch({ className }: DocsSearchProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    // Handle keyboard shortcut (Cmd/Ctrl + K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setIsOpen(true);
                setTimeout(() => inputRef.current?.focus(), 0);
            }
            if (e.key === "Escape") {
                setIsOpen(false);
                setQuery("");
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Filter results based on query
    const results = query.length < 2 ? [] : searchIndex.filter(
        (item) =>
            item.title.toLowerCase().includes(query.toLowerCase()) ||
            item.description.toLowerCase().includes(query.toLowerCase())
    );

    const handleSelect = (href: string) => {
        navigate(href);
        setIsOpen(false);
        setQuery("");
    };

    return (
        <div className={cn("relative", className)}>
            {/* Search trigger button */}
            <button
                onClick={() => {
                    setIsOpen(true);
                    setTimeout(() => inputRef.current?.focus(), 0);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground bg-neutral-700/50 border border-neutral-600 rounded-lg hover:bg-neutral-700 transition-colors"
            >
                <Search className="h-4 w-4" />
                <span className="flex-1 text-left">Search docs...</span>
                <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-card border border-neutral-600 rounded text-muted-foreground">
                    <Command className="h-3 w-3" />K
                </kbd>
            </button>

            {/* Search modal overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
                    onClick={() => {
                        setIsOpen(false);
                        setQuery("");
                    }}
                >
                    <div
                        className="fixed left-1/2 top-1/4 -translate-x-1/2 w-full max-w-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
                            {/* Search input */}
                            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                                <Search className="h-5 w-5 text-muted-foreground" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search documentation..."
                                    className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                                />
                                <kbd className="px-1.5 py-0.5 text-xs bg-neutral-700 border border-neutral-600 rounded text-muted-foreground">
                                    ESC
                                </kbd>
                            </div>

                            {/* Results */}
                            <div className="max-h-80 overflow-y-auto">
                                {query.length >= 2 && results.length === 0 && (
                                    <div className="px-4 py-8 text-center text-muted-foreground">
                                        No results found for "{query}"
                                    </div>
                                )}
                                {results.map((result, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleSelect(result.href)}
                                        className="flex items-start gap-3 w-full px-4 py-3 text-left hover:bg-neutral-700/50 transition-colors"
                                    >
                                        <div className="flex-1">
                                            <div className="font-medium text-foreground">
                                                {result.title}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {result.description}
                                            </div>
                                        </div>
                                        <span className="px-2 py-0.5 text-xs bg-neutral-700 rounded-full text-foreground">
                                            {result.category}
                                        </span>
                                    </button>
                                ))}
                                {query.length < 2 && (
                                    <div className="px-4 py-8 text-center text-muted-foreground">
                                        Type at least 2 characters to search
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
