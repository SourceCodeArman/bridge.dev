import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { Label } from '@/components/ui/label';

interface GoogleCalendarSelectorProps {
    value?: string;
    onChange: (calendarId: string) => void;
    credentialId?: string;
    label?: string;
    required?: boolean;
    error?: string;
}

export default function GoogleCalendarSelector({
    value,
    onChange,
    credentialId,
    label = 'Calendar',
    required = false,
    error,
}: GoogleCalendarSelectorProps) {
    const { data: calendars, isLoading, error: queryError } = useQuery({
        queryKey: ['google-calendars', credentialId],
        queryFn: async () => {
            if (!credentialId) return [];
            const response = await apiClient.get<any>(`/api/v1/core/credentials/${credentialId}/google/calendars/`);
            return response.data.calendars || [];
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
                value={value || 'primary'}
                onValueChange={onChange}
                disabled={!credentialId || isLoading}
            >
                <SelectTrigger>
                    <SelectValue placeholder={
                        !credentialId
                            ? "Select a credential first"
                            : isLoading
                                ? "Loading calendars..."
                                : "Select calendar"
                    } />
                </SelectTrigger>
                <SelectContent>
                    {calendars?.map((cal: any) => (
                        <SelectItem key={cal.id} value={cal.id}>
                            {cal.summary} {cal.primary && '(Primary)'}
                        </SelectItem>
                    ))}
                    {!calendars?.length && !isLoading && (
                        <div className="p-2 text-sm text-foreground text-center">
                            No calendars found
                        </div>
                    )}
                </SelectContent>
            </Select>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {queryError && <p className="text-sm text-destructive">Failed to load calendars</p>}
        </div>
    );
}
