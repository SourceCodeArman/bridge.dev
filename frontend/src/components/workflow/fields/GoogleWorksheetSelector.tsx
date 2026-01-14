import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { Label } from '@/components/ui/label';

interface GoogleWorksheetSelectorProps {
    value?: string;
    onChange: (worksheetName: string) => void;
    credentialId?: string;
    spreadsheetId?: string;
    label?: string;
    required?: boolean;
    error?: string;
}

export default function GoogleWorksheetSelector({
    value,
    onChange,
    credentialId,
    spreadsheetId,
    label = 'Worksheet',
    required = false,
    error,
}: GoogleWorksheetSelectorProps) {
    const { data: worksheets, isLoading, error: queryError } = useQuery({
        queryKey: ['google-worksheets', credentialId, spreadsheetId],
        queryFn: async () => {
            if (!credentialId || !spreadsheetId) return [];
            const response = await apiClient.get<any>(
                `/api/v1/core/credentials/${credentialId}/google/spreadsheets/${spreadsheetId}/worksheets/`
            );
            return response.data.worksheets || [];
        },
        enabled: !!credentialId && !!spreadsheetId,
    });

    const isDisabled = !credentialId || !spreadsheetId || isLoading;

    return (
        <div className="space-y-2">
            <Label>
                {label}
                {required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Select
                value={value || ''}
                onValueChange={onChange}
                disabled={isDisabled}
            >
                <SelectTrigger>
                    <SelectValue placeholder={
                        !credentialId
                            ? "Select a credential first"
                            : !spreadsheetId
                                ? "Select a spreadsheet first"
                                : isLoading
                                    ? "Loading worksheets..."
                                    : "Select worksheet"
                    } />
                </SelectTrigger>
                <SelectContent>
                    {worksheets?.map((ws: any) => (
                        <SelectItem key={ws.sheet_id} value={ws.title}>
                            {ws.title}
                        </SelectItem>
                    ))}
                    {!worksheets?.length && !isLoading && spreadsheetId && (
                        <div className="p-2 text-sm text-foreground text-center">
                            No worksheets found
                        </div>
                    )}
                </SelectContent>
            </Select>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {queryError && <p className="text-sm text-destructive">Failed to load worksheets</p>}
        </div>
    );
}
