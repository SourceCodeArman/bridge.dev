import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { Loader2 } from 'lucide-react';

// Fallback models when no credential is selected or API fails
const FALLBACK_MODELS: Record<string, { id: string; name: string; description?: string }[]> = {
    openai: [
        { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable model' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'High capability with improved speed' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and cost-effective' },
    ],
    anthropic: [
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Best balance of speed and intelligence' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fastest model for simple tasks' },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most powerful for complex tasks' },
    ],
    gemini: [
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Latest fast model' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Most capable Gemini model' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast and efficient' },
    ],
    deepseek: [
        { id: 'deepseek-chat', name: 'DeepSeek Chat', description: 'General chat model' },
        { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', description: 'Advanced reasoning' },
    ],
};

interface AIModelSelectorProps {
    value?: string;
    onChange: (value: string) => void;
    connectorSlug: string;
    credentialId?: string;
    label?: string;
    required?: boolean;
    error?: string;
    description?: string;
}

export default function AIModelSelector({
    value,
    onChange,
    connectorSlug,
    credentialId,
    label = 'Model',
    required = false,
    error,
    description,
}: AIModelSelectorProps) {
    // Fetch models from the backend using the credential
    const { data: fetchedModels, isLoading, error: queryError } = useQuery({
        queryKey: ['ai-models', credentialId, connectorSlug],
        queryFn: async () => {
            if (!credentialId) return null;
            const response = await apiClient.get<any>(`/api/v1/core/credentials/${credentialId}/ai/models/`);
            return response.data.models || [];
        },
        enabled: !!credentialId,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    // Use fetched models if available, otherwise fall back to defaults
    const models = fetchedModels || FALLBACK_MODELS[connectorSlug] || [];

    // Get display name for current value
    const selectedModel = models.find((m: any) => m.id === value);

    return (
        <div className="space-y-2">
            <Label htmlFor="model-selector">
                {label}
                {required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Select
                value={value || ''}
                onValueChange={onChange}
                disabled={isLoading}
            >
                <SelectTrigger id="model-selector" className="bg-card border-border">
                    <SelectValue placeholder={
                        isLoading
                            ? "Loading models..."
                            : "Select a model..."
                    }>
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading models...
                            </span>
                        ) : (
                            selectedModel?.name || value
                        )}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-background border-border max-h-[300px]">
                    {models.map((model: any) => (
                        <SelectItem
                            key={model.id}
                            value={model.id}
                            className="text-foreground hover:bg-card focus:bg-card"
                        >
                            <div className="flex flex-col items-start">
                                <div className="font-medium">{model.name}</div>
                                {model.description && (
                                    <div className="text-xs text-muted-foreground">
                                        {model.description}
                                    </div>
                                )}
                            </div>
                        </SelectItem>
                    ))}
                    {models.length === 0 && !isLoading && (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                            {!credentialId
                                ? "Select a credential first"
                                : queryError
                                    ? "Failed to load models"
                                    : "No models available"
                            }
                        </div>
                    )}
                </SelectContent>
            </Select>
            {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {queryError && (
                <p className="text-xs text-amber-500">Using fallback model list</p>
            )}
        </div>
    );
}
