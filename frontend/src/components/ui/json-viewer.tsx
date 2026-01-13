import React, { useState } from 'react';
import {
    ChevronRight,
    ChevronDown,
    Type,
    Hash,
    ToggleLeft,
    Box,
    List,
    Ban,
    Copy,
    Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Types and Icons
const getDataType = (value: any): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
};

const TypeIcon = ({ type, className }: { type: string, className?: string }) => {
    const iconProps = { className: cn("h-3 w-3", className) };

    switch (type) {
        case 'string': return <Type {...iconProps} className={cn(iconProps.className, "text-green-600 dark:text-green-400")} />;
        case 'number': return <Hash {...iconProps} className={cn(iconProps.className, "text-blue-600 dark:text-blue-400")} />;
        case 'boolean': return <ToggleLeft {...iconProps} className={cn(iconProps.className, "text-purple-600 dark:text-purple-400")} />;
        case 'object': return <Box {...iconProps} className={cn(iconProps.className, "text-orange-600 dark:text-orange-400")} />;
        case 'array': return <List {...iconProps} className={cn(iconProps.className, "text-yellow-600 dark:text-yellow-400")} />;
        case 'null': return <Ban {...iconProps} className={cn(iconProps.className, "text-gray-400")} />;
        default: return <Box {...iconProps} />;
    }
};

interface JsonTreeNodeProps {
    keyName?: string;
    value: any;
    level?: number;
    isLast?: boolean;
}

const JsonTreeNode: React.FC<JsonTreeNodeProps> = ({ keyName, value, level = 0 }) => {
    const [isOpen, setIsOpen] = useState(true);
    const type = getDataType(value);
    const isExpandable = type === 'object' || type === 'array';
    const isEmpty = isExpandable && Object.keys(value).length === 0;

    // Formatting value for display
    const formatValue = (val: any, type: string) => {
        if (type === 'string') return <span className="text-green-700 dark:text-green-300">"{val}"</span>;
        if (type === 'number') return <span className="text-blue-700 dark:text-blue-300">{val}</span>;
        if (type === 'boolean') return <span className="text-purple-700 dark:text-purple-300">{val.toString()}</span>;
        if (type === 'null') return <span className="text-gray-500 italic">null</span>;
        return null;
    };

    return (
        <div className="font-mono text-sm leading-6 selection:bg-primary/20">
            <div
                className={cn(
                    "flex items-center gap-2 py-0.5 px-2 rounded-sm hover:bg-muted/50 transition-colors group",
                    isExpandable && "cursor-pointer"
                )}
                style={{ paddingLeft: `${Math.max(level * 16 + 8, 8)}px` }}
                onClick={(e) => {
                    if (isExpandable) {
                        e.stopPropagation();
                        setIsOpen(!isOpen);
                    }
                }}
            >
                {/* Expand Toggle */}
                <div className="w-4 h-4 flex items-center justify-center shrink-0 text-muted-foreground/70">
                    {isExpandable && !isEmpty && (
                        isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
                    )}
                </div>

                {/* Key (if exists) */}
                {keyName && (
                    <div className="flex items-center gap-2 mr-1">
                        {/* Type Icon for Key (Visual aid from screenshot) */}
                        <div className={cn(
                            "flex items-center justify-center w-5 h-5 rounded border bg-background/50 shrink-0",
                            "text-muted-foreground/70"
                        )}>
                            <TypeIcon type={type} />
                        </div>
                        <span className="text-foreground/80 font-medium">{keyName}</span>
                        <span className="text-muted-foreground">:</span>
                    </div>
                )}

                {/* Value or Object Summary */}
                {isExpandable ? (
                    <div className="text-muted-foreground text-xs">
                        {type === 'array' ? (
                            <span>Array({value.length})</span>
                        ) : (
                            <span>Object</span>
                        )}
                    </div>
                ) : (
                    <div className="break-all">
                        {formatValue(value, type)}
                    </div>
                )}
            </div>

            {/* Children */}
            {isExpandable && isOpen && !isEmpty && (
                <div className="border-l border-border/40 ml-[calc(1.5rem+7px)] pl-0">
                    {Object.entries(value).map(([childKey, childValue], index, arr) => (
                        <JsonTreeNode
                            key={childKey}
                            keyName={childKey}
                            value={childValue}
                            level={0} // Level handled by padding calculation
                            isLast={index === arr.length - 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

interface JsonViewerProps {
    data: any;
    className?: string;
}

export function JsonViewer({ data, className }: JsonViewerProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={cn("flex flex-col h-full", className)}>
            <Tabs defaultValue="visual" className="h-full flex flex-col">
                <div className="flex items-center justify-between border-b pb-2 mb-2 px-1">
                    <TabsList className="h-8">
                        <TabsTrigger value="visual" className="text-xs h-7 px-3">Visual</TabsTrigger>
                        <TabsTrigger value="json" className="text-xs h-7 px-3">JSON</TabsTrigger>
                    </TabsList>
                    <div className="flex items-center gap-2">
                        {Array.isArray(data) && (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                {data.length} items
                            </span>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
                            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                    </div>
                </div>

                <TabsContent value="visual" className="flex-1 overflow-auto min-h-0 py-2">
                    <div className="w-full">
                        {/* Root handling */}
                        {typeof data === 'object' && data !== null ? (
                            Object.entries(data).map(([key, value]) => (
                                <JsonTreeNode key={key} keyName={key} value={value} />
                            ))
                        ) : (
                            <JsonTreeNode value={data} />
                        )}

                        {/* Special case for top-level array to show indices if not handled above */}
                        {Array.isArray(data) && data.length === 0 && (
                            <div className="text-sm text-muted-foreground px-4 italic">Empty Array []</div>
                        )}
                        {typeof data === 'object' && data !== null && Object.keys(data).length === 0 && (
                            <div className="text-sm text-muted-foreground px-4 italic">Empty Object { }</div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="json" className="flex-1 overflow-auto min-h-0">
                    <pre className="text-xs font-mono p-4 whitespace-pre-wrap wrap-break-word text-muted-foreground">
                        {JSON.stringify(data, null, 2)}
                    </pre>
                </TabsContent>
            </Tabs>
        </div>
    );
}
