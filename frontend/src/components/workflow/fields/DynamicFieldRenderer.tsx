import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';

interface JSONSchemaProperty {
    type: string | string[];
    description?: string;
    default?: any;
    enum?: string[];
    minimum?: number;
    maximum?: number;
    pattern?: string;
    format?: string;
    items?: JSONSchemaProperty;
    required?: boolean;
    readOnly?: boolean;
    displayName?: string;
}

interface DynamicFieldRendererProps {
    fieldName: string;
    schema: JSONSchemaProperty;
    value: any;
    onChange: (value: any) => void;
    required?: boolean;
    error?: string;
}

export default function DynamicFieldRenderer({
    fieldName,
    schema,
    value,
    onChange,
    required = false,
    error,
}: DynamicFieldRendererProps) {
    const [jsonError, setJsonError] = useState<string>('');

    // Normalize type to string (handle array format)
    const fieldType = Array.isArray(schema.type) ? schema.type[0] : schema.type;

    // Generate label from field name or use displayName from schema
    const label = schema.displayName || fieldName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    // Handle webhook_url format - display generated URL as read-only
    if (schema.format === 'webhook_url' && schema.readOnly) {
        // For now, show placeholder. The NodeConfigPanel should pass the actual webhook URL
        // based on the workflow/trigger context
        const webhookUrl = value || 'Webhook URL will be generated after saving';

        return (
            <div className="space-y-2">
                <Label htmlFor={fieldName}>
                    {label}
                    {required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {schema.description && (
                    <p className="text-xs text-muted-foreground">{schema.description}</p>
                )}
                <div className="flex gap-2">
                    <Input
                        id={fieldName}
                        type="text"
                        value={webhookUrl}
                        readOnly
                        className="bg-muted font-mono text-sm"
                    />
                    <button
                        type="button"
                        onClick={() => {
                            if (webhookUrl && webhookUrl !== 'Webhook URL will be generated after saving') {
                                navigator.clipboard.writeText(webhookUrl);
                            }
                        }}
                        className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-md text-sm"
                        title="Copy to clipboard"
                    >
                        Copy
                    </button>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
        );
    }

    // Handle enum fields (dropdown)
    if (schema.enum) {
        return (
            <div className="space-y-2">
                <Label htmlFor={fieldName}>
                    {label}
                    {required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {schema.description && (
                    <p className="text-xs text-muted-foreground">{schema.description}</p>
                )}
                <Select value={value || schema.default || ''} onValueChange={onChange}>
                    <SelectTrigger id={fieldName} className="bg-neutral-900 border-neutral-700">
                        <SelectValue placeholder={`Select ${label.toLowerCase()}`} className="text-neutral-500" />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-900 border-neutral-700">
                        {schema.enum.map((option) => (
                            <SelectItem
                                key={option}
                                value={option}
                                className="text-neutral-200 hover:bg-neutral-800 focus:bg-neutral-800"
                            >
                                {option}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
        );
    }

    // Handle boolean fields (checkbox)
    if (fieldType === 'boolean') {
        return (
            <div className="space-y-2">
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id={fieldName}
                        checked={value ?? schema.default ?? false}
                        onCheckedChange={(checked) => onChange(checked)}
                    />
                    <Label htmlFor={fieldName} className="cursor-pointer">
                        {label}
                        {required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                </div>
                {schema.description && (
                    <p className="text-xs text-muted-foreground ml-6">{schema.description}</p>
                )}
                {error && <p className="text-sm text-destructive ml-6">{error}</p>}
            </div>
        );
    }

    // Handle number/integer fields
    if (fieldType === 'number' || fieldType === 'integer') {
        return (
            <div className="space-y-2">
                <Label htmlFor={fieldName}>
                    {label}
                    {required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {schema.description && (
                    <p className="text-xs text-muted-foreground">{schema.description}</p>
                )}
                <Input
                    id={fieldName}
                    type="number"
                    value={value ?? schema.default ?? ''}
                    onChange={(e) => {
                        const val = e.target.value;
                        onChange(val === '' ? undefined : fieldType === 'integer' ? parseInt(val) : parseFloat(val));
                    }}
                    min={schema.minimum}
                    max={schema.maximum}
                    step={fieldType === 'integer' ? 1 : 'any'}
                    placeholder={schema.default?.toString() || ''}
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
        );
    }

    // Handle object/array fields (JSON editor)
    if (fieldType === 'object' || fieldType === 'array') {
        return (
            <div className="space-y-2">
                <Label htmlFor={fieldName}>
                    {label}
                    {required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {schema.description && (
                    <p className="text-xs text-muted-foreground">{schema.description}</p>
                )}
                <Textarea
                    id={fieldName}
                    value={typeof value === 'string' ? value : JSON.stringify(value || schema.default || (fieldType === 'array' ? [] : {}), null, 2)}
                    onChange={(e) => {
                        const val = e.target.value;
                        try {
                            const parsed = JSON.parse(val);
                            onChange(parsed);
                            setJsonError('');
                        } catch (err) {
                            // Keep the raw value for editing
                            onChange(val);
                            setJsonError('Invalid JSON');
                        }
                    }}
                    placeholder={`Enter valid JSON ${fieldType}`}
                    className="font-mono text-sm"
                    rows={6}
                />
                {jsonError && <p className="text-sm text-amber-600">{jsonError}</p>}
                {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
        );
    }

    // Handle string fields (default)
    const isPassword = schema.format === 'password' || fieldName.toLowerCase().includes('password') || fieldName.toLowerCase().includes('token') || fieldName.toLowerCase().includes('secret');
    const isUri = schema.format === 'uri' || fieldName.toLowerCase().includes('url');
    const isTextarea = schema.description?.toLowerCase().includes('long') || schema.description?.toLowerCase().includes('message') || schema.description?.toLowerCase().includes('body');

    if (isTextarea) {
        return (
            <div className="space-y-2">
                <Label htmlFor={fieldName}>
                    {label}
                    {required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {schema.description && (
                    <p className="text-xs text-muted-foreground">{schema.description}</p>
                )}
                <Textarea
                    id={fieldName}
                    value={value ?? schema.default ?? ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={schema.default || ''}
                    rows={4}
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <Label htmlFor={fieldName}>
                {label}
                {required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {schema.description && (
                <p className="text-xs text-muted-foreground">{schema.description}</p>
            )}
            <Input
                id={fieldName}
                type={isPassword ? 'password' : 'text'}
                value={value ?? schema.default ?? ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={schema.default || (isUri ? 'https://example.com' : '')}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}
