import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, RefreshCw, Search } from 'lucide-react';
import { useState } from 'react';

interface Tool {
    name: string;
    description?: string;
    inputSchema?: any;
}

interface McpToolSelectorProps {
    value: string[];
    onChange: (value: string[]) => void;
    label?: string;
    required?: boolean;
    error?: string;
    // Shared tools state from parent
    tools?: Tool[];
    loading?: boolean;
    fetchError?: string | null;
    onFetchTools?: () => void;
}

export default function McpToolSelector({
    value = [],
    onChange,
    label = "Tools",
    required = false,
    error,
    tools = [],
    loading = false,
    fetchError,
    onFetchTools
}: McpToolSelectorProps) {
    const [searchQuery, setSearchQuery] = useState('');

    // Initial value might be null/undefined
    const selectedTools = Array.isArray(value) ? value : [];
    const hasFetched = tools.length > 0 || fetchError !== undefined;

    // Filter tools based on search
    const filteredTools = tools.filter(tool =>
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tool.description && tool.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const toggleTool = (toolName: string) => {
        if (selectedTools.includes(toolName)) {
            onChange(selectedTools.filter(t => t !== toolName));
        } else {
            onChange([...selectedTools, toolName]);
        }
    };

    const toggleAll = () => {
        if (selectedTools.length === filteredTools.length) {
            // Deselect all visible
            const visibleNames = filteredTools.map(t => t.name);
            onChange(selectedTools.filter(t => !visibleNames.includes(t)));
        } else {
            // Select all visible
            const visibleNames = filteredTools.map(t => t.name);
            const unique = new Set([...selectedTools, ...visibleNames]);
            onChange(Array.from(unique));
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Label>
                    {label}
                    {required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {onFetchTools && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onFetchTools}
                        disabled={loading}
                        className="h-7 text-xs"
                    >
                        {loading ? (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : (
                            <RefreshCw className="mr-2 h-3 w-3" />
                        )}
                        {hasFetched ? "Refresh Tools" : "Fetch Tools"}
                    </Button>
                )}
            </div>

            {fetchError && (
                <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                    {fetchError}
                </div>
            )}

            {!hasFetched && !loading && !fetchError && (
                <div className="text-sm text-muted-foreground p-4 text-center border rounded-md border-dashed">
                    Click "Fetch Tools" to load available tools from the server.
                </div>
            )}

            {(hasFetched || loading) && (
                <div className="border rounded-md overflow-hidden">
                    <div className="p-2 border-b bg-muted/30 flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search tools..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 h-8 text-xs"
                            />
                        </div>
                        {filteredTools.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={toggleAll} className="h-8 text-xs">
                                {selectedTools.length === filteredTools.length ? "None" : "All"}
                            </Button>
                        )}
                    </div>

                    <ScrollArea className="h-[200px] p-2">
                        {loading ? (
                            <div className="flex flex-col gap-2 p-2">
                                <div className="h-6 w-full bg-muted animate-pulse rounded" />
                                <div className="h-6 w-3/4 bg-muted animate-pulse rounded" />
                                <div className="h-6 w-5/6 bg-muted animate-pulse rounded" />
                            </div>
                        ) : filteredTools.length === 0 ? (
                            <div className="py-8 text-center text-sm text-muted-foreground">
                                {searchQuery ? "No tools found matching search." : "No tools found on server."}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredTools.map(tool => (
                                    <div key={tool.name} className="flex items-start space-x-2 p-2 hover:bg-accent/50 rounded-sm">
                                        <Checkbox
                                            id={`tool-${tool.name}`}
                                            checked={selectedTools.includes(tool.name)}
                                            onCheckedChange={() => toggleTool(tool.name)}
                                            className="mt-1"
                                        />
                                        <div className="grid gap-1.5 leading-none">
                                            <label
                                                htmlFor={`tool-${tool.name}`}
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                            >
                                                {tool.name}
                                            </label>
                                            {tool.description && (
                                                <p className="text-xs text-muted-foreground">
                                                    {tool.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}
