import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { NodeTypesData } from "@/types/nodes";

interface DetailsStepProps {
    handleCounts: Record<string, number>;

    handleNames: Record<string, string>;
    setHandleNames: React.Dispatch<React.SetStateAction<Record<string, string>>>;

    smartPlusHandles: Record<string, boolean>;
    setSmartPlusHandles: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

    handleTypes: Record<string, 'input' | 'output'>;
    setHandleTypes: React.Dispatch<React.SetStateAction<Record<string, 'input' | 'output'>>>;

    connectorType: string;
    nodeTypesData: NodeTypesData;
}

export default function DetailsStep({
    handleCounts,
    handleNames,
    setHandleNames,
    smartPlusHandles,
    setSmartPlusHandles,
    handleTypes,
    setHandleTypes,
    connectorType,
    nodeTypesData
}: DetailsStepProps) {

    const updateHandleName = (key: string, value: string) => {
        setHandleNames(prev => ({ ...prev, [key]: value }));
    };

    const toggleSmartPlus = (key: string) => {
        setSmartPlusHandles(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleHandleType = (key: string, type: 'input' | 'output') => {
        setHandleTypes(prev => ({ ...prev, [key]: type }));
        // If switching to input, remove SmartPlus
        if (type === 'input') {
            setSmartPlusHandles(prev => ({ ...prev, [key]: false }));
        }
    };

    const getDefaultHandleType = (side: string): 'input' | 'output' => {
        const typeConfig = nodeTypesData.nodeTypes.find(t => t.id === connectorType);
        const allowedTypes = typeConfig?.handles?.allowedHandleTypes;

        if (allowedTypes && allowedTypes.length === 1) {
            return allowedTypes[0] as 'input' | 'output';
        }

        return side === 'left' ? 'input' : 'output';
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="space-y-3 flex flex-col items-start gap-2 w-full">
                <Label>Handle Configuration</Label>
                <p className="text-xs text-muted-foreground">Name your handles and configure their types.</p>

                {Object.values(handleCounts).some(v => v > 0) ? (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 w-full">
                        {(['left', 'top', 'right', 'bottom'] as const).map(side => {
                            const count = handleCounts[side] || 0;
                            if (count === 0) return null;

                            return Array.from({ length: count }).map((_, i) => {
                                const key = `${side}-${i}`;
                                const handleType = handleTypes[key] || getDefaultHandleType(side);
                                const isOutput = handleType === 'output';

                                return (
                                    <div key={key} className="flex items-center gap-2">
                                        <span className="text-xs uppercase text-foreground w-16 shrink-0">{side} {i + 1}</span>

                                        {/* Input/Output Type Selector */}
                                        <Select
                                            value={handleType}
                                            onValueChange={(value) => toggleHandleType(key, value as 'input' | 'output')}
                                            disabled={(nodeTypesData.nodeTypes.find(t => t.id === connectorType)?.handles?.allowedHandleTypes?.length ?? 2) === 1}
                                        >
                                            <SelectTrigger className="h-7 w-24 text-xs focus:ring-0">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(!nodeTypesData.nodeTypes.find(t => t.id === connectorType)?.handles?.allowedHandleTypes || nodeTypesData.nodeTypes.find(t => t.id === connectorType)?.handles?.allowedHandleTypes?.includes('input')) && (
                                                    <SelectItem value="input">Input</SelectItem>
                                                )}
                                                {(!nodeTypesData.nodeTypes.find(t => t.id === connectorType)?.handles?.allowedHandleTypes || nodeTypesData.nodeTypes.find(t => t.id === connectorType)?.handles?.allowedHandleTypes?.includes('output')) && (
                                                    <SelectItem value="output">Output</SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>

                                        <Input
                                            placeholder="Name (e.g. Input)"
                                            value={handleNames[key] || ''}
                                            onChange={(e) => updateHandleName(key, e.target.value)}
                                            className="h-7 flex-1 text-xs"
                                        />

                                        {/* SmartPlus - only for output handles */}
                                        {isOutput && (
                                            <div className="flex items-center gap-1.5">
                                                <Checkbox
                                                    id={`smart-${key}`}
                                                    checked={smartPlusHandles[key] || false}
                                                    onCheckedChange={() => toggleSmartPlus(key)}
                                                    className="border-border bg-background cursor-pointer p-2"
                                                />
                                                <label htmlFor={`smart-${key}`} className="text-[10px] text-foreground cursor-pointer whitespace-nowrap">+</label>
                                            </div>
                                        )}
                                    </div>
                                );
                            });
                        })}
                    </div>
                ) : (
                    <div className="text-sm text-muted-foreground italic">No handles defined. Go back to add handles.</div>
                )}
            </div>
        </div>
    );
} 