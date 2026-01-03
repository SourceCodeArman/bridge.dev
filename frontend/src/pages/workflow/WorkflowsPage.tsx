import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { workflowService } from "@/lib/api/services/workflow";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/router/routes";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";

export default function WorkflowsPage() {
    const navigate = useNavigate();
    const { data, isLoading } = useQuery({
        queryKey: ['workflows'],
        queryFn: () => workflowService.list({ page: 1, page_size: 50 })
    });

    const [isCreating, setIsCreating] = useState(false);

    const handleCreateWorkflow = async () => {
        try {
            setIsCreating(true);
            const newWorkflow = await workflowService.create({
                name: 'Untitled Workflow',
                description: '',
                nodes: [],
                edges: [],
            });
            navigate(ROUTES.WORKFLOWS_DETAIL.replace(':id', newWorkflow.id));
        } catch (error) {
            console.error('Failed to create workflow:', error);
            // You might want to add a toast notification here
        } finally {
            setIsCreating(false);
        }
    };

    const workflows = data?.results || [];

    return (
        <div className="space-y-8 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Workflows</h1>
                    <p className="text-foreground mt-2">
                        Manage and monitor your automation workflows.
                    </p>
                </div>
                <Button onClick={handleCreateWorkflow} disabled={isCreating}>
                    <Plus className="mr-2 h-4 w-4" />
                    {isCreating ? 'Creating...' : 'Create Workflow'}
                </Button>
            </div>

            <div className="rounded-md border border-border bg-card p-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Triggers</TableHead>
                            <TableHead>Last Run</TableHead>
                            <TableHead>Created</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    Loading workflows...
                                </TableCell>
                            </TableRow>
                        ) : workflows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-foreground">
                                    No workflows found. Create one to get started.
                                </TableCell>
                            </TableRow>
                        ) : (
                            workflows.map((workflow) => (
                                <TableRow
                                    key={workflow.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => navigate(ROUTES.WORKFLOWS_DETAIL.replace(':id', workflow.id))}
                                >
                                    <TableCell className="font-medium">
                                        {workflow.name}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={workflow.is_active ? "default" : "secondary"}>
                                            {workflow.is_active ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-foreground">
                                        {workflow.trigger_type || 'Manual'}
                                    </TableCell>
                                    <TableCell className="text-foreground">
                                        {workflow.last_run_at
                                            ? formatDistanceToNow(new Date(workflow.last_run_at), { addSuffix: true })
                                            : 'Never'}
                                    </TableCell>
                                    <TableCell className="text-foreground">
                                        {formatDistanceToNow(new Date(workflow.created_at), { addSuffix: true })}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
