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
import { AIAssistantWidget } from '@/components/workflow/AIAssistantWidget';



const initialNodes: Node[] = [];

const initialEdges: Edge[] = [];

// Layout helper using Dagre
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
    const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: direction, ranksep: 100, nodesep: 50 });

    edges.forEach((edge) => g.setEdge(edge.source, edge.target));
    nodes.forEach((node) => {
        // Use actual node dimensions based on type
        let width = 100;
        let height = 100;

        if (node.type === 'agent') {
            width = 200;
            height = 100;
        } else if (node.type === 'modelNode' || node.type === 'memoryNode' || node.type === 'toolsNode') {
            width = 60;
            height = 60;
        }

        g.setNode(node.id, { width, height });
    });

    Dagre.layout(g);

    return {
        nodes: nodes.map((node) => {
            const position = g.node(node.id);
            // We are shifting the dagre node position (anchor=center center) to the top left
            // so it matches the React Flow node anchor point (top left).
            const nodeWidth = g.node(node.id).width;
            const nodeHeight = g.node(node.id).height;
            const x = position.x - nodeWidth / 2;
            const y = position.y - nodeHeight / 2;

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
    const [isReady, setIsReady] = useState(false);
    const [activating, setActivating] = useState(false);

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
                    onAddClick: handleSmartAdd
                }
            }));

            setNodes(hydratedNodes);
            setEdges(savedEdges);
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
            connectorType = connectorDataVal.connector_type || type; // Use the actual connector_type
            slug = connectorDataVal.slug || ''; // Store the slug separately
            connectorId = connectorDataVal.id || ''; // Extract connector ID
            // For action nodes, we might need a specific actionId, but default to 'action' or first action if available?
            // For now keeping it simple as before:
            if (type === 'action') actionId = 'action';
        } else {
            // Fallbacks for drag without specific connector data (though our new UI always provides it)
            if (type === 'trigger') {
                label = 'Webhook Trigger';
                description = 'Starts workflow via webhook';
                connectorType = 'trigger';
                slug = 'webhook';
            } else if (type === 'condition') {
                label = 'If / Else';
                connectorType = 'condition';
                slug = 'condition';
            } else if (type === 'agent') {
                label = 'AI Agent';
                connectorType = 'agent';
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


    const handleApplyWorkflow = useCallback((definition: any) => {
        if (definition.nodes && definition.edges) {
            // Hydrate nodes with onAddClick callback
            const hydratedNodes = definition.nodes.map((node: Node) => ({
                ...node,
                data: {
                    ...node.data,
                    onAddClick: handleSmartAdd
                }
            }));
            setNodes(hydratedNodes);
            setEdges(definition.edges);
        }
    }, [handleSmartAdd, setNodes, setEdges]);

    const handleApplyActions = useCallback((actions: any[]) => {
        console.log('🔧 handleApplyActions called with:', actions);

        if (!actions || actions.length === 0) {
            console.warn('⚠️ No actions to apply');
            return;
        }

        let updatedNodes = nodes;
        let updatedEdges = edges;

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
                        position: action.position || { x: Math.random() * 400, y: Math.random() * 300 },
                    };
                    updatedNodes = [...updatedNodes, newNode];
                    break;
                }

                case 'add_edge': {
                    // Find nodes by label (case-insensitive, trimmed) or by slug
                    const findNode = (identifier: string) => {
                        if (!identifier) return undefined;
                        const searchStr = identifier.toString().toLowerCase().trim();
                        return updatedNodes.find((n) => {
                            const labelMatch = n.data.label?.toString().toLowerCase().trim() === searchStr;
                            const slugMatch = n.data.slug?.toString().toLowerCase().trim() === searchStr;
                            return labelMatch || slugMatch;
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
                        };
                        updatedEdges = [...updatedEdges, newEdge];
                        console.log('✅ Created edge:', action.source, '->', action.target, `(handle: ${sourceHandle})`);
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

                case 'generate_workflow':
                    // Full workflow replacement
                    const hydratedNodes = (action.definition?.nodes || []).map((node: any) => ({
                        ...node,
                        data: {
                            ...node.data,
                            onAddClick: handleSmartAdd,
                        },
                    }));
                    updatedNodes = hydratedNodes;
                    updatedEdges = action.definition?.edges || [];
                    break;
            }
        }

        // Apply auto-layout to ensure 100px gap
        const layouted = getLayoutedElements(updatedNodes, updatedEdges);
        setNodes(layouted.nodes);
        setEdges(layouted.edges);
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
            />

            {/* AI Assistant Widget */}
            {id && (
                <AIAssistantWidget
                    workflowId={id}
                    nodes={nodes}
                    edges={edges}
                    onApplyActions={handleApplyActions}
                    onAddNode={handleAddNodeClick}
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
