import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { workflowService } from "@/lib/api/services/workflow";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ['workflows'],
        queryFn: () => workflowService.list({ page: 1, page_size: 50 }),
        staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
        gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    });

    const [isCreating, setIsCreating] = useState(false);

    // Mutation for toggling workflow activation with optimistic updates
    const toggleActivationMutation = useMutation({
        mutationFn: ({ workflowId, isActive }: { workflowId: string; isActive: boolean }) =>
            workflowService.activate(workflowId, isActive),
        onMutate: async ({ workflowId, isActive }) => {
            // Cancel outgoing refetches to avoid overwriting optimistic update
            await queryClient.cancelQueries({ queryKey: ['workflows'] });

            // Snapshot the previous value
            const previousData = queryClient.getQueryData(['workflows']);

            // Optimistically update the cache
            queryClient.setQueryData(['workflows'], (old: any) => {
                if (!old?.results) return old;
                return {
                    ...old,
                    results: old.results.map((workflow: any) =>
                        workflow.id === workflowId
                            ? { ...workflow, is_active: isActive }
                            : workflow
                    ),
                };
            });

            // Return context with previous data for rollback
            return { previousData };
        },
        onError: (err: any, _variables, context) => {
            // Rollback to previous data on error
            if (context?.previousData) {
                queryClient.setQueryData(['workflows'], context.previousData);
            }
            const errorMsg = err?.response?.data?.message || err?.response?.data?.data?.validation_errors?.join('\n') || 'Failed to toggle workflow status';
            alert(errorMsg);
        },
        onSettled: () => {
            // Refetch to ensure data is in sync with server
            queryClient.invalidateQueries({ queryKey: ['workflows'] });
        },
    });

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
                            <TableHead>Last Run</TableHead>
                            <TableHead>Updated</TableHead>
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
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                checked={workflow.is_active}
                                                onCheckedChange={(checked) => {
                                                    toggleActivationMutation.mutate({
                                                        workflowId: workflow.id,
                                                        isActive: checked,
                                                    });
                                                }}
                                            />
                                            <Badge variant={workflow.is_active ? "default" : "secondary"}>
                                                {workflow.is_active ? "Active" : "Inactive"}
                                            </Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-foreground">
                                        {workflow.last_run_at
                                            ? formatDistanceToNow(new Date(workflow.last_run_at), { addSuffix: true })
                                            : 'Never'}
                                    </TableCell>
                                    <TableCell className="text-foreground">
                                        {formatDistanceToNow(new Date(workflow.updated_at), { addSuffix: true })}
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
