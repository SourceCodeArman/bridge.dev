import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, XCircle, KeyRound } from "lucide-react";
import type { AlertEvent } from "@/types";

interface AlertEventBadgeProps {
    event: AlertEvent;
    className?: string;
}

const eventConfig: Record<AlertEvent, { icon: React.ReactNode; label: string; variant: string }> = {
    run_failed: {
        icon: <AlertCircle className="w-3 h-3" />,
        label: 'Run Failed',
        variant: 'bg-red-500/10 text-red-600 border-red-500/30'
    },
    run_timeout: {
        icon: <Clock className="w-3 h-3" />,
        label: 'Run Timeout',
        variant: 'bg-orange-500/10 text-orange-600 border-orange-500/30'
    },
    workflow_disabled: {
        icon: <XCircle className="w-3 h-3" />,
        label: 'Workflow Disabled',
        variant: 'bg-neutral-500/10 text-neutral-600 border-neutral-500/30'
    },
    credential_expired: {
        icon: <KeyRound className="w-3 h-3" />,
        label: 'Credential Expired',
        variant: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30'
    }
};

export function AlertEventBadge({ event, className }: AlertEventBadgeProps) {
    const config = eventConfig[event];

    return (
        <Badge
            variant="outline"
            className={`gap-1.5 ${config.variant} ${className}`}
        >
            {config.icon}
            {config.label}
        </Badge>
    );
}
