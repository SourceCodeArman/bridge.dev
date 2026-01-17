import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, Copy, Key, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface TokenGeneratorFieldProps {
    value: string;
    onChange: (value: string) => void;
    label: string;
    required?: boolean;
    error?: string;
    description?: string;
    fieldName?: string;
}

function generateSecureToken(length: number = 32): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Base64URL encode (JWT-safe encoding)
function base64UrlEncode(data: string): string {
    return btoa(data)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// Generate a test JWT using the provided secret
async function generateTestJWT(secret: string): Promise<string> {
    // JWT Header
    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };

    // JWT Payload with 1 hour expiry
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        sub: 'webhook-user',
        iat: now,
        exp: now + 3600, // 1 hour
        jti: generateSecureToken(16) // unique token ID
    };

    // Encode header and payload
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    // Import the secret key for HMAC
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    // Sign the data
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(dataToSign));

    // Convert signature to base64url
    const signatureArray = new Uint8Array(signature);
    const signatureB64 = base64UrlEncode(String.fromCharCode(...signatureArray));

    // Return the complete JWT
    return `${dataToSign}.${signatureB64}`;
}

export default function TokenGeneratorField({
    value,
    onChange,
    label,
    required = false,
    error,
    fieldName,
}: TokenGeneratorFieldProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);

    // Check if this is a JWT secret field
    const isJwtSecretField = fieldName === 'jwt_secret' || label.toLowerCase().includes('jwt');

    const handleGenerate = () => {
        setIsGenerating(true);
        setTimeout(() => {
            // Always generate a hex secret (not a JWT)
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

    // For JWT secret field, generate a test JWT and copy it
    const handleGenerateTestJWT = async () => {
        if (!value) {
            toast.error('Please generate or enter a secret first');
            return;
        }
        try {
            const jwt = await generateTestJWT(value);
            await navigator.clipboard.writeText(jwt);
            toast.success('Test JWT copied to clipboard! Valid for 1 hour.');
        } catch {
            toast.error('Failed to generate test JWT');
        }
    };

    return (
        <div className="space-y-2">
            <Label>
                {label}
                {required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <div className="flex gap-2">
                <Input
                    type="text"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={isJwtSecretField ? "Enter or generate secret key" : "Enter token or generate one"}
                    className="font-mono text-sm"
                />
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    disabled={!value}
                    title="Copy secret to clipboard"
                >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    title="Generate Secret"
                >
                    <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                </Button>
                {isJwtSecretField && (
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleGenerateTestJWT}
                        disabled={!value}
                        title="Generate & Copy Test JWT"
                    >
                        <Key className="h-4 w-4" />
                    </Button>
                )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}
