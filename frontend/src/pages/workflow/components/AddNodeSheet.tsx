import React, { useState, useEffect } from 'react';
import {
    Plus,
    Webhook,
    ChevronLeft,
    Zap,
    Play,
    GitBranch,
    Bot,
    Box,
    Database,
    Wrench,
    Grid
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetTrigger,
} from '@/components/ui/sheet';
import { ThemeAwareIcon } from '@/components/connectors/ThemeAwareIcon';
import type { Connector } from '@/types/models';

interface AddNodeSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isNodeAllowed: (type: string) => boolean;
    allConnectors: Connector[];
    onAddNodeClick: (type: string, connector?: any) => void;
    initialCategory?: string;
}

type Page = 'home' | 'trigger' | 'action' | 'condition' | 'agent' | 'modelNode' | 'memoryNode' | 'toolsNode' | 'custom';

export const AddNodeSheet: React.FC<AddNodeSheetProps> = ({
    open,
    onOpenChange,
    isNodeAllowed,
    allConnectors,
    onAddNodeClick,
    initialCategory,
}) => {
    const [currentPage, setCurrentPage] = useState<Page>('home');

    // Reset to home or initial category when sheet opens
    useEffect(() => {
        if (open) {
            if (initialCategory) {
                // Map the category string to our Page type if needed
                setCurrentPage(initialCategory as Page);
            } else {
                setCurrentPage('home');
            }
        }
    }, [open, initialCategory]);

    const renderHome = () => (
        <div className="grid grid-cols-2 gap-4 mt-6">
            <CategoryButton
                icon={<Zap className="w-6 h-6 mb-2" />}
                label="Triggers"
                description="Start your workflow"
                onClick={() => setCurrentPage('trigger')}
                disabled={!isNodeAllowed('trigger') && !isNodeAllowed('webhook')}
            />
            <CategoryButton
                icon={<Play className="w-6 h-6 mb-2" />}
                label="Actions"
                description="Perform tasks"
                onClick={() => setCurrentPage('action')}
                disabled={!isNodeAllowed('action')}
            />
            <CategoryButton
                icon={<GitBranch className="w-6 h-6 mb-2" />}
                label="Logic"
                description="Control flow"
                onClick={() => setCurrentPage('condition')}
                disabled={!isNodeAllowed('condition')}
            />
            <CategoryButton
                icon={<Bot className="w-6 h-6 mb-2" />}
                label="Agents"
                description="AI capabilities"
                onClick={() => setCurrentPage('agent')}
                disabled={!isNodeAllowed('agent')}
            />
            <CategoryButton
                icon={<Box className="w-6 h-6 mb-2" />}
                label="Models"
                description="AI Models"
                onClick={() => setCurrentPage('modelNode')}
                disabled={!isNodeAllowed('modelNode')}
            />
            <CategoryButton
                icon={<Database className="w-6 h-6 mb-2" />}
                label="Memory"
                description="Storage & Context"
                onClick={() => setCurrentPage('memoryNode')}
                disabled={!isNodeAllowed('memoryNode')}
            />
            <CategoryButton
                icon={<Wrench className="w-6 h-6 mb-2" />}
                label="Tools"
                description="External tools"
                onClick={() => setCurrentPage('toolsNode')}
                disabled={!isNodeAllowed('toolsNode')}
            />
            <CategoryButton
                icon={<Grid className="w-6 h-6 mb-2" />}
                label="Custom"
                description="Custom integrations"
                onClick={() => setCurrentPage('custom')}
                disabled={false} // Always show custom if available or potentially available
            />
        </div>
    );

    const renderHeader = (title: string) => (
        <div className="flex items-center gap-2 mb-6">
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -ml-2"
                onClick={() => setCurrentPage('home')}
            >
                <ChevronLeft className="w-4 h-4" />
            </Button>
            <h3 className="font-semibold">{title}</h3>
        </div>
    );

    const renderCategoryContent = () => {
        switch (currentPage) {
            case 'trigger':
                return (
                    <div>
                        {renderHeader('Triggers')}
                        <div className="space-y-2">
                            {allConnectors.filter(c => c.connector_type === 'trigger').map((connector) => (
                                <NodeItem
                                    key={connector.id}
                                    connector={connector}
                                    type="trigger"
                                    onClick={onAddNodeClick}
                                />
                            ))}
                            {!allConnectors.some(c => c.connector_type === 'trigger') && (
                                <NodeItem
                                    type="trigger"
                                    onClick={onAddNodeClick}
                                    fallbackLabel="Webhook Trigger"
                                    fallbackIcon={<Webhook className="w-4 h-4 text-foreground" />}
                                />
                            )}
                        </div>
                    </div>
                );
            case 'action':
                return (
                    <div>
                        {renderHeader('Actions')}
                        <div className="space-y-2">
                            {allConnectors.filter(c => c.connector_type === 'action').map((connector) => (
                                <NodeItem
                                    key={connector.id}
                                    connector={connector}
                                    type="action"
                                    onClick={onAddNodeClick}
                                />
                            ))}
                        </div>
                    </div>
                );
            case 'condition':
                return (
                    <div>
                        {renderHeader('Logic')}
                        <div className="space-y-2">
                            <div
                                className="border p-3 rounded-lg cursor-pointer bg-card hover:bg-accent/50 transition-all flex items-center gap-3"
                                onClick={() => onAddNodeClick('condition')}
                                draggable
                                onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'condition')}
                            >
                                <GitBranch className="w-4 h-4 text-foreground" />
                                <span className="text-sm font-medium">If / Else</span>
                            </div>
                        </div>
                    </div>
                );
            case 'agent':
                return (
                    <div>
                        {renderHeader('Agents')}
                        <div className="space-y-2">
                            {allConnectors.filter(c => c.connector_type === 'agent').map((connector) => (
                                <NodeItem
                                    key={connector.id}
                                    connector={connector}
                                    type="agent"
                                    onClick={onAddNodeClick}
                                />
                            ))}
                            {!allConnectors.some(c => c.connector_type === 'agent') && (
                                <NodeItem
                                    type="agent"
                                    onClick={onAddNodeClick}
                                    fallbackLabel="AI Agent"
                                    fallbackIcon={<Bot className="w-4 h-4 text-foreground" />}
                                />
                            )}
                        </div>
                    </div>
                );
            case 'modelNode':
                return (
                    <div>
                        {renderHeader('Models')}
                        <div className="space-y-2">
                            {allConnectors.filter(c => c.connector_type === 'agent-model').map((connector) => (
                                <NodeItem
                                    key={connector.id}
                                    connector={connector}
                                    type="modelNode"
                                    onClick={onAddNodeClick}
                                />
                            ))}
                        </div>
                    </div>
                );
            case 'memoryNode':
                return (
                    <div>
                        {renderHeader('Memory')}
                        <div className="space-y-2">
                            {allConnectors.filter(c => c.connector_type === 'agent-memory').map((connector) => (
                                <NodeItem
                                    key={connector.id}
                                    connector={connector}
                                    type="memoryNode"
                                    onClick={onAddNodeClick}
                                />
                            ))}
                        </div>
                    </div>
                );
            case 'toolsNode':
                return (
                    <div>
                        {renderHeader('Tools')}
                        <div className="space-y-2">
                            {allConnectors.filter(c => c.connector_type === 'agent-tool').map((connector) => (
                                <NodeItem
                                    key={connector.id}
                                    connector={connector}
                                    type="toolsNode"
                                    onClick={onAddNodeClick}
                                />
                            ))}
                        </div>
                    </div>
                );
            case 'custom':
                return (
                    <div>
                        {renderHeader('Custom')}
                        <div className="space-y-2">
                            {allConnectors.filter(c => c.is_custom === true).map((connector) => (
                                <NodeItem
                                    key={connector.id}
                                    connector={connector}
                                    type="custom"
                                    onClick={onAddNodeClick}
                                />
                            ))}
                        </div>
                    </div>
                );
            default:
                return renderHome();
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetTrigger asChild>
                <Button className="rounded-full w-10 h-10 p-0 shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground absolute top-4 right-[calc(100vw-3rem)] md:right-[unset] md:-left-12 md:bottom-14 z-50">
                    <Plus className="w-6 h-6" />
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px] overflow-y-auto bg-sidebar">
                <SheetHeader>
                    <SheetTitle>Add Node</SheetTitle>
                    <SheetDescription className="sr-only">
                        Browse and drag nodes to add them to your workflow.
                    </SheetDescription>
                </SheetHeader>

                {currentPage === 'home' ? renderHome() : renderCategoryContent()}

            </SheetContent>
        </Sheet>
    );
};

// Helper Components

interface CategoryButtonProps {
    icon: React.ReactNode;
    label: string;
    description: string;
    onClick: () => void;
    disabled?: boolean;
}

const CategoryButton: React.FC<CategoryButtonProps> = ({ icon, label, description, onClick, disabled }) => {
    return (
        <Button
            variant="outline"
            className={`flex flex-col items-center justify-center p-4 h-auto text-center border-border/50 hover:bg-accent hover:text-accent-foreground transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={onClick}
            disabled={disabled}
        >
            <div className="text-primary">{icon}</div>
            <div className="font-semibold text-sm mb-1">{label}</div>
            <div className="text-xs text-muted-foreground leading-tight">{description}</div>
        </Button>
    );
};

interface NodeItemProps {
    connector?: Connector;
    type: string;
    onClick: (type: string, connector?: any) => void;
    fallbackLabel?: string;
    fallbackIcon?: React.ReactNode;
}

const NodeItem: React.FC<NodeItemProps> = ({ connector, type, onClick, fallbackLabel, fallbackIcon }) => {
    const handleDragStart = (event: React.DragEvent) => {
        event.dataTransfer.setData('application/reactflow', type);
        if (connector) {
            event.dataTransfer.setData('application/bridge-type', connector.slug || connector.display_name.toLowerCase());
            event.dataTransfer.setData('application/connector-data', JSON.stringify(connector));
        } else {
            // Fallback for generic types
            event.dataTransfer.setData('application/bridge-type', type);
        }
    };

    return (
        <div
            className="border p-3 rounded-lg cursor-pointer bg-card hover:bg-accent/50 transition-all flex items-center gap-3"
            onClick={() => onClick(type, connector)}
            draggable
            onDragStart={handleDragStart}
        >
            {connector ? (
                (connector.icon_url_light || connector.icon_url_dark) ? (
                    <ThemeAwareIcon
                        lightSrc={connector.icon_url_light}
                        darkSrc={connector.icon_url_dark}
                        alt={connector.display_name}
                        className="w-5 h-5 object-contain"
                    />
                ) : (
                    <div className="w-5 h-5 bg-muted rounded-full" />
                )
            ) : (
                fallbackIcon || <div className="w-5 h-5 bg-muted rounded-full" />
            )}
            <span className="text-sm font-medium">{connector?.display_name || fallbackLabel || type}</span>
        </div>
    );
};
