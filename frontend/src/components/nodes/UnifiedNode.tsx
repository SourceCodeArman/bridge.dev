import { memo, useMemo, type JSX } from 'react';
import { Handle, Position, useEdges, useNodeId } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { SmartPlusHandle } from './SmartPlusHandle';
import { ThemeAwareIcon } from '@/components/connectors/ThemeAwareIcon';
import { Webhook, Bolt, Database, Bot, Wrench } from 'lucide-react';
import nodeTypesData from './node-types.json';
import type { NodeType, NodeTypesData } from '@/types/nodes';

const handleStyle = { padding: '4px', background: 'var(--secondary)' };
const { nodeTypes: nodeTypeConfigs } = nodeTypesData as NodeTypesData;

export const getNodeTypeConfig = (typeId: string): NodeType | undefined => {
    return nodeTypeConfigs.find(config => config.id === typeId);
};

const DefaultIcon = ({ type, className = "w-10 h-10" }: { type: string; className?: string }) => {
    const iconClass = cn(className, "text-foreground");
    switch (type.toLowerCase()) {
        case 'trigger':
        case 'webhook': return <Webhook className={iconClass} />;
        case 'agent': return <Bot className={iconClass} />;
        case 'memory':
        case 'memorynode': return <Database className={iconClass} />;
        case 'tool':
        case 'toolsnode': return <Wrench className={iconClass} />;
        default: return <Bolt className={iconClass} />;
    }
};

const renderConfiguredHandles = (
    config: NodeType,
    data: Record<string, any>,
    position: 'left' | 'right' | 'top' | 'bottom',
    handleType: 'source' | 'target'
) => {
    // Custom UI overrides
    const ui = data.ui as any || {};
    const customHandles = ui.handles;
    const handleNames = ui.handleNames || {};

    // Determine count: Prefer custom UI, fallback to config defaults
    let count = 0;
    if (customHandles && typeof customHandles[position] === 'number') {
        count = customHandles[position];
    } else {
        const defaults = config.handles?.defaults;
        if (defaults) {
            count = defaults[position] || 0;
        }
    }

    if (count === 0) return null;

    const positionMap: Record<'left' | 'right' | 'top' | 'bottom', Position> = {
        left: Position.Left,
        right: Position.Right,
        top: Position.Top,
        bottom: Position.Bottom,
    };

    const handles: JSX.Element[] = [];
    const styling = ui.handleStyling || config.handles?.styling?.[0] || { type: 'circle', borderRadius: '10px', rotation: 0 };

    // Determine max connections
    let maxConnections = config.handles?.maxConnections?.[position] ?? 1;
    if (handleType === 'source' && ui.outputHandles !== undefined) {
        maxConnections = ui.outputHandles === -1 ? Infinity : ui.outputHandles;
    }

    // Is Wide Logic (for labels)
    const nodeWidth = ui.nodeSize?.width || config.dimensions.width;
    const isWide = nodeWidth >= 200;

    for (let i = 0; i < count; i++) {
        const handleId = count === 1 ? (handleType === 'source' ? 'source' : undefined) : `${position}-${i}`;

        // Calculate offset
        // For count=1, we can default to 50% implicitly or explicitly
        // If count > 1, we distribute
        let offsetPercent = 50;
        if (count > 1) {
            const spacing = 100 / (count + 1);
            offsetPercent = spacing * (i + 1);
        }

        let offsetStyle: React.CSSProperties = {};
        if (position === 'left' || position === 'right') {
            offsetStyle = { top: `${offsetPercent}%` };
        } else {
            offsetStyle = { left: `${offsetPercent}%` };
        }

        // Render Label (Wide Nodes)
        const nameKey = `${position}-${i}`;
        const handleName = handleNames[nameKey];

        if (isWide && handleName) {
            const labelStyle: React.CSSProperties = {
                position: 'absolute',
                fontSize: '9px',
                color: '#a3a3a3',
                whiteSpace: 'nowrap',
                textTransform: 'uppercase',
                fontWeight: 500,
                pointerEvents: 'none',
                zIndex: 20,
                ...offsetStyle
            };

            if (position === 'left') {
                labelStyle.right = 'calc(100% + 8px)';
                labelStyle.transform = 'translateY(-50%)';
                labelStyle.textAlign = 'right';
            } else if (position === 'right') {
                labelStyle.left = 'calc(100% + 8px)';
                labelStyle.transform = 'translateY(-50%)';
                labelStyle.textAlign = 'left';
            } else if (position === 'top') {
                labelStyle.bottom = 'calc(100% + 8px)';
                labelStyle.transform = 'translateX(-50%)';
            } else {
                labelStyle.top = 'calc(100% + 8px)';
                labelStyle.transform = 'translateX(-50%)';
            }

            handles.push(
                <span key={`label-${handleId}`} style={labelStyle}>
                    {handleName}
                </span>
            );
        }

        const isDiamond = styling.type === 'diamond';
        if (isDiamond) {
            // stable wrapper for React Flow anchor point
            const wrapperStyle: React.CSSProperties = {
                ...offsetStyle,
                width: 10,
                height: 10,
                background: 'transparent',
                border: 'none',
                transform: 'translate(-50%, -50%)',
                borderRadius: 0,
                zIndex: 99,
                right: '-10px',
            };

            const diamondInnerStyle: React.CSSProperties = {
                width: '100%',
                height: '100%',
                background: 'var(--secondary)',
                border: '1px solid #fff',
                transform: `rotate(${styling.rotation}deg)`,
                borderRadius: styling.borderRadius,
            };

            handles.push(
                <Handle
                    key={`${handleType}-${position}-${i}`}
                    type={handleType}
                    id={handleId}
                    position={positionMap[position]}
                    style={wrapperStyle}
                    className="z-99"
                >
                    <div style={diamondInnerStyle} />
                </Handle>
            );
        } else {
            // Standard handle logic
            // NOTE: offsetStyle typically handles 'top'/'left'
            // We need to ensure transform centers it on the edge

            let transform = 'translate(-50%, -50%)';
            // Adjust transform based on position if needed, though usually -50% -50% centers on the point defined by top/left

            const shapeStyle: React.CSSProperties = {
                borderRadius: styling.borderRadius,
                transform
            };

            const combinedStyle = { 
                ...handleStyle, 
                ...offsetStyle, 
                ...shapeStyle, 
                right: '-10px' 
            };

            handles.push(
                <Handle
                    key={`${handleType}-${position}-${i}`}
                    type={handleType}
                    id={handleId}
                    position={positionMap[position]}
                    style={combinedStyle}
                    className="z-99"
                />
            );
        }

        if (handleType === 'source' && config.id !== 'agent-tool') {
            handles.push(
                <SmartPlusHandle
                    key={`smart-${position}-${i}`}
                    id={handleId}
                    type={handleType}
                    position={positionMap[position]}
                    style={{ ...handleStyle, ...offsetStyle }}
                    maxConnections={maxConnections}
                    shape={styling.type}
                    onSmartClick={data.onAddClick}
                    draggingFrom={data.draggingFrom}
                    nodeWidth={config.dimensions.width}
                />
            );
        }
    }
    return handles;
};

/**
 * Render labeled handles (for agent node's Model/Memory/Tools)
 */
const renderLabeledHandles = (
    config: NodeType,
    data: Record<string, any>,
    nodeId: string | null,
    edges: any[]
) => {
    const labeledHandles = config.handles?.labeledHandles;
    if (!labeledHandles || labeledHandles.length === 0) return null;

    const positionMap: Record<'left' | 'right' | 'top' | 'bottom', Position> = {
        left: Position.Left,
        right: Position.Right,
        top: Position.Top,
        bottom: Position.Bottom,
    };

    return labeledHandles.map((lh) => {
        const isFull = lh.maxConnections > 0 &&
            edges.filter(e => e.target === nodeId && e.targetHandle === lh.id).length >= lh.maxConnections;

        return (
            <div key={lh.id}>
                {/* Invisible handle for React Flow */}
                <Handle
                    type={lh.type}
                    id={lh.id}
                    position={positionMap[lh.position]}
                    style={{
                        left: lh.offsetPx,
                        bottom: -10,
                        width: 10,
                        height: 10,
                        background: 'transparent',
                        border: 'none',
                        transform: 'translate(-50%, -50%)',
                        padding: 0,
                        pointerEvents: isFull ? 'none' : 'all',
                        zIndex: 50
                    }}
                >
                    {/* Diamond visual */}
                    <div style={{
                        width: 10,
                        height: 10,
                        background: 'var(--background)',
                        border: '1px solid #e5e5e5',
                        transform: lh.shape === 'diamond' ? 'rotate(45deg)' : 'none',
                        borderRadius: lh.shape === 'circle' ? '50%' : '2px',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        zIndex: 99
                    }} />
                </Handle>

                {/* SmartPlusHandle */}
                <SmartPlusHandle
                    type={lh.type}
                    id={lh.id}
                    position={positionMap[lh.position]}
                    style={{
                        left: lh.offsetPx,
                        height: lh.lineHeight || 100,
                    }}
                    shape={lh.shape}
                    maxConnections={lh.maxConnections === -1 ? Infinity : lh.maxConnections}
                    onSmartClick={data.onAddClick}
                    allowedNodeTypes={lh.allowedNodeTypes}
                    draggingFrom={data.draggingFrom}
                    diamondStyle={{ top: 92 }}
                />

                {/* Label */}
                <div
                    className="absolute top-full -translate-x-1/2 mt-3 text-[9px] font-bold text-muted-foreground uppercase tracking-wider bg-background z-20"
                    style={{ left: lh.offsetPx }}
                >
                    {lh.label}
                </div>
            </div>
        );
    });
};

export const UnifiedNode = memo(({ data, selected, type }: NodeProps) => {
    const nodeId = useNodeId();
    const edges = useEdges();

    const config = useMemo(() => {
        const typeMap: Record<string, string> = {
            'trigger': 'trigger',
            'action': 'action',
            'agent': 'agent',
            'modelNode': 'agent-tool',
            'memoryNode': 'agent-tool',
            'toolsNode': 'agent-tool',
            'custom': 'custom',
            'condition': 'action',
        };
        const configId = typeMap[type || 'action'] || 'action';
        return getNodeTypeConfig(configId) || getNodeTypeConfig('action')!;
    }, [type]);

    // Extract UI settings from data (for custom nodes)
    const ui = data.ui as {
        nodeSize?: { width: number; height: number },
        customRadius?: string,
    } || {};

    const dimensions = ui.nodeSize || config.dimensions;
    const isWide = dimensions.width >= 200;
    const customRadius = ui.customRadius;
    console.log(dimensions)
    const label = data.label as string || config.label;
    const description = data.description as string;
    const iconUrlLight = data.iconUrlLight as string;
    const iconUrlDark = data.iconUrlDark as string;
    const isCondition = type === 'condition';
    const isAgent = type === 'agent';
    const hasLabeledHandles = config.handles?.labeledHandles && config.handles.labeledHandles.length > 0;

    return (
        <div className="relative flex flex-col items-center">
            {renderConfiguredHandles(config, data, 'left', config.handles?.handleTypes?.left || 'target')}
            {renderConfiguredHandles(config, data, 'top', config.handles?.handleTypes?.top || 'target')}

            <Card
                className={cn(
                    "p-0 flex items-center border border-border bg-card z-10 transition-all shadow-sm",
                    isAgent ? "pl-3 gap-2" : "",
                    // Wide layout logic
                    isWide ? "justify-start px-3" : "justify-center",
                    selected ? "border-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]" : "hover:border-neutral-500",
                    config.style?.containerClass
                )}
                style={{
                    width: `${dimensions.width}px`,
                    height: `${dimensions.height}px`,
                    borderRadius: customRadius || undefined
                }}
            >
                {/* Icon Logic */}
                {(iconUrlLight || iconUrlDark) ? (
                    <ThemeAwareIcon
                        lightSrc={iconUrlLight}
                        darkSrc={iconUrlDark}
                        alt={label}
                        className={cn(
                            "object-contain select-none pointer-events-none",
                            config.id === 'agent-tool' ? "" : (isWide ? "w-8 h-8 mr-3" : "w-10 h-10")
                        )}
                        style={config.id === 'agent-tool' ? { width: '25px', height: '25px' } : undefined}
                    />
                ) : (
                    <DefaultIcon
                        type={data.connectorType as string || type || 'action'}
                        className={cn(
                            "text-foreground",
                            config.id === 'agent-tool' ? "w-[25px] h-[25px]" : (isWide ? "w-8 h-8 mr-3" : "w-10 h-10")
                        )}
                    />
                )}

                {/* Content Logic */}
                {isAgent && (
                    <div className="font-semibold text-md text-foreground mt-1">{label}</div>
                )}

                {/* Wide layout text (Custom Connectors) */}
                {isWide && !isAgent && (
                    <div className="flex flex-col overflow-hidden pointer-events-none select-none">
                        <span className="text-[10px] font-bold uppercase tracking-wider leading-none text-foreground truncate">
                            {label || "Custom Node"}
                        </span>
                        {description && (
                            <div className="text-[9px] text-foreground truncate mt-0.5 max-w-[140px] opacity-80">
                                {description}
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* Labels - skip for agent OR wide nodes since label is inside */}
            {!isAgent && !isWide && (
                <div className="absolute top-full mt-2 flex flex-col items-center text-center pointer-events-none z-20">
                    <span className={cn(
                        "font-bold uppercase tracking-wider leading-none mb-0.5 px-1.5 py-0.5 rounded-full",
                        config.id === 'agent-tool' ? "text-[8px]" : "text-[10px]",
                        selected ? "text-primary" : "text-foreground"
                    )}>
                        {label}
                    </span>
                </div>
            )}

            {isCondition ? (
                <>
                    <Handle id="true" type="source" position={Position.Right}
                        style={{ ...handleStyle, top: '25%', transform: 'translateY(-50%)' }} className="z-99" />
                    <SmartPlusHandle id="true" type="source" position={Position.Right}
                        style={{ ...handleStyle, top: '25%', transform: 'translateY(-50%)' }}
                        onSmartClick={data.onAddClick} draggingFrom={data.draggingFrom} nodeWidth={dimensions.width} />
                    <div className="absolute top-[25%] -right-8 -translate-y-1/2 text-[9px] text-foreground font-bold tracking-tighter bg-background z-20">TRUE</div>

                    <Handle id="false" type="source" position={Position.Right}
                        style={{ ...handleStyle, top: '75%', transform: 'translateY(-50%)' }} className="z-99" />
                    <SmartPlusHandle id="false" type="source" position={Position.Right}
                        style={{ ...handleStyle, top: '75%', transform: 'translateY(-50%)' }}
                        onSmartClick={data.onAddClick} draggingFrom={data.draggingFrom} nodeWidth={dimensions.width} />
                    <div className="absolute top-[75%] -right-9 -translate-y-1/2 text-[9px] text-foreground font-bold tracking-tighter bg-background z-20">FALSE</div>
                </>
            ) : (
                <>
                    {renderConfiguredHandles(config, data, 'right', config.handles?.handleTypes?.right || 'source')}
                    {renderConfiguredHandles(config, data, 'bottom', config.handles?.handleTypes?.bottom || 'source')}
                    {hasLabeledHandles && renderLabeledHandles(config, data, nodeId, edges)}
                </>
            )}
        </div>
    );
});

UnifiedNode.displayName = 'UnifiedNode';
export default UnifiedNode;
