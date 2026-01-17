import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import AIModelSelector from './AIModelSelector';
import CredentialSelector from './CredentialSelector';
import DateTimePicker from './DateTimePicker';
import GoogleCalendarSelector from './GoogleCalendarSelector';
import GoogleSpreadsheetSelector from './GoogleSpreadsheetSelector';
import GoogleWorksheetSelector from './GoogleWorksheetSelector';
import HttpBodyEditor from './HttpBodyEditor';
import KeyValueEditor from './KeyValueEditor';
import McpToolNameSelector from './McpToolNameSelector';
import McpToolSelector from './McpToolSelector';
import SlackChannelSelector from './SlackChannelSelector';
import UrlWithParamsField from './UrlWithParamsField';
import TokenGeneratorField from './TokenGeneratorField';

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
    additionalProperties?: { type: string } | boolean;
    required?: boolean;
    readOnly?: boolean;
    displayName?: string;
    'ui:component'?: string;
    'ui:range-pair'?: string;
    'ui:widget'?: string;
    'ui:showIf'?: Record<string, string[]>;
}

interface DynamicFieldRendererProps {
    fieldName: string;
    schema: JSONSchemaProperty;
    value: any;
    onChange: (value: any) => void;
    required?: boolean;
    error?: string;
    credentialId?: string;
    connectorSlug?: string;
    allSchemas?: Record<string, JSONSchemaProperty>;
    allValues?: Record<string, any>;
    onMultiChange?: (updates: Record<string, any>) => void;
    onCreateCredential?: (props?: { initialConnectorId?: string; authType?: string }) => void;
    // MCP tools shared state
    mcpTools?: { name: string; description?: string; inputSchema?: any }[];
    mcpToolsLoading?: boolean;
    mcpToolsError?: string | null;
    onFetchMcpTools?: () => void;
}

export default function DynamicFieldRenderer({
    fieldName,
    schema,
    value,
    onChange,
    required = false,
    error,
    credentialId,
    connectorSlug,
    allSchemas,
    allValues,
    onMultiChange,
    onCreateCredential,
    mcpTools,
    mcpToolsLoading,
    mcpToolsError,
    onFetchMcpTools,
}: DynamicFieldRendererProps) {
    const [jsonError, setJsonError] = useState<string>('');

    // Normalize type to string (handle array format)
    const fieldType = Array.isArray(schema.type) ? schema.type[0] : schema.type;

    // Generate label from field name or use displayName from schema
    const label = schema.displayName || fieldName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    // Handle date-time range pairs
    const rangePair = schema['ui:range-pair'];
    console.log(`[${fieldName}] Processing:`, {
        rangePair,
        component: schema['ui:component'],
        format: schema.format,
        hasAllSchemas: !!allSchemas,
        hasAllValues: !!allValues,
        hasOnMultiChange: !!onMultiChange,
        allSchemasCount: allSchemas ? Object.keys(allSchemas).length : 0
    });

    // Handle ui:showIf conditional visibility
    const showIfCondition = schema['ui:showIf'];
    if (showIfCondition && allValues) {
        for (const [dependentField, allowedValues] of Object.entries(showIfCondition)) {
            const currentValue = allValues[dependentField];
            if (!allowedValues.includes(currentValue)) {
                return null;
            }
        }
    }

    // Handle AI model selector for model fields on AI connectors
    const AI_CONNECTORS = ['openai', 'anthropic', 'gemini', 'deepseek'];
    if (fieldName === 'model' && connectorSlug && AI_CONNECTORS.includes(connectorSlug)) {
        return (
            <AIModelSelector
                value={value}
                onChange={onChange}
                connectorSlug={connectorSlug}
                credentialId={credentialId}
                label={label}
                required={required}
                error={error}
                description={schema.description}
            />
        );
    }

    // Handle URL field with params preview (for HTTP connector)
    if (fieldName === 'url' && schema.format === 'uri' && allValues?.params) {
        return (
            <UrlWithParamsField
                value={value}
                onChange={onChange}
                params={allValues.params as Record<string, string>}
                label={label}
                required={required}
                error={error}
                description={schema.description}
            />
        );
    }

    // Handle body field for HTTP connectors - use Postman-style editor
    if (fieldName === 'body' && (connectorSlug === 'http' || connectorSlug === 'http-tool')) {
        return (
            <HttpBodyEditor
                value={value}
                onChange={onChange}
                label={label}
                required={required}
                error={error}
                description={schema.description}
            />
        );
    }

    // Handle custom UI components
    if (schema['ui:widget'] === 'credential-selector') {
        const isVisible = allValues?.authentication && allValues.authentication !== 'none';

        if (!isVisible) return null;

        return (
            <CredentialSelector
                value={value}
                onChange={onChange}
                slug={connectorSlug}
                label={label}
                required={required}
                authType={allValues?.authentication}
                onCreate={onCreateCredential}
            />
        );
    }

    if (schema['ui:widget'] === 'tool-multiselect') {
        const toolsSelection = allValues?.tools_selection || 'all';
        const isVisible = toolsSelection === 'selected' || toolsSelection === 'all-except';

        if (!isVisible) return null;

        return (
            <McpToolSelector
                value={value}
                onChange={onChange}
                label={label}
                required={required}
                error={error}
                tools={mcpTools}
                loading={mcpToolsLoading}
                fetchError={mcpToolsError}
                onFetchTools={onFetchMcpTools}
            />
        );
    }

    if (schema['ui:widget'] === 'tool-name-selector') {
        return (
            <McpToolNameSelector
                value={value}
                onChange={onChange}
                label={label}
                required={required}
                error={error}
                tools={mcpTools}
                loading={mcpToolsLoading}
                fetchError={mcpToolsError}
                onFetchTools={onFetchMcpTools}
            />
        );
    }

    if (schema['ui:widget'] === 'token-generator') {
        return (
            <TokenGeneratorField
                value={value}
                onChange={onChange}
                label={label}
                required={required}
                error={error}
                description={schema.description}
            />
        );
    }

    // Handle legacy custom UI components
    if (schema['ui:component'] === 'google_calendar_selector') {
        return (
            <GoogleCalendarSelector
                value={value}
                onChange={onChange}
                credentialId={credentialId}
                label={label}
                required={required}
                error={error}
            />
        );
    }

    if (schema['ui:component'] === 'google_spreadsheet_selector') {
        return (
            <GoogleSpreadsheetSelector
                value={value}
                onChange={onChange}
                credentialId={credentialId}
                label={label}
                required={required}
                error={error}
            />
        );
    }

    if (schema['ui:component'] === 'slack_channel_selector') {
        return (
            <SlackChannelSelector
                value={value}
                onChange={onChange}
                credentialId={credentialId}
                label={label}
                required={required}
                error={error}
            />
        );
    }

    if (schema['ui:component'] === 'google_worksheet_selector') {
        // Get spreadsheet_id from allValues for cascading selection
        const spreadsheetId = allValues?.spreadsheet_id;
        return (
            <GoogleWorksheetSelector
                value={value}
                onChange={onChange}
                credentialId={credentialId}
                spreadsheetId={spreadsheetId}
                label={label}
                required={required}
                error={error}
            />
        );
    }

    // Handle date-time format fields (including range fields that couldn't be paired)
    if (schema.format === 'date-time') {
        return (
            <DateTimePicker
                value={value}
                onChange={onChange}
                label={label}
                required={required}
                error={error}
                placeholder={schema.description || 'Select date and time'}
            />
        );
    }

    // Handle webhook_url format - display generated URL as read-only
    if (schema.format === 'webhook_url' && schema.readOnly) {
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
                        className="px-3 py-2 bg-card hover:bg-neutral-700 rounded-md text-sm"
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
                    <SelectTrigger id={fieldName} className="bg-background border-border">
                        <SelectValue placeholder={`Select ${label.toLowerCase()}`} className="text-muted-foreground" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border">
                        {schema.enum.map((option) => (
                            <SelectItem
                                key={option}
                                value={option}
                                className="text-foreground hover:bg-card focus:bg-card"
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

    // Handle boolean fields (checkbox or switch)
    if (fieldType === 'boolean') {
        const isSwitch = schema['ui:widget'] === 'switch';

        if (isSwitch) {
            return (
                <div className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                        <Label className="text-sm font-medium">
                            {label}
                            {required && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        {schema.description && (
                            <p className="text-xs text-muted-foreground">{schema.description}</p>
                        )}
                    </div>
                    <Switch
                        checked={value ?? schema.default ?? false}
                        onCheckedChange={(checked) => onChange(checked)}
                    />
                    {error && <p className="text-sm text-destructive ml-6">{error}</p>}
                </div>
            );
        }

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
                    <p className="text-xs text-foreground ml-6">{schema.description}</p>
                )}
                {error && <p className="text-sm text-destructive ml-6">{error}</p>}
            </div>
        );
    }

    // Handle number/integer fields
    if (fieldType === 'number' || fieldType === 'integer') {
        // Use simple float input for temperature fields on LLM connectors
        const isTemperatureField = fieldName === 'temperature' &&
            schema.minimum !== undefined &&
            schema.maximum !== undefined;

        if (isTemperatureField) {
            const min = schema.minimum ?? 0;
            const max = schema.maximum ?? 2;
            const step = 0.1;
            const currentValue = value ?? schema.default ?? 1;

            return (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor={fieldName}>
                            {label}
                            {required && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        <Input
                            id={fieldName}
                            type="number"
                            value={typeof currentValue === 'number' ? currentValue : ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                    onChange(schema.default ?? 1);
                                } else {
                                    const parsed = parseFloat(val);
                                    if (!isNaN(parsed)) {
                                        const clamped = Math.min(max, Math.max(min, parsed));
                                        onChange(clamped);
                                    }
                                }
                            }}
                            min={min}
                            max={max}
                            step={step}
                            className="w-20 h-7 text-sm text-right border-0 shadow-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                    </div>
                    {schema.description && (
                        <p className="text-xs text-muted-foreground">{schema.description}</p>
                    )}
                    <div className="pt-1">
                        <Slider
                            value={[typeof currentValue === 'number' ? currentValue : parseFloat(currentValue) || 1]}
                            onValueChange={(vals) => onChange(vals[0])}
                            min={min}
                            max={max}
                            step={step}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>{min} (Precise)</span>
                            <span>{max} (Creative)</span>
                        </div>
                    </div>
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

    // Handle object fields with additionalProperties (key-value pairs)
    if (fieldType === 'object' && schema.additionalProperties) {
        return (
            <KeyValueEditor
                value={value as Record<string, string> | undefined}
                onChange={onChange}
                label={label}
                required={required}
                error={error}
                description={schema.description}
                keyPlaceholder={fieldName === 'headers' ? 'Header Name' : fieldName === 'params' ? 'Parameter' : 'Key'}
                valuePlaceholder={fieldName === 'headers' ? 'Header Value' : fieldName === 'params' ? 'Value' : 'Value'}
            />
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
    const isTextarea = schema['ui:widget'] === 'textarea' || schema.description?.toLowerCase().includes('long') || schema.description?.toLowerCase().includes('message') || schema.description?.toLowerCase().includes('body');

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
