import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

interface HeaderBuilderProps {
    value: string | any[];
    onChange: (value: string | any[]) => void;
    format?: 'json_string' | 'array_of_objects';
    height?: string;
}

interface HeaderPair {
    key: string;
    value: string;
}

export function HeaderBuilder({ value, onChange, format = 'json_string', height }: HeaderBuilderProps) {
    const [headers, setHeaders] = useState<HeaderPair[]>([]);

    // Initialize from value prop
    useEffect(() => {
        try {
            if (value) {
                if (format === 'array_of_objects' && Array.isArray(value)) {
                    const pairs = value.map((item: any) => ({
                        key: item.name || "",
                        value: item.value || ""
                    }));
                    // Simple deep compare to avoid infinite loop
                    setHeaders(prev => {
                        const prevJson = JSON.stringify(prev);
                        const newJson = JSON.stringify(pairs);
                        return prevJson === newJson ? prev : pairs;
                    });
                } else if (format === 'json_string' && typeof value === 'string') {
                    const parsed = JSON.parse(value);
                    const pairs = Object.entries(parsed).map(([k, v]) => ({
                        key: k,
                        value: String(v)
                    }));
                    setHeaders(prev => {
                        const prevJson = JSON.stringify(prev.reduce((acc, h) => {
                            if (h.key) acc[h.key] = h.value;
                            return acc;
                        }, {} as Record<string, string>));
                        const newJson = JSON.stringify(parsed);
                        return prevJson === newJson ? prev : pairs;
                    });
                }
            } else if (headers.length === 0) {
                // Initialize with one empty row if empty
                setHeaders([{ key: "", value: "" }]);
            }
        } catch (e) {
            if (headers.length === 0) setHeaders([{ key: "", value: "" }]);
        }
    }, [value, format]);

    const updateHeaders = (newHeaders: HeaderPair[]) => {
        setHeaders(newHeaders);

        if (format === 'array_of_objects') {
            const arrayOutput = newHeaders
                .map(h => ({
                    name: h.key,
                    value: h.value
                }));
            onChange(arrayOutput);
        } else {
            // Convert to object for storage
            const headerObj = newHeaders.reduce((acc, { key, value }) => {
                if (key) acc[key] = value;
                return acc;
            }, {} as Record<string, string>);
            onChange(JSON.stringify(headerObj));
        }
    };

    const addHeader = () => {
        updateHeaders([...headers, { key: "", value: "" }]);
    };

    const removeHeader = (index: number) => {
        const newHeaders = headers.filter((_, i) => i !== index);
        if (newHeaders.length === 0) newHeaders.push({ key: "", value: "" });
        updateHeaders(newHeaders);
    };

    const updateHeader = (index: number, field: 'key' | 'value', text: string) => {
        const newHeaders = [...headers];
        if (newHeaders[index]) {
            newHeaders[index][field] = text;
            updateHeaders(newHeaders);
        }
    };

    return (
        <div className="space-y-2">
            <div className={`space-y-2 h-[${height}] overflow-y-auto pr-2`}>
                {headers.map((header, index) => (
                    <div key={index} className="flex gap-2 items-start">
                        <div className="flex-1">
                            <Input
                                placeholder="Key (e.g. X-Custom-Header)"
                                value={header.key}
                                onChange={(e) => updateHeader(index, 'key', e.target.value)}
                                className="h-9"
                            />
                        </div>
                        <div className="flex-1">
                            <Input
                                placeholder="Value"
                                value={header.value}
                                onChange={(e) => updateHeader(index, 'value', e.target.value)}
                                className="h-9"
                            />
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => removeHeader(index)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addHeader}
                className="gap-2 w-full"
            >
                <Plus className="h-3.5 w-3.5" />
                Add Header
            </Button>
        </div>
    );
}

export default HeaderBuilder;
