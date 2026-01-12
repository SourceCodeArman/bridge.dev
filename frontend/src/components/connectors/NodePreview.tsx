import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Bolt, Plus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ThemeAwareIcon } from './ThemeAwareIcon';
import nodeTypesData from '@/components/nodes/node-types.json';

interface NodePreviewProps {
    name: string;
    description: string;
    lightIconFile: File | string | null;
    darkIconFile: File | string | null;
    nodeSize: { width: number; height: number };
    handleCounts: { [key: string]: number };
    handleNames?: Record<string, string>;
    smartPlusHandles?: Record<string, boolean>; // e.g., { 'right-0': true, 'bottom-1': true }
    connectorType?: string;
    customRadius?: string;
    handleStyling?: any;
}

export const SmartPlusHandle = ({
    shape,
    lineType,
    diamondStyle,
    ...handleProps  // Contains position, id, style, etc.
}: any) => {
    const arrowColor = 'var(--border)';
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
        background: 'var(--background)',
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
            top: handleProps.style?.top !== undefined ? handleProps.style.top : '50%',
            transform: shape === 'diamond' ? 'translate(-50%, -50%) rotate(45deg)' : 'translate(-50%, -50%)',
        });
    } else if (handleProps.position === 'left') {
        Object.assign(lineStyle, {
            top: handleProps.style?.top !== undefined ? handleProps.style.top : '50%',
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
        const leftPos = handleProps.style?.left !== undefined ? handleProps.style.left : '50%';
        Object.assign(lineStyle, {
            left: leftPos,
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
        background: 'var(--input)',
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
            left: handleProps.style?.left !== undefined ? handleProps.style.left : '50%',
            transform: 'translate(-50%, 0)',
        });
    } else if (handleProps.position === 'bottom') {
        Object.assign(buttonStyle, {
            bottom: handleOffset,
            left: handleProps.style?.left !== undefined ? handleProps.style.left : '50%',
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
                <Plus className="w-2.5 h-2.5 text-muted-foreground pointer-events-none" />
            </div>
        </>
    );
};

export function NodePreview({
    name,
    description,
    lightIconFile,
    darkIconFile,
    nodeSize,
    handleCounts,
    handleNames = {},
    smartPlusHandles = {},
    connectorType,
    customRadius,
    handleStyling,
}: NodePreviewProps) {
    const [lightIconUrl, setLightIconUrl] = useState<string | null>(null);
    const [darkIconUrl, setDarkIconUrl] = useState<string | null>(null);
    const isWide = nodeSize.width >= 200;

    // Get connector config from JSON
    const nodeTypeConfig = nodeTypesData.nodeTypes.find(t => t.id === connectorType);

    // Determine handle styling to use: passed prop OR config default
    const activeHandleStyling = handleStyling || (
        Array.isArray(nodeTypeConfig?.handles?.styling)
            ? nodeTypeConfig?.handles?.styling[0]
            : nodeTypeConfig?.handles?.styling
    );

    useEffect(() => {
        let lightUrl: string | null = null;
        let darkUrl: string | null = null;

        // Handle Light Icon
        if (typeof lightIconFile === 'string') {
            setLightIconUrl(lightIconFile);
        } else if (lightIconFile) {
            lightUrl = URL.createObjectURL(lightIconFile);
            setLightIconUrl(lightUrl);
        } else {
            setLightIconUrl(null);
        }

        // Handle Dark Icon
        if (typeof darkIconFile === 'string') {
            setDarkIconUrl(darkIconFile);
        } else if (darkIconFile) {
            darkUrl = URL.createObjectURL(darkIconFile);
            setDarkIconUrl(darkUrl);
        } else {
            setDarkIconUrl(null);
        }

        return () => {
            if (lightUrl) URL.revokeObjectURL(lightUrl);
            if (darkUrl) URL.revokeObjectURL(darkUrl);
        };
    }, [lightIconFile, darkIconFile]);

    const renderHandle = (side: 'left' | 'right' | 'top' | 'bottom', index: number, total: number) => {
        const key = `${side}-${index}`;
        const isSmartPlus = smartPlusHandles[key];
        const handleName = handleNames[key];

        // Determine handle style
        const style: React.CSSProperties = {
            width: '10px',
            height: '10px',
            background: 'var(--background)',
            position: 'absolute',
            zIndex: 20, // Ensure handle is above node content
            border: '1px solid var(--border)'
        };

        if (activeHandleStyling) {
            const { rotation, borderRadius, translation } = activeHandleStyling;
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

        // Consistent centering for ALL handles
        const baseTransform = 'translate(-50%, -50%)';

        switch (side) {
            case 'left':
                style.left = '0';
                style.top = `${((index + 1) * 100) / (total + 1)}%`;
                style.transform = `${baseTransform} ${style.transform || ''}`;
                break;
            case 'right':
                style.left = '100%';
                style.top = `${((index + 1) * 100) / (total + 1)}%`;
                style.transform = `${baseTransform} ${style.transform || ''}`;
                break;
            case 'top':
                style.top = '0';
                style.left = `${((index + 1) * 100) / (total + 1)}%`;
                style.transform = `${baseTransform} ${style.transform || ''}`;
                break;
            case 'bottom':
                style.top = '100%';
                style.left = `${((index + 1) * 100) / (total + 1)}%`;
                style.transform = `${baseTransform} ${style.transform || ''}`;
                break;
        }

        return (
            <React.Fragment key={key}>
                <div className="group relative" style={style}>
                    {/* Tooltip for handle name */}
                    {handleName && (
                        <div className={cn(
                            "absolute whitespace-nowrap bg-secondary text-secondary-foreground text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none",
                            side === 'left' ? "right-full mr-2" :
                                side === 'right' ? "left-full ml-2" :
                                    side === 'top' ? "bottom-full mb-2" :
                                        "top-full mt-2"
                        )}>
                            {handleName}
                        </div>
                    )}
                </div>
                {isSmartPlus && (
                    <SmartPlusHandle
                        key={`${key}-smart`}
                        position={side}
                        style={{
                            top: (side === 'right' || side === 'left') ? `${((index + 1) * 100) / (total + 1)}%` : undefined,
                            left: (side === 'bottom' || side === 'top') ? `${((index + 1) * 100) / (total + 1)}%` : undefined,
                            height: 90
                        }}
                    />
                )}
            </React.Fragment>
        );
    };

    // Simulate handles positioning
    const renderHandles = () => {
        const handles = [];
        const sides = ['left', 'right', 'top', 'bottom'] as const;

        for (const side of sides) {
            const count = handleCounts[side] || 0;
            if (count === 0) continue;

            for (let i = 0; i < count; i++) {
                handles.push(renderHandle(side, i, count));
            }
        }
        return handles;
    };

    // Fallback if type not found
    const shapeClass = nodeTypeConfig?.style?.containerClass || 'rounded-[18px]';

    return (
        <div className="flex flex-col items-center justify-center p-8 bg-transparent rounded-lg gap-2">
            <div className="relative flex flex-col items-center pointer-events-none select-none">
                {/* Visual Node Box */}
                <Card
                    className={cn(
                        "p-0 flex items-center border border-border bg-background transition-all relative shadow-xl",
                        shapeClass,
                        !shapeClass.includes('justify-') && (isWide ? "justify-start px-3" : "justify-center")
                    )}
                    style={{
                        width: nodeSize.width,
                        height: nodeSize.height,
                        ...(customRadius ? { borderRadius: customRadius } : {}),

                    }}
                >
                    {/* Handles */}
                    {renderHandles()}

                    {/* Icon */}
                    {(lightIconUrl || darkIconUrl) ? (
                        <ThemeAwareIcon
                            src={darkIconUrl || lightIconUrl || undefined}
                            lightSrc={lightIconUrl || undefined}
                            darkSrc={darkIconUrl || undefined}
                            alt="Icon"
                            className={cn(isWide ? "w-8 h-8 mr-3" : "w-10 h-10")}
                        />
                    ) : (
                        <Bolt className={cn("text-muted-foreground", isWide ? "w-8 h-8 mr-3" : "w-10 h-10")} />
                    )}

                    {/* Wide Layout Text */}
                    {isWide && (
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-[10px] font-bold uppercase tracking-wider leading-none text-foreground truncate">
                                {name || "Node Name"}
                            </span>
                            {description && (
                                <span className="text-[9px] text-foreground truncate mt-0.5">
                                    {description}
                                </span>
                            )}
                        </div>
                    )}
                </Card>

                {/* Floating Text (Standard Layout Only) */}
                {!isWide && (
                    <div className="absolute top-full mt-2 flex flex-col items-center text-center z-20 w-48 gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider leading-none mb-0.5 px-1.5 py-0.5 rounded-full backdrop-blur-sm text-foreground bg-background border border-border/50">
                            {name || "Node Name"}
                        </span>
                        {description && (
                            <div className="text-[9px] text-foreground leading-tight px-1 line-clamp-2">
                                {description}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};