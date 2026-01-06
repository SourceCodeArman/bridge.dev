import { useState } from "react";
import { format } from "date-fns";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { type Template } from "@/types";
import { Download, Calendar, Tag, Layers } from "lucide-react";

interface TemplateDetailModalProps {
    template: Template | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onClone: (templateId: string, workflowName?: string) => Promise<void>;
}

export function TemplateDetailModal({ template, open, onOpenChange, onClone }: TemplateDetailModalProps) {
    const [workflowName, setWorkflowName] = useState("");
    const [isCloning, setIsCloning] = useState(false);

    if (!template) return null;

    const handleClone = async () => {
        setIsCloning(true);
        try {
            await onClone(template.id, workflowName || `Copy of ${template.name}`);
            setWorkflowName("");
        } finally {
            setIsCloning(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto">
                    {/* Header Image */}
                    <div className="h-48 w-full bg-muted/30 flex items-center justify-center border-b">
                        {template.preview_image_url ? (
                            <img
                                src={template.preview_image_url}
                                alt={template.name}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="text-muted-foreground/30 font-semibold text-5xl select-none">
                                Preview
                            </div>
                        )}
                    </div>

                    <div className="p-6 space-y-6">
                        <DialogHeader>
                            <div className="flex items-center justify-between">
                                <Badge variant="secondary" className="mb-2 capitalize">
                                    {template.category || 'General'}
                                </Badge>
                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5" />
                                    Updated {format(new Date(template.updated_at), 'PPP')}
                                </div>
                            </div>
                            <DialogTitle className="text-2xl">{template.name}</DialogTitle>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {template.tags?.map(tag => (
                                    <Badge key={tag} variant="outline" className="text-xs">
                                        <Tag className="w-3 h-3 mr-1" />
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        </DialogHeader>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 space-y-4">
                                <div>
                                    <h4 className="font-semibold mb-2">Description</h4>
                                    <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                                        {template.description}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                                    <h4 className="font-semibold text-sm">Template Stats</h4>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Usage</span>
                                        <span className="font-mono">{template.usage_count || 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Version</span>
                                        <span className="font-mono">v{template.version || '1.0'}</span>
                                    </div>
                                    <Separator />
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Layers className="w-4 h-4" />
                                        Complete workflow configuration included
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 border-t bg-background">
                    <div className="flex w-full items-center gap-4">
                        <div className="flex-1 space-y-1">
                            <Label htmlFor="workflow-name" className="sr-only">Workflow Name</Label>
                            <Input
                                id="workflow-name"
                                placeholder={`Name for new workflow (default: Copy of ${template.name})`}
                                value={workflowName}
                                onChange={(e) => setWorkflowName(e.target.value)}
                            />
                        </div>
                        <Button onClick={handleClone} disabled={isCloning}>
                            {isCloning ? (
                                "Creating..."
                            ) : (
                                <>
                                    <Download className="w-4 h-4 mr-2" />
                                    Use Template
                                </>
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
