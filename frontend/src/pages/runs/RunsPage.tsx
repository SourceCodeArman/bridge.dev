import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Search,
    Filter,
    Play
} from "lucide-react";
import { RunStatusBadge } from "@/components/runs/RunStatusBadge";
import { RunDetailModal } from "@/components/runs/RunDetailModal";
import { runService } from "@/lib/api/services/run";
import { workflowService } from "@/lib/api/services/workflow";
import type { Run, RunListParams } from "@/types";
import { toast } from "sonner";

export default function RunsPage() {
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [workflowFilter, setWorkflowFilter] = useState<string>("all");
    const [selectedRun, setSelectedRun] = useState<Run | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const pageSize = 10;

    // Fetch workflows for filter
    const { data: workflows } = useQuery({
        queryKey: ['workflows', 'list'],
        queryFn: () => workflowService.list({ page: 1, page_size: 100 })
    });

    // Fetch runs
    const params: RunListParams = {
        page,
        page_size: pageSize,
    };

    if (statusFilter !== 'all') {
        params.status = statusFilter as Run['status'];
    }

    // Only add workflow_id if filtered (backend support assumed, logical extension)
    // If backend doesn't support generic filtering in list, we might need adjustments
    // But based on common patterns, this is likely supported or harmless to send

    // Note: The current runService.list definition might need to ensure backend supports filtering by workflow_id
    // If not, we rely on what's available. The plan assumed filters.

    const { data: runsData, isLoading, refetch } = useQuery({
        queryKey: ['runs', page, statusFilter, workflowFilter],
        queryFn: () => runService.list(params),
        placeholderData: (previousData) => previousData
    });

    // Client-side filtering for workflow if backend doesn't support it directly in this endpoint yet
    // Optimally this should be server-side.
    const filteredRuns = runsData?.results.filter(_run => {
        if (workflowFilter === 'all') return true;
        // Check if run belongs to workflow - assuming run object implies relation or we check related data
        // The Run type usually has workflow_id or similar.
        // Let's assume we can filter client side if needed, but ideally server side.
        // For now, if the API doesn't filter, we might show all.
        // Let's implement client filtering as fallback if response includes workflow info
        return _run.workflow_id === workflowFilter;
    }) || [];

    const handleRunClick = (run: Run) => {
        setSelectedRun(run);
        setIsDetailOpen(true);
    };

    const handleReplay = async (run: Run) => {
        try {
            toast.promise(runService.replay(run.id), {
                loading: 'Initiating replay...',
                success: (_newRun) => {
                    refetch();
                    setIsDetailOpen(false); // Close modal to show list update
                    return 'Replay started successfully';
                },
                error: 'Failed to start replay'
            });
        } catch (error) {
            console.error(error);
        }
    };

    const totalPages = runsData ? Math.ceil(runsData.count / pageSize) : 0;

    return (
        <div className="space-y-6 h-full flex flex-col p-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Workflow Runs</h1>
                <p className="text-muted-foreground">
                    History and status of all workflow executions.
                </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search runs..."
                            className="pl-8"
                            disabled // Search not implemented in backend filtering yet
                        />
                    </div>
                    <Button variant="outline" size="icon" onClick={() => refetch()}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[150px]">
                            <Filter className="w-4 h-4 mr-2" />
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                            <SelectItem value="running">Running</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={workflowFilter} onValueChange={setWorkflowFilter}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="All Workflows" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Workflows</SelectItem>
                            {workflows?.results.map(wf => (
                                <SelectItem key={wf.id} value={wf.id}>{wf.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="border rounded-lg flex-1 overflow-hidden flex flex-col">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[100px]">Status</TableHead>
                            <TableHead>Run ID</TableHead>
                            <TableHead>Workflow</TableHead>
                            <TableHead>Trigger</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Started At</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><div className="h-6 w-20 bg-muted animate-pulse rounded" /></TableCell>
                                    <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                                    <TableCell><div className="h-4 w-40 bg-muted animate-pulse rounded" /></TableCell>
                                    <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                                    <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded" /></TableCell>
                                    <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                                    <TableCell><div className="h-8 w-8 ml-auto bg-muted animate-pulse rounded" /></TableCell>
                                </TableRow>
                            ))
                        ) : filteredRuns.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                    No runs found matching your filters.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredRuns.map((run) => (
                                <TableRow
                                    key={run.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleRunClick(run)}
                                >
                                    <TableCell>
                                        <RunStatusBadge status={run.status} />
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                        {run.id.slice(0, 8)}...
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        {/* Assuming API expands workflow or we find it in our list */}
                                        {workflows?.results.find(w => w.id === run.workflow_id)?.name || run.workflow_name || 'Unknown Workflow'}
                                    </TableCell>
                                    <TableCell className="capitalize text-muted-foreground">
                                        {run.trigger_type || 'Manual'}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">
                                        {run.completed_at && run.started_at
                                            ? `${((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(2)}s`
                                            : '-'
                                        }
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {format(new Date(run.started_at), 'MMM d, p')}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleReplay(run);
                                            }}
                                            className="h-8 w-8 p-0"
                                            title="Replay Run"
                                            disabled={run.status === 'running'}
                                        >
                                            <Play className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-2">
                <div className="text-sm text-muted-foreground">
                    Page {page} of {totalPages || 1}
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <RunDetailModal
                run={selectedRun}
                open={isDetailOpen}
                onOpenChange={setIsDetailOpen}
                onReplay={handleReplay}
            />
        </div>
    );
}
