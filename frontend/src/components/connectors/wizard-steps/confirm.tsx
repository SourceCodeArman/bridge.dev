import { Button } from "@/components/ui/button";
import { Edit, Check, Files, Share2, Box, Settings } from "lucide-react";
import { NodePreview } from "@/components/connectors/NodePreview";
import type { NodeTypesData, NodeSize } from "@/types/nodes";
import { cn } from "@/lib/utils";

interface ConfirmStepProps {
    basicInfo: {
        name: string;
        description: string;
    };
    assets: {
        lightIconFile: File | string | null;
        darkIconFile: File | string | null;
        manifestFile: File | null;
    };
    appearance: {
        nodeSize: NodeSize;
        connectorType: string;
        customRadius: string;
        handleStylingIndex: number;
    };
    structure: {
        handleCounts: Record<string, number>;
    };
    details: {
        handleNames: Record<string, string>;
        handleTypes: Record<string, 'input' | 'output'>;
        smartPlusHandles: Record<string, boolean>;
    };
    onEditStep: (stepId: number) => void;
    nodeTypesData: NodeTypesData;
    errors?: Record<string, string[]>;
}

export default function ConfirmStep({
    basicInfo,
    assets,
    appearance,
    structure,
    details,
    onEditStep,
    nodeTypesData,
    errors = {}
}: ConfirmStepProps) {

    const ErrorMessage = ({ errorKeys }: { errorKeys: string[] }) => {
        const errorList = errorKeys.reduce<string[]>((acc, key) => {
            if (errors[key]) {
                acc.push(...errors[key]);
            }
            return acc;
        }, []);

        if (errorList.length === 0) return null;

        return (
            <div className="text-destructive text-xs mt-1 space-y-1">
                {errorList.map((err, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                        <span>{err}</span>
                    </div>
                ))}
            </div>
        );
    };

    const Section = ({ title, stepId, icon: Icon, children }: { title: string, stepId: number, icon: any, children: React.ReactNode }) => (
        <div className="bg-muted/30 rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium">{title}</h3>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-background"
                    onClick={() => onEditStep(stepId)}
                >
                    <Edit className="w-3 h-3 text-muted-foreground" />
                </Button>
            </div>
            <div className="p-4 text-sm">
                {children}
            </div>
        </div>
    );

    const renderIconStatus = (file: File | string | null, errorKeys: string[] = []) => {
        const hasError = errorKeys.some(k => errors[k]);

        const content = () => {
            if (!file) {
                return <span className="text-muted-foreground italic">Default icon will be used</span>;
            }

            if (typeof file === 'string') {
                const name = file.split('/').pop() || "Library Icon";
                return (
                    <>
                        <Check className="w-3 h-3 text-green-500" />
                        <span title={file} className="truncate max-w-[150px]">{name}</span>
                    </>
                )
            }

            return (
                <>
                    <Check className="w-3 h-3 text-green-500" />
                    <span>{file.name}</span>
                </>
            );
        };

        return (
            <div className="flex flex-col">
                <div className={cn("flex items-center gap-2", hasError && "text-destructive")}>
                    {content()}
                </div>
                <ErrorMessage errorKeys={errorKeys} />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6">
            <div className="space-y-4">
                <Section title="Basic Info" stepId={1} icon={Files}>
                    <div className="grid grid-cols-[100px_1fr] gap-2">
                        <span className={cn("text-muted-foreground", (errors.display_name || errors.slug) && "text-destructive")}>Name:</span>
                        <div>
                            <span className="font-medium">{basicInfo.name}</span>
                            <ErrorMessage errorKeys={['display_name', 'slug']} />
                        </div>

                        <span className={cn("text-muted-foreground", errors.description && "text-destructive")}>Description:</span>
                        <div>
                            <span className="text-muted-foreground line-clamp-2">{basicInfo.description || "No description provided"}</span>
                            <ErrorMessage errorKeys={['description']} />
                        </div>
                    </div>
                </Section>

                <Section title="Assets" stepId={2} icon={Box}>
                    <div className="grid grid-cols-[100px_1fr] gap-2">
                        <span className={cn("text-muted-foreground", (errors.light_icon || errors.icon_url_light) && "text-destructive")}>Light Icon:</span>
                        {renderIconStatus(assets.lightIconFile, ['light_icon', 'icon_url_light'])}

                        <span className={cn("text-muted-foreground", (errors.dark_icon || errors.icon_url_dark) && "text-destructive")}>Dark Icon:</span>
                        {renderIconStatus(assets.darkIconFile, ['dark_icon', 'icon_url_dark'])}

                        <span className={cn("text-muted-foreground", errors.manifest_file && "text-destructive")}>Manifest:</span>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                {assets.manifestFile ? (
                                    <>
                                        <Check className="w-3 h-3 text-green-500" />
                                        <span>{assets.manifestFile.name}</span>
                                    </>
                                ) : (
                                    <span className="text-muted-foreground italic">Default manifest will be used</span>
                                )}
                            </div>
                            <ErrorMessage errorKeys={['manifest_file']} />
                        </div>
                    </div>
                </Section>

                <Section title="Structure & Details" stepId={4} icon={Share2}>
                    <div className="space-y-2">
                        <div className="grid grid-cols-[100px_1fr] gap-2">
                            <span className="text-muted-foreground">Base Type:</span>
                            <span className="capitalize">{nodeTypesData.nodeTypes.find(t => t.id === appearance.connectorType)?.label || appearance.connectorType}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-border/50">
                            {(['left', 'top', 'right', 'bottom'] as const).map(side => (
                                <div key={side} className="flex flex-col items-center p-2 bg-background rounded-md border border-border/50">
                                    <span className="text-[10px] uppercase text-muted-foreground mb-1">{side}</span>
                                    <span className="font-mono font-medium">{structure.handleCounts[side] || 0}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Section>
            </div>

            <div className="space-y-4">
                <div className="bg-muted/30 rounded-lg border border-border overflow-hidden h-full flex flex-col">
                    <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Settings className="w-4 h-4 text-muted-foreground" />
                            <h3 className="text-sm font-medium">Visual Preview</h3>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-background"
                            onClick={() => onEditStep(3)} // Appearance step
                        >
                            <Edit className="w-3 h-3 text-muted-foreground" />
                        </Button>
                    </div>
                    <div className="p-4 flex-1 flex items-center justify-center bg-dot-pattern min-h-[200px]">
                        <div className="relative transform scale-75 origin-center">
                            <NodePreview
                                nodeSize={appearance.nodeSize}
                                lightIconFile={assets.lightIconFile}
                                darkIconFile={assets.darkIconFile}
                                handleCounts={structure.handleCounts}
                                connectorType={appearance.connectorType}
                                customRadius={appearance.customRadius}
                                handleStyling={nodeTypesData.nodeTypes.find(t => t.id === 'custom')?.handles?.styling?.[appearance.handleStylingIndex]}
                                handleNames={details.handleNames}
                                smartPlusHandles={details.smartPlusHandles}
                                name={basicInfo.name}
                                description={basicInfo.description}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
