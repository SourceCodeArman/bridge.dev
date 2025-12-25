import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
    code: string;
    language?: string;
    filename?: string;
    className?: string;
}

export function CodeBlock({
    code,
    language = "typescript",
    filename,
    className,
}: CodeBlockProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div
            className={cn(
                "relative group rounded-lg overflow-hidden border border-border bg-neutral-900",
                className
            )}
        >
            {/* Header with filename and language */}
            <div className="flex items-center justify-between px-4 py-2 bg-neutral-800 border-b border-border">
                <div className="flex items-center gap-2">
                    {filename && (
                        <span className="text-sm text-neutral-400">{filename}</span>
                    )}
                    {!filename && language && (
                        <span className="text-xs text-neutral-500 uppercase">
                            {language}
                        </span>
                    )}
                </div>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
                    title="Copy code"
                >
                    {copied ? (
                        <>
                            <Check className="h-3.5 w-3.5" />
                            Copied!
                        </>
                    ) : (
                        <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy
                        </>
                    )}
                </button>
            </div>

            {/* Code content */}
            <div className="p-4 overflow-x-auto">
                <pre className="text-sm font-mono text-neutral-200 leading-relaxed">
                    <code>{code}</code>
                </pre>
            </div>
        </div>
    );
}
