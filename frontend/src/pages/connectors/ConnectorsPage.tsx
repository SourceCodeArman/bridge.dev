import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { connectorService } from '@/lib/api/services/connector';
import { customConnectorService } from '@/lib/api/services/customConnector';
import { type Connector } from '@/types/models';
import { Input } from '@/components/ui/input';
import { Search, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ConnectorDetailsSheet } from '@/components/connectors/ConnectorDetailsSheet';

export default function ConnectorsPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
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

    const filteredConnectors = connectors?.filter(filterConnector) || [];
    const filteredCustomConnectors = customConnectors?.filter(filterConnector) || [];

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
                    <h1 className="text-4xl font-bold tracking-tight bg-linear-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                        Connectors
                    </h1>
                    <p className="text-muted-foreground">
                        Browse and manage available integrations for your workflows.
                    </p>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
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
                        <h2 className="text-xl font-semibold text-neutral-200">Custom Connectors</h2>
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
                    <h2 className="text-xl font-semibold text-neutral-200">System Connectors</h2>
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
                <div className="text-center py-12 text-muted-foreground">
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

    return (
        <div
            onClick={onClick}
            className="group relative flex flex-col justify-between rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 hover:bg-neutral-900 transition-colors cursor-pointer"
        >
            <div className="space-y-4">
                <div className="flex items-start justify-between">
                    <div className="h-12 w-12 rounded-lg bg-neutral-800 p-2 flex items-center justify-center overflow-hidden border border-neutral-700">
                        {connector.icon_url ? (
                            <img
                                src={connector.icon_url}
                                alt={connector.display_name}
                                className="h-full w-full object-contain"
                            />
                        ) : (
                            <div className="text-2xl font-bold text-neutral-500">
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
                    <h3 className="font-semibold text-lg text-neutral-100 group-hover:text-primary transition-colors">
                        {connector.display_name}
                    </h3>
                    <p className="text-sm text-neutral-400 line-clamp-2">
                        {connector.description || "No description available."}
                    </p>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-neutral-800">
                <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span className="capitalize">{connector.connector_type || 'System'}</span>
                    <span>{connector.version || 'v1.0.0'}</span>
                </div>
            </div>
        </div>
    );
}