import { useCallback, useRef, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { workflowService } from '@/lib/api/services/workflow';
import { connectorService } from '@/lib/api/services/connector';
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
import { TriggerNode, ActionNode, ConditionNode, AgentNode, ModelNode, MemoryNode, ToolNode } from '@/components/workflow/CustomNodes';
import NodeConfigPanel from '@/components/workflow/NodeConfigPanel';
import { Save, Layout, Rocket, Webhook, Plus } from 'lucide-react';
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
};

const initialNodes: Node[] = [
    { id: '1', type: 'trigger', position: { x: 250, y: 5 }, data: { label: 'Webhook', triggerType: 'webhook' } },
];

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

    // Fetch workflow data if ID is present
    const { data: workflow, isLoading } = useQuery({
        queryKey: ['workflow', id],
        queryFn: () => workflowService.get(id!),
        enabled: !!id,
    });

    const handleSmartAdd = useCallback((sourceId: string, handleId: string, type: string, allowedTypes?: string[], nodeWidth?: number) => {
        setPendingConnection({ sourceId, handleId, type, allowedTypes, nodeWidth });
        setIsAddNodeOpen(true);
    }, []);

    // Hydrate state from fetched workflow
    useEffect(() => {
        if (workflow?.current_version?.graph) {
            const { nodes: savedNodes, edges: savedEdges } = workflow.current_version.graph;

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

    // Autosave effect
    useEffect(() => {
        if (!isHydrated || !id) return;

        const timer = setTimeout(() => {
            handlePublish();
        }, 1000);

        return () => clearTimeout(timer);
    }, [nodes, edges, isHydrated, id]);


    // Fetch available connectors
    const { data: connectors } = useQuery({
        queryKey: ['connectors'],
        queryFn: connectorService.list,
    });

    // ... (omitted useEffect for brevity, it uses handleSmartAdd which is updated) ...

    // Helper to check if a node type is allowed based on pending connection context
    const isNodeAllowed = (type: string) => {
        if (!pendingConnection?.allowedTypes) return true;
        return pendingConnection.allowedTypes.includes(type);
    };

    // ...

    const createNode = (type: string, position: { x: number, y: number }, event?: React.DragEvent | null, connectorData?: any) => {
        // ... (existing variable setups) ...
        let bridgeType = event?.dataTransfer.getData('application/bridge-type');
        let connectorDataVal = connectorData;

        if (!connectorDataVal && event) {
            const connectorDataStr = event.dataTransfer.getData('application/connector-data');
            connectorDataVal = connectorDataStr ? JSON.parse(connectorDataStr) : null;
        }

        let label = `${type} node`;
        let description = 'Performs an action';
        let connectorType = 'action';
        let actionId = '';
        const iconUrl = connectorDataVal?.icon_url;

        if (type === 'action') {
            // ... (existing logic) ...
            if (connectorDataVal) {
                label = connectorDataVal.name;
                description = connectorDataVal.description || 'Action';
                connectorType = connectorDataVal.slug || bridgeType;
                actionId = 'action';
            } else if (bridgeType) {
                label = bridgeType;
                connectorType = bridgeType;
            }
        } else if (type === 'trigger') {
            label = 'Webhook Trigger';
            description = 'Starts workflow via webhook';
            connectorType = 'webhook';
        }

        const newNode: Node = {
            id: Math.random().toString(),
            type,
            position,
            data: {
                label,
                description,
                connectorType,
                actionId,
                iconUrl,
                onAddClick: handleSmartAdd
            },
        };

        setNodes((nds) => nds.concat(newNode));
        setIsAddNodeOpen(false);

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
                const nodeWidth = pendingConnection.nodeWidth || 92;  // Default to 92px for standard nodes
                let xOffset = nodeWidth + 100;  // Node width + 100px gap
                let yOffset = 0;

                // If connecting to a target handle (Agent Resources), place BELOW
                if (pendingConnection.type === 'target') {
                    yOffset = 250;

                    // Adjust X based on which handle was clicked
                    // Agent node has handles at: model=30px, memory=92px, tools=154px from left
                    // Resource nodes are 50px wide, so center them under the handle
                    const handlePositions: Record<string, number> = {
                        'model': 30,
                        'memory': 92,
                        'tools': 154,
                    };
                    const handleX = handlePositions[pendingConnection.handleId] || 0;
                    // Position the resource node (50px wide) centered under the handle
                    xOffset = handleX - 25; // Center the 50px node under the handle
                } else {
                    // Standard flow (Right)
                    if (pendingConnection.handleId === 'true') yOffset = -100;  // Upper branch
                    if (pendingConnection.handleId === 'false') yOffset = 100;   // Lower branch
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

    const onNodeClick = useCallback(
        (_: React.MouseEvent, node: Node) => {
            setSelectedNode(node);
        },
        [],
    );

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');
            const bridgeType = event.dataTransfer.getData('application/bridge-type');
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
        },
        [screenToFlowPosition, createNode],
    );

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

    const handlePublish = useCallback(async () => {
        if (!id) return;
        setSaving(true);
        try {
            // Map ReactFlow nodes to WorkflowNodes to ensure type safety
            const workflowNodes = nodes.map(node => ({
                id: node.id,
                type: node.type || 'default',
                position: node.position,
                data: node.data,
            }));

            await workflowService.update(id, {
                name: workflow?.name || 'Untitled Workflow',
                definition: {
                    nodes: workflowNodes,
                    edges: edges.map(edge => ({
                        id: edge.id,
                        source: edge.source,
                        target: edge.target
                    }))
                }
            });
            setLastSaved(new Date());
        } catch (err) {
            console.error('Failed to save workflow', err);
        } finally {
            setSaving(false);
        }
    }, [id, nodes, edges, workflow]);

    return (
        <div className="h-[calc(100vh-4rem)] flex w-full relative">
            {/* Main Canvas */}
            <div className="flex-1 relative" ref={reactFlowWrapper}>
                <div className="absolute top-4 right-4 z-10 flex gap-2">
                    <Sheet open={isAddNodeOpen} onOpenChange={setIsAddNodeOpen}>
                        <SheetTrigger asChild>
                            <Button className="rounded-full w-10 h-10 p-0 shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground absolute top-4 right-[calc(100vw-3rem)] md:right-[unset] md:left-4 z-50">
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
                                    {(isNodeAllowed('trigger') || isNodeAllowed('webhook')) && (
                                        <>
                                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Triggers</div>
                                            <div
                                                className="border p-2 rounded cursor-pointer bg-card hover:bg-accent flex items-center gap-2 transition-colors"
                                                onClick={() => handleAddNodeClick('trigger')}
                                                draggable
                                                onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'trigger')}
                                            >
                                                <Webhook className="w-4 h-4 text-neutral-200" />
                                                <span className="text-sm">Webhook Trigger</span>
                                            </div>
                                        </>
                                    )}

                                    {isNodeAllowed('action') && (
                                        <>
                                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 mt-4">Actions</div>
                                            {connectors?.map((connector) => (
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
                                                    {connector.icon_url ? (
                                                        <img src={connector.icon_url} alt={connector.display_name} className="w-4 h-4 object-contain" />
                                                    ) : (
                                                        <div className="w-4 h-4 bg-muted rounded-full" />
                                                    )}
                                                    <span className="text-sm">{connector.display_name}</span>
                                                </div>
                                            ))}
                                        </>
                                    )}

                                    {isNodeAllowed('condition') && (
                                        <>
                                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 mt-4">Logic</div>
                                            <div
                                                className="border p-2 rounded cursor-pointer bg-card hover:bg-accent transition-colors"
                                                onClick={() => handleAddNodeClick('condition')}
                                                draggable
                                                onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'condition')}
                                            >
                                                If / Else
                                            </div>
                                        </>
                                    )}

                                    {isNodeAllowed('agent') && (
                                        <>
                                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 mt-4">AI</div>
                                            <div
                                                className="border p-2 rounded cursor-pointer bg-card hover:bg-accent flex items-center gap-2 transition-colors"
                                                onClick={() => handleAddNodeClick('agent')}
                                                draggable
                                                onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'agent')}
                                            >
                                                <span className="text-sm">AI Agent</span>
                                            </div>
                                        </>
                                    )}

                                    {isNodeAllowed('modelNode') && (
                                        <>
                                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 mt-4">Agent Resources</div>
                                            <div
                                                className="border p-2 rounded cursor-pointer bg-card hover:bg-accent flex items-center gap-2 transition-colors"
                                                onClick={() => handleAddNodeClick('modelNode')}
                                                draggable
                                                onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'modelNode')}
                                            >
                                                <span className="text-sm">Model</span>
                                            </div>
                                        </>
                                    )}

                                    {isNodeAllowed('memoryNode') && (
                                        <div
                                            className="border p-2 rounded cursor-pointer bg-card hover:bg-accent flex items-center gap-2 transition-colors"
                                            onClick={() => handleAddNodeClick('memoryNode')}
                                            draggable
                                            onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'memoryNode')}
                                        >
                                            <span className="text-sm">Memory</span>
                                        </div>
                                    )}

                                    {isNodeAllowed('toolsNode') && (
                                        <div
                                            className="border p-2 rounded cursor-pointer bg-card hover:bg-accent flex items-center gap-2 transition-colors"
                                            onClick={() => handleAddNodeClick('toolsNode')}
                                            draggable
                                            onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'toolsNode')}
                                        >
                                            <span className="text-sm">Tool</span>
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
                    <Button variant="outline" size="sm" disabled>
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Saving...' : lastSaved ? 'Saved' : 'Saved'}
                    </Button>
                    <Button size="sm" onClick={handlePublish}>
                        <Rocket className="w-4 h-4 mr-2" />
                        Publish
                    </Button>
                </div>

                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onConnectStart={onConnectStart}
                    onConnectEnd={onConnectEnd}
                    onNodeClick={onNodeClick}
                    nodeTypes={nodeTypes}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
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
                    <MiniMap bgColor="#26262670" maskColor="#26262690" nodeColor="#262626" />
                    <Background gap={20} size={1} />
                </ReactFlow>
            </div>

            {/* Config Panel Right Sheet */}
            <NodeConfigPanel
                key={selectedNode?.id}
                selectedNode={selectedNode}
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
