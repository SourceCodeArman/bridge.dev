import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { SmartPlusHandle, ConnectorIcon } from './CustomNodes';
import React from 'react';

// Custom Node Component for user-defined connectors
export const CustomNode = memo(({ data, selected }: NodeProps) => {
    // Extract UI settings from data (which comes from manifest.ui)
    const ui = data.ui as {
        nodeSize?: { width: number; height: number },
        handles?: { [key: string]: number },
        handleNames?: Record<string, string>,
        handleLocations?: string[], // Legacy fallback
        outputHandles?: number
    } || {};

    const nodeSize = ui.nodeSize || { width: 100, height: 100 };
    const maxConnections = ui.outputHandles === -1 ? Infinity : (ui.outputHandles || 1);
    const isWide = nodeSize.width >= 200;

    // Style helper
    const handleStyle = { padding: '4px', background: '#262626' };

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
                const style: React.CSSProperties = { ...handleStyle };

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

                if (side === 'left') {
                    style.top = `${offset}%`;

                    labelStyle.right = 'calc(100% + 8px)';
                    labelStyle.top = `${offset}%`;
                    labelStyle.transform = 'translateY(-50%)';
                    labelStyle.textAlign = 'right';
                } else if (side === 'right') {
                    style.top = `${offset}%`;

                    labelStyle.left = 'calc(100% + 8px)';
                    labelStyle.top = `${offset}%`;
                    labelStyle.transform = 'translateY(-50%)';
                    labelStyle.textAlign = 'left';
                } else {
                    style.left = `${offset}%`;

                    if (side === 'top') {
                        labelStyle.bottom = 'calc(100% + 8px)';
                        labelStyle.left = `${offset}%`;
                        labelStyle.transform = 'translateX(-50%)';
                    } else {
                        labelStyle.top = 'calc(100% + 8px)';
                        labelStyle.left = `${offset}%`;
                        labelStyle.transform = 'translateX(-50%)';
                    }
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
                    // Source - Use SmartPlusHandle
                    handles.push(
                        <React.Fragment key={handleId}>
                            <Handle
                                type="source"
                                id={handleId}
                                position={position}
                                style={style}
                                className="z-10"
                            />
                            <SmartPlusHandle
                                id={handleId}
                                type="source"
                                position={position}
                                style={style}
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

    const customIcon = data.iconUrl as string;

    return (
        <div className="relative flex flex-col items-center">
            {/* Render Handles */}
            {renderHandles()}

            {/* Node Shell */}
            <Card
                className={cn(
                    "p-0 flex items-center border border-border bg-[#1c1c1c] transition-all rounded-[18px] z-10 relative",
                    selected ? "border-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]" : "hover:border-neutral-500",
                    isWide ? "justify-start px-3" : "justify-center"
                )}
                style={{
                    width: nodeSize.width,
                    height: nodeSize.height
                }}
            >
                {/* Icon */}
                {customIcon ? (
                    <img src={customIcon} alt="Icon" className={cn("object-contain select-none pointer-events-none", isWide ? "w-8 h-8 mr-3" : "w-10 h-10")} />
                ) : (
                    <ConnectorIcon type="custom" className={cn("select-none pointer-events-none", isWide ? "w-8 h-8 mr-3" : "w-10 h-10")} />
                )}

                {/* Wide Layout Text */}
                {isWide && (
                    <div className="flex flex-col overflow-hidden pointer-events-none select-none">
                        <span className="text-[10px] font-bold uppercase tracking-wider leading-none text-foreground truncate">
                            {data.label as string || "Custom Node"}
                        </span>
                        <div className="text-[9px] text-muted-foreground truncate mt-0.5 max-w-[140px]">
                            {data.description as string || "Custom connector"}
                        </div>
                    </div>
                )}
            </Card>

            {/* Standard Layout Text (Floating) */}
            {!isWide && (
                <div className="absolute top-full mt-2 flex flex-col items-center text-center pointer-events-none z-20 w-48">
                    <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider leading-none mb-0.5 px-1.5 py-0.5 rounded-full backdrop-blur-sm ",
                        selected ? "text-primary border-primary/30" : "text-foreground"
                    )}>
                        {data.label as string}
                    </span>
                    <div className="text-[9px] text-muted-foreground leading-tight px-1 line-clamp-2">
                        {data.description as string}
                    </div>
                </div>
            )}
        </div>
    );
});
