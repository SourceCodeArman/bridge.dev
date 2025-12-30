import { Handle, Position, useEdges, useNodeId } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Card } from '@/components/ui/card';
import { Webhook, Zap, Database, Globe, Bolt, Bot, Plus, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { memo } from 'react';

// Common handle styles
const handleStyle = { padding: '4px', background: '#262626' };

export const ConnectorIcon = ({ type, className }: { type: string, className?: string }) => {
    const iconClass = className || "w-5 h-5";
    const getColor = (t: string) => {
        switch (t.toLowerCase()) {
            case 'webhook': return "text-purple-500";
            case 'schedule': return "text-yellow-500";
            case 'supabase': return "text-green-500";
            case 'http': return "text-blue-500";
            case 'openai': return "text-teal-500";
            case 'anthropic': return "text-orange-500";
            case 'deepseek': return "text-blue-700";
            case 'google': return "text-red-500";
            case 'gemini': return "text-blue-400";
            default: return "text-gray-500";
        }
    };
    const colorClass = getColor(type);

    switch (type.toLowerCase()) {
        case 'webhook': return <Webhook className={cn(iconClass, colorClass)} />;
        case 'schedule': return <Zap className={cn(iconClass, colorClass)} />;
        case 'supabase': return <Database className={cn(iconClass, colorClass)} />;
        case 'http': return <Globe className={cn(iconClass, colorClass)} />;
        case 'openai': return <Bolt className={cn(iconClass, colorClass)} />;
        case 'anthropic': return <Bolt className={cn(iconClass, colorClass)} />;
        case 'deepseek': return <Bolt className={cn(iconClass, colorClass)} />;
        case 'google': return <Bolt className={cn(iconClass, colorClass)} />;
        case 'gemini': return <Bolt className={cn(iconClass, colorClass)} />;
        default: return <Bolt className={cn(iconClass, colorClass)} />;
    }
};

interface NodeShellProps {
    selected?: boolean;
    title: string;
    type: string;
    children?: React.ReactNode;
    icon?: React.ReactNode;
    className?: string;
}

const NodeShell = ({ selected, title, type, children, icon, className }: NodeShellProps) => (
    <div className="relative flex flex-col items-center">
        {/* The visual node box */}
        <Card className={cn(
            "w-[100px] h-[100px] p-0 flex items-center justify-center border border-border bg-[#1c1c1c] transition-all rounded-[18px] z-10",
            selected ? "border-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]" : "hover:border-neutral-500",
            className
        )}>
            {icon || <ConnectorIcon type={type} className="w-10 h-10" />}
        </Card>

        {/* Floating Text */}
        <div className="absolute top-full mt-2 flex flex-col items-center text-center pointer-events-none z-20">
            <span className={cn(
                "text-[10px] font-bold uppercase tracking-wider leading-none mb-0.5 px-1.5 py-0.5 rounded-full backdrop-blur-sm ",
                selected ? "text-primary border-primary/30" : "text-foreground"
            )}>
                {title}
            </span>

            <div className="text-[9px] text-muted-foreground leading-tight px-1 line-clamp-2">
                {children}
            </div>
        </div>
    </div>
);

export const SmartPlusHandle = ({
    maxConnections = 1,
    allowedNodeTypes,
    onSmartClick,
    nodeWidth,
    isHandle,
    shape,
    lineType,
    diamondStyle,
    draggingFrom,
    ...handleProps  // Only React Flow valid props (type, position, id, style)
}: any) => {
    const nodeId = useNodeId();
    const edges = useEdges();

    // Check if we're currently dragging from THIS handle
    const isDraggingFromThisHandle = draggingFrom &&
        draggingFrom.nodeId === nodeId &&
        (draggingFrom.handleId === handleProps.id || draggingFrom.handleId === `${handleProps.id}-plus`);

    // Count connections attached to this handle
    const connections = edges.filter(edge => {
        if (handleProps.type === 'target') {
            return edge.target === nodeId && (handleProps.id ? edge.targetHandle === handleProps.id : (!edge.targetHandle || edge.targetHandle === null));
        } else {
            // source
            return edge.source === nodeId && (handleProps.id ? edge.sourceHandle === handleProps.id : (!edge.sourceHandle || edge.sourceHandle === null));
        }
    }).length;

    const isFull = connections >= maxConnections;

    // Determine default transform based on position if not provided
    let defaultTransform = 'translate(0, 0)';
    if (handleProps.position === Position.Right || handleProps.position === Position.Left) {
        defaultTransform = 'translate(0, -50%)';
    } else if (handleProps.position === Position.Top || handleProps.position === Position.Bottom) {
        defaultTransform = 'translate(-50%, 0)';
    }

    const finalTransform = handleProps.style?.transform ? handleProps.style.transform : defaultTransform;

    // If handle is disabled (isHandle={false}) and NOT full, only render the visual line + button (not the border handle)
    // When full, skip this block and fall through to render the border handle at the bottom
    if (isHandle === false && !isFull) {
        // Render visual line + plus button, but not the border handle
        // This will be handled in the return statement below
    }

    // If not full, show the Smart Plus Handle
    if (!isFull) {
        const arrowColor = '#b1b1b7';
        const isDashed = lineType === 'dashed';

        // Calculate line styles based on position
        const lineStyle: React.CSSProperties = {
            position: 'absolute',
            zIndex: 10,
            pointerEvents: 'none', // Ensure line doesn't block clicks
        };

        if (isDashed) {
            lineStyle.background = 'transparent';
            lineStyle.borderColor = arrowColor;
            lineStyle.borderStyle = 'dashed';
            lineStyle.borderWidth = 0; // Set per direction
        } else {
            lineStyle.background = arrowColor;
        }

        // Little dot at the start of the line (on the node border)
        const dotStyle: React.CSSProperties = {
            position: 'absolute',
            width: 8,
            height: 8,
            borderRadius: shape === 'diamond' ? 0 : '50%',
            background: '#1c1c1c', // Match card bg for "cutout" look or fill
            zIndex: 11,
            transform: shape === 'diamond' ? 'translate(-50%, -50%) rotate(45deg)' : 'translate(-50%, -50%)',
        };

        const handleOffset = -100; // Distance from node border
        let lineWidth = Position.Bottom === handleProps.position ? 90 : 100;     // Length of the line

        // Apply custom line dimensions from handleProps.style if provided (AI Agent uses custom)
        if (handleProps.style?.height !== undefined) {
            lineWidth = Number(handleProps.style.height);  // Ensure it's a number
        }

        // Specific adjustments per side
        if (handleProps.position === Position.Right) {
            Object.assign(lineStyle, {
                top: handleProps.style?.top !== undefined ? handleProps.style.top : '50%',
                left: '100%',
                width: lineWidth,
                height: isDashed ? 0 : 1,
                transform: 'translateY(-50%)',
            });
            if (isDashed) lineStyle.borderTopWidth = 1;

            Object.assign(dotStyle, {
                left: 0,
                top: '50%',
                transform: shape === 'diamond' ? 'translate(-50%, -50%) rotate(45deg)' : 'translate(-50%, -50%)',
            });
        } else if (handleProps.position === Position.Left) {
            Object.assign(lineStyle, {
                top: '50%',
                right: '100%',
                width: lineWidth,
                height: isDashed ? 0 : 1,
                transform: 'translateY(-50%)',
            });
            if (isDashed) lineStyle.borderTopWidth = 1;

            Object.assign(dotStyle, {
                right: 0,
                top: '50%',
                transform: shape === 'diamond' ? 'translate(50%, -50%) rotate(45deg)' : 'translate(50%, -50%)',
            });
        } else if (handleProps.position === Position.Top) {
            // Resource nodes extending UPWARD
            Object.assign(lineStyle, {
                left: '50%',
                bottom: '100%',
                height: lineWidth,
                width: isDashed ? 0 : 1,
                transform: 'translateX(-50%)',
            });
            if (isDashed) lineStyle.borderLeftWidth = 1;

            Object.assign(dotStyle, {
                bottom: 0,
                left: '50%',
                transform: shape === 'diamond' ? 'translate(-50%, 50%) rotate(45deg)' : 'translate(-50%, 50%)',
            });
        } else if (handleProps.position === Position.Bottom) {
            // AI Agent extending DOWNWARD
            // Use manual left positioning from handleProps.style if provided
            const leftPos = handleProps.style?.left !== undefined ? handleProps.style.left : '50%';

            Object.assign(lineStyle, {
                left: leftPos,
                top: '100%',
                height: lineWidth,
                width: isDashed ? 0 : 1,
                transform: 'translateX(-50%)',
            });
            if (isDashed) lineStyle.borderLeftWidth = 1;

            Object.assign(dotStyle, {
                top: 0,
                left: '50%',
                transform: shape === 'diamond' ? 'translate(-50%, -50%) rotate(45deg)' : 'translate(-50%, -50%)',
            });
        }

        // Plus button styles
        const buttonStyle: React.CSSProperties = {
            position: 'absolute',
            width: 18,
            height: 18,
            borderRadius: '15%',
            background: '#262626',
            border: '0',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isFull ? 0 : 1,
            pointerEvents: (isFull ? 'none' : 'all') as React.CSSProperties['pointerEvents'],
            cursor: 'pointer',
            zIndex: 12,
        };

        // Position button at END of connector line
        if (handleProps.position === Position.Right) {
            Object.assign(buttonStyle, {
                right: handleOffset,
                top: handleProps.style?.top !== undefined ? handleProps.style.top : '50%',
                transform: finalTransform,
            });
        } else if (handleProps.position === Position.Left) {
            Object.assign(buttonStyle, {
                left: handleOffset,
                top: handleProps.style?.top !== undefined ? handleProps.style.top : '50%',
                transform: finalTransform,
            });
        } else if (handleProps.position === Position.Top) {
            Object.assign(buttonStyle, {
                top: handleOffset,
                left: '50%',
                transform: 'translate(-50%, 0)',
            });
        } else if (handleProps.position === Position.Bottom) {
            // Use manual left from handleProps if provided
            const leftPos = handleProps.style?.left !== undefined ? handleProps.style.left : '50%';
            Object.assign(buttonStyle, {
                bottom: handleOffset,
                left: leftPos,
                transform: 'translate(-50%, 0)',
            });
        }

        const handleClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (onSmartClick) {
                onSmartClick(nodeId, handleProps.id, handleProps.type, allowedNodeTypes, nodeWidth);
            }
        };

        // Create style for invisible border handle
        // Must inherit vertical positioning for condition node true/false handles
        const borderhandleStyle: React.CSSProperties = {
            opacity: shape === 'diamond' ? 1 : 0, // Show diamond handles, hide others
            pointerEvents: 'all', // Enable dragging from this handle
            width: shape === 'diamond' ? 10 : 1,
            height: shape === 'diamond' ? 10 : 1,
            borderRadius: shape === 'diamond' ? 0 : '50%',
            background: shape === 'diamond' ? '#1c1c1c' : 'transparent',
            border: shape === 'diamond' ? '1px solid #b1b1b7' : 'none',
            transform: shape === 'diamond' ? 'translate(-50%, -50%) rotate(45deg)' : 'translate(-50%, -50%)', // Center and rotate diamonds
            zIndex: shape === 'diamond' ? 50 : 1,
            ...diamondStyle,
        };

        // Copy positioning from handleProps.style if provided
        // For bottom position diamonds, we DON'T want to inherit 'top: calc(200%)' which is for the plus button
        if (handleProps.position === Position.Bottom && shape === 'diamond') {
            // Position at bottom border, not extended below
            if (handleProps.style?.left !== undefined) {
                borderhandleStyle.left = handleProps.style.left;
            }
            borderhandleStyle.bottom = -5; // At border
        } else {
            // For other positions, inherit positioning normally
            if (handleProps.style?.top !== undefined) {
                borderhandleStyle.top = handleProps.style.top;
            }
            if (handleProps.style?.bottom !== undefined) {
                borderhandleStyle.bottom = handleProps.style.bottom;
            }
            // Override transform only if explicitly provided
            if (handleProps.style?.transform !== undefined) {
                borderhandleStyle.transform = handleProps.style.transform;
            }
        }

        return (
            <>
                {/* Invisible Handle at node border for React Flow edge connections */}
                {/* This handle is invisible - visual styling comes from parent component's Handle */}
                <Handle
                    type={handleProps.type}
                    position={handleProps.position}
                    id={handleProps.id}
                    style={{
                        opacity: 0,
                        pointerEvents: isFull ? 'none' : 'all',
                        width: 1,
                        height: 1,
                        borderRadius: '50%',
                        background: 'transparent',
                        border: 'none',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 1,
                        top: handleProps.style?.top,
                    }}
                />

                {/* Connector Line - animate when dragging */}
                <div style={{
                    ...lineStyle,
                    opacity: isDraggingFromThisHandle ? 0 : 1,
                    transform: isDraggingFromThisHandle
                        ? (handleProps.position === Position.Bottom
                            ? 'translateX(-50%) scaleY(0)'
                            : handleProps.position === Position.Right
                                ? 'translateY(-50%) scaleX(0)'
                                : lineStyle.transform)
                        : lineStyle.transform,
                    transformOrigin: handleProps.position === Position.Bottom ? 'top' : 'left',
                    transition: 'opacity 0.2s ease, transform 0.2s ease',
                }}>
                    <div style={dotStyle} />
                </div>

                {/* Plus Button - visual only with animation */}
                <div
                    className="nodrag nopan"
                    style={{
                        ...buttonStyle,
                        cursor: 'pointer',
                        opacity: isDraggingFromThisHandle ? 0 : 1,
                        transform: isDraggingFromThisHandle
                            ? (handleProps.position === Position.Bottom
                                ? 'translate(-50%, -50px)'
                                : handleProps.position === Position.Right
                                    ? 'translate(-50px, -50%)'
                                    : buttonStyle.transform)
                            : buttonStyle.transform,
                        transition: 'opacity 0.2s ease, transform 0.2s ease',
                        pointerEvents: 'none', // Let the invisible handle below receive events
                    }}
                >
                    <Plus className="w-2.5 h-2.5 text-neutral-400 pointer-events-none" />
                </div>

                {/* Invisible Handle overlay for dragging - only when not full */}
                {!isFull && (
                    <Handle
                        type={handleProps.type}
                        position={handleProps.position}
                        id={handleProps.id}
                        style={{
                            ...buttonStyle,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'crosshair',
                            zIndex: 100,
                        }}
                        onClick={handleClick}
                    />
                )}
            </>
        );
    }

    // Fallback to standard handle positioned at node border if full
    const borderStyle: React.CSSProperties = {
        ...handleStyle,
        width: shape === 'diamond' ? 10 : 8,
        height: shape === 'diamond' ? 10 : 8,
        borderRadius: shape === 'diamond' ? 0 : '50%',
        background: '#1c1c1c',
        border: '1px solid #b1b1b7',
    };

    // Determine default transform based on position and shape
    // Always center the handle dot on the border
    if (shape === 'diamond') {
        borderStyle.transform = 'translate(-50%, -50%) rotate(45deg)';
    } else {
        if (handleProps.position === Position.Top || handleProps.position === Position.Bottom) {
            borderStyle.transform = 'translate(-50%, -50%)';
        } else if (handleProps.position === Position.Right || handleProps.position === Position.Left) {
            borderStyle.transform = 'translate(-50%, -50%)';
        }
    }

    // When full (connection exists), return invisible handle - visual comes from parent's explicit Handle
    return (
        <Handle
            type={handleProps.type}
            position={handleProps.position}
            id={handleProps.id}
            style={{
                ...handleProps.style,
                opacity: 0,
                width: 1,
                height: 1,
                background: 'transparent',
                border: 'none',
                pointerEvents: 'none',
            }}
            onClick={(e) => {
                e.stopPropagation();
                if (handleProps.onClick) handleProps.onClick(e);
            }}
            className="z-99"
        />
    );
};

export const TriggerNode = memo(({ data, selected }: NodeProps) => {
    return (
        <>
            <NodeShell selected={selected} title={data.label as string} type="Trigger" icon={<Webhook className="w-10 h-10 text-neutral-200" />} className="rounded-l-[60px]" />
            <Handle type="source" id="source" position={Position.Right} style={handleStyle} className="z-99" />
            <SmartPlusHandle
                id="source"
                type="source"
                position={Position.Right}
                style={handleStyle}
                maxConnections={1}
                onSmartClick={data.onAddClick}
                draggingFrom={data.draggingFrom}
            />
        </>
    );
});

export const ActionNode = memo(({ data, selected }: NodeProps) => {
    // Helper to determine display data based on connector type if not provided explicitly
    const getDisplayData = () => {
        const type = (data.connectorType as string || '').toLowerCase();
        const title = data.label as string;

        // If title is generic "Action node", try to improve it
        if (!title || title === "action node") {
            switch (type) {
                case 'slack': return { title: 'Slack', subtitle: 'Send Message' };
                case 'http': return { title: 'HTTP Request', subtitle: 'Make Request' };
                case 'openai': return { title: 'OpenAI', subtitle: 'Generate Text' };
                case 'anthropic': return { title: 'Anthropic', subtitle: 'Claude Model' };
                case 'deepseek': return { title: 'DeepSeek', subtitle: 'LLM Generation' };
                case 'google': return { title: 'Google', subtitle: 'Google Workspace' };
                case 'gemini': return { title: 'Gemini', subtitle: 'Multimodal AI' };
                case 'supabase': return { title: 'Supabase', subtitle: 'Database Action' };
                default: return { title: 'Action', subtitle: 'Perform Action' };
            }
        }

        return { title, subtitle: data.description as string };
    };

    const display = getDisplayData();
    const iconUrl = data.iconUrl as string;
    const customIcon = iconUrl ? <img src={iconUrl} alt={display.title} className="w-10 h-10 object-contain" /> : undefined;

    return (
        <>
            <Handle type="target" position={Position.Left} style={handleStyle} className="z-99" />
            <NodeShell
                selected={selected}
                title={display.title}
                type={data.connectorType == 'http' ? 'HTTP' : data.connectorType as string || "Action"}
                icon={customIcon}
            // Let NodeShell handle the icon via connectorType if not passed
            >
                <div className="flex flex-col gap-1">
                    <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">{display.subtitle || "Performs an action"}</p>
                </div>
            </NodeShell>
            <Handle type="source" id="source" position={Position.Right} style={{ ...handleStyle }} className="z-99" />
            <SmartPlusHandle
                id="source"
                type="source"
                position={Position.Right}
                style={{ ...handleStyle, top: '50%' }}
                onSmartClick={data.onAddClick}
                draggingFrom={data.draggingFrom}
                nodeWidth={100}
            />
        </>
    );
});

export const ConditionNode = memo(({ data, selected }: NodeProps) => {
    return (
        <div className="relative flex flex-col items-center">
            <Handle type="target" position={Position.Left} style={handleStyle} className="z-99" />
            <NodeShell selected={selected} title={data.label as string || "Condition"} type="Condition" icon={<img src="/if-else-icon.svg" alt="Condition" className="w-10 h-10 text-neutral-200" />} />

            {/* True Path */}
            <Handle
                id="true"
                type="source"
                position={Position.Right}
                style={{ ...handleStyle, top: '25%', transform: 'translateY(-50%)' }}
                className="z-99"
            />
            <SmartPlusHandle
                id="true"
                type="source"
                position={Position.Right}
                style={{ ...handleStyle, top: '25%', transform: 'translateY(-50%)' }}
                onSmartClick={data.onAddClick}
                draggingFrom={data.draggingFrom}
                nodeWidth={100}
            />
            <div className={`absolute top-[25%] -right-8 -translate-y-1/2 text-[9px] text-neutral-200 font-bold tracking-tighter bg-neutral-900 z-20`}>TRUE</div>

            {/* False Path */}
            <Handle
                id="false"
                type="source"
                position={Position.Right}
                style={{ ...handleStyle, top: '75%', transform: 'translateY(-50%)' }}
                className="z-99"
            />
            <SmartPlusHandle
                id="false"
                type="source"
                position={Position.Right}
                style={{ ...handleStyle, top: '75%', transform: 'translateY(-50%)' }}
                onSmartClick={data.onAddClick}
                draggingFrom={data.draggingFrom}
                nodeWidth={100}
            />
            <div className="absolute top-[75%] -right-9 -translate-y-1/2 text-[9px] text-neutral-200 font-bold tracking-tighter bg-neutral-900 z-20">FALSE</div>
        </div>
    );
});

export const AgentNode = memo(({ data, selected }: NodeProps) => {
    const nodeId = useNodeId();
    const edges = useEdges();

    // Check if handles are at max connections
    const isModelFull = edges.filter(e => e.target === nodeId && e.targetHandle === 'model').length >= 1;
    const isMemoryFull = edges.filter(e => e.target === nodeId && e.targetHandle === 'memory').length >= 1;

    return (
        <div className="relative">
            <Handle type="target" position={Position.Left} style={handleStyle} className="z-99" />

            <Card className={cn(
                "flex w-[200px] !important h-[100px] p-0 items-center border border-border bg-[#1c1c1c] transition-all rounded-[18px]",
                selected ? "border-neutral-500 shadow-md" : ""
            )}>
                <div className="flex items-center gap-2 pl-3">
                    <Bot className="w-10 h-10 text-neutral-200" />
                    <div className="font-semibold text-md text-neutral-200 mt-1">{data.label as string || "AI Agent"}</div>
                </div>
            </Card>

            {/* Diamond Handles at Bottom */}
            <Handle
                type="target"
                id="model"
                position={Position.Bottom}
                style={{
                    left: 30,
                    bottom: -10,
                    width: 10,
                    height: 10,
                    background: 'transparent',  // Make handle invisible
                    border: 'none',
                    transform: 'translate(-50%, -50%)',  // ⬅️ NO rotation here!
                    padding: 0,
                    pointerEvents: isModelFull ? 'none' : 'all'
                }}
            >
                {/* Child div that does the rotation */}
                <div style={{
                    width: 10,
                    height: 10,
                    background: '#1c1c1c',
                    border: '1px solid #b1b1b7',
                    transform: 'rotate(45deg)',  // ⬅️ Rotation happens here
                    position: 'absolute',
                    top: 0,
                    left: 0,
                }}
                />

            </Handle>
            <SmartPlusHandle
                type="target"
                id="model"
                position={Position.Bottom}
                style={{
                    left: 30,
                    height: 100,
                }}
                shape="diamond"
                maxConnections={1}
                onSmartClick={data.onAddClick}
                allowedNodeTypes={['modelNode']}
                draggingFrom={data.draggingFrom}
                diamondStyle={{
                    top: 92,
                }}
            />
            <Handle
                type="target"
                id="memory"
                position={Position.Bottom}
                style={{
                    left: 90,
                    bottom: -10,
                    width: 10,
                    height: 10,
                    background: 'transparent',  // Make handle invisible
                    border: 'none',
                    transform: 'translate(-50%, -50%)',  // ⬅️ NO rotation here!
                    padding: 0,
                    pointerEvents: isMemoryFull ? 'none' : 'all'
                }}
            >
                {/* Child div that does the rotation */}
                <div style={{
                    width: 10,
                    height: 10,
                    background: '#1c1c1c',
                    border: '1px solid #b1b1b7',
                    transform: 'rotate(45deg)',  // ⬅️ Rotation happens here
                    position: 'absolute',
                    top: 0,
                    left: 0,
                }} />
            </Handle>
            <SmartPlusHandle
                type="target"
                id="memory"
                position={Position.Bottom}
                style={{
                    left: 90,
                    height: 100,
                }}
                shape="diamond"
                maxConnections={1}
                onSmartClick={data.onAddClick}
                allowedNodeTypes={['memoryNode']}
                draggingFrom={data.draggingFrom}
                diamondStyle={{
                    top: 92,
                }}
            />
            <Handle
                type="target"
                id="tools"
                position={Position.Bottom}
                style={{
                    left: 150,
                    bottom: -10,
                    width: 10,
                    height: 10,
                    background: 'transparent',  // Make handle invisible
                    border: 'none',
                    transform: 'translate(-50%, -50%)',  // ⬅️ NO rotation here!
                    padding: 0,
                }}
            >
                {/* Child div that does the rotation */}
                <div style={{
                    width: 10,
                    height: 10,
                    background: '#1c1c1c',
                    border: '1px solid #b1b1b7',
                    transform: 'rotate(45deg)',  // ⬅️ Rotation happens here
                    position: 'absolute',
                    top: 0,
                    left: 0,
                }} />
            </Handle>
            <SmartPlusHandle
                type="target"
                id="tools"
                position={Position.Bottom}
                style={{
                    left: 150,
                    height: 100,
                }}
                shape="diamond"
                maxConnections={Infinity}
                onSmartClick={data.onAddClick}
                allowedNodeTypes={['toolsNode']}
                draggingFrom={data.draggingFrom}
                diamondStyle={{
                    top: 92,
                }}
            />

            {/* Resource Labels - Positioned under handles */}
            <div className="absolute top-full left-[30px] -translate-x-1/2 mt-3 text-[9px] font-bold text-neutral-500 uppercase tracking-wider bg-neutral-900 px-1.5 py-0.5 backdrop-blur-sm z-20">Model</div>
            <div className="absolute top-full left-[90px] -translate-x-1/2 mt-3 text-[9px] font-bold text-neutral-500 uppercase tracking-wider bg-neutral-900 px-1.5 py-0.5 backdrop-blur-sm z-20">Memory</div>
            <div className="absolute top-full left-[150px] -translate-x-1/2 mt-3 text-[9px] font-bold text-neutral-500 uppercase tracking-wider bg-neutral-900 px-1.5 py-0.5 backdrop-blur-sm z-20">Tools</div>

            <Handle type="source" id="source" position={Position.Right} style={handleStyle} className="z-99" />
            <SmartPlusHandle
                id="source"
                type="source"
                position={Position.Right}
                style={{ ...handleStyle, top: '50%' }}
                nodeWidth={200}
                maxConnections={1}
                onSmartClick={data.onAddClick}
                draggingFrom={data.draggingFrom}
            />
        </div>
    );
});// Reusable Agent Resource Node - Used for Model, Memory, Tool nodes
const AgentResourceNode = memo(({ data, selected }: NodeProps) => {
    // Icon can be passed via data.icon (React element) or data.iconUrl (image URL)
    const renderIcon = () => {
        if (data.iconUrl) {
            return <img src={data.iconUrl as string} alt="Node Icon" style={{ width: '25px', height: '25px' }} />;
        }
        if (data.icon) {
            return data.icon as React.ReactNode;
        }
        // Default icon
        return (
            <svg width="25" height="25" viewBox="0 0 24 24" fill="none" className="text-neutral-200">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
        );
    };

    return (
        <div className="relative flex flex-col items-center">
            {/* Top Diamond Handle - Connects to AI Agent input */}
            <Handle
                type="source"
                position={Position.Top}
                style={{
                    top: 1,
                    left: '50%',
                    width: 10,
                    height: 10,
                    background: 'transparent',
                    border: 'none',
                    transform: 'translate(-50%, -50%)',
                    padding: 0,
                    zIndex: 99,
                }}
            >
                <div style={{
                    width: 10,
                    height: 10,
                    background: '#1c1c1c',
                    border: '1px solid #b1b1b7',
                    transform: 'rotate(45deg)',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                }} />
            </Handle>

            {/* Circular Node */}
            <Card className={cn(
                "w-[60px] h-[60px] rounded-full p-0 flex items-center justify-center bg-[#1c1c1c] transition-all relative border border-neutral-800",
                selected ? "border-neutral-500 shadow-md" : ""
            )}>
                <div className="flex flex-col items-center justify-center gap-2">
                    {renderIcon()}

                    {/* Warning Icon */}
                    {(data.hasWarning as boolean) && (
                        <div className="absolute bottom-8 right-8 w-6 h-6 bg-red-500 rounded-sm flex items-center justify-center" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}>
                            <span className="text-white text-xs font-bold mb-1">!</span>
                        </div>
                    )}
                </div>
            </Card>

            {/* Label below node */}
            <div className="absolute top-full mt-3 flex flex-col items-center text-center pointer-events-none z-20">
                <span className="text-[10px] text-nowrap text-neutral-200 leading-none">
                    {(data.label as string) || (data.defaultLabel as string) || "Resource Node"}
                </span>
            </div>
        </div>
    );
});

// Wrapper components that pass specific defaults
export const ModelNode = memo((props: NodeProps) => (
    <AgentResourceNode
        {...props}
        data={{
            ...props.data,
            iconUrl: 'https://jdoswygfcisugxlzlfly.supabase.co/storage/v1/object/public/connector-logos/OpenAi.png',
            defaultLabel: 'OpenAI Chat Model',
        }}
    />
));

export const MemoryNode = memo((props: NodeProps) => (
    <AgentResourceNode
        {...props}
        data={{
            ...props.data,
            icon: <Database color="#e5e5e5" />,
            defaultLabel: 'Window Buffer Memory',
        }}
    />
));

export const ToolNode = memo((props: NodeProps) => (
    <AgentResourceNode
        {...props}
        data={{
            ...props.data,
            icon: <Wrench color="#e5e5e5" />,
            defaultLabel: 'Tool Node',
        }}
    />
));