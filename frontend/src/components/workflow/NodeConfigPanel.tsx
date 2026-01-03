import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import type { Node } from '@xyflow/react';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { connectorService } from '@/lib/api/services/connector';
import CredentialSelector from './fields/CredentialSelector';
import ActionSelector from './fields/ActionSelector';
import DynamicFieldRenderer from './fields/DynamicFieldRenderer';
import type { Connector, ConnectorAction } from '@/types/models';

interface NodeConfigPanelProps {
    selectedNode: Node | null;
    onClose: () => void;
    onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void;
    workflowId?: string;
}

export default function NodeConfigPanel({ selectedNode, onClose, onUpdateNode, workflowId }: NodeConfigPanelProps) {
    const [label, setLabel] = useState(selectedNode?.data.label as string || '');
    const [description, setDescription] = useState(selectedNode?.data.description as string || '');
    const [credentialId, setCredentialId] = useState<string>(selectedNode?.data.credential_id as string || '');
    const [actionId, setActionId] = useState<string>(selectedNode?.data.action_id as string || '');
    const [fieldValues, setFieldValues] = useState<Record<string, any>>(selectedNode?.data.config as Record<string, any> || {});

    const connectorSlug = selectedNode?.data.connectorType as string;

    // Generate webhook URL for webhook triggers
    // Use the node ID as the webhook_id (it's already a unique identifier)
    const webhookId = selectedNode?.id;
    const webhookUrl = connectorSlug === 'webhook' && webhookId
        ? `${import.meta.env.VITE_API_URL || window.location.origin}/api/v1/core/webhook/${webhookId}/`
        : undefined;

    // Fetch connector details if we have a connector type
    const { data: connector, isLoading: connectorLoading } = useQuery<Connector | undefined>({
        queryKey: ['connector', connectorSlug],
        queryFn: () => connectorSlug ? connectorService.getBySlug(connectorSlug) : Promise.resolve(undefined),
        enabled: !!connectorSlug,
    });

    // Get selected action from manifest
    const selectedAction = connector?.manifest?.actions
        ? Object.values(connector.manifest.actions).find((a: ConnectorAction) => a.id === actionId)
        : undefined;

    // Update local state when node changes
    useEffect(() => {
        if (selectedNode) {
            setLabel(selectedNode.data.label as string || '');
            setDescription(selectedNode.data.description as string || '');
            setCredentialId(selectedNode.data.credential_id as string || '');
            setActionId(selectedNode.data.action_id as string || '');
            setFieldValues(selectedNode.data.config as Record<string, any> || {});
        }
    }, [selectedNode?.id]);

    // Auto-select first action if only one available
    // Auto-select first action if only one available
    useEffect(() => {
        if (connector?.manifest?.actions) {
            const actions = Object.values(connector.manifest.actions);
            if (actions.length === 1 && !actionId) {
                const firstAction = actions[0];
                console.log('Auto-selecting first action:', firstAction);
                if (firstAction) {
                    setActionId(firstAction.id);
                    handleFieldChange('action_id', firstAction.id);
                }
            }
        }
    }, [connector]);

    const handleCredentialChange = (newCredentialId: string) => {
        setCredentialId(newCredentialId);
        // Changes saved on close
    };

    const handleActionChange = (newActionId: string) => {
        setActionId(newActionId);
        // Reset field values when action changes
        setFieldValues({});
    };

    const handleFieldChange = (fieldName: string, value: any) => {
        const newValues = { ...fieldValues, [fieldName]: value };
        setFieldValues(newValues);
    };

    const handleSheetOpenChange = (open: boolean) => {
        if (!open) {
            // Save on close
            if (selectedNode) {
                // Merge fieldValues into the top level data for backwards compatibility
                // just like the individual handlers did
                onUpdateNode(selectedNode.id, {
                    ...selectedNode.data,
                    label,
                    description,
                    credential_id: credentialId,
                    action_id: actionId,
                    config: fieldValues,
                    ...fieldValues // Flatten config into data for legacy support
                });
            }
            onClose();
        }
    };

    return (
        <Sheet open={!!selectedNode} onOpenChange={handleSheetOpenChange}>
            <SheetContent side="right" className="w-[400px] sm:w-[540px] overflow-y-auto bg-background text-foreground border-l-0">
                <SheetHeader>
                    <SheetTitle>{label}</SheetTitle>
                    <SheetDescription>
                        {description}
                    </SheetDescription>
                </SheetHeader>

                {selectedNode && (
                    <div className="mt-6 space-y-6">
                        {/* Connector Configuration */}
                        {connectorLoading && (
                            <div className="text-sm text-foreground">Loading connector...</div>
                        )}

                        {connector && (
                            <div className="space-y-4">
                                {/* Credential Selector */}
                                {connector.manifest?.auth && connector.manifest.auth.type !== 'none' && (
                                    <CredentialSelector
                                        value={credentialId}
                                        onChange={handleCredentialChange}
                                        connectorType={connector.id}
                                        required={connector.manifest.auth.fields?.some(f => f.required)}
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
                                            {Object.entries(selectedAction.input_schema.properties).map(([fieldName, fieldSchema]: [string, any]) => {
                                                // Skip internal fields
                                                if (fieldName === 'step_context' || fieldName === 'credential_id') {
                                                    return null;
                                                }

                                                const isRequired = selectedAction.input_schema.required?.includes(fieldName) || false;

                                                // For webhook path field, use generated URL
                                                const fieldValue = (fieldName === 'path' && webhookUrl)
                                                    ? webhookUrl
                                                    : fieldValues[fieldName];

                                                return (
                                                    <DynamicFieldRenderer
                                                        key={fieldName}
                                                        fieldName={fieldName}
                                                        schema={fieldSchema}
                                                        value={fieldValue}
                                                        onChange={(value) => handleFieldChange(fieldName, value)}
                                                        required={isRequired}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </>
                                )}

                                {/* No action selected message */}
                                {connector.manifest?.actions && Object.keys(connector.manifest.actions).length > 0 && !selectedAction && (
                                    <div className="text-sm text-foreground bg-muted/50 p-4 rounded-md">
                                        Select an action to configure parameters
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Non-connector nodes (Condition, plain Trigger) */}
                        {!connector && !connectorLoading && connectorSlug && (
                            <div className="text-sm text-foreground bg-muted/50 p-4 rounded-md">
                                {selectedNode.type === 'condition' && (
                                    <p>Condition logic builder will be available here.</p>
                                )}
                                {selectedNode.type === 'trigger' && (
                                    <p>Trigger configuration (schedule, webhook URL) will appear here.</p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
