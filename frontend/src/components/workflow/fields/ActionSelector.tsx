import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Lock } from 'lucide-react';
import type { ConnectorAction } from '@/types/models';
import { useEffect } from 'react';

interface ActionSelectorProps {
    actions: ConnectorAction[];
    value?: string;
    onChange: (actionId: string) => void;
    label?: string;
}

export default function ActionSelector({
    actions,
    value,
    onChange,
    label = 'Action',
}: ActionSelectorProps) {
    // Auto-select single action
    useEffect(() => {
        if (actions.length === 1 && !value) {
            const firstAction = actions[0];
            if (firstAction) {
                onChange(firstAction.id);
            }
        }
    }, [actions, value, onChange]);

    // No actions available - return null
    if (actions.length < 1) {
        return null;
    }

    // Single action - show as locked field
    if (actions.length === 1) {
        const action = actions[0];
        return (
            <div className="space-y-2">
                <Label htmlFor="action-selector">{label}</Label>
                <div className="relative">
                    <Input
                        id="action-selector"
                        value={action?.name || ''}
                        disabled
                        className="bg-muted/50 border-border pr-10"
                    />
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                {action?.description && (
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                )}
            </div>
        );
    }

    // Multiple actions - show dropdown
    return (
        <div className="space-y-2">
            <Label htmlFor="action-selector">{label}</Label>
            <Select value={value || ''} onValueChange={onChange}>
                <SelectTrigger id="action-selector" className="bg-card border-border">
                    <SelectValue placeholder="Select an action...">
                        {value && actions.find(a => a.id === value)?.name}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-background border-border">
                    {actions.map((action) => (
                        <SelectItem
                            key={action.id}
                            value={action.id}
                            className="text-foreground hover:bg-card focus:bg-card"
                        >
                            <div className="flex flex-col items-start">
                                <div className="font-medium">{action.name}</div>
                                {action.description && (
                                    <div className="text-xs text-muted-foreground">
                                        {action.description}
                                    </div>
                                )}
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {!value && (
                <p className="text-xs text-muted-foreground">
                    Please select an action to configure parameters
                </p>
            )}
        </div>
    );
}
