import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { Label } from '@/components/ui/label';

interface SlackChannelSelectorProps {
    value?: string;
    onChange: (channelId: string) => void;
    credentialId?: string;
    label?: string;
    required?: boolean;
    error?: string;
}

export default function SlackChannelSelector({
    value,
    onChange,
    credentialId,
    label = 'Channel',
    required = false,
    error,
}: SlackChannelSelectorProps) {
    const { data: channels, isLoading, error: queryError } = useQuery({
        queryKey: ['slack-channels', credentialId],
        queryFn: async () => {
            if (!credentialId) return [];
            const response = await apiClient.get<any>(`/api/v1/core/credentials/${credentialId}/slack/channels/`);
            return response.data.channels || [];
        },
        enabled: !!credentialId,
    });

    return (
        <div className="space-y-2">
            <Label>
                {label}
                {required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Select
                value={value || ''}
                onValueChange={onChange}
                disabled={!credentialId || isLoading}
            >
                <SelectTrigger>
                    <SelectValue placeholder={
                        !credentialId
                            ? "Select a credential first"
                            : isLoading
                                ? "Loading channels..."
                                : "Select channel"
                    } />
                </SelectTrigger>
                <SelectContent>
                    {channels?.map((channel: any) => (
                        <SelectItem key={channel.id} value={channel.id}>
                            {channel.name}
                        </SelectItem>
                    ))}
                    {!channels?.length && !isLoading && (
                        <div className="p-2 text-sm text-foreground text-center">
                            No channels found
                        </div>
                    )}
                </SelectContent>
            </Select>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {queryError && <p className="text-sm text-destructive">Failed to load channels</p>}
        </div>
    );
}
