import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { connectorService } from '@/lib/api/services/connector';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Connector } from '@/types/models';
import { ThemeAwareIcon } from '@/components/connectors/ThemeAwareIcon';

interface ConnectorAction {
    display_name?: string;
    description?: string;
}

interface ConnectorTrigger {
    display_name?: string;
    description?: string;
}

interface ConnectorManifest {
    actions?: Record<string, ConnectorAction>;
    triggers?: Record<string, ConnectorTrigger>;
    auth_config?: unknown;
}

interface ExtendedConnector extends Omit<Connector, 'manifest'> {
    manifest?: ConnectorManifest;
}

interface ConnectorDetailsSheetProps {
    connectorId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ConnectorDetailsSheet({ connectorId, open, onOpenChange }: ConnectorDetailsSheetProps) {
    const { data: connector, isLoading } = useQuery<ExtendedConnector | null>({
        queryKey: ['connector', connectorId],
        queryFn: async () => {
            if (!connectorId) return null;
            return connectorService.get(connectorId) as Promise<ExtendedConnector>;
        },
        enabled: !!connectorId
    });

    if (!connectorId) return null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[800px] sm:w-[540px] bg-background border-border text-foreground overflow-y-auto">
                <SheetHeader className="mb-6">
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-xl bg-card p-3 flex items-center justify-center border border-border">
                            {connector?.icon_url_light || connector?.icon_url_dark ? (
                                <ThemeAwareIcon
                                    lightSrc={connector.icon_url_light}
                                    darkSrc={connector.icon_url_dark}
                                    alt={connector.display_name}
                                    className="h-full w-full object-contain"
                                />
                            ) : (
                                <div className="text-3xl font-bold text-muted-foreground">
                                    {connector?.display_name?.charAt(0) || '?'}
                                </div>
                            )}
                        </div>
                        <div>
                            <SheetTitle className="text-2xl font-bold text-foreground">{connector?.display_name}</SheetTitle>
                            <SheetDescription className="text-muted-foreground">
                                v{connector?.version} • {connector?.connector_type}
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : (
                    <Tabs defaultValue="overview" className="w-full">
                        <TabsList className="grid w-full grid-cols-4 bg-card">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
                            <TabsTrigger value="config">Config</TabsTrigger>
                            <TabsTrigger value="json">JSON</TabsTrigger>
                        </TabsList>

                        <div className="mt-6">
                            <TabsContent value="overview" className="space-y-4">
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">Description</h3>
                                    <p className="text-foreground leading-relaxed">
                                        {connector?.description || "No description available."}
                                    </p>
                                </div>
                            </TabsContent>

                            <TabsContent value="capabilities" className="space-y-6">
                                {connector?.manifest?.actions && (
                                    <div>
                                        <h3 className="text-lg font-semibold mb-3 text-foreground flex items-center gap-2">
                                            Actions <Badge variant="secondary">{Object.keys(connector.manifest.actions).length}</Badge>
                                        </h3>
                                        <div className="space-y-3">
                                            {Object.entries(connector.manifest.actions).map(([key, action]) => (
                                                <div key={key} className="p-3 rounded-lg bg-card border border-border">
                                                    <div className="font-medium text-foreground">{action.display_name || key}</div>
                                                    <div className="text-sm text-muted-foreground mt-1">{action.description}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {connector?.manifest?.triggers && (
                                    <div>
                                        <h3 className="text-lg font-semibold mb-3 text-foreground flex items-center gap-2">
                                            Triggers <Badge variant="secondary">{Object.keys(connector.manifest.triggers).length}</Badge>
                                        </h3>
                                        <div className="space-y-3">
                                            {Object.entries(connector.manifest.triggers).map(([key, trigger]) => (
                                                <div key={key} className="p-3 rounded-lg bg-card border border-border">
                                                    <div className="font-medium text-foreground">{trigger.display_name || key}</div>
                                                    <div className="text-sm text-muted-foreground mt-1">{trigger.description}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="config">
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold mb-2">Authentication</h3>
                                    <div className="p-4 rounded-lg bg-card border border-border">
                                        {connector?.manifest?.auth_config ? (
                                            <pre className="text-sm font-mono text-foreground overflow-x-auto">
                                                {JSON.stringify(connector.manifest.auth_config, null, 2)}
                                            </pre>
                                        ) : (
                                            <p className="text-muted-foreground">No authentication configuration required.</p>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="json">
                                <ScrollArea className="h-[400px] w-full rounded-md border border-border bg-neutral-950 p-4">
                                    <pre className="text-xs font-mono text-green-400">
                                        {JSON.stringify(connector, null, 2)}
                                    </pre>
                                </ScrollArea>
                            </TabsContent>
                        </div>
                    </Tabs>
                )}
            </SheetContent>
        </Sheet>
    );
}
