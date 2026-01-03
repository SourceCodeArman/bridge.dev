import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { ConnectorAction } from '@/types/models';

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
    // Auto-select first action if only one available
    if (actions.length === 1 && !value) {
        const firstAction = actions[0];
        if (firstAction) {
            setTimeout(() => onChange(firstAction.id), 0);
        }
    }

    // Don't render if only one action (it's implicit)
    if (actions.length <= 1) {
        return null;
    }

    return (
        <div className="space-y-2">
            <Label htmlFor="action-selector">{label}</Label>
            <Select value={value || ''} onValueChange={onChange}>
                <SelectTrigger id="action-selector" className="bg-card border-border">
                    <SelectValue placeholder="Select an action..." className="text-muted-foreground" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border">
                    {actions.map((action) => (
                        <SelectItem
                            key={action.id}
                            value={action.id}
                            className="text-foreground hover:bg-card focus:bg-card"
                        >
                            <div>
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
