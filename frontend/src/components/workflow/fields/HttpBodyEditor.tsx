import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, X, Sparkles, Upload } from 'lucide-react';

type BodyType = 'none' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary' | 'graphql';
type RawType = 'json' | 'text' | 'javascript' | 'html' | 'xml';

interface KeyValuePair {
    id: string;
    key: string;
    value: string;
    enabled: boolean;
}

interface BodyValue {
    type: BodyType;
    rawType?: RawType;
    content?: string;
    formData?: KeyValuePair[];
    urlencoded?: KeyValuePair[];
    graphql?: { query: string; variables: string };
    file?: { name: string };
}

interface HttpBodyEditorProps {
    value: BodyValue | any;
    onChange: (value: BodyValue) => void;
    label?: string;
    required?: boolean;
    error?: string;
    description?: string;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const DEFAULT_VALUE: BodyValue = {
    type: 'none',
    rawType: 'json',
    content: '',
    formData: [{ id: generateId(), key: '', value: '', enabled: true }],
    urlencoded: [{ id: generateId(), key: '', value: '', enabled: true }],
    graphql: { query: '', variables: '{}' },
};

export default function HttpBodyEditor({
    value,
    onChange,
    label = 'Body',
    required = false,
    error,
    description,
}: HttpBodyEditorProps) {
    // Normalize value to BodyValue format
    const normalizedValue: BodyValue = typeof value === 'object' && value?.type
        ? { ...DEFAULT_VALUE, ...value }
        : DEFAULT_VALUE;

    const [bodyType, setBodyType] = useState<BodyType>(normalizedValue.type);
    const [rawType, setRawType] = useState<RawType>(normalizedValue.rawType || 'json');

    const updateValue = useCallback((updates: Partial<BodyValue>) => {
        const newValue = { ...normalizedValue, ...updates };
        onChange(newValue);
    }, [normalizedValue, onChange]);

    const handleBodyTypeChange = (type: BodyType) => {
        setBodyType(type);
        updateValue({ type });
    };

    const handleRawTypeChange = (type: RawType) => {
        setRawType(type);
        updateValue({ rawType: type });
    };

    const handleContentChange = (content: string) => {
        updateValue({ content });
    };

    const handleBeautify = () => {
        if (!normalizedValue.content) return;

        try {
            if (rawType === 'json') {
                const parsed = JSON.parse(normalizedValue.content);
                updateValue({ content: JSON.stringify(parsed, null, 2) });
            } else if (rawType === 'xml' || rawType === 'html') {
                // Basic XML/HTML beautification
                const formatted = normalizedValue.content
                    .replace(/></g, '>\n<')
                    .replace(/>\s+</g, '>\n<');
                updateValue({ content: formatted });
            }
        } catch (e) {
            // If parsing fails, leave as is
        }
    };

    // Key-value pair handlers for form-data and urlencoded
    const handlePairChange = (
        pairType: 'formData' | 'urlencoded',
        id: string,
        field: 'key' | 'value' | 'enabled',
        newValue: string | boolean
    ) => {
        const pairs = normalizedValue[pairType] || [];
        const newPairs = pairs.map(p =>
            p.id === id ? { ...p, [field]: newValue } : p
        );
        updateValue({ [pairType]: newPairs });
    };

    const addPair = (pairType: 'formData' | 'urlencoded') => {
        const pairs = normalizedValue[pairType] || [];
        updateValue({
            [pairType]: [...pairs, { id: generateId(), key: '', value: '', enabled: true }]
        });
    };

    const removePair = (pairType: 'formData' | 'urlencoded', id: string) => {
        const pairs = normalizedValue[pairType] ?? [];
        if (pairs.length <= 1) {
            updateValue({ [pairType]: [{ id: generateId(), key: '', value: '', enabled: true }] });
        } else {
            updateValue({ [pairType]: pairs.filter(p => p.id !== id) });
        }
    };

    // GraphQL handlers
    const handleGraphQLChange = (field: 'query' | 'variables', content: string) => {
        const currentGraphql = normalizedValue.graphql ?? { query: '', variables: '{}' };
        updateValue({
            graphql: {
                query: currentGraphql.query,
                variables: currentGraphql.variables,
                [field]: content
            }
        });
    };

    // Render key-value pairs
    const renderKeyValuePairs = (pairType: 'formData' | 'urlencoded') => {
        const pairs = normalizedValue[pairType] || [{ id: generateId(), key: '', value: '', enabled: true }];

        return (
            <div className="space-y-2">
                {pairs.map((pair) => (
                    <div key={pair.id} className="flex items-center gap-2">
                        <Input
                            value={pair.key}
                            onChange={(e) => handlePairChange(pairType, pair.id, 'key', e.target.value)}
                            placeholder="Key"
                            className="flex-1 h-8 text-sm"
                        />
                        <Input
                            value={pair.value}
                            onChange={(e) => handlePairChange(pairType, pair.id, 'value', e.target.value)}
                            placeholder="Value"
                            className="flex-1 h-8 text-sm"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removePair(pairType, pair.id)}
                            className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addPair(pairType)}
                    className="w-full h-8"
                >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Row
                </Button>
            </div>
        );
    };

    return (
        <div className="space-y-2">
            <Label>
                {label}
                {required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
            )}

            {/* Body Type Selector */}
            <Tabs value={bodyType} onValueChange={(v) => handleBodyTypeChange(v as BodyType)}>
                <TabsList className="h-10 px-0.5 w-full grid grid-cols-6 text-xs">
                    <TabsTrigger value="none" className="h-7 text-xs px-2">none</TabsTrigger>
                    <TabsTrigger value="form-data" className="h-7 text-xs px-2">form-data</TabsTrigger>
                    <TabsTrigger value="x-www-form-urlencoded" className="h-7 text-xs px-1">urlencoded</TabsTrigger>
                    <TabsTrigger value="raw" className="h-7 text-xs px-2">raw</TabsTrigger>
                    <TabsTrigger value="binary" className="h-7 text-xs px-2">binary</TabsTrigger>
                    <TabsTrigger value="graphql" className="h-7 text-xs px-2">GraphQL</TabsTrigger>
                </TabsList>

                {/* None */}
                <TabsContent value="none" className="mt-2">
                    <p className="text-xs text-muted-foreground italic">
                        This request does not have a body
                    </p>
                </TabsContent>

                {/* Form Data */}
                <TabsContent value="form-data" className="mt-2">
                    {renderKeyValuePairs('formData')}
                </TabsContent>

                {/* URL Encoded */}
                <TabsContent value="x-www-form-urlencoded" className="mt-2">
                    {renderKeyValuePairs('urlencoded')}
                </TabsContent>

                {/* Raw */}
                <TabsContent value="raw" className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                        <Select value={rawType} onValueChange={(v) => handleRawTypeChange(v as RawType)}>
                            <SelectTrigger className="w-32 h-7 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="json">JSON</SelectItem>
                                <SelectItem value="text">Text</SelectItem>
                                <SelectItem value="javascript">JavaScript</SelectItem>
                                <SelectItem value="html">HTML</SelectItem>
                                <SelectItem value="xml">XML</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleBeautify}
                            className="h-7 text-xs gap-1"
                            disabled={!normalizedValue.content}
                        >
                            <Sparkles className="h-3 w-3" />
                            Beautify
                        </Button>
                    </div>
                    <Textarea
                        value={normalizedValue.content || ''}
                        onChange={(e) => handleContentChange(e.target.value)}
                        placeholder={rawType === 'json' ? '{\n  "key": "value"\n}' : 'Enter content...'}
                        className="font-mono text-sm min-h-[120px]"
                        spellCheck={false}
                    />
                </TabsContent>

                {/* Binary */}
                <TabsContent value="binary" className="mt-2">
                    <div className="border-2 border-dashed border-muted rounded-md p-4 text-center">
                        <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                        <p className="text-xs text-muted-foreground">
                            Binary file upload not yet supported
                        </p>
                    </div>
                </TabsContent>

                {/* GraphQL */}
                <TabsContent value="graphql" className="mt-2 space-y-2">
                    <div>
                        <Label className="text-xs">Query</Label>
                        <Textarea
                            value={normalizedValue.graphql?.query || ''}
                            onChange={(e) => handleGraphQLChange('query', e.target.value)}
                            placeholder="query { ... }"
                            className="font-mono text-sm min-h-[80px] mt-1"
                            spellCheck={false}
                        />
                    </div>
                    <div>
                        <Label className="text-xs">Variables (JSON)</Label>
                        <Textarea
                            value={normalizedValue.graphql?.variables || '{}'}
                            onChange={(e) => handleGraphQLChange('variables', e.target.value)}
                            placeholder="{}"
                            className="font-mono text-sm min-h-[60px] mt-1"
                            spellCheck={false}
                        />
                    </div>
                </TabsContent>
            </Tabs>

            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}
