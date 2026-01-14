import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { credentialService } from '@/lib/api/services/credential';
import { Plus } from 'lucide-react';
import { useEffect } from 'react';

interface CredentialSelectorProps {
    value?: string;
    onChange: (credentialId: string) => void;
    slug?: string;
    label?: string;
    required?: boolean;
    onCreate?: () => void;
}

export default function CredentialSelector({
    value,
    onChange,
    slug,
    label = 'Credential',
    required = false,
    onCreate,
}: CredentialSelectorProps) {
    const { data: credentials, isLoading } = useQuery({
        queryKey: ['credentials'],
        queryFn: () => credentialService.list(),
    });
    console.log(credentials, isLoading)

    // Credential aliases - connectors that can share credentials
    // Key: connector that needs credentials, Value: connectors whose credentials can be used
    const credentialAliases: Record<string, string[]> = {
        'openai-model': ['openai', 'openai-model'],
    };

    // Get allowed slugs for filtering (include aliases)
    const getAllowedSlugs = (connectorSlug?: string): string[] => {
        if (!connectorSlug) return [];
        // Check if this slug has aliases defined
        if (credentialAliases[connectorSlug]) {
            return credentialAliases[connectorSlug];
        }
        // Check if this slug is an alias target (e.g., 'openai' can be used by 'openai-model')
        const reverseMatches = Object.entries(credentialAliases)
            .filter(([, aliases]) => aliases.includes(connectorSlug))
            .flatMap(([, aliases]) => aliases);
        if (reverseMatches.length > 0) {
            return [...new Set([connectorSlug, ...reverseMatches])];
        }
        return [connectorSlug];
    };

    const allowedSlugs = getAllowedSlugs(slug);

    // Filter credentials by connector type if provided (with alias support)
    const filteredCredentials = credentials?.results?.filter(
        (cred) => !cred.slug || !slug || allowedSlugs.includes(cred.slug)
    ) || [];
    useEffect(() => console.log(filteredCredentials), [filteredCredentials]);

    return (
        <div className="space-y-2">
            <Label htmlFor="credential-selector">
                {label}
                {required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <div className="flex gap-2">
                <Select value={value} onValueChange={onChange} disabled={isLoading}>
                    <SelectTrigger id="credential-selector" className="flex-1">
                        <SelectValue placeholder={isLoading ? 'Loading...' : 'Select credential'} />
                    </SelectTrigger>
                    <SelectContent>
                        {filteredCredentials.length === 0 && (
                            <div className="p-2 text-sm text-foreground text-center">
                                No credentials available
                            </div>
                        )}
                        {filteredCredentials.map((cred) => (
                            <SelectItem key={cred.id} value={cred.id}>
                                {cred.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Create new credential"
                    onClick={() => {
                        if (onCreate) onCreate();
                    }}
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
            {required && !value && (
                <p className="text-sm text-destructive">This field is required</p>
            )}
        </div>
    );
}
