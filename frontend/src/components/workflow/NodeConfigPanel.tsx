import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Node } from '@xyflow/react';
import { useState } from 'react';

interface NodeConfigPanelProps {
    selectedNode: Node | null;
    onClose: () => void;
    onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void;
}

export default function NodeConfigPanel({ selectedNode, onClose, onUpdateNode }: NodeConfigPanelProps) {
    const [label, setLabel] = useState(selectedNode?.data.label as string || '');
    const [description, setDescription] = useState(selectedNode?.data.description as string || '');

    const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLabel(e.target.value);
        if (selectedNode) {
            onUpdateNode(selectedNode.id, { ...selectedNode.data, label: e.target.value });
        }
    };

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDescription(e.target.value);
        if (selectedNode) {
            onUpdateNode(selectedNode.id, { ...selectedNode.data, description: e.target.value });
        }
    };

    return (
        <Sheet open={!!selectedNode} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                    <SheetTitle>Configuration</SheetTitle>
                    <SheetDescription>
                        Configure settings for {selectedNode?.type} node.
                    </SheetDescription>
                </SheetHeader>

                {selectedNode && (
                    <div className="mt-6 space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="node-label">Label</Label>
                            <Input
                                id="node-label"
                                value={label}
                                onChange={handleLabelChange}
                                placeholder="Node Name"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="node-desc">Description</Label>
                            <Input
                                id="node-desc"
                                value={description}
                                onChange={handleDescriptionChange}
                                placeholder="What does this step do?"
                            />
                        </div>

                        <div className="border-t pt-4">
                            <h4 className="text-sm font-medium mb-3">Parameters</h4>
                            <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-md">
                                {selectedNode.type === 'trigger' && (
                                    <p>Trigger configuration will appear here (e.g. Schedule, Webhook URL).</p>
                                )}
                                {selectedNode.type === 'action' && (
                                    <p>Connector action inputs will represent the schema form here.</p>
                                )}
                                {selectedNode.type === 'condition' && (
                                    <p>Condition logic builder (Group / Rules) will govern the execution path.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
