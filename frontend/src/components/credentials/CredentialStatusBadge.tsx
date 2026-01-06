import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";

interface CredentialStatusBadgeProps {
    isActive: boolean;
    lastUsedAt?: string;
    className?: string;
}

export function CredentialStatusBadge({ isActive, className }: CredentialStatusBadgeProps) {
    if (!isActive) {
        return (
            <Badge variant="secondary" className={`gap-1 bg-muted text-muted-foreground hover:bg-muted ${className}`}>
                <XCircle className="w-3 h-3" />
                Inactive
            </Badge>
        );
    }

    // Check if recently used (e.g., within last 24 hours) - optional logic could go here
    // For now, simple active status
    return (
        <Badge variant="outline" className={`gap-1 border-green-500/30 text-green-600 bg-green-500/10 hover:bg-green-500/20 ${className}`}>
            <CheckCircle2 className="w-3 h-3" />
            Active
        </Badge>
    );
}
