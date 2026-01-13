import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import type { Node } from '@xyflow/react';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { connectorService } from '@/lib/api/services/connector';
import CredentialSelector from './fields/CredentialSelector';
import ActionSelector from './fields/ActionSelector';
import DynamicFieldRenderer from './fields/DynamicFieldRenderer';
import type { Connector, ConnectorAction } from '@/types/models';
import { Loader2, Play, X, FileJson, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { JsonViewer } from '@/components/ui/json-viewer';
import { Textarea } from '@/components/ui/textarea';

interface NodeConfigPanelProps {
    selectedNode: Node | null;
    onClose: () => void;
    onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void;
    onCreateCredential?: () => void;
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

    const executeAction = async () => {
        if (!connectorId || !actionId) return;

        setIsExecuting(true);
        setExecutionResult(null);
        setExecutionStatus('idle');

        try {
            const result = await connectorService.executeAction(
                connectorId,
                actionId,
                fieldValues,
                credentialId
            );
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

    // Get selected action
    const selectedAction = connector?.manifest?.actions
        ? Object.values(connector.manifest.actions).find((a: ConnectorAction) => a.id === actionId)
        : undefined;

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
                onUpdateNode(selectedNode.id, {
                    ...selectedNode.data,
                    label,
                    description,
                    credential_id: credentialId,
                    action_id: actionId,
                    config: fieldValues,
                    ...fieldValues
                });
            }
            onClose();
        }
    };

    return (
        <Dialog open={!!selectedNode} onOpenChange={handleDialogOpenChange}>
            <DialogContent className="h-[90vh] w-full max-w-[80vw] overflow-hidden flex flex-col duration-200">
                <DialogHeader className="shrink-0 mb-4">
                    <DialogTitle>{label}</DialogTitle>
                    <DialogDescription>
                        {description}
                    </DialogDescription>
                </DialogHeader>

                {selectedNode && (
                    <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
                        {/* Left Column: Configuration */}
                        <div className="space-y-6 overflow-y-auto pr-2">
                            {/* Connector Configuration */}
                            {connectorLoading && (
                                <div className="text-sm text-foreground">Loading connector...</div>
                            )}

                            {connector && (
                                <div className="space-y-4">
                                    {/* Credential Selector */}
                                    {connector.manifest?.auth_config && connector.manifest.auth_config.type !== 'none' && (
                                        <CredentialSelector
                                            value={credentialId}
                                            onChange={handleCredentialChange}
                                            connectorType={connector.id}
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
                                            <Separator />
                                            <div className="space-y-4">
                                                <h4 className="text-sm font-medium">Parameters</h4>
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
                                                        if (fieldName === 'step_context' || fieldName === 'credential_id') return null;

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
            allSchemas={selectedAction.input_schema.properties}
            allValues={fieldValues}
            onMultiChange={(updates) => {
                const newValues = { ...fieldValues, ...updates };
                setFieldValues(newValues);
            }}
        />
    );
});
                                                }) ()}
                                            </div >
                                        </>
                                    )}

{/* No action selected message */ }
{
    connector.manifest?.actions && Object.keys(connector.manifest.actions).length > 0 && !selectedAction && (
        <div className="text-sm text-foreground bg-muted/50 p-4 rounded-md">
            Select an action to configure parameters
        </div>
    )
}
                                </div >
                            )}

{/* Non-connector nodes or Error State */ }
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

    {/* Right Column: Execution Result & Test Controls */ }
    < div className = "flex flex-col h-full border-l pl-6 min-h-0" >
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

                            <div className="flex-1 bg-muted/30 rounded-md border min-h-0 relative flex flex-col">
                                {executionResult ? (
                                    <JsonViewer
                                        data={executionResult}
                                        className="h-full w-full p-1"
                                    />
                                ) : showMockInput ? (
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
                    </div >
                )}
            </DialogContent >
        </Dialog >
    );
}
