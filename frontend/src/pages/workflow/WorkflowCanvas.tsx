import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
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
    Panel,
    useNodesState,
    useEdgesState,
    addEdge,
    ReactFlowProvider,
    useReactFlow,
    Position,
} from '@xyflow/react';
import type {
    Connection,
    Edge,
    Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { UnifiedNode } from '@/components/nodes';
import NodeConfigPanel from '@/components/workflow/NodeConfigPanel';
import { Save, Layout, Plus, Sparkles, Loader2 } from 'lucide-react';
import Dagre from '@dagrejs/dagre';

import { AddNodeSheet } from '../../components/workflow/AddNodeSheet';
import { CreateCredentialModal } from '../../components/credentials/CreateCredentialModal';
import { AIAssistantWidget } from '@/components/workflow/AIAssistantWidget';



const initialNodes: Node[] = [];

const initialEdges: Edge[] = [];

// Layout helper using Dagre
// Helper to get node dimensions
const getNodeSize = (type: string | undefined): { width: number; height: number } => {
    if (type === 'agent') return { width: 200, height: 100 };
    if (['modelNode', 'memoryNode', 'toolsNode', 'agent-model', 'agent-memory', 'agent-tool'].includes(type || '')) {
        return { width: 60, height: 60 };
    }
    return { width: 100, height: 100 };
};

// Layout helper using Dagre
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
    const dagreGraph = new Dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // Separate Interaction Nodes (Main Flow) vs Resource Nodes (Agent Attachments)
    const resourceTypes = ['modelNode', 'memoryNode', 'toolsNode', 'model', 'memory', 'agent-tool', 'agent-model', 'agent-memory'];
    const isResourceNode = (node: Node) => {
        return resourceTypes.includes(node.type || '') ||
            resourceTypes.includes(node.data?.connectorType as string);
    };

    const mainNodes = nodes.filter(n => !isResourceNode(n));
    const resourceNodes = nodes.filter(n => isResourceNode(n));

    // Filter edges: Only include edges between main nodes for Dagre calculation
    const mainNodeIds = new Set(mainNodes.map(n => n.id));
    const mainEdges = edges.filter(e => mainNodeIds.has(e.source) && mainNodeIds.has(e.target));

    dagreGraph.setGraph({ rankdir: direction, ranksep: 100, nodesep: 50 });

    mainNodes.forEach((node) => {
        const { width, height } = getNodeSize(node.type);
        dagreGraph.setNode(node.id, { width, height });
    });

    mainEdges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    Dagre.layout(dagreGraph);

    // Map main nodes to new positions
    const layoutedMainNodes = mainNodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        const nodeWidth = dagreGraph.node(node.id).width;
        const nodeHeight = dagreGraph.node(node.id).height;

        return {
            ...node,
            targetPosition: Position.Left,
            sourcePosition: Position.Right,
            // Shift anchor to top-left
            position: {
                x: nodeWithPosition.x - nodeWidth / 2,
                y: nodeWithPosition.y - nodeHeight / 2,
            },
        };
    });

    // Manually position resource nodes relative to their connected Agent
    const layoutedResourceNodes = resourceNodes.map((node) => {
        // Find the edge connecting this resource to an agent
        // Resources connect TO the Agent (Source=Resource, Target=Agent)
        const connectedEdge = edges.find(e => e.source === node.id && mainNodeIds.has(e.target));

        if (connectedEdge) {
            const agentNode = layoutedMainNodes.find(n => n.id === connectedEdge.target);
            if (agentNode) {
                const handleId = connectedEdge.targetHandle; // 'model', 'memory', 'tools'

                // Offsets from node-types.json
                // Model: 30, Memory: 90, Tools: 150
                // Manual placement logic (handleAddNodeClick) suggests a wider fan-out:
                // Model: -30 (Left), Tools: 220 (Right)
                let handleX = 0;
                if (handleId === 'model') handleX = -30;
                else if (handleId === 'memory') handleX = 90;
                else if (handleId === 'tools') handleX = 220;

                // Center the 60px resource node under the calculated handle X point
                // Node Left X = Handle X - (NodeWidth / 2)
                const resourceX = agentNode.position.x + handleX - 30;

                // Use yOffset = 260 from manual logic (approx 260px below agent top)
                // Agent top is agentNode.position.y.
                const resourceY = agentNode.position.y + 260;

                return {
                    ...node,
                    position: { x: resourceX, y: resourceY }
                };
            }
        }

        // Fallback if no connection found (shouldn't happen in valid graph)
        return node;
    });

    return {
        nodes: [...layoutedMainNodes, ...layoutedResourceNodes],
        edges,
    };
};

// Helper to sanitize edges (fix corrupted Agent -> Resource direction)
const sanitizeEdges = (nodes: Node[], edges: Edge[]): Edge[] => {
    return edges.map(edge => {
        if (edge.targetHandle === 'model' || edge.targetHandle === 'memory' || edge.targetHandle === 'tools') {
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);

            // If Source is Agent and Target is NOT Agent: SWAP
            if (sourceNode?.type === 'agent' && targetNode?.type !== 'agent') {
                console.log(`🔧 Fixing corrupted edge direction: ${sourceNode.data.label} (Source) -> ${targetNode?.data.label} (Target)`);
                return {
                    ...edge,
                    id: `${edge.target}-${edge.source}-${edge.targetHandle}`,
                    source: edge.target,
                    target: edge.source,
                    // Ensure handles are correct (Agent handle is Target, Resource handle is Source)
                    targetHandle: edge.targetHandle,
                    sourceHandle: edge.sourceHandle || 'source'
                };
            }
        }
        return edge;
    });
};

const WorkflowCanvasInner = () => {
    const { id } = useParams();
    const queryClient = useQueryClient();
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [isAddNodeOpen, setIsAddNodeOpen] = useState(false);
    const [isCreateCredentialOpen, setIsCreateCredentialOpen] = useState(false);
    const [pendingConnection, setPendingConnection] = useState<{ sourceId: string; handleId: string; type: string; allowedTypes?: string[]; nodeWidth?: number } | null>(null);
    const reactFlowWrapper = useRef(null);
    const { screenToFlowPosition, fitView } = useReactFlow();
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);
    const [initialDefinition, setInitialDefinition] = useState<string | null>(null);
    const [showMiniMap, setShowMiniMap] = useState(false);
    const miniMapTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [isReady, setIsReady] = useState(false);
    const [activating, setActivating] = useState(false);
    const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);

    // Memoize nodeTypes to prevent React Flow warning
    const nodeTypes = useMemo(() => ({
        trigger: UnifiedNode,
        action: UnifiedNode,
        condition: UnifiedNode,
        agent: UnifiedNode,
        modelNode: UnifiedNode,
        memoryNode: UnifiedNode,
        toolsNode: UnifiedNode,
        custom: UnifiedNode,
    }), []);

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
    const { data: workflow, isLoading } = useQuery({
        queryKey: ['workflow', id],
        queryFn: () => workflowService.get(id!),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,  // 5 minutes
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
                    ...((node.type === 'agent' || node.type === 'trigger' || node.type === 'condition') ? {} : {}), // Ensure consistent structure
                    onAddClick: handleSmartAdd
                }
            }));

            // Fix corrupted edges (Agent -> Resource) by swapping source/target
            const fixedEdges = sanitizeEdges(hydratedNodes, savedEdges);

            setNodes(hydratedNodes);
            setEdges(fixedEdges);
            setIsHydrated(true);

            // Store initial definition for change detection - use same serialization format as handleSave
            const serializedNodes = savedNodes.map((node: Node) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { onAddClick, draggingFrom, ...cleanData } = (node.data || {}) as Record<string, any>;
                return {
                    id: node.id,
                    type: node.type || 'default',
                    position: node.position,
                    data: cleanData,
                };
            });
            const serializedEdges = savedEdges.map((edge: Edge) => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                sourceHandle: edge.sourceHandle,
                targetHandle: edge.targetHandle,
            }));
            setInitialDefinition(JSON.stringify({
                nodes: serializedNodes,
                edges: serializedEdges
            }));
        }

        // Set ready state after a short delay to allow initial rendering/effects to settle
        const timer = setTimeout(() => {
            setIsReady(true);
        }, 1000);

        return () => clearTimeout(timer);
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
        staleTime: Infinity,  // Cache until invalidated
    });

    const { data: customConnectors } = useQuery({
        queryKey: ['custom-connectors'],
        queryFn: customConnectorService.list,
        staleTime: Infinity,  // Cache until invalidated
    });

    const allConnectors = [...(connectors?.results || []), ...(customConnectors || [])];

    // ... (omitted useEffect for brevity, it uses handleSmartAdd which is updated) ...

    // Helper to check if a node type is allowed based on pending connection context
    const isNodeAllowed = (type: string) => {
        if (!pendingConnection?.allowedTypes) return true;
        return pendingConnection.allowedTypes.includes(type);
    };

    // ...

    const createNode = (type: string, position: { x: number, y: number }, event?: React.DragEvent | null, connectorData?: any) => {
        let connectorDataVal = connectorData;

        if (!connectorDataVal && event) {
            const connectorDataStr = event.dataTransfer.getData('application/connector-data');
            connectorDataVal = connectorDataStr ? JSON.parse(connectorDataStr) : null;
        }

        let label = `${type} node`;
        let description = 'Performs an action';
        let connectorType = 'action'; // Valid values: trigger, action, agent, condition, agent-tool, agent-model, agent-memory
        let slug = ''; // The connector's unique identifier (e.g., 'openai', 'slack', 'webhook')
        let actionId = '';
        let connectorId = ''; // Add connector ID
        const iconUrlLight = connectorDataVal?.icon_url_light;
        const iconUrlDark = connectorDataVal?.icon_url_dark;
        let ui = connectorDataVal?.manifest?.ui; // Extract UI settings

        // Generic handling from connector data if available
        if (connectorDataVal) {
            label = connectorDataVal.display_name || connectorDataVal.name;
            description = connectorDataVal.description || '';
            // IMPORTANT: connectorType must be the Connector ID (slug) for backend validation to work
            // The API returns 'id' as the unique slug (e.g. 'webhook', 'openai')
            connectorType = connectorDataVal.id;
            slug = connectorDataVal.id || ''; // Use id as slug
            connectorId = connectorDataVal.id || ''; // Extract connector ID

            // For action nodes, we might need a specific actionId, but default to 'action' or first action if available?
            // For now keeping it simple as before:
            if (type === 'action') actionId = 'action';
        } else {
            // Fallbacks for drag without specific connector data (though our new UI always provides it)
            if (type === 'trigger') {
                label = 'Webhook Trigger';
                description = 'Starts workflow via webhook';
                connectorType = 'webhook'; // CORRECT: Use legal connector ID
                slug = 'webhook';
            } else if (type === 'condition') {
                label = 'If / Else';
                connectorType = 'condition';
                slug = 'condition';
            } else if (type === 'agent') {
                label = 'AI Agent';
                connectorType = 'ai-agent'; // Match backend agent connector
                slug = 'ai-agent';
            } else if (type === 'modelNode') {
                label = 'Model';
                connectorType = 'agent-model';
                slug = 'model';
            } else if (type === 'memoryNode') {
                label = 'Memory';
                connectorType = 'agent-memory';
                slug = 'memory';
            } else if (type === 'toolsNode') {
                label = 'Tool';
                connectorType = 'agent-tool';
                slug = 'tool';
            }
        }

        const baseType = type;

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
                connector_id: connectorId, // Add connector ID for API calls
                connectorType, // Valid type: trigger, action, agent, condition, agent-tool, agent-model, agent-memory
                connector_type: connectorType, // Add snake_case for compatibility
                slug, // Unique connector identifier (e.g., 'openai', 'slack', 'webhook')
                action_id: actionId, // Use snake_case
                actionId, // Keep camelCase for backward compatibility
                iconUrlLight,
                iconUrlDark,
                ui, // Pass UI settings
                baseType, // Pass valid base type (trigger, action, etc.)
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
        window.requestAnimationFrame(() => fitView({ padding: 0.5, maxZoom: 1 }));
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
                setSaving(false);
                return;
            }

            // Use saveDraft to save the workflow definition (creates/updates WorkflowVersion)
            await workflowService.saveDraft(id, definition);

            // Update initial definition after successful save
            setInitialDefinition(currentDefinitionStr);
            setLastSaved(new Date());
        } catch (err: any) {
            console.error('Failed to save workflow', err);
            alert(`Failed to save workflow: ${err?.message || err?.response?.data?.message || 'Unknown error'}`);
            // Don't set lastSaved if there was an error
        } finally {
            setSaving(false);
        }
    }, [id, nodes, edges, initialDefinition]);


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
    // Autosave effect - only triggers after user makes changes, not on initial load
    useEffect(() => {
        if (!isHydrated || !id || !isReady) return;

        // Skip autosave if no user edits (though we are now using isReady to Gate invalid initial saves)
        // We can use a simpler approach now: just debounce save on changes *iff* ready

        const timer = setTimeout(() => {
            handleSave();
        }, 1000);

        return () => clearTimeout(timer);
    }, [nodes, edges, isHydrated, id, isReady, handleSave]);

    // Determine the initial category page based on pending connection context
    const initialCategory = useMemo(() => {
        if (!pendingConnection?.allowedTypes || pendingConnection.allowedTypes.length === 0) return undefined;

        const type = pendingConnection.allowedTypes[0];

        if (type === 'trigger' || type === 'webhook') return 'trigger';
        if (type === 'action') return 'action';
        if (type === 'condition') return 'condition';
        if (type === 'agent') return 'agent';
        if (type === 'modelNode' || type === 'model' || type === 'agent-model') return 'modelNode';
        if (type === 'memoryNode' || type === 'memory' || type === 'agent-memory') return 'memoryNode';
        if (type === 'toolsNode' || type === 'tool' || type === 'agent-tool') return 'toolsNode';
        if (type === 'custom') return 'custom';

        return undefined;
    }, [pendingConnection]);

    const handleApplyActions = useCallback((actions: any[]) => {
        console.log('🔧 handleApplyActions called with:', actions);

        if (!actions || actions.length === 0) {
            console.warn('⚠️ No actions to apply');
            return;
        }

        let updatedNodes = nodes;
        let updatedEdges = edges;
        let skipAutoLayout = false; // Skip auto-layout for generate_workflow since AI provides correct positions

        // Process each action
        for (const action of actions) {
            console.log('Processing action:', action.type, action);
            switch (action.type) {
                case 'add_node': {
                    // Look up connector by slug in allConnectors
                    const connector = allConnectors.find(c => c.slug === action.connector_slug);
                    console.log('Connector found:', connector);
                    if (!connector) {
                        console.error(`Connector not found for slug: ${action.connector_slug}`);
                        continue;
                    }

                    // Determine node type based on connector_type
                    let nodeType = 'action'; // default
                    if (connector.connector_type === 'trigger') nodeType = 'trigger';
                    else if (connector.connector_type === 'condition') nodeType = 'condition';
                    else if (connector.connector_type === 'agent') nodeType = 'agent';
                    else if (connector.connector_type === 'agent-model') nodeType = 'modelNode';
                    else if (connector.connector_type === 'agent-memory') nodeType = 'memoryNode';
                    else if (connector.connector_type === 'agent-tool') nodeType = 'toolsNode';
                    else if ('is_custom' in connector && connector.is_custom) nodeType = 'custom';
                    console.log('nodeType: ', nodeType)
                    const newNode: Node = {
                        id: uuidv4(),
                        type: nodeType,
                        data: {
                            label: connector.display_name, // Always use connector's display name
                            description: connector.description,
                            connector_id: connector.id, // Store connector ID for API calls
                            connectorType: connector.connector_type, // Valid type: trigger, action, agent, condition, agent-tool, agent-model, agent-memory
                            connector_type: connector.connector_type, // Add snake_case for compatibility
                            slug: connector.slug, // Unique connector identifier (e.g., 'openai', 'slack', 'webhook')
                            action_id: action.action_id || '', // Use snake_case to match NodeConfigPanel
                            iconUrlLight: connector.icon_url_light,
                            iconUrlDark: connector.icon_url_dark,
                            baseType: nodeType,
                            config: action.config || {},
                            onAddClick: handleSmartAdd,
                        },
                        // Handle both array [x, y] and object {x, y} position formats
                        position: Array.isArray(action.position)
                            ? { x: action.position[0], y: action.position[1] }
                            : action.position || { x: Math.random() * 400, y: Math.random() * 300 },
                    };
                    updatedNodes = [...updatedNodes, newNode];
                    break;
                }

                case 'add_edge': {
                    // Find nodes by various identifiers (case-insensitive, trimmed)
                    // Supports: exact slug, label, slug_action pattern, or connector-slug_action pattern
                    const findNode = (identifier: string) => {
                        if (!identifier) return undefined;
                        const searchStr = identifier.toString().toLowerCase().trim();

                        return updatedNodes.find((n) => {
                            const nodeLabel = n.data.label?.toString().toLowerCase().trim() || '';
                            const nodeSlug = n.data.slug?.toString().toLowerCase().trim() || '';
                            const nodeActionId = n.data.action_id?.toString().toLowerCase().trim() || '';

                            // Exact match on label or slug
                            if (nodeLabel === searchStr || nodeSlug === searchStr) {
                                return true;
                            }

                            // Match slug_action pattern (e.g., "webhook_receive" matches node with slug="webhook", action_id="receive")
                            // Also handles hyphenated slugs like "ai-agent_run" or "google-calendar_list_events"
                            const slugActionPattern = nodeSlug + '_' + nodeActionId;
                            if (slugActionPattern === searchStr) {
                                return true;
                            }

                            // Handle case where identifier might use underscores for hyphenated slugs
                            // e.g., "ai_agent_run" should match slug="ai-agent", action_id="run"
                            const normalizedSlug = nodeSlug.replace(/-/g, '_');
                            const normalizedPattern = normalizedSlug + '_' + nodeActionId;
                            if (normalizedPattern === searchStr) {
                                return true;
                            }

                            return false;
                        });
                    };

                    const sourceNode = findNode(action.source);
                    const targetNode = findNode(action.target);

                    if (sourceNode && targetNode) {
                        // Determine source handle ID
                        // Condition nodes have 'true'/'false' handles, others have 'source'
                        const sourceHandle = sourceNode.type === 'condition' ? 'true' : 'source';

                        const newEdge: Edge = {
                            id: `${sourceNode.id}-${targetNode.id}`,
                            source: sourceNode.id,
                            target: targetNode.id,
                            sourceHandle,
                            ...(action.targetHandle ? { targetHandle: action.targetHandle } : {}),
                        };
                        updatedEdges = [...updatedEdges, newEdge];
                        console.log('✅ Created edge:', action.source, '->', action.target, `(sourceHandle: ${sourceHandle}, targetHandle: ${action.targetHandle || 'default'})`);
                    } else {
                        console.warn('❌ Could not create edge:', {
                            source: action.source,
                            target: action.target,
                            sourceFound: !!sourceNode,
                            targetFound: !!targetNode,
                            availableLabels: updatedNodes.map(n => n.data.label),
                            availableSlugs: updatedNodes.map(n => n.data.slug)
                        });
                    }
                    break;
                }

                case 'delete_node':
                    updatedNodes = updatedNodes.filter((n) => n.id !== action.node_id);
                    updatedEdges = updatedEdges.filter(
                        (e) => e.source !== action.node_id && e.target !== action.node_id
                    );
                    break;

                case 'update_node': {
                    // Handle manifest updates to existing nodes
                    const targetNode = updatedNodes.find(n => n.id === action.node_id);
                    if (targetNode) {
                        targetNode.data = {
                            ...targetNode.data,
                            ...(action.manifest || {}),
                        };
                    }
                    break;
                }

                case 'generate_workflow': {
                    // n8n-compatible workflow format parser
                    const definition = action.definition;
                    if (!definition) {
                        console.warn('No definition in generate_workflow action');
                        break;
                    }

                    console.log('🔧 Parsing n8n-compatible workflow:', definition);

                    // Map node names to their generated IDs for edge creation
                    const nodeNameToId = new Map<string, string>();

                    // 1. Create nodes from definition
                    const newNodes: Node[] = (definition.nodes || []).map((node: any) => {
                        const connector = allConnectors.find(c => c.slug === node.slug);
                        const nodeId = node.id || uuidv4();

                        // Store name -> id mapping for connections
                        nodeNameToId.set(node.name, nodeId);

                        console.log(`📦 Creating node: ${node.name} (slug: ${node.slug}, id: ${nodeId})`);

                        // Determine node type based on connector_type
                        let nodeType = 'action';
                        if (connector) {
                            if (connector.connector_type === 'trigger') nodeType = 'trigger';
                            else if (connector.connector_type === 'condition') nodeType = 'condition';
                            else if (connector.connector_type === 'agent') nodeType = 'agent';
                            else if (connector.connector_type === 'agent-model') nodeType = 'modelNode';
                            else if (connector.connector_type === 'agent-memory') nodeType = 'memoryNode';
                            else if (connector.connector_type === 'agent-tool') nodeType = 'toolsNode';
                            else if ('is_custom' in connector && connector.is_custom) nodeType = 'custom';
                        }

                        // Handle position - n8n uses [x, y] array, ReactFlow uses {x, y} object
                        let position = { x: 100, y: 100 };
                        if (Array.isArray(node.position)) {
                            position = { x: node.position[0], y: node.position[1] };
                        } else if (node.position?.x !== undefined) {
                            position = node.position;
                        }

                        return {
                            id: nodeId,
                            type: nodeType,
                            position,
                            data: {
                                label: node.name,
                                description: connector?.description || '',
                                connector_id: connector?.id || '',
                                connectorType: connector?.connector_type || 'action',
                                connector_type: connector?.connector_type || 'action',
                                slug: node.slug,
                                action_id: node.action_id || '',
                                iconUrlLight: connector?.icon_url_light,
                                iconUrlDark: connector?.icon_url_dark,
                                baseType: nodeType,
                                onAddClick: handleSmartAdd,
                            },
                        };
                    });

                    // 2. Create edges from connections object (n8n format)
                    const newEdges: Edge[] = [];
                    const connections = definition.connections || {};

                    for (const [sourceName, outputs] of Object.entries(connections)) {
                        // Case-insensitive lookup
                        let sourceId = nodeNameToId.get(sourceName);
                        if (!sourceId) {
                            // Try case-insensitive match
                            for (const [name, id] of nodeNameToId.entries()) {
                                if (name.toLowerCase() === sourceName.toLowerCase()) {
                                    sourceId = id;
                                    break;
                                }
                            }
                        }
                        if (!sourceId) {
                            console.warn(`Source node not found: ${sourceName}`, Array.from(nodeNameToId.keys()));
                            continue;
                        }

                        // Find source node to determine its type for handle selection
                        const sourceNode = newNodes.find(n => n.id === sourceId);
                        const sourceType = sourceNode?.type;

                        for (const [handleType, targets] of Object.entries(outputs as Record<string, any[]>)) {
                            // Each target can be an array of connections
                            const targetList = Array.isArray(targets) ? targets : [targets];

                            for (const target of targetList.flat()) {
                                if (!target?.node) continue;

                                // Case-insensitive target lookup
                                let targetId = nodeNameToId.get(target.node);
                                if (!targetId) {
                                    for (const [name, id] of nodeNameToId.entries()) {
                                        if (name.toLowerCase() === target.node.toLowerCase()) {
                                            targetId = id;
                                            break;
                                        }
                                    }
                                }
                                if (!targetId) {
                                    console.warn(`Target node not found: ${target.node}`, Array.from(nodeNameToId.keys()));
                                    continue;
                                }

                                // Determine sourceHandle based on source node type
                                let sourceHandle = 'source';
                                if (sourceType === 'condition') {
                                    sourceHandle = 'true'; // Default to true branch
                                }

                                // Determine targetHandle based on connection type
                                let targetHandle: string | undefined;
                                if (handleType === 'model' || target.type === 'model') {
                                    targetHandle = 'model';
                                } else if (handleType === 'memory' || target.type === 'memory') {
                                    targetHandle = 'memory';
                                } else if (handleType === 'tools' || target.type === 'tools') {
                                    targetHandle = 'tools';
                                }

                                let finalSourceId = sourceId;
                                let finalTargetId = targetId;

                                // Special handling for agent resources: Agent MUST be the target
                                if (targetHandle) {
                                    const sourceNode = newNodes.find(n => n.id === sourceId);
                                    const targetNode = newNodes.find(n => n.id === targetId);

                                    if (sourceNode?.type === 'agent' && targetNode?.type !== 'agent') {
                                        // AI defined connection from Agent -> Resource, but we need Resource -> Agent
                                        console.log(`Swap edge direction for agent resource: ${sourceName} -> ${target.node}`);
                                        finalSourceId = targetId;
                                        finalTargetId = sourceId;
                                    }
                                }

                                const edge: Edge = {
                                    id: `${finalSourceId}-${finalTargetId}-${targetHandle || handleType}`,
                                    source: finalSourceId,
                                    target: finalTargetId,
                                    sourceHandle,
                                    ...(targetHandle ? { targetHandle } : {}),
                                };

                                newEdges.push(edge);
                                console.log(`🔗 Created edge: ${finalSourceId} -> ${finalTargetId} (${handleType}, targetHandle: ${targetHandle || 'default'})`);
                            }
                        }
                    }

                    // Also handle legacy edges array format for backwards compatibility
                    if (definition.edges && Array.isArray(definition.edges)) {
                        for (const edge of definition.edges) {
                            newEdges.push({
                                ...edge,
                                id: edge.id || `${edge.source}-${edge.target}`,
                            });
                        }
                    }

                    console.log(`✅ Created ${newNodes.length} nodes and ${newEdges.length} edges`);

                    updatedNodes = newNodes;
                    updatedEdges = newEdges;
                    skipAutoLayout = true; // AI already positioned nodes correctly
                    break;
                }
            }
        }

        // Apply auto-layout to ensure 100px gap (skip for generate_workflow which has correct positions)
        if (skipAutoLayout) {
            // Use AI-provided positions directly, just hydrate with callbacks
            const hydratedNodes = updatedNodes.map((node: Node) => ({
                ...node,
                data: {
                    ...node.data,
                    onAddClick: handleSmartAdd,
                },
            }));
            // Set nodes first, then edges after a delay to allow handles to render
            setNodes(hydratedNodes);

            // Use setTimeout to allow enough time for React Flow to register the handles
            setTimeout(() => {
                // Sanitize edges one more time to ensure direction is correct (Resource -> Agent)
                const finalEdges = sanitizeEdges(hydratedNodes, updatedEdges);
                setEdges(finalEdges);
            }, 100);
        } else {
            const layouted = getLayoutedElements(updatedNodes, updatedEdges);
            setNodes(layouted.nodes);
            setEdges(layouted.edges);
        }
    }, [nodes, edges, allConnectors, handleSmartAdd, setNodes, setEdges]);

    return (
        <div className="h-screen flex w-full relative rounded-2xl">
            {/* Main Canvas */}
            <div className="flex-1 relative" ref={reactFlowWrapper}>
                <div className="absolute top-4 right-4 z-10 flex gap-2">
                    <AddNodeSheet
                        open={isAddNodeOpen}
                        onOpenChange={setIsAddNodeOpen}
                        isNodeAllowed={isNodeAllowed}
                        allConnectors={allConnectors}
                        onAddNodeClick={handleAddNodeClick}
                        initialCategory={initialCategory}
                    />

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
                    fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
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

                    {/* Loading State */}
                    {isLoading && (
                        <Panel position="top-center" className="top-1/2! -translate-y-1/2!">
                            <div className="flex flex-col items-center gap-4">
                                <Loader2 className="w-12 h-12 text-neutral-400 animate-spin" />
                                <span className="text-sm text-neutral-400">Loading workflow...</span>
                            </div>
                        </Panel>
                    )}

                    {/* Empty Canvas CTA */}
                    {!isLoading && nodes.length === 0 && (
                        <Panel position="top-center" className="top-1/2! -translate-y-1/2!">
                            <div className="flex items-center gap-6">
                                {/* Add first step button */}
                                <button
                                    onClick={() => setIsAddNodeOpen(true)}
                                    className="flex flex-col items-center justify-center w-28 h-28 border-2 border-dashed border-neutral-600 rounded-lg hover:border-neutral-400 hover:bg-neutral-800/50 transition-all group"
                                >
                                    <Plus className="w-8 h-8 text-neutral-500 group-hover:text-neutral-300 transition-colors" />
                                    <span className="mt-2 text-sm text-neutral-400 group-hover:text-neutral-200 transition-colors">
                                        Add first step...
                                    </span>
                                </button>

                                <span className="text-neutral-500 text-sm">or</span>

                                {/* Build with AI button */}
                                <button
                                    onClick={() => {
                                        // Placeholder - will implement AI workflow builder
                                        console.log('Build with AI clicked');
                                    }}
                                    className="flex flex-col items-center justify-center w-28 h-28 border-2 border-dashed border-neutral-600 rounded-lg hover:border-neutral-400 hover:bg-neutral-800/50 transition-all group"
                                >
                                    <Sparkles className="w-8 h-8 text-neutral-500 group-hover:text-neutral-300 transition-colors" />
                                    <span className="mt-2 text-sm text-neutral-400 group-hover:text-neutral-200 transition-colors">
                                        Build with AI
                                    </span>
                                </button>
                            </div>
                        </Panel>
                    )}
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
                onCreateCredential={() => setIsCreateCredentialOpen(true)}
            />

            <CreateCredentialModal
                open={isCreateCredentialOpen}
                onOpenChange={setIsCreateCredentialOpen}
                connectors={allConnectors}
            />

            {/* AI Assistant Widget */}
            {id && (
                <AIAssistantWidget
                    workflowId={id}
                    nodes={nodes}
                    edges={edges}
                    onApplyActions={handleApplyActions}
                    onAddNode={handleAddNodeClick}
                    open={isAIAssistantOpen}
                    onOpenChange={setIsAIAssistantOpen}
                />
            )}
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
