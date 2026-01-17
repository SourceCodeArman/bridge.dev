import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface TokenGeneratorFieldProps {
    value: string;
    onChange: (value: string) => void;
    label: string;
    required?: boolean;
    error?: string;
    description?: string;
}

function generateSecureToken(length: number = 32): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export default function TokenGeneratorField({
    value,
    onChange,
    label,
    required = false,
    error,
    description,
}: TokenGeneratorFieldProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleGenerate = () => {
        setIsGenerating(true);
        setTimeout(() => {
            const token = generateSecureToken(32);
            onChange(token);
            setIsGenerating(false);
        }, 150);
    };

    const handleCopy = async () => {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // Clipboard failed
        }
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
            <div className="flex gap-2">
                <Input
                    type="text"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Enter token or generate one"
                    className="font-mono text-sm"
                />
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    disabled={!value}
                    title="Copy to clipboard"
                >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    title="Generate Token"
                >
                    <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}
