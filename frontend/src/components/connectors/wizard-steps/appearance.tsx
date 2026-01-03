import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { NodeTypesData, NodeSize } from "@/types/nodes";

interface AppearanceStepProps {
    nodeTypesData: NodeTypesData;
    nodeSize: NodeSize;
    setNodeSize: (size: NodeSize) => void;
    connectorType: string;
    setConnectorType: (type: string) => void;
    customRadius: string;
    setCustomRadius: (radius: string) => void;
    handleStylingIndex: number;
    setHandleStylingIndex: (index: number) => void;
}

export default function AppearanceStep({
    nodeTypesData,
    nodeSize,
    setNodeSize,
    connectorType,
    setConnectorType,
    customRadius,
    setCustomRadius,
    handleStylingIndex,
    setHandleStylingIndex
}: AppearanceStepProps) {
    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 mb-0">

            {/* Custom Node Styling Options */}
            <div className="space-y-4">
                <Label>Custom Styling</Label>
                <div className="space-y-3 flex flex-col items-start gap-2 w-full">
                    <Label>Node Type</Label>
                    <div className="grid grid-cols-4 gap-4">
                        {nodeTypesData.nodeTypes.map((type) => (
                            <div
                                key={type.id}
                                className={cn(
                                    "border rounded-md p-3 cursor-pointer transition-all",
                                    nodeSize.width === type.dimensions.width && nodeSize.height === type.dimensions.height && connectorType === type.id
                                        ? 'border-primary bg-primary/10'
                                        : 'hover:bg-accent border-border'
                                )}
                                onClick={() => {
                                    setNodeSize(type.dimensions);
                                    setConnectorType(type.id);
                                }}
                            >
                                <div className={cn(
                                    "h-8 border border-neutral-600 bg-card mb-2 ml-auto mr-auto flex items-center gap-1",
                                    type.preview.widthClass,
                                    type.preview.containerClass
                                )}>
                                    <div className="w-3 h-3 bg-neutral-600 rounded-[2px]"></div>
                                    {type.preview.showLine && (
                                        <div className="w-8 h-1 bg-neutral-600 rounded"></div>
                                    )}
                                </div>
                                <div className="text-center text-xs font-medium">
                                    {type.label} <br /> ({type.dimensions.width}x{type.dimensions.height})
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {connectorType === 'custom' && (
                    <div className="flex flex-col gap-4 mt-2">
                        {/* Dimensions Selector */}
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Dimensions</Label>
                            <Select
                                value={`${nodeSize.width}x${nodeSize.height}`}
                                onValueChange={(val) => {
                                    const [w, h] = val.split('x').map(Number);
                                    if (w !== undefined && h !== undefined) {
                                        setNodeSize({ width: w, height: h });
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {nodeTypesData.nodeTypes.find(t => t.id === 'custom')?.style?.ratioOptions?.map((opt, i) => (
                                        <SelectItem key={i} value={`${opt.width}x${opt.height}`}>
                                            {opt.width}x{opt.height} px
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Border Radius Selector */}
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Corner Radius</Label>
                            <Select
                                value={customRadius}
                                onValueChange={setCustomRadius}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {nodeTypesData.nodeTypes.find(t => t.id === 'custom')?.style?.radiusOptions?.map((opt, i) => (
                                        <SelectItem key={i} value={opt}>
                                            {opt}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Handle Shape Selector */}
                        <div className="space-y-2 col-span-2">
                            <Label className="text-xs text-muted-foreground">Handle Shape</Label>
                            <div className="flex gap-4">
                                {nodeTypesData.nodeTypes.find(t => t.id === 'custom')?.handles?.styling?.map((style, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "border rounded-md p-3 cursor-pointer flex-1 flex flex-col items-center gap-2 transition-all",
                                            handleStylingIndex === i
                                                ? "border-primary bg-primary/10"
                                                : "border-border hover:bg-accent"
                                        )}
                                        onClick={() => setHandleStylingIndex(i)}
                                    >
                                        <div
                                            className="w-4 h-4 bg-foreground"
                                            style={{
                                                borderRadius: style.borderRadius,
                                                transform: `rotate(${style.rotation}deg)`
                                            }}
                                        />
                                        <span className="text-xs capitalize">{style.type}</span>
                                    </div>
                                ))}
                            </div>
                        </div>


                    </div>
                )}
            </div>


        </div>
    );
}
