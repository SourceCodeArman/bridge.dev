import {
    UserPlus,
    UserMinus,
    ShieldCheck,
    Settings2,
    GitBranch,
    Trash2,
} from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MOCK_WORKSPACE_ACTIVITY, type MockWorkspaceActivity } from "@/lib/mockData";

const activityConfig: Record<MockWorkspaceActivity['type'], { icon: typeof UserPlus; color: string }> = {
    member_joined: { icon: UserPlus, color: "text-green-500" },
    member_left: { icon: UserMinus, color: "text-orange-500" },
    role_changed: { icon: ShieldCheck, color: "text-blue-500" },
    settings_updated: { icon: Settings2, color: "text-purple-500" },
    workflow_created: { icon: GitBranch, color: "text-primary" },
    workflow_deleted: { icon: Trash2, color: "text-destructive" },
};

function formatActivityMessage(activity: MockWorkspaceActivity): string {
    switch (activity.type) {
        case 'member_joined':
            return `joined the workspace`;
        case 'member_left':
            return `left the workspace`;
        case 'role_changed':
            return `updated ${activity.target_name}'s role`;
        case 'settings_updated':
            return `updated workspace settings`;
        case 'workflow_created':
            return `created workflow "${activity.target_name}"`;
        case 'workflow_deleted':
            return `deleted workflow "${activity.target_name}"`;
        default:
            return 'performed an action';
    }
}

function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
}

export function ActivityLogTab() {
    const activities = MOCK_WORKSPACE_ACTIVITY;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Activity Log</CardTitle>
                <CardDescription>
                    Recent activity and changes in your workspace.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-1">
                    {activities.map((activity, index) => {
                        const config = activityConfig[activity.type];
                        const Icon = config.icon;
                        const isLast = index === activities.length - 1;

                        return (
                            <div key={activity.id} className="relative flex gap-4 pb-6">
                                {/* Timeline line */}
                                {!isLast && (
                                    <div className="absolute left-[18px] top-10 w-0.5 h-[calc(100%-24px)] bg-border" />
                                )}

                                {/* Icon */}
                                <div className={`relative z-10 flex items-center justify-center w-9 h-9 rounded-full border bg-background ${config.color}`}>
                                    <Icon className="w-4 h-4" />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0 pt-1">
                                    <div className="flex items-center gap-2">
                                        <Avatar className="w-5 h-5">
                                            <AvatarFallback className="text-[10px]">
                                                {activity.actor_name.split(' ').map(n => n[0]).join('')}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium text-sm">
                                            {activity.actor_name}
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                            {formatActivityMessage(activity)}
                                        </span>
                                    </div>
                                    {activity.details && (
                                        <p className="text-xs text-muted-foreground mt-1 ml-7">
                                            {activity.details}
                                        </p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1 ml-7">
                                        {formatRelativeTime(activity.created_at)}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
