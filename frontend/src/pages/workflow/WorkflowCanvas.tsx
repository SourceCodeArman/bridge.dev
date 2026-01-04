import { useCallback, useRef, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { workflowService } from '@/lib/api/services/workflow';
import { connectorService } from '@/lib/api/services/connector';
import { customConnectorService } from '@/lib/api/services/customConnector';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    ReactFlowProvider,
    useReactFlow,
} from '@xyflow/react';
import type {
    Connection,
    Edge,
    Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { TriggerNode, ActionNode, ConditionNode, AgentNode, ModelNode, MemoryNode, ToolNode } from '@/components/workflow/CustomNodes';
import { CustomNode } from '@/components/workflow/CustomNode';
import { ThemeAwareIcon } from '@/components/connectors/ThemeAwareIcon';
import NodeConfigPanel from '@/components/workflow/NodeConfigPanel';
import { Save, Layout, Webhook, Plus } from 'lucide-react';
import Dagre from '@dagrejs/dagre';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';

const nodeTypes = {
    trigger: TriggerNode,
    action: ActionNode,
    condition: ConditionNode,
    agent: AgentNode,
    modelNode: ModelNode,
    memoryNode: MemoryNode,
    toolsNode: ToolNode,
    custom: CustomNode,
};

const initialNodes: Node[] = [];

const initialEdges: Edge[] = [];

// Layout helper using Dagre
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
    const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: direction });

    edges.forEach((edge) => g.setEdge(edge.source, edge.target));
    nodes.forEach((node) => {
        g.setNode(node.id, { width: 250, height: 100 }); // Estimate node size
    });

    Dagre.layout(g);

    return {
        nodes: nodes.map((node) => {
            const position = g.node(node.id);
            // We are shifting the dagre node position (anchor=center center) to the top left
            // so it matches the React Flow node anchor point (top left).
            const x = position.x - 125;
            const y = position.y - 50;

            return { ...node, position: { x, y } };
        }),
        edges,
    };
};

const WorkflowCanvasInner = () => {
    const { id } = useParams();
    const queryClient = useQueryClient();
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [isAddNodeOpen, setIsAddNodeOpen] = useState(false);
    const [pendingConnection, setPendingConnection] = useState<{ sourceId: string; handleId: string; type: string; allowedTypes?: string[]; nodeWidth?: number } | null>(null);
    const reactFlowWrapper = useRef(null);
    const { screenToFlowPosition, fitView } = useReactFlow();
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);
    const [initialDefinition, setInitialDefinition] = useState<string | null>(null);
    const [showMiniMap, setShowMiniMap] = useState(false);
    const miniMapTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const hasUserEdited = useRef(false);  // Track if user has made changes

    const showMiniMapUI = useCallback(() => {
        if (miniMapTimeoutRef.current) {
            clearTimeout(miniMapTimeoutRef.current);
        }
        setShowMiniMap(true);
    }, []);

    const hideMiniMapUI = useCallback(() => {
        if (miniMapTimeoutRef.current) {
            clearTimeout(miniMapTimeoutRef.current);
        }
        miniMapTimeoutRef.current = setTimeout(() => {
            setShowMiniMap(false);
        }, 1000);
    }, []);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (miniMapTimeoutRef.current) {
                clearTimeout(miniMapTimeoutRef.current);
            }
        };
    }, []);

    // Fetch workflow data if ID is present
    const { data: workflow } = useQuery({
        queryKey: ['workflow', id],
        queryFn: () => workflowService.get(id!),
        enabled: !!id,
    });

    const handleSmartAdd = useCallback((sourceId: string, handleId: string, type: string, allowedTypes?: string[], nodeWidth?: number) => {
        setPendingConnection({ sourceId, handleId, type, allowedTypes, nodeWidth });
        setIsAddNodeOpen(true);
    }, []);

    // Hydrate state from workflow's current_version (already included in GET /workflows/{id}/)
    useEffect(() => {
        const versionData = workflow?.current_version;

        if (versionData?.graph) {
            const { nodes: savedNodes, edges: savedEdges } = versionData.graph;

            // Restore the onAddClick function to nodes, as it's not serialized
            const hydratedNodes = savedNodes.map((node: Node) => ({
                ...node,
                data: {
                    ...node.data,
                    onAddClick: handleSmartAdd
                }
            }));

            setNodes(hydratedNodes);
            setEdges(savedEdges);
            setIsHydrated(true);

            // Store initial definition for change detection
            setInitialDefinition(JSON.stringify({
                nodes: savedNodes,
                edges: savedEdges
            }));
        } else if (workflow) {
            // Workflow loaded but no version/draft - start with empty canvas
            setIsHydrated(true);
        }
    }, [workflow, setNodes, setEdges, handleSmartAdd]);

    // Ensure initial nodes have the callback attached
    useEffect(() => {
        setNodes((nds) => nds.map((node) => {
            if (node.data.onAddClick) return node;
            return {
                ...node,
                data: {
                    ...node.data,
                    onAddClick: handleSmartAdd,
                },
            };
        }));
    }, [handleSmartAdd, setNodes]);




    // Fetch available connectors
    const { data: connectors } = useQuery({
        queryKey: ['connectors'],
        queryFn: connectorService.list,
    });

    const { data: customConnectors } = useQuery({
        queryKey: ['custom-connectors'],
        queryFn: customConnectorService.list,
    });

    const allConnectors = [...(connectors || []), ...(customConnectors || [])];

    // ... (omitted useEffect for brevity, it uses handleSmartAdd which is updated) ...

    // Helper to check if a node type is allowed based on pending connection context
    const isNodeAllowed = (type: string) => {
        if (!pendingConnection?.allowedTypes) return true;
        return pendingConnection.allowedTypes.includes(type);
    };

    // ...

    const createNode = (type: string, position: { x: number, y: number }, event?: React.DragEvent | null, connectorData?: any) => {
        // ... (existing variable setups) ...
        const bridgeType = event?.dataTransfer.getData('application/bridge-type');
        let connectorDataVal = connectorData;

        if (!connectorDataVal && event) {
            const connectorDataStr = event.dataTransfer.getData('application/connector-data');
            connectorDataVal = connectorDataStr ? JSON.parse(connectorDataStr) : null;
        }

        let label = `${type} node`;
        let description = 'Performs an action';
        let connectorType = 'action';
        let actionId = '';
        const iconUrlLight = connectorDataVal?.icon_url_light;
        const iconUrlDark = connectorDataVal?.icon_url_dark;
        let ui = connectorDataVal?.manifest?.ui; // Extract UI settings

        // Generic handling from connector data if available
        if (connectorDataVal) {
            label = connectorDataVal.display_name || connectorDataVal.name;
            description = connectorDataVal.description || '';
            connectorType = connectorDataVal.slug || bridgeType;
            // For action nodes, we might need a specific actionId, but default to 'action' or first action if available?
            // For now keeping it simple as before:
            if (type === 'action') actionId = 'action';
        } else {
            // Fallbacks for drag without specific connector data (though our new UI always provides it)
            if (type === 'trigger') {
                label = 'Webhook Trigger';
                description = 'Starts workflow via webhook';
                connectorType = 'webhook';
            } else if (type === 'condition') {
                label = 'If / Else';
                connectorType = 'condition';
            } else if (type === 'agent') {
                label = 'AI Agent';
                connectorType = 'ai-agent';
            } else if (type === 'modelNode') {
                label = 'Model';
                connectorType = 'model';
            } else if (type === 'memoryNode') {
                label = 'Memory';
                connectorType = 'memory';
            } else if (type === 'toolsNode') {
                label = 'Tool';
                connectorType = 'tool';
            }
        }

        // Determine the react-flow node type
        let nodeType = type;
        if (connectorDataVal?.is_custom) {
            nodeType = 'custom';
        }

        const newNode: Node = {
            id: uuidv4(),
            type: nodeType,
            position,
            data: {
                label,
                description,
                connectorType,
                actionId,
                iconUrlLight,
                iconUrlDark,
                ui, // Pass UI settings
                onAddClick: handleSmartAdd
            },
        };

        setNodes((nds) => nds.concat(newNode));
        setIsAddNodeOpen(false);
        // ...

        // Handle Pending Connection
        if (pendingConnection) {
            let newEdge: Edge;

            // Check if we are connecting TO a Target Handle (Reverse connection)
            if (pendingConnection.type === 'target') {
                // Reverse Connection: New Node -> Existing Node (Target Handle)
                newEdge = {
                    id: `e-${newNode.id}-${pendingConnection.sourceId}`,
                    source: newNode.id,
                    target: pendingConnection.sourceId,
                    targetHandle: pendingConnection.handleId,
                };
            } else {
                // Standard Connection: Existing Node (Source) -> New Node (Target)
                const targetHandle = null;

                newEdge = {
                    id: `e-${pendingConnection.sourceId}-${newNode.id}`,
                    source: pendingConnection.sourceId,
                    target: newNode.id,
                    sourceHandle: pendingConnection.handleId,
                    ...(targetHandle ? { targetHandle } : {}),
                };
            }

            setEdges((eds) => addEdge(newEdge, eds));
            setPendingConnection(null);
        }
    };

    // ...

    // Track when connection drag starts
    const onConnectStart = useCallback((_: any, { nodeId, handleId }: { nodeId: string | null; handleId: string | null }) => {
        if (nodeId) {
            // Update node data to pass dragging info down to AgentSmartPlusHandle
            setNodes(nds => nds.map(n => {
                if (n.id === nodeId) {
                    return {
                        ...n,
                        data: { ...n.data, draggingFrom: { nodeId, handleId } }
                    };
                }
                return n;
            }));
        }
    }, [setNodes]);

    // Track when connection drag ends
    const onConnectEnd = useCallback(() => {
        // Clear dragging info from nodes
        setNodes(nds => nds.map(n => {
            if (n.data.draggingFrom) {
                const newData = { ...n.data };
                delete newData.draggingFrom;
                return { ...n, data: newData };
            }
            return n;
        }));
    }, [setNodes]);

    const handleAddNodeClick = (type: string, connectorData?: any) => {
        let position = { x: 0, y: 0 };

        if (pendingConnection) {
            // Place relative to source (or target in reverse case)
            const referenceNode = nodes.find(n => n.id === pendingConnection.sourceId);
            if (referenceNode) {
                const nodeWidth = pendingConnection.nodeWidth || 100;  // Default to 100px for standard nodes
                let xOffset = nodeWidth + 100;  // Node width + 100px gap
                let yOffset = 0;
                // If connecting to a target handle (Agent Resources), place BELOW
                if (pendingConnection.type === 'target') {
                    yOffset = 260;

                    // Adjust X based on which handle was clicked
                    // Agent node has handles at: model=30px, memory=90px, tools=150px from left
                    // Resource nodes are 50px wide, so center them under the handle
                    const handlePositions: Record<string, number> = {
                        'model': -30,
                        'memory': 90,
                        'tools': 220,
                    };
                    const handleX = handlePositions[pendingConnection.handleId] || 0;
                    // Position the resource node (60px wide) centered under the handle
                    xOffset = handleX - 30; // Center the 60px node under the handle
                } else {
                    // Standard flow (Right)
                    if (pendingConnection.handleId === 'true') yOffset = -90;  // Upper branch
                    if (pendingConnection.handleId === 'false') yOffset = 90;   // Lower branch
                }

                position = {
                    x: referenceNode.position.x + xOffset,
                    y: referenceNode.position.y + yOffset
                };
            } else {
                const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
                position = screenToFlowPosition(center);
            }
        } else {
            const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
            position = screenToFlowPosition(center);
        }

        createNode(type, position, null, connectorData);
    };

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    );

    const onNodeDoubleClick = useCallback(
        (_: React.MouseEvent, node: Node) => {
            setSelectedNode(node);
        },
        [],
    );

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        showMiniMapUI();
    }, [showMiniMapUI]);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');
            const connectorDataStr = event.dataTransfer.getData('application/connector-data');

            if (typeof type === 'undefined' || !type) {
                return;
            }

            const positionRaw = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            // Snap to grid (20px)
            const position = {
                x: Math.round(positionRaw.x / 20) * 20,
                y: Math.round(positionRaw.y / 20) * 20,
            };

            let connectorData = null;
            if (connectorDataStr) {
                try {
                    connectorData = JSON.parse(connectorDataStr);
                } catch (e) { console.error('Failed to parse connector data', e); }
            }

            createNode(type, position, event, connectorData);
            hideMiniMapUI();
        },
        [screenToFlowPosition, createNode, hideMiniMapUI],
    );

    const onMoveStart = useCallback(() => showMiniMapUI(), [showMiniMapUI]);
    const onMoveEnd = useCallback(() => hideMiniMapUI(), [hideMiniMapUI]);
    const onNodeDragStart = useCallback(() => showMiniMapUI(), [showMiniMapUI]);
    const onNodeDragStop = useCallback(() => hideMiniMapUI(), [hideMiniMapUI]);

    const isValidConnection = useCallback(
        (connection: Connection | Edge) => {
            const targetHandle = connection.targetHandle;
            const target = connection.target;
            const source = connection.source;

            // Find the source node to check its type
            const sourceNode = nodes.find(n => n.id === source);
            const sourceType = sourceNode?.type;

            // Restrict which node types can connect to which handles

            // 1. Resource Node Constraints (Strict)
            // Model Nodes can ONLY connect to 'model' handles
            if (sourceType === 'modelNode' && targetHandle !== 'model') return false;
            // Memory Nodes can ONLY connect to 'memory' handles
            if (sourceType === 'memoryNode' && targetHandle !== 'memory') return false;
            // Tool Nodes can ONLY connect to 'tools' handles
            if (sourceType === 'toolsNode' && targetHandle !== 'tools') return false;

            // 2. Handle Specific Constraints
            if (targetHandle === 'model') {
                // Only model nodes can connect to model handle
                if (sourceType !== 'modelNode') {
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
                if (sourceType !== 'memoryNode') {
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
                if (sourceType !== 'toolsNode') {
                    return false;
                }
                // Tools handle allows unlimited connections
            }

            return true;
        },
        [edges, nodes],
    );

    const handleAutoLayout = useCallback(() => {
        const layouted = getLayoutedElements(nodes, edges);
        setNodes([...layouted.nodes]);
        setEdges([...layouted.edges]);
        window.requestAnimationFrame(() => fitView());
    }, [nodes, edges, setNodes, setEdges, fitView]);

    const handleSave = useCallback(async () => {
        if (!id) return;
        setSaving(true);
        try {
            // Map ReactFlow nodes to WorkflowNodes, stripping out callbacks
            const workflowNodes = nodes.map(node => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { onAddClick, draggingFrom, ...cleanData } = node.data as Record<string, any>;
                return {
                    id: node.id,
                    type: node.type || 'default',
                    position: node.position,
                    data: cleanData,
                };
            });

            const definition = {
                nodes: workflowNodes,
                edges: edges.map(edge => ({
                    id: edge.id,
                    source: edge.source,
                    target: edge.target,
                    sourceHandle: edge.sourceHandle,
                    targetHandle: edge.targetHandle,
                }))
            };

            // Compare with initial definition to detect changes
            const currentDefinitionStr = JSON.stringify(definition);

            if (initialDefinition && currentDefinitionStr === initialDefinition) {
                console.log('No changes detected, skipping save');
                setSaving(false);
                return;
            }

            // Use saveDraft to save the workflow definition (creates/updates WorkflowVersion)
            await workflowService.saveDraft(id, definition);

            // Update initial definition after successful save
            setInitialDefinition(currentDefinitionStr);
            setLastSaved(new Date());
            console.log('Workflow draft saved successfully');
        } catch (err: any) {
            console.error('Failed to save workflow', err);
            alert(`Failed to save workflow: ${err?.message || err?.response?.data?.message || 'Unknown error'}`);
            // Don't set lastSaved if there was an error
        } finally {
            setSaving(false);
        }
    }, [id, nodes, edges, initialDefinition]);

    const [activating, setActivating] = useState(false);

    const handleActivate = useCallback(async (activate: boolean) => {
        if (!id) return;
        setActivating(true);
        try {
            await workflowService.activate(id, activate);
            // Invalidate the workflow query to refresh data
            queryClient.invalidateQueries({ queryKey: ['workflow', id] });
            console.log(`Workflow ${activate ? 'activated' : 'deactivated'} successfully`);
        } catch (err: any) {
            console.error('Failed to toggle activation', err);
            const errorMsg = err?.response?.data?.message || err?.response?.data?.data?.validation_errors?.join('\n') || err?.message || 'Unknown error';
            alert(`Failed to ${activate ? 'activate' : 'deactivate'} workflow: ${errorMsg}`);
        } finally {
            setActivating(false);
        }
    }, [id, queryClient]);


    // Autosave effect - only triggers after user makes changes, not on initial load
    useEffect(() => {
        if (!isHydrated || !id) return;

        // Skip autosave on initial hydration
        if (!hasUserEdited.current) {
            hasUserEdited.current = true;
            return;
        }

        const timer = setTimeout(() => {
            handleSave();
        }, 1000);

        return () => clearTimeout(timer);
    }, [nodes, edges, isHydrated, id, handleSave]);

    return (
        <div className="h-screen flex w-full relative rounded-2xl">
            {/* Main Canvas */}
            <div className="flex-1 relative" ref={reactFlowWrapper}>
                <div className="absolute top-4 right-4 z-10 flex gap-2">
                    <Sheet open={isAddNodeOpen} onOpenChange={setIsAddNodeOpen}>
                        <SheetTrigger asChild>
                            <Button className="rounded-full w-10 h-10 p-0 shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground absolute top-4 right-[calc(100vw-3rem)] md:right-[unset] md:left-4 z-50">
                                <Plus className="w-6 h-6" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-[300px] sm:w-[400px] overflow-y-auto bg-sidebar">
                            <SheetHeader className="mb-4">
                                <SheetTitle>Add Node</SheetTitle>
                            </SheetHeader>
                            <div className="flex flex-col gap-4 text-foreground">
                                <h3 className="font-semibold text-sm">Components</h3>
                                <div className="space-y-4">
                                    {/* Triggers */}
                                    {(isNodeAllowed('trigger') || isNodeAllowed('webhook')) && (
                                        <div>
                                            <div className="text-xs font-medium text-foreground uppercase tracking-wider mb-2">Triggers</div>
                                            <div className="space-y-2">
                                                {allConnectors.filter(c => c.connector_type === 'trigger').map((connector) => (
                                                    <div
                                                        key={connector.id}
                                                        className="border p-2 rounded cursor-pointer bg-card hover:bg-accent flex items-center gap-2 transition-colors"
                                                        onClick={() => handleAddNodeClick('trigger', connector)}
                                                        draggable
                                                        onDragStart={(event) => {
                                                            event.dataTransfer.setData('application/reactflow', 'trigger');
                                                            event.dataTransfer.setData('application/bridge-type', connector.slug || 'webhook');
                                                            event.dataTransfer.setData('application/connector-data', JSON.stringify(connector));
                                                        }}
                                                    >
                                                        {connector.icon_url_light || connector.icon_url_dark ? (
                                                            <ThemeAwareIcon
                                                                lightSrc={connector.icon_url_light}
                                                                darkSrc={connector.icon_url_dark}
                                                                alt={connector.display_name}
                                                                className="w-4 h-4 object-contain"
                                                            />
                                                        ) : (
                                                            <Webhook className="w-4 h-4 text-foreground" />
                                                        )}
                                                        <span className="text-sm">{connector.display_name}</span>
                                                    </div>
                                                ))}
                                                {/* Fallback for hardcoded if needed, or if no trigger connectors yet */}
                                                {!allConnectors.some(c => c.connector_type === 'trigger') && (
                                                    <div
                                                        className="border p-2 rounded cursor-pointer bg-card hover:bg-accent flex items-center gap-2 transition-colors"
                                                        onClick={() => handleAddNodeClick('trigger')}
                                                        draggable
                                                        onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'trigger')}
                                                    >
                                                        <Webhook className="w-4 h-4 text-foreground" />
                                                        <span className="text-sm">Webhook Trigger</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    {isNodeAllowed('action') && allConnectors.some(c => c.connector_type === 'action') && (
                                        <div>
                                            <div className="text-xs font-medium text-foreground uppercase tracking-wider mb-2">Actions</div>
                                            <div className="space-y-2">
                                                {allConnectors.filter(c => c.connector_type === 'action').map((connector) => (
                                                    <div
                                                        key={connector.id}
                                                        className="border p-2 rounded cursor-pointer bg-card hover:bg-accent flex items-center gap-2 transition-colors"
                                                        onClick={() => handleAddNodeClick('action', connector)}
                                                        draggable
                                                        onDragStart={(event) => {
                                                            event.dataTransfer.setData('application/reactflow', 'action');
                                                            event.dataTransfer.setData('application/bridge-type', connector.slug || connector.display_name.toLowerCase());
                                                            event.dataTransfer.setData('application/connector-data', JSON.stringify(connector));
                                                        }}
                                                    >
                                                        {connector.icon_url_light || connector.icon_url_dark ? (
                                                            <ThemeAwareIcon
                                                                lightSrc={connector.icon_url_light}
                                                                darkSrc={connector.icon_url_dark}
                                                                alt={connector.display_name}
                                                                className="w-4 h-4 object-contain"
                                                            />
                                                        ) : (
                                                            <div className="w-4 h-4 bg-muted rounded-full" />
                                                        )}
                                                        <span className="text-sm">{connector.display_name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Logic (Condition) */}
                                    {isNodeAllowed('condition') && (
                                        <div>
                                            <div className="text-xs font-medium text-foreground uppercase tracking-wider mb-2">Logic</div>
                                            <div
                                                className="border p-2 rounded cursor-pointer bg-card hover:bg-accent transition-colors"
                                                onClick={() => handleAddNodeClick('condition')}
                                                draggable
                                                onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'condition')}
                                            >
                                                <span className="text-sm">If / Else</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* AI Agents */}
                                    {isNodeAllowed('agent') && (
                                        <div>
                                            <div className="text-xs font-medium text-foreground uppercase tracking-wider mb-2">AI Agents</div>
                                            <div className="space-y-2">
                                                {/* Dynamic Agent Connectors */}
                                                {allConnectors.filter(c => c.connector_type === 'agent').map((connector) => (
                                                    <div
                                                        key={connector.id}
                                                        className="border p-2 rounded cursor-pointer bg-card hover:bg-accent flex items-center gap-2 transition-colors"
                                                        onClick={() => handleAddNodeClick('agent', connector)}
                                                        draggable
                                                        onDragStart={(event) => {
                                                            event.dataTransfer.setData('application/reactflow', 'agent');
                                                            event.dataTransfer.setData('application/bridge-type', connector.slug || 'agent');
                                                            event.dataTransfer.setData('application/connector-data', JSON.stringify(connector));
                                                        }}
                                                    >
                                                        {connector.icon_url_light || connector.icon_url_dark ? (
                                                            <ThemeAwareIcon
                                                                lightSrc={connector.icon_url_light}
                                                                darkSrc={connector.icon_url_dark}
                                                                alt={connector.display_name}
                                                                className="w-4 h-4 object-contain"
                                                            />
                                                        ) : (
                                                            <div className="w-4 h-4 bg-muted rounded-full" />
                                                        )}
                                                        <span className="text-sm">{connector.display_name}</span>
                                                    </div>
                                                ))}
                                                {/* Fallback/Generic Agent Node if no specific agent connectors or want generic option */}
                                                {!allConnectors.some(c => c.connector_type === 'agent') && (
                                                    <div
                                                        className="border p-2 rounded cursor-pointer bg-card hover:bg-accent flex items-center gap-2 transition-colors"
                                                        onClick={() => handleAddNodeClick('agent')}
                                                        draggable
                                                        onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'agent')}
                                                    >
                                                        <span className="text-sm">AI Agent</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Agent Models */}
                                    {isNodeAllowed('modelNode') && allConnectors.some(c => c.connector_type === 'agent-model') && (
                                        <div>
                                            <div className="text-xs font-medium text-foreground uppercase tracking-wider mb-2">Models</div>
                                            <div className="space-y-2">
                                                {allConnectors.filter(c => c.connector_type === 'agent-model').map((connector) => (
                                                    <div
                                                        key={connector.id}
                                                        className="border p-2 rounded cursor-pointer bg-card hover:bg-accent flex items-center gap-2 transition-colors"
                                                        onClick={() => handleAddNodeClick('modelNode', connector)}
                                                        draggable
                                                        onDragStart={(event) => {
                                                            event.dataTransfer.setData('application/reactflow', 'modelNode');
                                                            event.dataTransfer.setData('application/bridge-type', connector.slug || 'model');
                                                            event.dataTransfer.setData('application/connector-data', JSON.stringify(connector));
                                                        }}
                                                    >
                                                        {connector.icon_url_light || connector.icon_url_dark ? (
                                                            <ThemeAwareIcon
                                                                lightSrc={connector.icon_url_light}
                                                                darkSrc={connector.icon_url_dark}
                                                                alt={connector.display_name}
                                                                className="w-4 h-4 object-contain"
                                                            />
                                                        ) : (
                                                            <div className="w-4 h-4 bg-muted rounded-full" />
                                                        )}
                                                        <span className="text-sm">{connector.display_name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Agent Memory */}
                                    {isNodeAllowed('memoryNode') && allConnectors.some(c => c.connector_type === 'agent-memory') && (
                                        <div>
                                            <div className="text-xs font-medium text-foreground uppercase tracking-wider mb-2">Memory</div>
                                            <div className="space-y-2">
                                                {allConnectors.filter(c => c.connector_type === 'agent-memory').map((connector) => (
                                                    <div
                                                        key={connector.id}
                                                        className="border p-2 rounded cursor-pointer bg-card hover:bg-accent flex items-center gap-2 transition-colors"
                                                        onClick={() => handleAddNodeClick('memoryNode', connector)}
                                                        draggable
                                                        onDragStart={(event) => {
                                                            event.dataTransfer.setData('application/reactflow', 'memoryNode');
                                                            event.dataTransfer.setData('application/bridge-type', connector.slug || 'memory');
                                                            event.dataTransfer.setData('application/connector-data', JSON.stringify(connector));
                                                        }}
                                                    >
                                                        {connector.icon_url_light || connector.icon_url_dark ? (
                                                            <ThemeAwareIcon
                                                                lightSrc={connector.icon_url_light}
                                                                darkSrc={connector.icon_url_dark}
                                                                alt={connector.display_name}
                                                                className="w-4 h-4 object-contain"
                                                            />
                                                        ) : (
                                                            <div className="w-4 h-4 bg-muted rounded-full" />
                                                        )}
                                                        <span className="text-sm">{connector.display_name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Agent Tools */}
                                    {isNodeAllowed('toolsNode') && allConnectors.some(c => c.connector_type === 'agent-tool') && (
                                        <div>
                                            <div className="text-xs font-medium text-foreground uppercase tracking-wider mb-2">Tools</div>
                                            <div className="space-y-2">
                                                {allConnectors.filter(c => c.connector_type === 'agent-tool').map((connector) => (
                                                    <div
                                                        key={connector.id}
                                                        className="border p-2 rounded cursor-pointer bg-card hover:bg-accent flex items-center gap-2 transition-colors"
                                                        onClick={() => handleAddNodeClick('toolsNode', connector)}
                                                        draggable
                                                        onDragStart={(event) => {
                                                            event.dataTransfer.setData('application/reactflow', 'toolsNode');
                                                            event.dataTransfer.setData('application/bridge-type', connector.slug || 'tool');
                                                            event.dataTransfer.setData('application/connector-data', JSON.stringify(connector));
                                                        }}
                                                    >
                                                        {connector.icon_url_light || connector.icon_url_dark ? (
                                                            <ThemeAwareIcon
                                                                lightSrc={connector.icon_url_light}
                                                                darkSrc={connector.icon_url_dark}
                                                                alt={connector.display_name}
                                                                className="w-4 h-4 object-contain"
                                                            />
                                                        ) : (
                                                            <div className="w-4 h-4 bg-muted rounded-full" />
                                                        )}
                                                        <span className="text-sm">{connector.display_name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Custom Connectors (Uncategorized) */}
                                    {allConnectors.some(c => c.connector_type === 'custom' || !['trigger', 'action', 'condition', 'agent', 'agent-model', 'agent-memory', 'agent-tool'].includes(c.connector_type)) && (
                                        <div>
                                            <div className="text-xs font-medium text-foreground uppercase tracking-wider mb-2">Custom</div>
                                            <div className="space-y-2">
                                                {allConnectors.filter(c => c.connector_type === 'custom' || !['trigger', 'action', 'condition', 'agent', 'agent-model', 'agent-memory', 'agent-tool'].includes(c.connector_type)).map((connector) => (
                                                    <div
                                                        key={connector.id}
                                                        className="border p-2 rounded cursor-pointer bg-card hover:bg-accent flex items-center gap-2 transition-colors"
                                                        onClick={() => handleAddNodeClick('custom', connector)}
                                                        draggable
                                                        onDragStart={(event) => {
                                                            event.dataTransfer.setData('application/reactflow', 'custom');
                                                            event.dataTransfer.setData('application/bridge-type', connector.slug || 'custom');
                                                            event.dataTransfer.setData('application/connector-data', JSON.stringify(connector));
                                                        }}
                                                    >
                                                        {connector.icon_url_light || connector.icon_url_dark ? (
                                                            <ThemeAwareIcon
                                                                lightSrc={connector.icon_url_light}
                                                                darkSrc={connector.icon_url_dark}
                                                                alt={connector.display_name}
                                                                className="w-4 h-4 object-contain"
                                                            />
                                                        ) : (
                                                            <div className="w-4 h-4 bg-muted rounded-full" />
                                                        )}
                                                        <span className="text-sm">{connector.display_name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>

                    <Button variant="outline" size="sm" onClick={handleAutoLayout}>
                        <Layout className="w-4 h-4 mr-2" />
                        Auto Layout
                    </Button>
                    <Button variant="outline" size="sm" disabled={saving} onClick={handleSave}>
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Saving...' : lastSaved ? 'Saved' : 'Save'}
                    </Button>
                    <div className="flex items-center gap-2 bg-background/80 backdrop-blur px-3 py-1.5 rounded-md border">
                        <span className="text-sm text-muted-foreground">
                            {workflow?.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <Switch
                            checked={workflow?.is_active ?? false}
                            onCheckedChange={handleActivate}
                            disabled={activating}
                        />
                    </div>
                </div>

                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onConnectStart={onConnectStart}
                    onConnectEnd={onConnectEnd}
                    onNodeDoubleClick={onNodeDoubleClick}
                    nodeTypes={nodeTypes}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                    onMoveStart={onMoveStart}
                    onMoveEnd={onMoveEnd}
                    onNodeDragStart={onNodeDragStart}
                    onNodeDragStop={onNodeDragStop}
                    isValidConnection={isValidConnection}
                    snapToGrid={true}
                    snapGrid={[20, 20]} // Snap to 20px grid
                    fitView
                    fitViewOptions={{ maxZoom: 1 }}
                    defaultEdgeOptions={{
                        type: 'default',
                        style: {
                            stroke: '#b1b1b7',
                            strokeWidth: 2,
                        },
                        markerEnd: undefined, // Remove arrow
                    }}
                >
                    <Controls />
                    <MiniMap
                        bgColor="var(--background)"
                        maskColor="var(--background)"
                        nodeColor="var(--foreground)/0.5"
                        className={`transition-opacity duration-500 ${showMiniMap ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                    />
                    <Background gap={20} size={1} />
                </ReactFlow>
            </div>

            {/* Config Panel Right Sheet */}
            <NodeConfigPanel
                key={selectedNode?.id}
                selectedNode={selectedNode}
                workflowId={id}
                onClose={() => setSelectedNode(null)}
                onUpdateNode={(nodeId, data) => {
                    setNodes((nds) => nds.map((n) => {
                        if (n.id === nodeId) {
                            return { ...n, data: { ...n.data, ...data } };
                        }
                        return n;
                    }));
                }}
            />
        </div>
    );
};

export default function WorkflowCanvas() {
    return (
        <ReactFlowProvider>
            <WorkflowCanvasInner />
        </ReactFlowProvider>
    );
}
