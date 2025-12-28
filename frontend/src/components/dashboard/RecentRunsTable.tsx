import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Run, RunStatus } from "@/types/models";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface RecentRunsTableProps {
    runs: Run[];
    loading?: boolean;
}

export function RecentRunsTable({ runs, loading }: RecentRunsTableProps) {
    const getStatusVariant = (status: RunStatus) => {
        switch (status) {
            case 'success': return 'success';
            case 'failed': return 'destructive';
            case 'running': return 'default';
            case 'pending': return 'secondary';
            default: return 'outline';
        }
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Recent Runs</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-12 w-full bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Runs</CardTitle>
                <Link to="/activity" className="text-sm text-primary hover:underline flex items-center">
                    View All
                    <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
            </CardHeader>
            <CardContent>
                <Table >
                    <TableHeader>
                        <TableRow>
                            <TableHead>Workflow</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Started</TableHead>
                            <TableHead>Duration</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {runs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground h-28">
                                    No runs found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            runs.map((run) => (
                                <TableRow key={run.id}>
                                    <TableCell className="font-medium">
                                        {/* Ideally we have workflow name here, but API might only give ID. 
                                            Assuming run object has workflow snapshot or we fetched it. 
                                            For now, using ID or a placeholder if name missing. */}
                                        {run.workflow_id}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={getStatusVariant(run.status)}>
                                            {run.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                                    </TableCell>
                                    <TableCell>
                                        {run.completed_at
                                            ? `${((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(2)}s`
                                            : '-'
                                        }
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
