import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw } from 'lucide-react';
import { connectorService } from '@/lib/api/services/connector';
import { Label } from '@/components/ui/label';

interface Tool {
    name: string;
    description?: string;
    inputSchema?: any;
}

interface McpToolNameSelectorProps {
    value: string;
    onChange: (value: string) => void;
    connectorId?: string;
    config: any;
    credentialId?: string;
    label?: string;
    required?: boolean;
    error?: string;
}

export default function McpToolNameSelector({
    value,
    onChange,
    connectorId,
    config,
    credentialId,
    label = "Tool Name",
    required = false,
    error
}: McpToolNameSelectorProps) {
    const [tools, setTools] = useState<Tool[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [hasFetched, setHasFetched] = useState(false);

    const fetchTools = async () => {
        if (!connectorId) return;

        setLoading(true);
        setFetchError(null);

        try {
            const result = await connectorService.executeAction(
                connectorId,
                "list_tools",
                config,
                credentialId
            );

            if (result && result.tools) {
                setTools(result.tools);
                setHasFetched(true);
            } else {
                throw new Error("Invalid response format");
            }
        } catch (err: any) {
            console.error("Failed to fetch tools:", err);
            setFetchError(err.message || "Failed to fetch tools");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Label>
                    {label}
                    {required && <span className="text-destructive ml-1">*</span>}
                </Label>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchTools}
                    disabled={loading}
                    className="h-6 text-xs px-2"
                >
                    {loading ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : (
                        <RefreshCw className="mr-2 h-3 w-3" />
                    )}
                    {hasFetched ? "Refresh" : "Fetch Tools"}
                </Button>
            </div>

            {fetchError && (
                <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                    {fetchError}
                </div>
            )}

            <Select value={value || ''} onValueChange={onChange} disabled={loading || (!hasFetched && !value)}>
                <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder={hasFetched ? "Select a tool..." : "Fetch tools to select"} />
                </SelectTrigger>
                <SelectContent className="bg-background border-border max-h-[300px]">
                    {tools.length === 0 && hasFetched && (
                        <div className="p-2 text-sm text-muted-foreground text-center">No tools found</div>
                    )}
                    {tools.map((tool) => (
                        <SelectItem key={tool.name} value={tool.name}>
                            <div className="flex flex-col items-start">
                                <span className="font-medium">{tool.name}</span>
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}
