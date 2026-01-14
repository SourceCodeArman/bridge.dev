import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { Label } from '@/components/ui/label';

interface GoogleSpreadsheetSelectorProps {
    value?: string;
    onChange: (spreadsheetId: string) => void;
    credentialId?: string;
    label?: string;
    required?: boolean;
    error?: string;
}

export default function GoogleSpreadsheetSelector({
    value,
    onChange,
    credentialId,
    label = 'Spreadsheet',
    required = false,
    error,
}: GoogleSpreadsheetSelectorProps) {
    const { data: spreadsheets, isLoading, error: queryError } = useQuery({
        queryKey: ['google-spreadsheets', credentialId],
        queryFn: async () => {
            if (!credentialId) return [];
            const response = await apiClient.get<any>(`/api/v1/core/credentials/${credentialId}/google/spreadsheets/`);
            return response.data.spreadsheets || [];
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
                                ? "Loading spreadsheets..."
                                : "Select spreadsheet"
                    } />
                </SelectTrigger>
                <SelectContent>
                    {spreadsheets?.map((sheet: any) => (
                        <SelectItem key={sheet.id} value={sheet.id}>
                            {sheet.name}
                        </SelectItem>
                    ))}
                    {!spreadsheets?.length && !isLoading && (
                        <div className="p-2 text-sm text-foreground text-center">
                            No spreadsheets found
                        </div>
                    )}
                </SelectContent>
            </Select>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {queryError && <p className="text-sm text-destructive">Failed to load spreadsheets</p>}
        </div>
    );
}
