import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CheckCircle, Play, Workflow } from "lucide-react";

interface DashboardStatsProps {
    stats: {
        totalWorkflows: number;
        activeWorkflows: number;
        totalRuns: number;
        successRate: number;
    };
    loading?: boolean;
}

export function DashboardStats({ stats, loading }: DashboardStatsProps) {
    if (loading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 rounded-xl bg-neutral-100 dark:bg-card animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Total Workflows
                    </CardTitle>
                    <Workflow className="h-4 w-4 text-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalWorkflows}</div>
                    <p className="text-xs text-foreground">
                        All workflows in your workspace
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Active Workflows
                    </CardTitle>
                    <Play className="h-4 w-4 text-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.activeWorkflows}</div>
                    <p className="text-xs text-foreground">
                        Currently running or scheduled
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Total Runs
                    </CardTitle>
                    <Activity className="h-4 w-4 text-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalRuns}</div>
                    <p className="text-xs text-foreground">
                        In the last 30 days
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Success Rate
                    </CardTitle>
                    <CheckCircle className="h-4 w-4 text-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.successRate}%</div>
                    <p className="text-xs text-foreground">
                        Average completion rate
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
