import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMemo } from 'react';

interface UrlWithParamsFieldProps {
    value: string;
    onChange: (value: string) => void;
    params?: Record<string, string>;
    label: string;
    required?: boolean;
    error?: string;
    description?: string;
    placeholder?: string;
}

export default function UrlWithParamsField({
    value,
    onChange,
    params,
    label,
    required = false,
    error,
    description,
    placeholder = 'https://api.example.com/endpoint',
}: UrlWithParamsFieldProps) {
    // Compute the full URL with params for preview
    const fullUrl = useMemo(() => {
        if (!value) return '';
        if (!params || Object.keys(params).length === 0) return value;

        try {
            const url = new URL(value);
            Object.entries(params).forEach(([key, val]) => {
                if (key.trim()) {
                    url.searchParams.set(key.trim(), val);
                }
            });
            return url.toString();
        } catch {
            // If URL is invalid or relative, just append query string manually
            const queryString = Object.entries(params)
                .filter(([key]) => key.trim())
                .map(([key, val]) => `${encodeURIComponent(key.trim())}=${encodeURIComponent(val)}`)
                .join('&');

            if (!queryString) return value;

            const separator = value.includes('?') ? '&' : '?';
            return `${value}${separator}${queryString}`;
        }
    }, [value, params]);

    const hasParams = params && Object.keys(params).some(k => k.trim());

    return (
        <div className="space-y-2">
            <Label htmlFor="url">
                {label}
                {required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
            )}
            <Input
                id="url"
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
            />
            {hasParams && fullUrl && fullUrl !== value && (
                <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md font-mono break-all">
                    <span className="text-muted-foreground/70 mr-1">Preview:</span>
                    {fullUrl}
                </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}
