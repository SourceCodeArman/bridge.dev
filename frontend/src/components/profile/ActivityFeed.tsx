import { format, formatDistanceToNow } from "date-fns";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Play, Edit, Key, Workflow } from "lucide-react";

interface ActivityItem {
    id: string;
    type: 'workflow_created' | 'workflow_executed' | 'credential_updated' | 'workflow_edited';
    description: string;
    timestamp: string;
}

interface ActivityFeedProps {
    activities?: ActivityItem[];
}

const iconMap = {
    workflow_created: <Workflow className="w-4 h-4 text-green-500" />,
    workflow_executed: <Play className="w-4 h-4 text-blue-500" />,
    credential_updated: <Key className="w-4 h-4 text-amber-500" />,
    workflow_edited: <Edit className="w-4 h-4 text-purple-500" />
};

// Mock activity data
const MOCK_ACTIVITIES: ActivityItem[] = [
    {
        id: '1',
        type: 'workflow_executed',
        description: 'Ran "Customer Onboarding" workflow',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 min ago
    },
    {
        id: '2',
        type: 'credential_updated',
        description: 'Updated "Stripe Production" credential',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() // 2 hours ago
    },
    {
        id: '3',
        type: 'workflow_created',
        description: 'Created "Daily Report Generator" workflow',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() // 1 day ago
    },
    {
        id: '4',
        type: 'workflow_edited',
        description: 'Edited "Lead Enrichment" workflow',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString() // 2 days ago
    }
];

export function ActivityFeed({ activities = MOCK_ACTIVITIES }: ActivityFeedProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                    Your latest actions and workflow executions.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {activities.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                        No recent activity.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {activities.map((activity) => (
                            <div key={activity.id} className="flex items-start gap-3">
                                <div className="p-2 bg-muted rounded-full mt-0.5">
                                    {iconMap[activity.type]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                        {activity.description}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
