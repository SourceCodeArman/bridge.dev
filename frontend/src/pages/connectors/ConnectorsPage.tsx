import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { connectorService } from '@/lib/api/services/connector';
import { customConnectorService } from '@/lib/api/services/customConnector';
import { type Connector } from '@/types/models';
import { Input } from '@/components/ui/input';
import { Search, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ConnectorDetailsSheet } from '@/components/connectors/ConnectorDetailsSheet';
import { ThemeAwareIcon } from '@/components/connectors/ThemeAwareIcon';

export default function ConnectorsPage() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);

    const { data: connectors, isLoading, error } = useQuery({
        queryKey: ['connectors'],
        queryFn: connectorService.list
    });

    const { data: customConnectors, isLoading: isCustomLoading, error: customError } = useQuery({
        queryKey: ['custom-connectors'],
        queryFn: customConnectorService.list
    });

    const filterConnector = (connector: Connector) =>
        connector.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        connector.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        connector.connector_type?.toLowerCase().includes(searchQuery.toLowerCase());

    const filteredConnectors = connectors?.results?.filter(filterConnector) || [];
    const filteredCustomConnectors = customConnectors?.filter(filterConnector) || [];
    console.log(filteredConnectors, filteredCustomConnectors);

    if (isLoading || isCustomLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error || customError) {
        return (
            <div className="flex h-full items-center justify-center text-destructive">
                Failed to load connectors. Please try again later.
            </div>
        );
    }

    return (
        <div className="space-y-8 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <h1 className="text-4xl font-bold tracking-tight text-foreground">
                        Connectors
                    </h1>
                    <p className="text-foreground">
                        Browse and manage available integrations for your workflows.
                    </p>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-foreground" />
                        <Input
                            placeholder="Search connectors..."
                            className="pl-8"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button onClick={() => navigate('/connectors/create')}>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload
                    </Button>
                </div>
            </div>

            <div className="space-y-8">
                {/* Custom Connectors Section */}
                {filteredCustomConnectors.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold text-foreground">Custom Connectors</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredCustomConnectors.map((connector) => (
                                <ConnectorCard
                                    key={connector.id}
                                    connector={connector}
                                    onClick={() => setSelectedConnectorId(connector.id || connector.slug || 'unknown')}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* System Connectors Section */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-foreground">System Connectors</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredConnectors.map((connector) => (
                            <ConnectorCard
                                key={connector.id}
                                connector={connector}
                                onClick={() => setSelectedConnectorId(connector.id || connector.slug || 'unknown')} // Fallback if ID/slug missing
                            />
                        ))}
                    </div>
                </div>
            </div>

            {!isLoading && !isCustomLoading && filteredConnectors.length === 0 && filteredCustomConnectors.length === 0 && (
                <div className="text-center py-12 text-foreground">
                    No connectors found matching your search.
                </div>
            )}

            <ConnectorDetailsSheet
                connectorId={selectedConnectorId}
                open={!!selectedConnectorId}
                onOpenChange={(open) => !open && setSelectedConnectorId(null)}
            />
        </div>
    );
}

function ConnectorCard({ connector, onClick }: { connector: Connector; onClick: () => void }) {
    // Determine status color
    const isActive = connector.is_active !== false; // Default to true if undefined
    console.log(connector)
    return (
        <div
            onClick={onClick}
            className="group relative flex flex-col justify-between rounded-xl border border-border bg-background/50 p-6 hover:bg-background transition-colors cursor-pointer"
        >
            <div className="space-y-4">
                <div className="flex items-start justify-between">
                    <div className="h-12 w-12 rounded-lg bg-card p-2 flex items-center justify-center overflow-hidden border border-border">
                        {connector.icon_url_light && connector.icon_url_dark ? (
                            <ThemeAwareIcon
                                lightSrc={connector.icon_url_light}
                                darkSrc={connector.icon_url_dark}
                                className="h-6 w-6"
                            />
                        ) : (
                            <div className="text-2xl font-bold text-muted-foreground">
                                {connector.display_name?.charAt(0) || '?'}
                            </div>
                        )}
                    </div>
                    {/* Badge for custom vs system connectors if we had a way to distinguish clearly */}
                    <Badge variant={isActive ? "default" : "secondary"} className={isActive ? "bg-green-500/10 text-green-500 hover:bg-green-500/20" : ""}>
                        {isActive ? 'Active' : 'Inactive'}
                    </Badge>
                </div>

                <div className="space-y-2">
                    <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
                        {connector.display_name}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                        {connector.description || "No description available."}
                    </p>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="capitalize">{connector.connector_type || 'System'}</span>
                    <span>{connector.version || 'v1.0.0'}</span>
                </div>
            </div>
        </div>
    );
}