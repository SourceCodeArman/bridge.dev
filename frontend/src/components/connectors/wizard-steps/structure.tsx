import { Label } from "@/components/ui/label";
import { Minus, Plus } from "lucide-react";
import type { NodeTypesData } from "@/types/nodes";

interface StructureStepProps {
    handleCounts: Record<string, number>;
    setHandleCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    connectorType: string;
    nodeTypesData: NodeTypesData;
}

export default function StructureStep({
    handleCounts,
    setHandleCounts,
    connectorType,
    nodeTypesData
}: StructureStepProps) {

    const updateHandleCount = (side: string, delta: number) => {
        const typeConfig = nodeTypesData.nodeTypes.find(t => t.id === connectorType);
        const maxHandles = typeConfig?.handles?.maxHandleCounts?.[side as keyof typeof typeConfig.handles.maxHandleCounts] ?? 5;

        setHandleCounts(prev => ({
            ...prev,
            [side]: Math.max(0, maxHandles === -1 ? (prev[side] || 0) + delta : Math.min(maxHandles, (prev[side] || 0) + delta))
        }));
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="space-y-3 flex flex-col items-start gap-2 w-full">
                <Label>Handle Structure</Label>
                <p className="text-xs text-muted-foreground">Define how many handles should be on each side of the node.</p>
                <div className="grid grid-cols-2 gap-4 w-full">
                    {(['left', 'right', 'top', 'bottom'] as const).map(side => (
                        <div key={side} className="bg-muted/50 p-2.5 rounded-md border border-border">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs uppercase font-medium text-foreground">{side}</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => updateHandleCount(side, -1)}
                                        className="w-5 h-5 flex items-center justify-center rounded bg-background border border-border hover:bg-accent text-foreground"
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <span className="text-xs font-mono w-4 text-center">{handleCounts[side]}</span>
                                    <button
                                        type="button"
                                        onClick={() => updateHandleCount(side, 1)}
                                        className="w-5 h-5 flex items-center justify-center rounded bg-background border border-border hover:bg-accent text-foreground"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}