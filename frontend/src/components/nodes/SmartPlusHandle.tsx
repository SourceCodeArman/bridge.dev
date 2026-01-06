import { Handle, Position } from '@xyflow/react';
import { useEdges, useNodeId } from '@xyflow/react';
import { Plus } from 'lucide-react';

// Common handle styles
const handleStyle = { padding: '4px', background: 'var(--secondary)' };

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
        const arrowColor = 'var(--border)';
        const isDashed = lineType === 'dashed';

        // Calculate line styles based on position
        const lineStyle: React.CSSProperties = {
            position: 'absolute',
            zIndex: 20,
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
            background: 'var(--background)', // Match card bg for "cutout" look or fill
            zIndex: 21,
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
            background: 'var(--input)',
            border: '0',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isFull ? 0 : 1,
            pointerEvents: (isFull ? 'none' : 'all') as React.CSSProperties['pointerEvents'],
            cursor: 'pointer',
            zIndex: 22,
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
            background: shape === 'diamond' ? 'var(--background)' : 'transparent',
            border: shape === 'diamond' ? '1px solid var(--border)' : 'none',
            transform: shape === 'diamond' ? 'translate(-50%, -50%) rotate(45deg)' : 'translate(-50%, -50%)', // Center and rotate diamonds
            zIndex: shape === 'diamond' ? 60 : 1,
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
                    <Plus className="w-2.5 h-2.5 text-muted-foreground pointer-events-none" />
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
        background: 'var(--background)',
        border: '1px solid var(--border)',
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