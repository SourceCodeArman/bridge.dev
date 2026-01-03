import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { SmartPlusHandle } from './CustomNodes';
import { ThemeAwareIcon } from '@/components/connectors/ThemeAwareIcon';
import { Bolt } from 'lucide-react';
import React from 'react';

// Custom Node Component for user-defined connectors
export const CustomNode = memo(({ data, selected }: NodeProps) => {
    // Extract UI settings from data (which comes from manifest.ui)
    const ui = data.ui as {
        nodeSize?: { width: number; height: number },
        handles?: { [key: string]: number },
        handleNames?: Record<string, string>,
        handleLocations?: string[], // Legacy fallback
        outputHandles?: number,
        customRadius?: string,
        handleStyling?: any
    } || {};

    const nodeSize = ui.nodeSize || { width: 100, height: 100 };
    const maxConnections = ui.outputHandles === -1 ? Infinity : (ui.outputHandles || 1);
    const isWide = nodeSize.width >= 200;
    const customRadius = ui.customRadius;
    const handleStyling = ui.handleStyling;

    // Handle Generation Logic
    const renderHandles = () => {
        const handles = [];
        const handleCounts = ui.handles || {
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
        };
        const handleNames = ui.handleNames || {};

        // Fallback for legacy handleLocations if handles config is missing
        if (!ui.handles && ui.handleLocations) {
            ui.handleLocations.forEach((loc: string) => {
                handleCounts[loc] = 1;
            });
            // Ensure at least right is 1 if nothing set?
            if (Object.values(handleCounts).every(v => v === 0)) handleCounts.right = 1;
        } else if (!ui.handles && !ui.handleLocations) {
            // Default default
            handleCounts.left = 1;
            handleCounts.right = 1;
        }

        const sides = ['left', 'right', 'top', 'bottom'];

        for (const side of sides) {
            const count = handleCounts[side] || 0;
            if (count === 0) continue;

            for (let i = 0; i < count; i++) {
                const isTarget = side === 'left' || side === 'top';
                const position = side === 'left' ? Position.Left :
                    side === 'right' ? Position.Right :
                        side === 'top' ? Position.Top : Position.Bottom;

                const handleId = `${isTarget ? 'target' : 'source'}-${side}-${i}`;

                // Key for looking up name (matches abstract key in wizard)
                const nameKey = `${side}-${i}`;
                const handleName = handleNames[nameKey];

                // Calculate position percentage
                const offset = (i + 1) * (100 / (count + 1));

                // Determine handle style
                const style: React.CSSProperties = {
                    width: '10px',
                    height: '10px',
                    background: 'var(--background)',
                    position: 'absolute',
                    zIndex: 20,
                    border: '1px solid var(--border)'
                };

                if (handleStyling) {
                    const { rotation, borderRadius, translation } = handleStyling;
                    if (rotation) {
                        style.transform = (style.transform || '') + ` rotate(${rotation}deg)`;
                    }
                    if (borderRadius !== undefined) {
                        style.borderRadius = borderRadius;
                    }

                    // Apply translation if available
                    if (translation) {
                        // Horizontal handles (Left/Right) - use rightLeft config
                        if (side === 'left' || side === 'right') {
                            const { x, y } = translation.rightLeft || { x: 0, y: 0 };
                            if (x) style.transform = (style.transform || '') + ` translateX(${x})`;
                            if (y) style.transform = (style.transform || '') + ` translateY(${y})`;
                        }

                        // Vertical handles (Top/Bottom) - use topBottom config
                        if (side === 'top' || side === 'bottom') {
                            const { x, y } = translation.topBottom || { x: 0, y: 0 };
                            if (x) style.transform = (style.transform || '') + ` translateX(${x})`;
                            if (y) style.transform = (style.transform || '') + ` translateY(${y})`;
                        }
                    }
                } else {
                    // Default circular
                    style.borderRadius = '50%';
                }


                // Consistent centering logic
                const baseTransform = 'translate(-50%, -50%)';

                if (side === 'left') {
                    style.left = '0';
                    style.top = `${offset}%`;
                    style.transform = `${baseTransform} ${style.transform || ''}`;
                } else if (side === 'right') {
                    style.left = '100%';
                    style.top = `${offset}%`;
                    style.transform = `${baseTransform} ${style.transform || ''}`;
                } else if (side === 'top') {
                    style.top = '0';
                    style.left = `${offset}%`;
                    style.transform = `${baseTransform} ${style.transform || ''}`;
                } else {
                    style.top = '100%';
                    style.left = `${offset}%`;
                    style.transform = `${baseTransform} ${style.transform || ''}`;
                }


                let labelStyle: React.CSSProperties = {
                    position: 'absolute',
                    fontSize: '9px',
                    color: '#a3a3a3',
                    whiteSpace: 'nowrap',
                    textTransform: 'uppercase',
                    fontWeight: 500,
                    pointerEvents: 'none',
                    zIndex: 20
                };

                // Helper for label positioning 
                // Note: NodePreview uses tooltip-like labels on hover. 
                // CustomNode logic for always-visible labels on wide nodes is good to keep.
                if (side === 'left') {
                    labelStyle.right = 'calc(100% + 8px)';
                    labelStyle.top = `${offset}%`;
                    labelStyle.transform = 'translateY(-50%)';
                    labelStyle.textAlign = 'right';
                } else if (side === 'right') {
                    labelStyle.left = 'calc(100% + 8px)';
                    labelStyle.top = `${offset}%`;
                    labelStyle.transform = 'translateY(-50%)';
                    labelStyle.textAlign = 'left';
                } else if (side === 'top') {
                    labelStyle.bottom = 'calc(100% + 8px)';
                    labelStyle.left = `${offset}%`;
                    labelStyle.transform = 'translateX(-50%)';
                } else {
                    labelStyle.top = 'calc(100% + 8px)';
                    labelStyle.left = `${offset}%`;
                    labelStyle.transform = 'translateX(-50%)';
                }

                // Push Label first (so handle is on top if overlap, though Z-index handles it)
                if (isWide && handleName) {
                    handles.push(
                        <span key={`label-${handleId}`} style={labelStyle}>
                            {handleName}
                        </span>
                    );
                }

                if (isTarget) {
                    handles.push(
                        <Handle
                            key={handleId}
                            type="target"
                            id={handleId}
                            position={position}
                            style={style}
                            className="z-10"
                        />
                    );
                } else {
                    // Source - Use SmartPlusHandle logic? 
                    // To strictly match NodePreview visual, we'd use the dot + plus button.
                    // But for actual functionality, we need ReactFlow Handle.
                    // The previous CustomNode implementation used Handle + SmartPlusHandle. 
                    // I will keep that functional logic but ensure the STYLE matches NodePreview's handle style.
                    handles.push(
                        <React.Fragment key={handleId}>
                            <Handle
                                type="source"
                                id={handleId}
                                position={position}
                                style={style}
                                className="z-10"
                            />
                            {/* Only show SmartPlusHandle if we want that behavior. CustomNode had it. */}
                            <SmartPlusHandle
                                id={handleId}
                                type="source"
                                position={position}
                                style={{
                                    ...style,
                                    // Reset transform for SmartPlusHandle wrapper as it might handle its own positioning
                                    transform: undefined,
                                    top: (side === 'right' || side === 'left') ? `${offset}%` : undefined,
                                    left: (side === 'bottom' || side === 'top') ? `${offset}%` : undefined,
                                }}
                                maxConnections={maxConnections}
                                onSmartClick={data.onAddClick}
                                draggingFrom={data.draggingFrom}
                                nodeWidth={nodeSize.width}
                            />
                        </React.Fragment>
                    );
                }
            }
        }
        return handles;
    };

    const iconUrlLight = data.iconUrlLight as string;
    const iconUrlDark = data.iconUrlDark as string;

    return (
        <div className="relative flex flex-col items-center">
            {/* Render Handles */}
            {renderHandles()}

            {/* Node Shell */}
            <Card
                className={cn(
                    "p-0 flex items-center border border-border bg-background transition-all relative shadow-xl z-10",
                    selected ? "border-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]" : "hover:border-neutral-500",
                    isWide ? "justify-start px-3" : "justify-center"
                )}
                style={{
                    width: nodeSize.width,
                    height: nodeSize.height,
                    borderRadius: customRadius || '18px'
                }}
            >
                {/* Icon */}
                {(iconUrlLight || iconUrlDark) ? (
                    <ThemeAwareIcon
                        lightSrc={iconUrlLight}
                        darkSrc={iconUrlDark}
                        alt="Icon"
                        className={cn("object-contain select-none pointer-events-none", isWide ? "w-8 h-8 mr-3" : "w-10 h-10")}
                    />
                ) : (
                    <Bolt className={cn("text-muted-foreground", isWide ? "w-8 h-8 mr-3" : "w-10 h-10")} />
                )}

                {/* Wide Layout Text */}
                {isWide && (
                    <div className="flex flex-col overflow-hidden pointer-events-none select-none">
                        <span
                            className="text-[10px] font-bold uppercase tracking-wider leading-none text-foreground truncate"
                        >
                            {data.label as string || "Custom Node"}
                        </span>
                        <div
                            className="text-[9px] text-foreground truncate mt-0.5 max-w-[140px]"
                        >
                            {data.description as string || "Custom connector"}
                        </div>
                    </div>
                )}
            </Card>

            {/* Standard Layout Text (Floating) */}
            {!isWide && (
                <div className="absolute top-full mt-2 flex flex-col items-center text-center pointer-events-none z-20 w-48 gap-2">
                    <span
                        className={cn(
                            "text-[10px] font-bold uppercase tracking-wider leading-none mb-0.5 px-1.5 py-0.5 rounded-full backdrop-blur-sm ",
                            selected ? "text-primary border-primary/30" : "text-foreground bg-background border border-border/50"
                        )}
                    >
                        {data.label as string}
                    </span>
                    <div
                        className="text-[9px] text-foreground leading-tight px-1 line-clamp-2"
                    >
                        {data.description as string}
                    </div>
                </div>
            )}
        </div>
    );
});
