import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { customConnectorService } from '@/lib/api/services/customConnector';
import { Loader2, ArrowRight, ArrowLeft, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { NodePreview } from '@/components/connectors/NodePreview';
import { type ConnectorManifest } from '@/types/models';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import nodeTypesData from '@/components/nodes/node-types.json';
import BasicInfoStep from '@/components/connectors/wizard-steps/basic-info';
import AssetsStep from '@/components/connectors/wizard-steps/assets';
import AppearanceStep from '@/components/connectors/wizard-steps/appearance';
import StructureStep from '@/components/connectors/wizard-steps/structure';
import DetailsStep from '@/components/connectors/wizard-steps/details';
import ConfirmStep from '@/components/connectors/wizard-steps/confirm';

// Define the steps
const STEPS = [
    { id: 1, title: 'Basic Info', description: 'Name and describe your connector' },
    { id: 2, title: 'Assets', description: 'Upload icon and manifest' },
    { id: 3, title: 'Appearance', description: 'Customize styling' },
    { id: 4, title: 'Structure', description: 'Define handle counts' },
    { id: 5, title: 'Details', description: 'Configure handle properties' },
    { id: 6, title: 'Confirm', description: 'Review and submit' },
];

export default function CreateCustomConnectorPage() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string[]>>({});

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [manifestFile, setManifestFile] = useState<File | null>(null);
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [lightIconFile, setLightIconFile] = useState<File | string | null>(null);
    const [darkIconFile, setDarkIconFile] = useState<File | string | null>(null);
    const [connectorType, setConnectorType] = useState<string>("trigger");
    const [nodeSize, setNodeSize] = useState<{ width: number; height: number }>({ width: 100, height: 100 });
    // Handles state: count per side
    const [handleCounts, setHandleCounts] = useState<{ [key: string]: number }>({
        left: 1,
        right: 1,
        top: 0,
        bottom: 0
    });

    // Custom Styling State
    const [customRadius, setCustomRadius] = useState<string>("18px");


    const [handleStylingIndex, setHandleStylingIndex] = useState<number>(0);

    const [handleNames, setHandleNames] = useState<Record<string, string>>({});
    const [smartPlusHandles, setSmartPlusHandles] = useState<Record<string, boolean>>({});
    const [handleTypes, setHandleTypes] = useState<Record<string, 'input' | 'output'>>({});

    const handleNext = () => {
        if (currentStep < 6) setCurrentStep(c => c + 1);
    };

    const handleBack = () => {
        if (currentStep > 1) setCurrentStep(c => c - 1);
    };

    const handleCancel = () => {
        navigate('/connectors');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});
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

        const typeConfig = nodeTypesData.nodeTypes.find(t => t.id === connectorType);
        const allowedTypes = typeConfig?.handles?.allowedHandleTypes || ['input', 'output'];
        const needsInput = allowedTypes.includes('input');
        const needsOutput = allowedTypes.includes('output');


        // Check if we have enough sides populated
        // If the configuration RESTRICTS us to < 2 sides, we shouldn't fail validation
        const maxPossibleSides = ['left', 'right', 'top', 'bottom'].filter(s =>
            (typeConfig?.handles?.maxHandleCounts?.[s as keyof typeof typeConfig.handles.maxHandleCounts] ?? 5) > 0
        ).length;

        if (maxPossibleSides >= 2 && activeSides < 2) {
            toast({
                title: "Configuration Error",
                description: "Node must have handles on at least two different sides (e.g., Left and Right, or Top and Bottom).",
                variant: "destructive"
            });
            return;
        }

        // Validate requirements
        const allHandleKeys = Object.keys(handleCounts).flatMap(side =>
            Array.from({ length: handleCounts[side] || 0 }, (_, i) => `${side}-${i}`)
        );
        const inputCount = allHandleKeys.filter(key => {
            // Logic repeated here for validation since we removed the helper function
            // Or we could export/import it. For now, let's keep it consistent with validation logic.
            const side = key.split('-')[0]!;
            const typeConfig = nodeTypesData.nodeTypes.find(t => t.id === connectorType);
            const allowedTypes = typeConfig?.handles?.allowedHandleTypes;
            const defaultType = (allowedTypes && allowedTypes.length === 1) ? allowedTypes[0] : (side === 'left' ? 'input' : 'output');

            return (handleTypes[key] || defaultType) === 'input';
        }).length;
        const outputCount = allHandleKeys.filter(key => {
            const side = key.split('-')[0]!;
            const typeConfig = nodeTypesData.nodeTypes.find(t => t.id === connectorType);
            const allowedTypes = typeConfig?.handles?.allowedHandleTypes;
            const defaultType = (allowedTypes && allowedTypes.length === 1) ? allowedTypes[0] : (side === 'left' ? 'input' : 'output');
            return (handleTypes[key] || defaultType) === 'output';
        }).length;

        if ((needsInput && inputCount === 0) || (needsOutput && outputCount === 0)) {
            toast({
                title: "Configuration Error",
                description: `Node must have at least ${needsInput ? 'one input' : ''} ${needsInput && needsOutput ? 'and' : ''} ${needsOutput ? 'one output' : ''} handle.`,
                variant: "destructive"
            });
            return;
        }


        setIsSubmitting(true);

        try {
            const formData = new FormData();
            formData.append('display_name', name);
            formData.append('connector_type', connectorType);
            if (description) formData.append('description', description);
            formData.append('manifest_file', manifestFile);

            // Handle Light Icon
            if (lightIconFile) {
                if (typeof lightIconFile === 'string') {
                    formData.append('icon_url_light', lightIconFile);
                } else {
                    formData.append('light_icon', lightIconFile);
                }
            }

            // Handle Dark Icon
            if (darkIconFile) {
                if (typeof darkIconFile === 'string') {
                    formData.append('icon_url_dark', darkIconFile);
                } else {
                    formData.append('dark_icon', darkIconFile);
                }
            }

            // Inject UI settings into manifest if possible
            const manifestText = await manifestFile.text();
            try {
                const manifestJson = JSON.parse(manifestText) as ConnectorManifest;



                const selectedStyling = nodeTypesData.nodeTypes.find(t => t.id === connectorType)?.handles?.styling?.[handleStylingIndex];

                // Merge UI settings
                manifestJson.ui = {
                    nodeSize,
                    handles: handleCounts, // New handle counts
                    handleNames: handleNames, // Inject user-defined names
                    handleStyling: selectedStyling, // Inject selected styling
                    customRadius: customRadius, // Inject custom radius
                    handleLocations: Object.keys(handleCounts).filter(k => (handleCounts[k] ?? 0) > 0) as any, // Backwards compat
                    outputHandles: -1
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
            navigate('/connectors');
        } catch (error: any) {
            console.error('Failed to create custom connector:', error);

            // Handle validation errors from backend
            if (error.response?.status === 400 && error.response?.data) {
                setErrors(error.response.data);
                toast({
                    title: 'Validation Error',
                    description: 'Please check the form for errors.',
                    variant: 'destructive',
                });
            } else {
                toast({
                    title: 'Error',
                    description: error.response?.data?.message || 'Failed to create connector',
                    variant: 'destructive',
                });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Update handles when connector type changes
    useEffect(() => {
        const typeConfig = nodeTypesData.nodeTypes.find(t => t.id === connectorType);
        if (typeConfig) {
            if (typeConfig.handles) {
                setHandleCounts(typeConfig.handles.defaults);
            }

            // Check if this type allows custom radius options
            const hasRadiusOptions = typeConfig.style?.radiusOptions && typeConfig.style.radiusOptions.length > 0;

            if (hasRadiusOptions) {
                setCustomRadius("18px"); // Default for custom/configurable types
            } else {
                setCustomRadius(""); // Clear for strict types like 'trigger'
            }

        } else {
            // Fallback default
            setHandleCounts({ left: 1, right: 1, top: 0, bottom: 0 });
            setCustomRadius("18px");
        }
    }, [connectorType]);

    return (
        <div className="min-h-screen bg-background p-6 pb-0 flex flex-col items-center w-full justify-between">
            {/* Header */}
            <div className="border-b border-border bg-background pb-4 w-full">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold">Custom Connector</h1>
                            <p className="text-sm text-foreground mt-1">Import your own connector definition</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleCancel} disabled={isSubmitting}>
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="container m-auto px-6 py-8 w-full">
                <div className={cn("grid gap-8 w-full", currentStep === 6 ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2")}>
                    {/* Left: Preview - Hide on Confirm step */}
                    {currentStep !== 6 && (
                        <div className="flex flex-col">
                            <div className="mb-4 text-xs font-medium text-foreground uppercase tracking-wider">Live Preview ({nodeSize.width}x{nodeSize.height} px)</div>
                            <Card className="flex-1 flex items-center justify-center bg-[radial-gradient(#333_1px,transparent_1px)] bg-size-[16px_16px] p-8 min-h-[400px] bg-background">
                                <NodePreview
                                    name={name}
                                    description={description}
                                    lightIconFile={lightIconFile}
                                    darkIconFile={darkIconFile}
                                    nodeSize={nodeSize}
                                    handleCounts={handleCounts}
                                    handleNames={handleNames}
                                    smartPlusHandles={smartPlusHandles}
                                    connectorType={connectorType}
                                    customRadius={customRadius}
                                    handleStyling={nodeTypesData.nodeTypes.find(t => t.id === connectorType)?.handles?.styling?.[handleStylingIndex]}
                                />
                            </Card>
                        </div>
                    )}

                    {/* Right: Form */}
                    <div className="flex flex-col">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Step 1: Basic Info */}
                            {currentStep === 1 && (
                                <BasicInfoStep
                                    name={name}
                                    setName={setName}
                                    description={description}
                                    setDescription={setDescription}
                                />
                            )}

                            {/* Step 2: Assets */}
                            {currentStep === 2 && (
                                <AssetsStep
                                    iconFile={iconFile}
                                    setIconFile={setIconFile}
                                    setLightIconFile={setLightIconFile}
                                    setDarkIconFile={setDarkIconFile}
                                    setManifestFile={setManifestFile}
                                />
                            )}

                            {/* Step 3: Appearance */}
                            {currentStep === 3 && (
                                <AppearanceStep
                                    nodeTypesData={nodeTypesData as any}
                                    nodeSize={nodeSize}
                                    setNodeSize={setNodeSize}
                                    connectorType={connectorType}
                                    setConnectorType={setConnectorType}
                                    customRadius={customRadius}
                                    setCustomRadius={setCustomRadius}
                                    handleStylingIndex={handleStylingIndex}
                                    setHandleStylingIndex={setHandleStylingIndex}
                                />
                            )}

                            {/* Step 4: Structure */}
                            {currentStep === 4 && (
                                <StructureStep
                                    handleCounts={handleCounts}
                                    setHandleCounts={setHandleCounts}
                                    connectorType={connectorType}
                                    nodeTypesData={nodeTypesData as any}
                                />
                            )}

                            {/* Step 5: Details */}
                            {currentStep === 5 && (
                                <DetailsStep
                                    handleCounts={handleCounts}
                                    handleNames={handleNames}
                                    setHandleNames={setHandleNames}
                                    smartPlusHandles={smartPlusHandles}
                                    setSmartPlusHandles={setSmartPlusHandles}
                                    handleTypes={handleTypes}
                                    setHandleTypes={setHandleTypes}
                                    connectorType={connectorType}
                                    nodeTypesData={nodeTypesData as any}
                                />
                            )}

                            {/* Step 6: Confirm */}
                            {currentStep === 6 && (
                                <ConfirmStep
                                    basicInfo={{ name, description }}
                                    assets={{ lightIconFile, darkIconFile, manifestFile }}
                                    appearance={{ nodeSize, connectorType, customRadius, handleStylingIndex }}
                                    structure={{ handleCounts }}
                                    details={{ handleNames, handleTypes, smartPlusHandles }}
                                    onEditStep={setCurrentStep}
                                    nodeTypesData={nodeTypesData as any}
                                    errors={errors}
                                />
                            )}

                            <div className="space-y-6"></div>
                        </form>
                    </div>
                </div>
            </div >

            {/* Footer */}
            < div className="sticky bottom-0 w-full border-t border-border bg-background backdrop-blur-sm mt-auto z-10" >
                <div className="container mx-auto px-6 py-4 grid grid-cols-[1fr_6fr_1fr]">
                    <div className="w-full flex justify-end">
                        {currentStep > 1 ? (
                            <Button type="button" variant="outline" onClick={handleBack} disabled={isSubmitting}>
                                <ArrowLeft className="w-4 h-4 mr-2" /> Back
                            </Button>
                        ) : (<div className="w-25 h-[36px]"></div>)}
                    </div>
                    {/* Stepper */}
                    <div className="grid grid-cols-6">
                        {STEPS.map((step, index) => (
                            <div key={step.id} className="flex items-center cursor-pointer relative" onClick={() => setCurrentStep(step.id)}>
                                <div className="flex flex-col items-center w-full">
                                    <div className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                                        currentStep >= step.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                                    )}>
                                        {step.id}
                                    </div>
                                    <span className={cn(
                                        "text-xs mt-2 font-medium uppercase tracking-wider",
                                        currentStep >= step.id ? 'text-foreground' : 'text-foreground'
                                    )}>
                                        {step.title}
                                    </span>
                                </div>
                                {index < STEPS.length - 1 && (
                                    <div className={cn(
                                        "absolute -right-1/4 z-10 w-16 h-0.5 mx-2 mb-6 transition-colors",
                                        currentStep > step.id ? 'bg-primary' : 'bg-muted-foreground/40'
                                    )} />
                                )}
                            </div>
                        ))}
                    </div>
                    <div>
                        {currentStep < 6 ? (
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