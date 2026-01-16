import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw } from 'lucide-react';

interface Tool {
    name: string;
    description?: string;
    inputSchema?: any;
}

interface McpToolNameSelectorProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    required?: boolean;
    error?: string;
    // Shared tools state from parent
    tools?: Tool[];
    loading?: boolean;
    fetchError?: string | null;
    onFetchTools?: () => void;
}

export default function McpToolNameSelector({
    value,
    onChange,
    label = "Tool Name",
    required = false,
    error,
    tools = [],
    loading = false,
    fetchError,
    onFetchTools
}: McpToolNameSelectorProps) {
    const hasFetched = tools.length > 0 || fetchError !== undefined;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Label>
                    {label}
                    {required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {onFetchTools && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onFetchTools}
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
                )}
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
