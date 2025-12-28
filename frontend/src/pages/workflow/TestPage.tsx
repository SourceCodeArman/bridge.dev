import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ReactFlow, Background, Controls, BackgroundVariant, Handle, Position, type NodeProps, type Node, type Edge, type Connection, useEdges, useNodeId, useNodesState, useEdgesState, addEdge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Bot, Database, Plus, Webhook, Wrench, Zap } from 'lucide-react';
import { memo, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';

// Common handle styles
const AgentHandleStyle = { padding: '4px', background: '#262626' };

const AgentSmartPlusHandle = ({
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

        let handleOffset = -100; // Distance from node border
        let lineWidth = 100;     // Length of the line

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
        const borderAgentHandleStyle: React.CSSProperties = {
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
                borderAgentHandleStyle.left = handleProps.style.left;
            }
            borderAgentHandleStyle.bottom = -5; // At border
        } else {
            // For other positions, inherit positioning normally
            if (handleProps.style?.top !== undefined) {
                borderAgentHandleStyle.top = handleProps.style.top;
            }
            if (handleProps.style?.bottom !== undefined) {
                borderAgentHandleStyle.bottom = handleProps.style.bottom;
            }
            // Override transform only if explicitly provided
            if (handleProps.style?.transform !== undefined) {
                borderAgentHandleStyle.transform = handleProps.style.transform;
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
        ...AgentHandleStyle,
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

    // For bottom position diamond handles, selectively copy positioning
    // Don't spread entire handleProps.style as it contains transform that would overwrite rotation
    let finalStyle: React.CSSProperties;
    if (handleProps.position === Position.Bottom && shape === 'diamond') {
        finalStyle = {
            ...borderStyle,
            bottom: -5,
            top: handleProps.style?.top, // Position at bottom border
            left: handleProps.style?.left, // Preserve horizontal positioning (30, 110, 190 for Model, Memory, Tools)
        };
    } else {
        finalStyle = { ...borderStyle, ...handleProps.style };
    }
    console.log(isFull)
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

export const AgentNode = memo(({ data, selected }: NodeProps) => {
    const nodeId = useNodeId();
    const edges = useEdges();

    // Check if handles are at max connections
    const isModelFull = edges.filter(e => e.target === nodeId && e.targetHandle === 'model').length >= 1;
    const isMemoryFull = edges.filter(e => e.target === nodeId && e.targetHandle === 'memory').length >= 1;

    return (
        <div className="relative">
            <Handle type="target" position={Position.Left} style={AgentHandleStyle} className="z-99" />

            <Card className={cn(
                "flex min-w-[200px] h-[100px] p-0 items-center border border-border bg-[#1c1c1c] transition-all rounded-[18px]",
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
            <AgentSmartPlusHandle
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
                    left: 92,
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
            <AgentSmartPlusHandle
                type="target"
                id="memory"
                position={Position.Bottom}
                style={{
                    left: 92,
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
                    left: 154,
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
            <AgentSmartPlusHandle
                type="target"
                id="tools"
                position={Position.Bottom}
                style={{
                    left: 154,
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
            <div className="absolute top-full left-[92px] -translate-x-1/2 mt-3 text-[9px] font-bold text-neutral-500 uppercase tracking-wider bg-neutral-900 px-1.5 py-0.5 backdrop-blur-sm z-20">Memory</div>
            <div className="absolute top-full left-[154px] -translate-x-1/2 mt-3 text-[9px] font-bold text-neutral-500 uppercase tracking-wider bg-neutral-900 px-1.5 py-0.5 backdrop-blur-sm z-20">Tools</div>

            <Handle type="source" id="source" position={Position.Right} style={AgentHandleStyle} className="z-99" />
            <AgentSmartPlusHandle
                id="source"
                type="source"
                position={Position.Right}
                style={{ ...AgentHandleStyle, top: '50%' }}
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
                "w-[50px] h-[50px] rounded-full p-0 flex items-center justify-center bg-[#1c1c1c] transition-all relative border border-neutral-800",
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

const nodeTypes = {
    agent: AgentNode,
    model: ModelNode,
    memory: MemoryNode,
    tool: ToolNode,
};

export default function TestPage() {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [isAddNodeOpen, setIsAddNodeOpen] = useState(false);
    const [pendingConnection, setPendingConnection] = useState<{
        sourceId: string;
        handleId: string;
        type: string;
    } | null>(null);
    const [draggingFrom, setDraggingFrom] = useState<{
        nodeId: string;
        handleId: string | null;
    } | null>(null);

    // Handle AgentSmartPlusHandle click - opens the node menu and stores connection info
    const handleSmartAdd = (sourceId: string, handleId: string, type: string) => {
        console.log('AgentSmartPlusHandle clicked:', { sourceId, handleId, type });
        setPendingConnection({ sourceId, handleId, type });
        setIsAddNodeOpen(true);
    };

    // Track when connection drag starts
    const onConnectStart = useCallback((_: any, { nodeId, handleId }: { nodeId: string | null; handleId: string | null }) => {
        if (nodeId) {
            setDraggingFrom({ nodeId, handleId });
            // Update nodes to pass dragging info
            setNodes(nds => nds.map(n => ({
                ...n,
                data: { ...n.data, draggingFrom: { nodeId, handleId } }
            })));
        }
    }, [setNodes]);

    // Track when connection drag ends
    const onConnectEnd = useCallback(() => {
        setDraggingFrom(null);
        // Clear dragging info from nodes
        setNodes(nds => nds.map(n => ({
            ...n,
            data: { ...n.data, draggingFrom: null }
        })));
    }, [setNodes]);

    // Handle edge connections
    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    );

    // Validate connections - prevent connections to full handles and restrict node types
    const isValidConnection = useCallback((connection: Connection | Edge) => {
        const targetHandle = connection.targetHandle;
        const target = connection.target;
        const source = connection.source;

        // Find the source node to check its type
        const sourceNode = nodes.find(n => n.id === source);
        const sourceType = sourceNode?.type;

        // Restrict which node types can connect to which handles
        if (targetHandle === 'model') {
            // Only model nodes can connect to model handle
            if (sourceType !== 'model') {
                return false;
            }
            // Check max connections
            const existingConnections = edges.filter(
                edge => edge.target === target && edge.targetHandle === targetHandle
            );
            if (existingConnections.length >= 1) {
                return false;
            }
        } else if (targetHandle === 'memory') {
            // Only memory nodes can connect to memory handle
            if (sourceType !== 'memory') {
                return false;
            }
            // Check max connections
            const existingConnections = edges.filter(
                edge => edge.target === target && edge.targetHandle === targetHandle
            );
            if (existingConnections.length >= 1) {
                return false;
            }
        } else if (targetHandle === 'tools') {
            // Only tool nodes can connect to tools handle
            if (sourceType !== 'tool') {
                return false;
            }
            // Tools handle allows unlimited connections
        }

        return true;
    }, [edges, nodes]);

    // Initialize first node with callback
    useState(() => {
        setNodes([{
            id: 'agent-1',
            type: 'agent',
            position: { x: 250, y: 250 },
            data: {
                label: 'Test Agent',
                onAddClick: handleSmartAdd
            },
        }]);
    });

    const handleAddNodeClick = (type: string) => {
        // Find the source node to position the new node nearby
        const sourceNode = pendingConnection
            ? nodes.find(n => n.id === pendingConnection.sourceId)
            : null;

        // Calculate position - place below for target handles, to the right for source handles
        let position = { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 };
        if (sourceNode) {
            // Get source node dimensions (default to AgentNode size if unknown)
            const sourceWidth = sourceNode.type === 'agent' ? 184 : 60; // agent=184px, model=60px

            if (pendingConnection?.type === 'target') {
                // Target handle (like Model/Memory/Tools) - place new node BELOW
                // Calculate x offset based on which handle was clicked
                // Handle positions: model=30px, memory=92px, tools=154px from left edge
                let handleXOffset = 30; // default to model position
                const handleId = pendingConnection.handleId;
                if (handleId === 'memory') {
                    handleXOffset = 92;
                } else if (handleId === 'tools') {
                    handleXOffset = 154;
                }

                position = {
                    x: sourceNode.position.x + handleXOffset - 30, // Center the 60px resource node on the handle
                    y: sourceNode.position.y + 200
                };
            } else {
                // Source handle - place new node TO THE RIGHT
                // Left border of new node should be 100px from right border of source node
                position = {
                    x: sourceNode.position.x + sourceWidth + 100,
                    y: sourceNode.position.y
                };
            }
        }

        const newNode = {
            id: `${type}-${Math.random().toString(36).substr(2, 9)}`,
            type,
            position,
            data: {
                label: type === 'agent' ? 'AI Agent'
                    : type === 'model' ? 'OpenAI Chat Model'
                        : type === 'memory' ? 'Window Buffer Memory'
                            : type === 'tool' ? 'Calculator Tool'
                                : 'Node',
                onAddClick: handleSmartAdd
            },
        };
        setNodes((nds) => [...nds, newNode]);

        // Auto-create edge if there's a pending connection
        if (pendingConnection) {
            let newEdge;
            if (pendingConnection.type === 'target') {
                // Connection from NEW node (source) -> EXISTING node (target handle)
                newEdge = {
                    id: `e-${newNode.id}-${pendingConnection.sourceId}`,
                    source: newNode.id,
                    target: pendingConnection.sourceId,
                    targetHandle: pendingConnection.handleId,
                };
            } else {
                // Connection from EXISTING node (source handle) -> NEW node (target)
                newEdge = {
                    id: `e-${pendingConnection.sourceId}-${newNode.id}`,
                    source: pendingConnection.sourceId,
                    sourceHandle: pendingConnection.handleId,
                    target: newNode.id,
                };
            }
            setEdges((eds) => addEdge(newEdge, eds));
            setPendingConnection(null);
        }

        setIsAddNodeOpen(false);
    };

    return (
        <div className="h-screen w-screen bg-neutral-900 relative">
            {/* Add Node Button & Menu */}
            <Sheet open={isAddNodeOpen} onOpenChange={setIsAddNodeOpen}>
                <SheetTrigger asChild>
                    <Button className="rounded-full w-10 h-10 p-0 shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground absolute top-4 left-4 z-50">
                        <Plus className="w-6 h-6" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[400px] overflow-y-auto bg-neutral-800">
                    <SheetHeader className="mb-4">
                        <SheetTitle>Add Node</SheetTitle>
                    </SheetHeader>
                    <div className="flex flex-col gap-4 text-neutral-200">
                        <h3 className="font-semibold text-sm">Components</h3>
                        <div className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">AI Nodes</div>

                            {/* AI Agent Node */}
                            <div
                                className="border p-3 rounded cursor-pointer bg-card hover:bg-accent flex items-center gap-3 transition-colors"
                                onClick={() => handleAddNodeClick('agent')}
                            >
                                <Bot className="w-5 h-5 text-neutral-200" />
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium">AI Agent</span>
                                    <span className="text-xs text-muted-foreground">Intelligent agent node</span>
                                </div>
                            </div>

                            {/* OpenAI Model Node - only show when clicking model handle or no specific handle */}
                            {(!pendingConnection || pendingConnection.handleId === 'model' || pendingConnection.type === 'source') && (
                                <div
                                    className="border p-3 rounded cursor-pointer bg-card hover:bg-accent flex items-center gap-3 transition-colors"
                                    onClick={() => handleAddNodeClick('model')}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-neutral-200">
                                        <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" fill="currentColor" />
                                    </svg>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">OpenAI Model</span>
                                        <span className="text-xs text-muted-foreground">Chat completion model</span>
                                    </div>
                                </div>
                            )}

                            {/* Memory Node - only show when clicking memory handle or no specific handle */}
                            {(!pendingConnection || pendingConnection.handleId === 'memory' || pendingConnection.type === 'source') && (
                                <div
                                    className="border p-3 rounded cursor-pointer bg-card hover:bg-accent flex items-center gap-3 transition-colors"
                                    onClick={() => handleAddNodeClick('memory')}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-neutral-200">
                                        <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6A4.997 4.997 0 017 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z" fill="currentColor" />
                                    </svg>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">Memory Node</span>
                                        <span className="text-xs text-muted-foreground">Window buffer memory</span>
                                    </div>
                                </div>
                            )}

                            {/* Tool Node - only show when clicking tools handle or no specific handle */}
                            {(!pendingConnection || pendingConnection.handleId === 'tools' || pendingConnection.type === 'source') && (
                                <div
                                    className="border p-3 rounded cursor-pointer bg-card hover:bg-accent flex items-center gap-3 transition-colors"
                                    onClick={() => handleAddNodeClick('tool')}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-neutral-200">
                                        <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" fill="currentColor" />
                                    </svg>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">Tool Node</span>
                                        <span className="text-xs text-muted-foreground">Calculator, API, etc.</span>
                                    </div>
                                </div>
                            )}

                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 mt-4">Triggers</div>

                            {/* Webhook Trigger */}
                            <div
                                className="border p-3 rounded cursor-pointer bg-card hover:bg-accent flex items-center gap-3 transition-colors opacity-50"
                            >
                                <Webhook className="w-5 h-5 text-neutral-200" />
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium">Webhook Trigger</span>
                                    <span className="text-xs text-muted-foreground">Coming soon</span>
                                </div>
                            </div>

                            {/* Schedule Trigger */}
                            <div
                                className="border p-3 rounded cursor-pointer bg-card hover:bg-accent flex items-center gap-3 transition-colors opacity-50"
                            >
                                <Zap className="w-5 h-5 text-neutral-200" />
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium">Schedule Trigger</span>
                                    <span className="text-xs text-muted-foreground">Coming soon</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                isValidConnection={isValidConnection}
                nodeTypes={nodeTypes}
                fitView
            >
                <Background
                    id="2"
                    gap={10}
                    color="#353535"
                    variant={BackgroundVariant.Dots}
                />
                <Controls />
            </ReactFlow>
        </div>
    );
}