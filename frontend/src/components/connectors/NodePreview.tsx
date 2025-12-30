import React from 'react';
import { Card } from '@/components/ui/card';
import { Bolt, Plus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface NodePreviewProps {
    name: string;
    description: string;
    iconFile: File | null;
    nodeSize: { width: number; height: number };
    handleCounts: { [key: string]: number };
    handleNames?: Record<string, string>;
    smartPlusHandles?: Record<string, boolean>; // e.g., { 'right-0': true, 'bottom-1': true }
}

export const SmartPlusHandle = ({
    shape,
    lineType,
    diamondStyle,
    ...handleProps  // Contains position, id, style, etc.
}: any) => {
    const arrowColor = '#b1b1b7';
    const isDashed = lineType === 'dashed';

    // Calculate line styles based on position
    const lineStyle: React.CSSProperties = {
        position: 'absolute',
        zIndex: 10,
        pointerEvents: 'none',
    };

    if (isDashed) {
        lineStyle.background = 'transparent';
        lineStyle.borderColor = arrowColor;
        lineStyle.borderStyle = 'dashed';
        lineStyle.borderWidth = 0;
    } else {
        lineStyle.background = arrowColor;
    }

    // Little dot at the start of the line (on the node border)
    const dotStyle: React.CSSProperties = {
        position: 'absolute',
        width: 8,
        height: 8,
        borderRadius: shape === 'diamond' ? 0 : '50%',
        background: '#1c1c1c',
        zIndex: 11,
        transform: shape === 'diamond' ? 'translate(-50%, -50%) rotate(45deg)' : 'translate(-50%, -50%)',
    };

    const handleOffset = -100;
    let lineWidth = 100;

    if (handleProps.style?.height !== undefined) {
        lineWidth = Number(handleProps.style.height);
    }

    // Specific adjustments per side
    if (handleProps.position === 'right') {
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
    } else if (handleProps.position === 'left') {
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
    } else if (handleProps.position === 'top') {
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
    } else if (handleProps.position === 'bottom') {
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
        cursor: 'pointer',
        zIndex: 12,
    };

    // Position button at END of connector line
    if (handleProps.position === 'right') {
        Object.assign(buttonStyle, {
            right: handleOffset,
            top: handleProps.style?.top !== undefined ? handleProps.style.top : '50%',
            transform: 'translate(0, -50%)',
        });
    } else if (handleProps.position === 'left') {
        Object.assign(buttonStyle, {
            left: handleOffset,
            top: handleProps.style?.top !== undefined ? handleProps.style.top : '50%',
            transform: 'translate(0, -50%)',
        });
    } else if (handleProps.position === 'top') {
        Object.assign(buttonStyle, {
            top: handleOffset,
            left: '50%',
            transform: 'translate(-50%, 0)',
        });
    } else if (handleProps.position === 'bottom') {
        const leftPos = handleProps.style?.left !== undefined ? handleProps.style.left : '50%';
        Object.assign(buttonStyle, {
            bottom: handleOffset,
            left: leftPos,
            transform: 'translate(-50%, 0)',
        });
    }

    return (
        <>
            {/* Connector Line */}
            <div style={lineStyle}>
                <div style={dotStyle} />
            </div>

            {/* Plus Button - visual only */}
            <div
                className="nodrag nopan"
                style={buttonStyle}
            >
                <Plus className="w-2.5 h-2.5 text-neutral-400 pointer-events-none" />
            </div>
        </>
    );
};

export const NodePreview = ({ name, description, iconFile, nodeSize, handleCounts, handleNames, smartPlusHandles }: NodePreviewProps) => {
    const iconUrl = iconFile ? URL.createObjectURL(iconFile) : null;
    const isWide = nodeSize.width >= 200;

    // Simulate handles positioning
    const renderHandles = () => {
        const handles = [];
        const sides = ['left', 'right', 'top', 'bottom'];

        for (const side of sides) {
            const count = handleCounts[side] || 0;
            if (count === 0) continue;

            for (let i = 0; i < count; i++) {
                const style: React.CSSProperties = {
                    position: 'absolute',
                    width: '8px',
                    height: '8px',
                    background: '#262626',
                    border: '1px solid #b1b1b7',
                    borderRadius: '50%',
                    zIndex: 20,
                };

                // Calculate distribution
                const offset = (i + 1) * (100 / (count + 1));
                const key = `${side}-${i}`;
                const handleName = handleNames?.[key];

                let labelStyle: React.CSSProperties = {
                    position: 'absolute',
                    fontSize: '9px',
                    color: '#a3a3a3', // text-muted-foreground
                    whiteSpace: 'nowrap',
                    textTransform: 'uppercase',
                    fontWeight: 500,
                    pointerEvents: 'none'
                };

                if (side === 'left') {
                    style.left = '-4px';
                    style.top = `${offset}%`;
                    style.transform = 'translateY(-50%)';

                    labelStyle.right = 'calc(100% + 8px)';
                    labelStyle.top = `${offset}%`;
                    labelStyle.transform = 'translateY(-50%)';
                    labelStyle.textAlign = 'right';
                } else if (side === 'right') {
                    style.right = '-4px';
                    style.top = `${offset}%`;
                    style.transform = 'translateY(-50%)';

                    labelStyle.left = 'calc(100% + 8px)';
                    labelStyle.top = `${offset}%`;
                    labelStyle.transform = 'translateY(-50%)';
                    labelStyle.textAlign = 'left';
                } else if (side === 'top') {
                    style.top = '-4px';
                    style.left = `${offset}%`;
                    style.transform = 'translateX(-50%)';

                    labelStyle.bottom = 'calc(100% + 8px)';
                    labelStyle.left = `${offset}%`;
                    labelStyle.transform = 'translateX(-50%)';
                } else if (side === 'bottom') {
                    style.bottom = '-4px';
                    style.left = `${offset}%`;
                    style.transform = 'translateX(-50%)';

                    labelStyle.top = 'calc(100% + 8px)';
                    labelStyle.left = `${offset}%`;
                    labelStyle.transform = 'translateX(-50%)';
                }

                handles.push(
                    <React.Fragment key={key}>
                        <div style={style} />
                        {isWide && handleName && (
                            <span style={{ ...labelStyle, backgroundColor: '#171717' }} className="text-xs rounded z-99">{handleName}</span>
                        )}
                        {smartPlusHandles?.[key] && (
                            <SmartPlusHandle
                                key={`${key}-smart`}
                                position={side}
                                style={{
                                    top: (side === 'right' || side === 'left') ? `${offset}%` : undefined,
                                    left: (side === 'bottom' || side === 'top') ? `${offset}%` : undefined,
                                    height: 90
                                }}
                            />
                        )}
                    </React.Fragment>
                );
            }
        }
        return handles;
    };

    return (
        <div className="flex flex-col items-center justify-center p-8 bg-transparent rounded-lg gap-2">
            <div className="relative flex flex-col items-center pointer-events-none select-none">
                {/* Visual Node Box */}
                <Card
                    className={cn(
                        "p-0 flex items-center border border-border bg-neutral-900 transition-all rounded-[18px] relative shadow-xl",
                        isWide ? "justify-start px-3" : "justify-center"
                    )}
                    style={{
                        width: nodeSize.width,
                        height: nodeSize.height,
                    }}
                >
                    {/* Handles */}
                    {renderHandles()}

                    {/* Icon */}
                    {iconUrl ? (
                        <img src={iconUrl} alt="Icon" className={cn("object-contain", isWide ? "w-8 h-8 mr-3" : "w-10 h-10")} />
                    ) : (
                        <Bolt className={cn("text-neutral-500", isWide ? "w-8 h-8 mr-3" : "w-10 h-10")} />
                    )}

                    {/* Wide Layout Text */}
                    {isWide && (
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-[10px] font-bold uppercase tracking-wider leading-none text-foreground truncate">
                                {name || "Node Name"}
                            </span>
                            {description && (
                                <span className="text-[9px] text-muted-foreground truncate mt-0.5">
                                    {description}
                                </span>
                            )}
                        </div>
                    )}
                </Card>

                {/* Floating Text (Standard Layout Only) */}
                {!isWide && (
                    <div className="absolute top-full mt-2 flex flex-col items-center text-center z-20 w-48 gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider leading-none mb-0.5 px-1.5 py-0.5 rounded-full backdrop-blur-sm text-foreground bg-neutral-900 border border-border/50">
                            {name || "Node Name"}
                        </span>
                        {description && (
                            <div className="text-[9px] text-muted-foreground leading-tight px-1 line-clamp-2">
                                {description}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};