import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { customConnectorService } from '@/lib/api/services/customConnector';
import { FileUpload } from '@/components/ui/file-upload';
import { Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { NodePreview } from './NodePreview';
import { type ConnectorManifest } from '@/types/models';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface CustomConnectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

// Define the steps
const STEPS = [
    { id: 1, title: 'Basic Info', description: 'Name and describe your connector' },
    { id: 2, title: 'Assets', description: 'Upload icon and manifest' },
    { id: 3, title: 'Appearance', description: 'Customize node look and feel' }
];

export const CustomConnectorModal = ({ isOpen, onClose, onSuccess }: CustomConnectorModalProps) => {
    const { toast } = useToast();
    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [manifestFile, setManifestFile] = useState<File | null>(null);
    const [iconFile, setIconFile] = useState<File | null>(null);

    // Customization State
    const [nodeSize, setNodeSize] = useState<{ width: number; height: number }>({ width: 100, height: 100 });
    // Handles state: count per side
    const [handleCounts, setHandleCounts] = useState<{ [key: string]: number }>({
        left: 1,
        right: 1,
        top: 0,
        bottom: 0
    });
    const [maxOutputConnections, setMaxOutputConnections] = useState<number | string>(1);
    const [handleNames, setHandleNames] = useState<Record<string, string>>({});

    // Reset state on open/close
    useEffect(() => {
        if (!isOpen) {
            setCurrentStep(1);
            setName('');
            setDescription('');
            setManifestFile(null);
            setIconFile(null);
            setNodeSize({ width: 100, height: 100 });
            setHandleCounts({ left: 1, right: 1, top: 0, bottom: 0 });
            setHandleNames({});
            setMaxOutputConnections(1);
            setIsSubmitting(false);
        }
    }, [isOpen]);

    const handleNext = () => {
        if (currentStep < 3) setCurrentStep(c => c + 1);
    };

    const handleBack = () => {
        if (currentStep > 1) setCurrentStep(c => c - 1);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Validation for final step
        if (!name || !manifestFile) {
            toast({
                title: "Validation Error",
                description: "Name and Manifest file are required.",
                variant: "destructive"
            });
            return;
        }

        // Validate Handle Distribution (at least 2 different sides)
        const activeSides = Object.entries(handleCounts)
            .filter(([_, count]) => count > 0)
            .length;

        if (activeSides < 2) {
            toast({
                title: "Configuration Error",
                description: "Node must have handles on at least two different sides (e.g., Left and Right, or Top and Bottom).",
                variant: "destructive"
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const formData = new FormData();
            formData.append('display_name', name);
            if (description) formData.append('description', description);
            formData.append('manifest_file', manifestFile);
            if (iconFile) formData.append('icon', iconFile);

            // Inject UI settings into manifest if possible
            const manifestText = await manifestFile.text();
            try {
                const manifestJson = JSON.parse(manifestText) as ConnectorManifest;

                // Ensure outputHandles is a number
                let finalOutputHandles = typeof maxOutputConnections === 'string'
                    ? parseInt(maxOutputConnections)
                    : maxOutputConnections;

                // Allow empty string to pass as default 1, but if it parsed to NaN handle it
                if (isNaN(finalOutputHandles)) finalOutputHandles = 1;

                // STRICT VALIDATION
                if (finalOutputHandles === 0) {
                    toast({
                        title: "Configuration Error",
                        description: "Edge limit cannot be 0. Use -1 for Infinity or a positive integer.",
                        variant: "destructive"
                    });
                    setIsSubmitting(false);
                    return;
                }

                if (finalOutputHandles < -1) {
                    toast({
                        title: "Configuration Error",
                        description: "Edge limit cannot be less than -1.",
                        variant: "destructive"
                    });
                    setIsSubmitting(false);
                    return;
                }

                // Check for floats (though parseInt handles this, let's be explicit if string contained dot)
                if (typeof maxOutputConnections === 'string' && maxOutputConnections.includes('.')) {
                    toast({
                        title: "Configuration Error",
                        description: "Edge limit must be a whole number.",
                        variant: "destructive"
                    });
                    setIsSubmitting(false);
                    return;
                }

                // Merge UI settings
                manifestJson.ui = {
                    nodeSize,
                    handles: handleCounts, // New handle counts
                    handleNames: handleNames, // Inject user-defined names
                    handleLocations: Object.keys(handleCounts).filter(k => (handleCounts[k] ?? 0) > 0) as any, // Backwards compat
                    outputHandles: finalOutputHandles
                };

                const updatedManifestBlob = new Blob([JSON.stringify(manifestJson, null, 2)], { type: 'application/json' });
                formData.set('manifest_file', updatedManifestBlob, 'manifest.json');

            } catch (err) {
                console.error("Failed to parse/update manifest JSON", err);
            }

            await customConnectorService.create(formData);

            toast({
                title: 'Success',
                description: 'Custom connector created successfully',
            });
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Failed to create custom connector:', error);
            toast({
                title: 'Error',
                description: error.response?.data?.message || 'Failed to create connector',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const updateHandleCount = (side: string, delta: number) => {
        setHandleCounts(prev => ({
            ...prev,
            [side]: Math.max(0, Math.min(5, (prev[side] || 0) + delta))
        }));
    };

    const updateHandleName = (key: string, value: string) => {
        setHandleNames(prev => ({ ...prev, [key]: value }));
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[700px] h-[600px] flex flex-col p-0 gap-0 overflow-hidden bg-neutral-800 text-neutral-200 border-none">
                {/* Header with Steps */}
                <div className="border-b-neutral-700 border-b px-6 py-4 bg-muted/30">
                    <DialogHeader>
                        <DialogTitle>Create Custom Connector</DialogTitle>
                        <DialogDescription>
                            Import your own connector definition.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Stepper */}
                    <div className="flex items-center justify-between mt-6 px-2">
                        {STEPS.map((step) => (
                            <div key={step.id} className="flex flex-col items-center relative z-10">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${currentStep >= step.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground'
                                    }`}>
                                    {step.id}
                                </div>
                                <span className={`text-[10px] mt-2 font-medium uppercase tracking-wider ${currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'
                                    }`}>
                                    {step.title}
                                </span>
                            </div>
                        ))}
                        {/* Progress Bar background would go here but keeping it simple for now */}
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel: Preview (Always Visible) */}
                    <div className="w-1/2 border-r border-neutral-700 bg-muted/10 p-6 flex flex-col items-center justify-center bg-[radial-gradient(#333_1px,transparent_1px)] bg-size-[16px_16px]">
                        <div className="mb-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Live Preview</div>
                        <NodePreview
                            name={name}
                            description={description}
                            iconFile={iconFile}
                            nodeSize={nodeSize}
                            handleCounts={handleCounts}
                            handleNames={handleNames}
                        />
                    </div>

                    {/* Right Panel: Form Fields */}
                    <div className="w-1/2 p-6 overflow-y-auto">
                        <form id="connector-form" onSubmit={handleSubmit} className="space-y-6">

                            {/* Step 1: Basic Info */}
                            {currentStep === 1 && (
                                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Display Name</Label>
                                        <Input
                                            id="name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="My Connector"
                                            className="border-neutral-700"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="description">Description (Optional)</Label>
                                        <Textarea
                                            id="description"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="What does this connector do?"
                                            rows={8}
                                            className="border-neutral-700"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Assets */}
                            {currentStep === 2 && (
                                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                    <div className="space-y-2">
                                        <Label>Icon (Optional)</Label>
                                        <div className="h-24">
                                            <FileUpload
                                                id="icon-upload"
                                                onChange={(files) => setIconFile(files[0] || null)}
                                                accept={{ 'image/*': [] }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">Recommended: 100x100px PNG or SVG</p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Manifest (JSON)</Label>
                                        <div className="h-24">
                                            <FileUpload
                                                id="manifest-upload"
                                                onChange={(files) => setManifestFile(files[0] || null)}
                                                accept={{ 'application/json': ['.json'] }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">Must follow the Bridge connector schema</p>
                                    </div>
                                </div>
                            )}

                            {/* Step 3: Appearance */}
                            {currentStep === 3 && (
                                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                    <div className="space-y-3">
                                        <Label>Node Layout</Label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div
                                                className={`border rounded-md p-3 cursor-pointer transition-all ${nodeSize.width === 100 ? 'border-primary bg-primary/10' : 'hover:bg-accent border-neutral-700'}`}
                                                onClick={() => setNodeSize({ width: 100, height: 100 })}
                                            >
                                                <div className="w-8 h-8 border border-neutral-600 bg-neutral-800 mb-2 rounded ml-auto mr-auto"></div>
                                                <div className="text-center text-xs font-medium">Standard (100x100)</div>
                                            </div>
                                            <div
                                                className={`border rounded-md p-3 cursor-pointer transition-all ${nodeSize.width === 200 ? 'border-primary bg-primary/10' : 'hover:bg-accent border-neutral-700'}`}
                                                onClick={() => setNodeSize({ width: 200, height: 100 })}
                                            >
                                                <div className="w-16 h-8 border border-neutral-600 bg-neutral-800 mb-2 rounded ml-auto mr-auto flex items-center justify-start pl-2 gap-1">
                                                    <div className="w-3 h-3 bg-neutral-600 rounded-full"></div>
                                                    <div className="w-8 h-1 bg-neutral-600 rounded"></div>
                                                </div>
                                                <div className="text-center text-xs font-medium">Wide (200x100)</div>
                                            </div>
                                        </div>
                                        {/* Handle Configuration */}
                                        <div className="space-y-3">
                                            <Label>Handles</Label>
                                            <div className="grid grid-cols-2 gap-4">
                                                {(['left', 'right', 'top', 'bottom'] as const).map(side => (
                                                    <div key={side} className="bg-neutral-900/50 p-2.5 rounded-md border border-neutral-800">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-xs uppercase font-medium text-muted-foreground">{side}</span>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateHandleCount(side, -1)}
                                                                    className="w-5 h-5 flex items-center justify-center rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400"
                                                                >
                                                                    -
                                                                </button>
                                                                <span className="text-xs font-mono w-4 text-center">{handleCounts[side]}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateHandleCount(side, 1)}
                                                                    className="w-5 h-5 flex items-center justify-center rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Handle Names (Wide Mode Only) */}
                                    {nodeSize.width >= 200 && Object.values(handleCounts).some(v => v > 0) && (
                                        <div className="space-y-3 pt-2 border-t border-neutral-800">
                                            <Label>Handle Names</Label>
                                            <div className="space-y-3 max-h-[150px] overflow-y-auto pr-2">
                                                {(['left', 'top', 'right', 'bottom'] as const).map(side => {
                                                    const count = handleCounts[side] || 0;
                                                    if (count === 0) return null;

                                                    return Array.from({ length: count }).map((_, i) => {
                                                        const key = `${side}-${i}`;
                                                        return (
                                                            <div key={key} className="flex items-center gap-3">
                                                                <span className="text-[10px] uppercase text-muted-foreground w-12 shrink-0">{side} {i + 1}</span>
                                                                <Input
                                                                    placeholder="Name (e.g. Input)"
                                                                    value={handleNames[key] || ''}
                                                                    onChange={(e) => updateHandleName(key, e.target.value)}
                                                                    className="h-7 text-xs border-neutral-700"
                                                                />
                                                            </div>
                                                        );
                                                    });
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label>Edge Limit per Output</Label>
                                        <Input
                                            type="text"
                                            value={maxOutputConnections}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '' || val === '-') {
                                                    setMaxOutputConnections(val);
                                                } else {
                                                    const num = parseInt(val);
                                                    if (!isNaN(num)) setMaxOutputConnections(num);
                                                }
                                            }}
                                            className="border-neutral-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-mono"
                                        />
                                        <p className="text-[10px] text-muted-foreground">Whole number only. Min 1, or -1 for Infinity.</p>
                                    </div>
                                </div>
                            )}
                        </form>
                    </div>
                </div>

                {/* Footer */}
                <DialogFooter className="border-t border-neutral-700 px-6 py-4 bg-muted/30 flex justify-between sm:justify-between items-center w-full">
                    {currentStep > 1 ? (
                        <Button type="button" variant="outline" onClick={handleBack} disabled={isSubmitting} className="border-neutral-700 hover:bg-neutral-800">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Back
                        </Button>
                    ) : (
                        <div /> /* Spacer */
                    )}

                    {currentStep < 3 ? (
                        <Button type="button" onClick={handleNext} disabled={currentStep === 1 && !name}>
                            Next <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    ) : (
                        <Button type="submit" onClick={handleSubmit} disabled={isSubmitting || !name || !manifestFile}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                'Create Connector'
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
