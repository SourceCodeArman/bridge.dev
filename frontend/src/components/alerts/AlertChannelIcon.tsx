import { Mail, MessageSquare, Globe } from "lucide-react";
import type { AlertChannel } from "@/types";

interface AlertChannelIconProps {
    channel: AlertChannel;
    className?: string;
    showLabel?: boolean;
}

const channelConfig: Record<AlertChannel, { icon: React.ReactNode; label: string }> = {
    email: {
        icon: <Mail className="w-4 h-4" />,
        label: 'Email'
    },
    slack: {
        icon: <MessageSquare className="w-4 h-4" />,
        label: 'Slack'
    },
    webhook: {
        icon: <Globe className="w-4 h-4" />,
        label: 'Webhook'
    }
};

export function AlertChannelIcon({ channel, className, showLabel = false }: AlertChannelIconProps) {
    const config = channelConfig[channel];

    return (
        <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
            {config.icon}
            {showLabel && <span className="text-sm">{config.label}</span>}
        </div>
    );
}
