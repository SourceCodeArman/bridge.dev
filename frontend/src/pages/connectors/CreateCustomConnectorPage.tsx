import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { customConnectorService } from '@/lib/api/services/customConnector';
import { FileUpload } from '@/components/ui/file-upload';
import { Loader2, ArrowRight, ArrowLeft, X, Minus, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { NodePreview } from '@/components/connectors/NodePreview';
import { type ConnectorManifest } from '@/types/models';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';



// Define the steps
const STEPS = [
    { id: 1, title: 'Basic Info', description: 'Name and describe your connector' },
    { id: 2, title: 'Assets', description: 'Upload icon and manifest' },
    { id: 3, title: 'Appearance', description: 'Customize node look and feel' }
];

export default function CreateCustomConnectorPage() {
    const navigate = useNavigate();
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
    const [smartPlusHandles, setSmartPlusHandles] = useState<Record<string, boolean>>({});
    const [handleTypes, setHandleTypes] = useState<Record<string, 'input' | 'output'>>({});

    const handleNext = () => {
        if (currentStep < 3) setCurrentStep(c => c + 1);
    };

    const handleBack = () => {
        if (currentStep > 1) setCurrentStep(c => c - 1);
    };

    const handleCancel = () => {
        navigate('/connectors');
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

        // Validate at least one input and one output handle
        const allHandleKeys = Object.keys(handleCounts).flatMap(side =>
            Array.from({ length: handleCounts[side] || 0 }, (_, i) => `${side}-${i}`)
        );
        const inputCount = allHandleKeys.filter(key => handleTypes[key] === 'input').length;
        const outputCount = allHandleKeys.filter(key => handleTypes[key] === 'output').length;

        if (inputCount === 0 || outputCount === 0) {
            toast({
                title: "Configuration Error",
                description: "Node must have at least one input handle and at least one output handle.",
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
            navigate('/connectors');
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

    const toggleSmartPlus = (key: string) => {
        setSmartPlusHandles(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleHandleType = (key: string, type: 'input' | 'output') => {
        setHandleTypes(prev => ({ ...prev, [key]: type }));
        // If switching to input, remove SmartPlus
        if (type === 'input') {
            setSmartPlusHandles(prev => ({ ...prev, [key]: false }));
        }
    };

    // Get default handle type based on side
    const getDefaultHandleType = (side: string): 'input' | 'output' => {
        return side === 'left' ? 'input' : 'output';
    };

    return (
        <div className="min-h-screen bg-neutral-900 p-6 pb-0">
            {/* Header */}
            <div className="border-b border-border bg-card/50">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold">Create Custom Connector</h1>
                            <p className="text-sm text-muted-foreground mt-1">Import your own connector definition</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleCancel} disabled={isSubmitting}>
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center justify-center mt-6 gap-8">
                        {STEPS.map((step, index) => (
                            <div key={step.id} className="flex items-center">
                                <div className="flex flex-col items-center">
                                    <div className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                                        currentStep >= step.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                    )}>
                                        {step.id}
                                    </div>
                                    <span className={cn(
                                        "text-xs mt-2 font-medium uppercase tracking-wider",
                                        currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'
                                    )}>
                                        {step.title}
                                    </span>
                                </div>
                                {index < STEPS.length - 1 && (
                                    <div className={cn(
                                        "w-32 h-0.5 mx-4 transition-colors",
                                        currentStep > step.id ? 'bg-primary' : 'bg-muted'
                                    )} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="container mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left: Preview */}
                    <div className="flex flex-col">
                        <div className="mb-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Live Preview ({nodeSize.width}x{nodeSize.height} px)</div>
                        <Card className="flex-1 flex items-center justify-center bg-[radial-gradient(#333_1px,transparent_1px)] bg-size-[16px_16px] p-8 min-h-[400px]">
                            <NodePreview
                                name={name}
                                description={description}
                                iconFile={iconFile}
                                nodeSize={nodeSize}
                                handleCounts={handleCounts}
                                handleNames={handleNames}
                                smartPlusHandles={smartPlusHandles}
                            />
                        </Card>
                    </div>

                    {/* Right: Form */}
                    <div className="flex flex-col">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Step 1: Basic Info */}
                            {currentStep === 1 && (
                                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                                    <div className="space-y-2 flex flex-col items-start gap-2">
                                        <Label htmlFor="name">Display Name</Label>
                                        <Input
                                            id="name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="My Connector"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <div className="space-y-2 flex flex-col items-start gap-2">
                                        <Label htmlFor="description">Description (Optional)</Label>
                                        <Textarea
                                            id="description"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="What does this connector do?"
                                            rows={8}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Assets */}
                            {currentStep === 2 && (
                                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                    <div className="space-y-2 flex flex-col items-start gap-2 w-full">
                                        <Label>Icon (Optional)</Label>
                                        <div className="h-24 w-full">
                                            <FileUpload
                                                id="icon-upload"
                                                onChange={(files) => setIconFile(files[0] || null)}
                                                accept={{ 'image/*': [] }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">Recommended: 100x100px PNG or SVG</p>
                                    </div>

                                    <div className="space-y-2 flex flex-col items-start gap-2 w-full">
                                        <Label>Manifest (JSON)</Label>
                                        <div className="h-24 w-full">
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
                                    <div className="space-y-3 flex flex-col items-start gap-2 w-full">
                                        <Label>Node Layout</Label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div
                                                className={`border rounded-md p-3 cursor-pointer transition-all ${nodeSize.width === 100 ? 'border-primary bg-primary/10' : 'hover:bg-accent border-border'}`}
                                                onClick={() => setNodeSize({ width: 100, height: 100 })}
                                            >
                                                <div className="w-8 h-8 border border-neutral-600 bg-neutral-800 mb-2 rounded ml-auto mr-auto"></div>
                                                <div className="text-center text-xs font-medium">Standard (100x100)</div>
                                            </div>
                                            <div
                                                className={`border rounded-md p-3 cursor-pointer transition-all ${nodeSize.width === 200 ? 'border-primary bg-primary/10' : 'hover:bg-accent border-border'}`}
                                                onClick={() => setNodeSize({ width: 200, height: 100 })}
                                            >
                                                <div className="w-16 h-8 border border-neutral-600 bg-neutral-800 mb-2 rounded ml-auto mr-auto flex items-center justify-start pl-2 gap-1">
                                                    <div className="w-3 h-3 bg-neutral-600 rounded-full"></div>
                                                    <div className="w-8 h-1 bg-neutral-600 rounded"></div>
                                                </div>
                                                <div className="text-center text-xs font-medium">Wide (200x100)</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Handle Configuration */}
                                    <div className="space-y-3 flex flex-col items-start gap-2 w-full">
                                        <Label>Handles</Label>
                                        <div className="grid grid-cols-2 gap-4 w-full">
                                            {(['left', 'right', 'top', 'bottom'] as const).map(side => (
                                                <div key={side} className="bg-muted/50 p-2.5 rounded-md border border-border">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs uppercase font-medium text-muted-foreground">{side}</span>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => updateHandleCount(side, -1)}
                                                                className="w-5 h-5 flex items-center justify-center rounded bg-neutral-900 border border-border hover:bg-accent text-foreground"
                                                            >
                                                                <Minus size={14} />
                                                            </button>
                                                            <span className="text-xs font-mono w-4 text-center">{handleCounts[side]}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateHandleCount(side, 1)}
                                                                className="w-5 h-5 flex items-center justify-center rounded bg-neutral-900 border border-border hover:bg-accent text-foreground"
                                                            >
                                                                <Plus size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Handle Names & SmartPlus */}
                                    {Object.values(handleCounts).some(v => v > 0) && (
                                        <div className="space-y-3 pt-2 border-t border-border flex flex-col items-start gap-2 w-full">
                                            <Label>Handle Configuration</Label>
                                            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
                                                {(['left', 'top', 'right', 'bottom'] as const).map(side => {
                                                    const count = handleCounts[side] || 0;
                                                    if (count === 0) return null;

                                                    return Array.from({ length: count }).map((_, i) => {
                                                        const key = `${side}-${i}`;
                                                        const handleType = handleTypes[key] || getDefaultHandleType(side);
                                                        const isOutput = handleType === 'output';

                                                        return (
                                                            <div key={key} className="flex items-center gap-2">
                                                                <span className="text-xs uppercase text-muted-foreground w-16 shrink-0">{side} {i + 1}</span>

                                                                {/* Input/Output Type Selector */}
                                                                <Select
                                                                    value={handleType}
                                                                    onValueChange={(value) => toggleHandleType(key, value as 'input' | 'output')}
                                                                >
                                                                    <SelectTrigger className="h-7 w-24 text-xs">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="input">Input</SelectItem>
                                                                        <SelectItem value="output">Output</SelectItem>
                                                                    </SelectContent>
                                                                </Select>

                                                                <Input
                                                                    placeholder="Name (e.g. Input)"
                                                                    value={handleNames[key] || ''}
                                                                    onChange={(e) => updateHandleName(key, e.target.value)}
                                                                    className="h-7 flex-1 text-xs"
                                                                />

                                                                {/* SmartPlus - only for output handles */}
                                                                {isOutput && (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <Checkbox
                                                                            id={`smart-${key}`}
                                                                            checked={smartPlusHandles[key] || false}
                                                                            onCheckedChange={() => toggleSmartPlus(key)}
                                                                            className="border-border bg-neutral-900 cursor-pointer"
                                                                        />
                                                                        <label htmlFor={`smart-${key}`} className="text-[10px] text-muted-foreground cursor-pointer whitespace-nowrap">+</label>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    });
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2 flex flex-col items-start gap-2 w-full">
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
                                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-mono"
                                        />
                                        <p className="text-[10px] text-muted-foreground">Whole number only. Min 1, or -1 for Infinity.</p>
                                    </div>


                                </div>
                            )}
                        </form>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 w-full border-t border-border bg-card/95 backdrop-blur-sm mt-auto z-10">
            <div className="container mx-auto px-6 py-4 flex justify-between items-center">
            <div>
                {currentStep > 1 ? (
                    <Button type="button" variant="outline" onClick={handleBack} disabled={isSubmitting}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                ) : (
                    <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
                        Cancel
                    </Button>
                )}
            </div>
            <div>
                {currentStep < 3 ? (
                    <Button type="button" onClick={handleNext}>
                        Next <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                ) : (
                    <Button type="submit" onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Create Connector
                    </Button>
                )}
            </div>
        </div>
            </div >
        </div >
    );
};
