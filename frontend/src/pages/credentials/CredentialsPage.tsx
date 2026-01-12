import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Plus,
    Search,
    MoreHorizontal,
    Key,
    Pencil,
    Trash2,
    Activity
} from "lucide-react";
import { credentialService } from "@/lib/api/services/credential";
import { connectorService } from "@/lib/api/services/connector";
import { CredentialStatusBadge } from "@/components/credentials/CredentialStatusBadge";
import { CreateCredentialModal } from "@/components/credentials/CreateCredentialModal";
import { CredentialDetailModal } from "@/components/credentials/CredentialDetailModal";
import type { Credential } from "@/types";
import { toast } from "sonner";

export default function CredentialsPage() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [connectorFilter, setConnectorFilter] = useState("all");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const queryClient = useQueryClient();

    // Fetch credentials
    const { data: credentialsData, isLoading } = useQuery({
        queryKey: ['credentials', page, connectorFilter],
        queryFn: () => credentialService.list(page, 100) // Increase limit for client-side search mock
    });

    // Fetch connectors for filter
    const { data: connectorsData } = useQuery({
        queryKey: ['connectors'],
        queryFn: () => connectorService.list()
    });

    const deleteMutation = useMutation({
        mutationFn: credentialService.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['credentials'] });
            toast.success("Credential deleted");
        },
        onError: () => toast.error("Failed to delete credential")
    });

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this credential? This action cannot be undone.")) {
            deleteMutation.mutate(id);
        }
    };

    // Client-side filtering for search (since API mock might not support it fully yet)
    const filteredCredentials = credentialsData?.results.filter(cred => {
        const matchesSearch = cred.name.toLowerCase().includes(search.toLowerCase());
        const matchesConnector = connectorFilter === 'all' || cred.connector_id === connectorFilter;
        return matchesSearch && matchesConnector;
    }) || [];

    const handleEdit = (cred: Credential, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedCredential(cred);
        setIsDetailOpen(true);
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-6">
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight">API Credentials</h1>
                        <p className="text-muted-foreground">
                            Manage API keys and authentication secrets for your connectors.
                        </p>
                    </div>
                    <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                        <Plus className="w-4 h-4" />
                        New Credential
                    </Button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search credentials..."
                            className="pl-8"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Select value={connectorFilter} onValueChange={setConnectorFilter}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="All Connectors" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Connectors</SelectItem>
                            {connectorsData?.results.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[250px]">Name</TableHead>
                            <TableHead>Connector</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Last Used</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><div className="h-5 w-32 bg-muted animate-pulse rounded" /></TableCell>
                                    <TableCell><div className="h-5 w-24 bg-muted animate-pulse rounded" /></TableCell>
                                    <TableCell><div className="h-5 w-16 bg-muted animate-pulse rounded" /></TableCell>
                                    <TableCell><div className="h-5 w-24 bg-muted animate-pulse rounded" /></TableCell>
                                    <TableCell><div className="h-5 w-24 bg-muted animate-pulse rounded" /></TableCell>
                                    <TableCell><div className="h-8 w-8 ml-auto bg-muted animate-pulse rounded" /></TableCell>
                                </TableRow>
                            ))
                        ) : filteredCredentials.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                    No credentials found. Create one to get started.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredCredentials.map((cred) => (
                                <TableRow
                                    key={cred.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => {
                                        setSelectedCredential(cred);
                                        setIsDetailOpen(true);
                                    }}
                                >
                                    <TableCell className="font-medium flex items-center gap-2">
                                        <div className="p-1.5 bg-muted rounded-md">
                                            <Key className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                        {cred.name}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {/* Ideally showing icon here */}
                                            {cred.connector_name || 'Unknown Connector'}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <CredentialStatusBadge
                                            isActive={cred.is_active}
                                            lastUsedAt={cred.last_used_at}
                                        />
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {cred.last_used_at ? format(new Date(cred.last_used_at), 'MMM d, p') : '-'}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {format(new Date(cred.created_at), 'MMM d, yyyy')}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={(e) => handleEdit(cred, e)}>
                                                    <Pencil className="w-4 h-4 mr-2" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem disabled>
                                                    <Activity className="w-4 h-4 mr-2" />
                                                    View Usage
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={(e) => handleDelete(cred.id, e)}
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <CreateCredentialModal
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                connectors={connectorsData?.results || []}
            />

            <CredentialDetailModal
                credential={selectedCredential}
                open={isDetailOpen}
                onOpenChange={setIsDetailOpen}
            />
        </div >
    );
}
