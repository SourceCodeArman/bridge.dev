import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { JsonViewer } from '@/components/ui/json-viewer';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { connectorService } from '@/lib/api/services/connector';
import { cn } from '@/lib/utils';
import type { Connector, ConnectorAction } from '@/types/models';
import { useQuery } from '@tanstack/react-query';
import type { Node } from '@xyflow/react';
import { Check, FileJson, Loader2, Play, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import ActionSelector from './fields/ActionSelector';
import CredentialSelector from './fields/CredentialSelector';
import DynamicFieldRenderer from './fields/DynamicFieldRenderer';
import HttpRequestResponseTabs from './fields/HttpRequestResponseTabs';

interface NodeConfigPanelProps {
    selectedNode: Node | null;
    onClose: () => void;
    onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void;
    onCreateCredential?: (props?: { initialConnectorId?: string; authType?: string }) => void;
}

export default function NodeConfigPanel({ selectedNode, onClose, onUpdateNode, onCreateCredential }: NodeConfigPanelProps) {
    const [label, setLabel] = useState(selectedNode?.data.label as string || '');
    const [description, setDescription] = useState(selectedNode?.data.description as string || '');
    const [credentialId, setCredentialId] = useState<string>(selectedNode?.data.credential_id as string || '');
    const [actionId, setActionId] = useState<string>(selectedNode?.data.action_id as string || '');
    const [fieldValues, setFieldValues] = useState<Record<string, any>>(selectedNode?.data.config as Record<string, any> || {});

    // Execution state
    const [isExecuting, setIsExecuting] = useState(false);
    const [executionResult, setExecutionResult] = useState<any>(null);
    const [executionStatus, setExecutionStatus] = useState<'success' | 'error' | 'idle'>('idle');

    // Mock data state
    const [showMockInput, setShowMockInput] = useState(false);
    const [mockJson, setMockJson] = useState('');
    const [mockError, setMockError] = useState<string | null>(null);

    // Track the request that was sent (for HTTP connector)
    const [executionRequest, setExecutionRequest] = useState<any>(null);

    // MCP tools shared state
    const [mcpTools, setMcpTools] = useState<{ name: string; description?: string; inputSchema?: any }[]>([]);
    const [mcpToolsLoading, setMcpToolsLoading] = useState(false);
    const [mcpToolsError, setMcpToolsError] = useState<string | null>(null);
    const [mcpToolsFetchKey, setMcpToolsFetchKey] = useState<string>('');

    const executeAction = async () => {
        if (!connectorId || !actionId) return;

        setIsExecuting(true);
        setExecutionResult(null);
        setExecutionStatus('idle');

        try {
            // Use filtered values to exclude hidden conditional fields
            const filteredValues = getFilteredFieldValues();
            // For MCP connector, use the credential_id from field values (selected in the config)
            // For other connectors, use the top-level credentialId state
            // Don't pass credential_id when authentication is "none"
            let effectiveCredentialId = connector?.slug === 'mcp-client-tool'
                ? (filteredValues.credential_id || credentialId)
                : credentialId;

            // Clear credential_id if authentication is "none" for MCP connector
            if (connector?.slug === 'mcp-client-tool' && filteredValues.authentication === 'none') {
                effectiveCredentialId = '';
                delete filteredValues.credential_id;
            }
            const result = await connectorService.executeAction(
                connectorId,
                actionId,
                filteredValues,
                effectiveCredentialId
            );
            // Store the request that was sent (for HTTP connector)
            setExecutionRequest({
                method: actionId.toUpperCase(),
                url: fieldValues.url,
                headers: fieldValues.headers,
                params: fieldValues.params,
                body: fieldValues.body,
            });
            setExecutionResult(result);
            setExecutionStatus('success');
        } catch (error: any) {
            console.error('Execution failed:', error);
            setExecutionResult(error.response?.data || error.message);
            setExecutionStatus('error');
        } finally {
            setIsExecuting(false);
        }
    };

    const handleVisualizeMock = () => {
        if (!mockJson.trim()) return;
        setMockError(null);
        try {
            const parsed = JSON.parse(mockJson);
            setExecutionResult(parsed);
            setExecutionStatus('success');
            setShowMockInput(false);
        } catch (e) {
            setMockError("Invalid JSON format");
        }
    };

    const connectorId = selectedNode?.data.connector_id as string; // Use connector ID instead of slug

    // Generate webhook URL for webhook triggers
    const webhookId = selectedNode?.id;
    // Always generate the URL if we have an ID - we'll only use it if the field schema requests it
    const computedWebhookUrl = webhookId
        ? `${import.meta.env.VITE_API_URL || window.location.origin}/api/v1/core/webhook/${webhookId}/`
        : undefined;

    // Fetch connector details
    const { data: connector, isLoading: connectorLoading } = useQuery<Connector | undefined>({
        queryKey: ['connector', connectorId],
        queryFn: () => connectorId ? connectorService.get(connectorId) : Promise.resolve(undefined),
        enabled: !!connectorId,
    });

    // Get selected action - fall back to first action if only one exists
    const selectedAction = connector?.manifest?.actions
        ? (Object.values(connector.manifest.actions).find((a: ConnectorAction) => a.id === actionId) ||
            (Object.values(connector.manifest.actions).length === 1 ? Object.values(connector.manifest.actions)[0] as ConnectorAction : undefined))
        : undefined;

    // Filter out fields that don't meet their ui:showIf conditions
    const getFilteredFieldValues = () => {
        if (!selectedAction?.input_schema?.properties) return fieldValues;

        const filteredValues: Record<string, any> = {};
        const properties = selectedAction.input_schema.properties;

        for (const [fieldName, value] of Object.entries(fieldValues)) {
            const fieldSchema = properties[fieldName];

            // If the field doesn't exist in schema or has no showIf, include it
            if (!fieldSchema || !fieldSchema['ui:showIf']) {
                filteredValues[fieldName] = value;
                continue;
            }

            // Check if the showIf condition is met
            const showIfCondition = fieldSchema['ui:showIf'];
            let shouldInclude = true;

            for (const [dependentField, allowedValues] of Object.entries(showIfCondition) as [string, string[]][]) {
                const currentValue = fieldValues[dependentField];
                if (!allowedValues.includes(currentValue)) {
                    shouldInclude = false;
                    break;
                }
            }

            if (shouldInclude) {
                filteredValues[fieldName] = value;
            }
        }

        return filteredValues;
    };

    // Sync state with selected node
    useEffect(() => {
        if (selectedNode) {
            setLabel(selectedNode.data.label as string || '');
            setDescription(selectedNode.data.description as string || '');
            setCredentialId(selectedNode.data.credential_id as string || '');
            setActionId(selectedNode.data.action_id as string || '');
            setFieldValues(selectedNode.data.config as Record<string, any> || {});

            // Reset execution state on new node
            setExecutionResult(null);
            setExecutionRequest(null);
            setExecutionStatus('idle');
            setShowMockInput(false);
            setMockJson('');
            setMockError(null);
        }
    }, [selectedNode?.id]);

    // Auto-select first action
    useEffect(() => {
        if (connector?.manifest?.actions) {
            const actions = Object.values(connector.manifest.actions);
            if (actions.length === 1 && !actionId) {
                const firstAction = actions[0];
                if (firstAction) {
                    setActionId(firstAction.id);
                    handleFieldChange('action_id', firstAction.id);
                }
            }
        }
    }, [connector]);

    // Auto-populate timezone
    useEffect(() => {
        if (selectedAction?.input_schema?.properties?.timezone && !fieldValues.timezone) {
            const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            setFieldValues(prev => ({
                ...prev,
                timezone: userTimeZone
            }));
        }
    }, [selectedAction?.id, fieldValues.timezone]);

    // MCP tools fetch function
    const fetchMcpTools = async () => {
        if (!connectorId || connector?.slug !== 'mcp-client-tool') return;

        setMcpToolsLoading(true);
        setMcpToolsError(null);

        try {
            // Filter config based on transport
            const transport = fieldValues.transport || 'sse';
            const filteredConfig = { ...fieldValues };

            if (transport === 'stdio') {
                delete filteredConfig.endpoint;
            } else {
                delete filteredConfig.server_command;
                delete filteredConfig.server_args;
            }

            // Clear credential_id if authentication is "none"
            let effectiveCredentialId = filteredConfig.credential_id || credentialId;
            if (filteredConfig.authentication === 'none') {
                effectiveCredentialId = '';
                delete filteredConfig.credential_id;
            }

            const result = await connectorService.executeAction(
                connectorId,
                "list_tools",
                filteredConfig,
                effectiveCredentialId
            );

            if (result && result.tools) {
                setMcpTools(result.tools);
            } else {
                throw new Error("Invalid response format");
            }
        } catch (err: any) {
            console.error("Failed to fetch MCP tools:", err);
            setMcpToolsError(err.message || "Failed to fetch tools");
        } finally {
            setMcpToolsLoading(false);
        }
    };

    // Auto-fetch MCP tools when endpoint or server config changes
    useEffect(() => {
        if (connector?.slug !== 'mcp-client-tool') return;

        const transport = fieldValues.transport || 'sse';
        let fetchKey = '';

        if (transport === 'stdio') {
            const cmd = fieldValues.server_command || '';
            const args = fieldValues.server_args || '';
            if (cmd) {
                fetchKey = `stdio:${cmd}:${args}`;
            }
        } else {
            const endpoint = fieldValues.endpoint || '';
            if (endpoint) {
                fetchKey = `${transport}:${endpoint}`;
            }
        }

        // Only fetch if we have a valid config and it changed
        if (fetchKey && fetchKey !== mcpToolsFetchKey) {
            setMcpToolsFetchKey(fetchKey);
            // Use a debounce to avoid fetching on every keystroke
            const timeoutId = setTimeout(() => {
                fetchMcpTools();
            }, 500);
            return () => clearTimeout(timeoutId);
        }
    }, [connector?.slug, fieldValues.transport, fieldValues.endpoint, fieldValues.server_command, fieldValues.server_args]);

    // Reset MCP tools when node changes
    useEffect(() => {
        setMcpTools([]);
        setMcpToolsError(null);
        setMcpToolsFetchKey('');
    }, [selectedNode?.id]);

    const handleCredentialChange = (newCredentialId: string) => {
        setCredentialId(newCredentialId);
    };

    const handleActionChange = (newActionId: string) => {
        setActionId(newActionId);
        setFieldValues({});
    };

    const handleFieldChange = (fieldName: string, value: any) => {
        const newValues = { ...fieldValues, [fieldName]: value };
        setFieldValues(newValues);
    };


    const handleDialogOpenChange = (open: boolean) => {
        if (!open) {
            if (selectedNode) {
                const filteredConfig = getFilteredFieldValues();
                onUpdateNode(selectedNode.id, {
                    ...selectedNode.data,
                    label,
                    description,
                    credential_id: credentialId,
                    action_id: actionId,
                    config: filteredConfig,
                    ...filteredConfig
                });
            }
            onClose();
        }
    };

    return (
        <Dialog open={!!selectedNode} onOpenChange={handleDialogOpenChange}>
            <DialogContent className="h-[90vh] w-full max-w-[80vw] overflow-hidden flex flex-col duration-200 [&>button]:hidden">
                <DialogHeader className="shrink-0 mb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col items-start justify-between gap-2">
                            <DialogTitle className="text-2xl font-bold">{label}</DialogTitle>
                            <DialogDescription>
                                {description}
                            </DialogDescription>
                        </div>
                        <DialogTrigger>
                            <X className="w-6 h-6" />
                        </DialogTrigger>
                    </div>
                </DialogHeader>

                {selectedNode && (
                    <div className={cn(
                        "flex-1 min-h-0",
                        // HTTP connector: full width until execution, then split
                        connector?.slug === 'http' || connector?.slug === 'http-tool' && !executionResult
                            ? "flex flex-col"
                            : "grid grid-cols-2 gap-6"
                    )}>
                        {/* Left Column / Full Width: Configuration */}
                        <div className={cn(
                            "space-y-6 overflow-y-auto pr-2",
                            connector?.slug === 'http' || connector?.slug === 'http-tool' && !executionResult && "flex-1"
                        )}>
                            {/* Connector Configuration */}
                            {connectorLoading && (
                                <div className="text-sm text-foreground">Loading connector...</div>
                            )}

                            {connector && (
                                <div className="space-y-4 p-0.5">
                                    {/* Credential Selector - Hide for connectors with custom placement */}
                                    {connector.manifest?.auth_config && connector.manifest.auth_config.type !== 'none' && connector.slug !== 'mcp-client-tool' && connector.slug !== 'webhook' && (
                                        <CredentialSelector
                                            value={credentialId}
                                            onChange={handleCredentialChange}
                                            slug={connector.slug}
                                            required={connector.manifest.auth_config.fields?.some(f => f.required)}
                                            onCreate={onCreateCredential}
                                        />
                                    )}

                                    {/* Action Selector */}
                                    {connector.manifest?.actions && Object.keys(connector.manifest.actions).length > 1 && (
                                        <ActionSelector
                                            actions={Object.values(connector.manifest.actions)}
                                            value={actionId}
                                            onChange={handleActionChange}
                                        />
                                    )}

                                    {/* Dynamic Fields from Action Schema */}
                                    {selectedAction?.input_schema?.properties && (
                                        <>
                                            {connector.manifest?.actions && Object.keys(connector.manifest.actions).length > 1 && (
                                                <Separator />
                                            )}
                                            <div className="space-y-4">
                                                {connector.manifest?.actions && Object.keys(connector.manifest.actions).length > 1 && (
                                                    <h4 className="text-sm font-medium">Parameters</h4>
                                                )}
                                                {(() => {
                                                    const properties = Object.entries(selectedAction.input_schema.properties);
                                                    const uiOrder = selectedAction.input_schema['ui:order'] as string[] | undefined;

                                                    if (uiOrder) {
                                                        properties.sort(([keyA], [keyB]) => {
                                                            const indexA = uiOrder.indexOf(keyA);
                                                            const indexB = uiOrder.indexOf(keyB);
                                                            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                                                            if (indexA !== -1) return -1;
                                                            if (indexB !== -1) return 1;
                                                            return 0;
                                                        });
                                                    }

                                                    return properties.map(([fieldName, fieldSchema]: [string, any]) => {
                                                        if (fieldName === 'step_context') return null;
                                                        // Hide credential_id from dynamic fields unless it's MCP tool which handles it properly
                                                        if (fieldName === 'credential_id' && connector.slug !== 'mcp-client-tool') return null;

                                                        const isRequired = selectedAction.input_schema.required?.includes(fieldName) || false;

                                                        // Check if field is a webhook URL field either by format or name/context
                                                        const isWebhookUrlField = fieldSchema.format === 'webhook_url' || (fieldName === 'path' && connector?.id === 'webhook');
                                                        const fieldValue = (isWebhookUrlField && computedWebhookUrl)
                                                            ? computedWebhookUrl
                                                            : fieldValues[fieldName];

                                                        return (
                                                            <DynamicFieldRenderer
                                                                key={fieldName}
                                                                fieldName={fieldName}
                                                                schema={fieldSchema}
                                                                value={fieldValue}
                                                                onChange={(value) => handleFieldChange(fieldName, value)}
                                                                required={isRequired}
                                                                credentialId={credentialId}
                                                                connectorSlug={connector.slug}
                                                                allSchemas={selectedAction.input_schema.properties}
                                                                allValues={fieldValues}
                                                                onMultiChange={(updates) => {
                                                                    const newValues = { ...fieldValues, ...updates };
                                                                    setFieldValues(newValues);
                                                                }}
                                                                onCreateCredential={onCreateCredential}
                                                                mcpTools={mcpTools}
                                                                mcpToolsLoading={mcpToolsLoading}
                                                                mcpToolsError={mcpToolsError}
                                                                onFetchMcpTools={fetchMcpTools}
                                                            />
                                                        );
                                                    });
                                                })()}
                                            </div >
                                        </>
                                    )}

                                    {/* No action selected message */}
                                    {
                                        connector.manifest?.actions && Object.keys(connector.manifest.actions).length > 0 && !selectedAction && (
                                            <div className="text-sm text-foreground bg-muted/50 p-4 rounded-md">
                                                Select an action to configure parameters
                                            </div>
                                        )
                                    }
                                </div >
                            )}

                            {/* Non-connector nodes or Error State */}
                            {
                                !connector && !connectorLoading && connectorId && (
                                    <div className="text-sm text-foreground bg-muted/50 p-4 rounded-md">
                                        {selectedNode.type === 'condition' ? (
                                            <p>Condition logic builder will be available here.</p>
                                        ) : selectedNode.type === 'trigger' ? (
                                            <p>Trigger configuration (schedule, webhook URL) will appear here.</p>
                                        ) : (
                                            <div className="flex flex-col gap-2 text-destructive">
                                                <p className="font-medium">Configuration Error</p>
                                                <p>Connector type "{connectorId}" not found. This node may be invalid or the connector is missing.</p>
                                                <p className="text-xs text-muted-foreground">Try deleting and re-creating this node.</p>
                                            </div>
                                        )}
                                    </div>
                                )
                            }
                        </div >

                        {/* Send Request button for HTTP connector (full-width mode) */}
                        {connector?.slug === 'http' || connector?.slug === 'http-tool' && !executionResult && (
                            <div className="shrink-0 pt-4 border-t mt-4">
                                <Button
                                    onClick={executeAction}
                                    disabled={isExecuting || !actionId}
                                    size="lg"
                                    className="w-full"
                                >
                                    {isExecuting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Sending Request...
                                        </>
                                    ) : (
                                        <>
                                            <Play className="mr-2 h-4 w-4" />
                                            Send Request
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}

                        {/* Right Column: Execution Result & Test Controls - hidden for HTTP until execution */}
                        {(connector?.slug !== 'http' && connector?.slug !== 'http-tool' || executionResult) && (
                            < div className="flex flex-col h-full border-l pl-6 min-h-0" >
                                <div className="flex items-center justify-between shrink-0 mb-4 h-8">
                                    <h4 className="text-sm font-medium">
                                        {executionResult ? 'Execution Output' : showMockInput ? 'Mock Data Input' : 'Test Action'}
                                    </h4>

                                    {executionResult ? (
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "text-xs font-medium px-2 py-0.5 rounded-full uppercase",
                                                executionStatus === 'success' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                                    executionStatus === 'error' ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                                        "bg-gray-100 text-gray-700"
                                            )}>
                                                {executionStatus === 'success' ? 'Success' : 'Error'}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={executeAction}
                                                disabled={isExecuting}
                                                className="h-7 text-xs"
                                            >
                                                <Play className="mr-2 h-3 w-3" />
                                                Run Again
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0"
                                                onClick={() => {
                                                    setExecutionResult(null);
                                                    setShowMockInput(false);
                                                }}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="flex-1 bg-muted/30 rounded-md border min-h-0 relative flex flex-col overflow-hidden">
                                    {executionResult ? (() => {
                                        // Check if this is an HTTP connector result (has status_code)
                                        if ((connector?.slug === 'http' || connector?.slug === 'http-tool') && executionRequest && executionResult.status_code !== undefined) {
                                            return (
                                                <HttpRequestResponseTabs
                                                    request={executionRequest}
                                                    response={executionResult}
                                                    className="h-full p-3 flex flex-col"
                                                />
                                            );
                                        }

                                        // Check if this is an MCP connector result with nested text content
                                        if (connector?.slug === 'mcp-client-tool' && executionResult?.result) {
                                            const mcpResult = executionResult.result;
                                            if (Array.isArray(mcpResult) && mcpResult.length > 0) {
                                                const firstResult = mcpResult[0];
                                                if (firstResult?.type === 'text' && firstResult?.text) {
                                                    // Try to parse the text as JSON first
                                                    try {
                                                        const parsedJson = JSON.parse(firstResult.text);
                                                        return (
                                                            <JsonViewer
                                                                data={parsedJson}
                                                                className="h-full w-full p-1"
                                                            />
                                                        );
                                                    } catch {
                                                        // Not JSON - display as formatted text
                                                        return (
                                                            <div className="h-full w-full p-3 overflow-auto">
                                                                <pre className="text-xs font-mono whitespace-pre-wrap wrap-break-word text-foreground">
                                                                    {firstResult.text}
                                                                </pre>
                                                            </div>
                                                        );
                                                    }
                                                }
                                            }
                                            // Handle error case
                                            if (executionResult.isError && typeof executionResult.error === 'string') {
                                                return (
                                                    <div className="h-full w-full p-3 overflow-auto">
                                                        <pre className="text-xs font-mono whitespace-pre-wrap wrap-break-word text-red-500">
                                                            {executionResult.error}
                                                        </pre>
                                                    </div>
                                                );
                                            }
                                        }

                                        // Default: show raw result
                                        return (
                                            <JsonViewer
                                                data={executionResult}
                                                className="h-full w-full p-1"
                                            />
                                        );
                                    })() : showMockInput ? (
                                        <div className="flex-1 flex flex-col p-4 gap-4">
                                            <div className="flex-1 relative">
                                                <Textarea
                                                    value={mockJson}
                                                    onChange={(e) => setMockJson(e.target.value)}
                                                    placeholder="Paste JSON here..."
                                                    className={cn(
                                                        "absolute inset-0 resize-none font-mono text-xs border-none shadow-none",
                                                        mockError && "border-red-500 focus-visible:ring-red-500"
                                                    )}
                                                    spellCheck={false}
                                                />
                                            </div>
                                            {mockError && (
                                                <div className="text-xs text-red-500 font-medium">{mockError}</div>
                                            )}
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setShowMockInput(false);
                                                        setMockError(null);
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={handleVisualizeMock}
                                                    disabled={!mockJson.trim()}
                                                >
                                                    <Check className="mr-2 h-3 w-3" />
                                                    Visualize
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                                            <div className="mb-4 p-4 rounded-full bg-muted">
                                                <Play className="h-8 w-8 text-muted-foreground/50" />
                                            </div>
                                            <h3 className="font-medium text-foreground mb-2">Ready to Test</h3>
                                            <p className="text-sm mb-6 max-w-xs">
                                                Configure your step on the left, then run it here to verify the output.
                                            </p>
                                            <div className="flex flex-col gap-3 w-full max-w-xs">
                                                <Button
                                                    onClick={executeAction}
                                                    disabled={isExecuting || !actionId}
                                                    size="lg"
                                                    className="w-full"
                                                >
                                                    {isExecuting ? (
                                                        <>
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            Executing...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Play className="mr-2 h-4 w-4" />
                                                            Test Step
                                                        </>
                                                    )}
                                                </Button>

                                                <div className="relative">
                                                    <div className="absolute inset-0 flex items-center">
                                                        <span className="w-full border-t" />
                                                    </div>
                                                    <div className="relative flex justify-center text-xs uppercase">
                                                        <span className="bg-muted/30 px-2 text-muted-foreground">Or</span>
                                                    </div>
                                                </div>

                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setShowMockInput(true)}
                                                    className="w-full"
                                                >
                                                    <FileJson className="mr-2 h-4 w-4" />
                                                    Use Mock Data
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div >
                        )}
                    </div >
                )}
            </DialogContent >
        </Dialog >
    );
}
