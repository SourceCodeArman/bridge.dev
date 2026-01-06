import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, Loader2, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

interface RunStatusBadgeProps {
    status: string;
    className?: string;
}

export function RunStatusBadge({ status, className }: RunStatusBadgeProps) {
    const getStatusConfig = (status: string) => {
        switch (status.toLowerCase()) {
            case 'completed':
            case 'success':
                return {
                    variant: 'default' as const,
                    icon: CheckCircle2,
                    label: 'Completed',
                    className: 'bg-green-500/15 text-green-500 hover:bg-green-500/25 border-green-500/20'
                };
            case 'failed':
            case 'error':
                return {
                    variant: 'destructive' as const,
                    icon: XCircle,
                    label: 'Failed',
                    className: 'bg-red-500/15 text-red-500 hover:bg-red-500/25 border-red-500/20'
                };
            case 'running':
                return {
                    variant: 'default' as const,
                    icon: Loader2,
                    label: 'Running',
                    className: 'bg-blue-500/15 text-blue-500 hover:bg-blue-500/25 border-blue-500/20 animate-pulse',
                    iconClassName: 'animate-spin'
                };
            case 'pending':
            case 'queued':
                return {
                    variant: 'secondary' as const,
                    icon: Clock,
                    label: 'Pending',
                    className: 'bg-yellow-500/15 text-yellow-500 hover:bg-yellow-500/25 border-yellow-500/20'
                };
            case 'cancelled':
                return {
                    variant: 'secondary' as const,
                    icon: Ban,
                    label: 'Cancelled',
                    className: 'bg-neutral-500/15 text-neutral-500 hover:bg-neutral-500/25 border-neutral-500/20'
                };
            default:
                return {
                    variant: 'outline' as const,
                    icon: Clock,
                    label: status,
                    className: 'text-muted-foreground'
                };
        }
    };

    const config = getStatusConfig(status);
    const Icon = config.icon;

    return (
        <Badge
            variant="outline"
            className={cn("gap-1.5 py-1 px-2.5 capitalize border", config.className, className)}
        >
            <Icon className={cn("w-3.5 h-3.5", config.iconClassName)} />
            {config.label}
        </Badge>
    );
}
