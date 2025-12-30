import { useQuery } from "@tanstack/react-query";
import { workflowService } from "@/lib/api/services/workflow";
import { runService } from "@/lib/api/services/run";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentRunsTable } from "@/components/dashboard/RecentRunsTable";
// import { Button } from "@/components/ui/button"; // Unused
// import { useNavigate } from "react-router-dom"; // Unused

export default function DashboardPage() {

    // Fetch generic stats from workflows
    const { data: workflowsData, isLoading: isLoadingWorkflows } = useQuery({
        queryKey: ['workflows', 'stats'],
        queryFn: () => workflowService.list({ page: 1, page_size: 100 }) // fetching 100 to calc active count roughly
    });

    // Fetch recent runs
    const { data: runsData, isLoading: isLoadingRuns } = useQuery({
        queryKey: ['runs', 'recent'],
        queryFn: () => runService.list({ page: 1, page_size: 5 })
    });

    // Calculate stats
    const totalWorkflows = workflowsData?.count || 0;
    const activeWorkflows = workflowsData?.results?.filter(w => w.is_active).length || 0;
    const totalRuns = runsData?.count || 0;

    // Success rate - hard to calc from just 5 runs, but let's try from the recent batch or just mock it for now if count > 0
    const recentRuns = runsData?.results || [];
    const successRate = recentRuns.length > 0
        ? Math.round((recentRuns.filter(r => r.status === 'success').length / recentRuns.length) * 100)
        : 0;

    const stats = {
        totalWorkflows,
        activeWorkflows,
        totalRuns,
        successRate
    };

    return (
        <div className="space-y-8 relative p-6">
            {/* Header Section */}
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                    Dashboard
                </h1>
                <p className="text-muted-foreground">
                    Overview of your workflows and recent activity.
                </p>
            </div>

            <DashboardStats
                stats={stats}
                loading={isLoadingWorkflows || isLoadingRuns}
            />

            <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <RecentRunsTable runs={recentRuns} loading={isLoadingRuns} />
                </div>
                <div className="space-y-6">
                    <QuickActions />
                </div>
            </div>
        </div>
    );
}
