import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface KeyValuePair {
    id: string; // Unique ID for React keys
    key: string;
    value: string;
}

interface KeyValueEditorProps {
    value: Record<string, string> | undefined;
    onChange: (value: Record<string, string>) => void;
    label: string;
    required?: boolean;
    error?: string;
    description?: string;
    keyPlaceholder?: string;
    valuePlaceholder?: string;
}

// Generate a unique ID for new rows
const generateId = () => Math.random().toString(36).substring(2, 9);

export default function KeyValueEditor({
    value,
    onChange,
    label,
    required = false,
    error,
    description,
    keyPlaceholder = 'Key',
    valuePlaceholder = 'Value',
}: KeyValueEditorProps) {
    // Track pairs as internal state with unique IDs
    const [pairs, setPairs] = useState<KeyValuePair[]>(() => {
        if (value && Object.keys(value).length > 0) {
            return Object.entries(value).map(([key, val]) => ({
                id: generateId(),
                key,
                value: val,
            }));
        }
        return [{ id: generateId(), key: '', value: '' }];
    });

    // Sync internal state when external value changes
    useEffect(() => {
        const valueKeys = value ? Object.keys(value) : [];
        const pairKeys = pairs.filter(p => p.key.trim()).map(p => p.key.trim());

        // Only sync if external value is meaningfully different
        if (JSON.stringify(valueKeys.sort()) !== JSON.stringify(pairKeys.sort())) {
            if (value && Object.keys(value).length > 0) {
                setPairs(Object.entries(value).map(([key, val]) => ({
                    id: generateId(),
                    key,
                    value: val,
                })));
            }
        }
    }, [value]);

    // Emit changes to parent (only non-empty keys)
    const emitChange = (newPairs: KeyValuePair[]) => {
        const newValue: Record<string, string> = {};
        newPairs.forEach(pair => {
            if (pair.key.trim()) {
                newValue[pair.key.trim()] = pair.value;
            }
        });
        onChange(newValue);
    };

    const handleKeyChange = (id: string, newKey: string) => {
        const newPairs = pairs.map(p =>
            p.id === id ? { ...p, key: newKey } : p
        );
        setPairs(newPairs);
        emitChange(newPairs);
    };

    const handleValueChange = (id: string, newValue: string) => {
        const newPairs = pairs.map(p =>
            p.id === id ? { ...p, value: newValue } : p
        );
        setPairs(newPairs);
        emitChange(newPairs);
    };

    const addRow = () => {
        setPairs([...pairs, { id: generateId(), key: '', value: '' }]);
    };

    const removeRow = (id: string) => {
        if (pairs.length === 1) {
            // Clear the only row instead of removing it
            const clearedPairs = [{ id: pairs[0]!.id, key: '', value: '' }];
            setPairs(clearedPairs);
            emitChange(clearedPairs);
        } else {
            const newPairs = pairs.filter(p => p.id !== id);
            setPairs(newPairs);
            emitChange(newPairs);
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

            <div className="space-y-2">
                {pairs.map((pair) => (
                    <div key={pair.id} className="flex items-center gap-2">
                        <Input
                            value={pair.key}
                            onChange={(e) => handleKeyChange(pair.id, e.target.value)}
                            placeholder={keyPlaceholder}
                            className="flex-1"
                        />
                        <Input
                            value={pair.value}
                            onChange={(e) => handleValueChange(pair.id, e.target.value)}
                            placeholder={valuePlaceholder}
                            className="flex-1"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRow(pair.id)}
                            className="shrink-0 h-9 w-9 text-muted-foreground hover:text-destructive"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>

            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRow}
                className="w-full"
            >
                <Plus className="h-4 w-4 mr-2" />
                Add Row
            </Button>

            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}
