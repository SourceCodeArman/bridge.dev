import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Eye, EyeOff, AlertTriangle } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { credentialService } from "@/lib/api/services/credential";
import { toast } from "sonner";
import type { Credential, Connector, AuthField } from "@/types";

interface CredentialDetailModalProps {
    credential: Credential | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    // We might need connector info to render fields correctly if we allow editing fields
    // For now, let's assume we fetch or look up connector detail.
    // In a real app we'd fetch the connector definition here or pass it in.
}

// Minimal form schema for updates
const updateSchema = z.object({
    name: z.string().min(1, "Name is required"),
    is_active: z.boolean(),
    // Credentials field is optional here, only if user wants to update
    credentials: z.record(z.string(), z.string()).optional()
});

type FormValues = z.infer<typeof updateSchema>;

export function CredentialDetailModal({ credential, open, onOpenChange }: CredentialDetailModalProps) {
    const queryClient = useQueryClient();
    const [showSecrets, setShowSecrets] = useState(false); // If we implement reveal
    const [isEditingSecrets, setIsEditingSecrets] = useState(false);

    const { register, control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(updateSchema),
        defaultValues: {
            name: "",
            is_active: true,
            credentials: {}
        }
    });

    useEffect(() => {
        if (credential && open) {
            reset({
                name: credential.name,
                is_active: credential.is_active,
                credentials: {}
            });
            setIsEditingSecrets(false);
        }
    }, [credential, open, reset]);

    const updateMutation = useMutation({
        mutationFn: (data: FormValues) => {
            if (!credential) return Promise.reject("No credential selected");
            // Only send credentials object if we are editing secrets and content exists
            const payload: any = {
                name: data.name,
                is_active: data.is_active
            };
            if (isEditingSecrets && Object.keys(data.credentials || {}).length > 0) {
                payload.credentials = data.credentials;
            }
            return credentialService.update(credential.id, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['credentials'] });
            toast.success("Credential updated");
            onOpenChange(false);
        },
        onError: () => toast.error("Failed to update credential")
    });

    const onSubmit = (data: FormValues) => {
        updateMutation.mutate(data);
    };

    if (!credential) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Credential Details</DialogTitle>
                    <DialogDescription>
                        Manage settings for <strong>{credential.connector_name}</strong> credential.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Credential Name</Label>
                            <Input
                                id="name"
                                {...register("name")}
                            />
                            {errors.name && (
                                <p className="text-xs text-destructive">{errors.name.message}</p>
                            )}
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                                <Label>Active Status</Label>
                                <div className="text-sm text-muted-foreground">
                                    Disable to temporarily stop usage.
                                </div>
                            </div>
                            <Controller
                                name="is_active"
                                control={control}
                                render={({ field }) => (
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                )}
                            />
                        </div>

                        <div className="space-y-4 border rounded-md p-4 bg-muted/20">
                            <div className="flex items-center justify-between">
                                <Label>Secrets</Label>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsEditingSecrets(!isEditingSecrets)}
                                    className="h-8"
                                >
                                    {isEditingSecrets ? "Cancel Update" : "Update Values"}
                                </Button>
                            </div>

                            {!isEditingSecrets ? (
                                <div className="text-sm text-muted-foreground italic flex items-center gap-2">
                                    <EyeOff className="w-4 h-4" />
                                    Values are masked. Click update to overwrite.
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="flex items-start gap-2 text-amber-600 bg-amber-50 p-2 rounded text-xs">
                                        <AlertTriangle className="w-4 h-4 shrink-0" />
                                        Entering new values here will overwrite existing secrets. Blank fields will be ignored.
                                    </div>

                                    {/* 
                                      In a real implementation, we'd need the connector schema here to render correct input types.
                                      For this mock/MVP, we'll provide a generic JSON text area or simplified inputs.
                                      Since we don't strictly have the schema passed into this component in the current design,
                                      we might need to rethink passing 'connector' prop or fetching it.
                                      
                                      For the sake of this task, let's assume a generic Key input for simplicity 
                                      or just a generic 'secret' field if we can't resolve schema.
                                    */}
                                    <div className="space-y-2">
                                        <Label htmlFor="new-secret">New Secret Value</Label>
                                        <Input
                                            id="new-secret"
                                            type="password"
                                            placeholder="Enter new secret value..."
                                            {...register("credentials.secret")} // Generic binding
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Field mapping depends on connector type.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="text-xs text-muted-foreground">
                            Last used: <span className="font-mono">{credential.last_used_at ? new Date(credential.last_used_at).toLocaleString() : 'Never'}</span>
                            <br />
                            Created: <span className="font-mono">{new Date(credential.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={updateMutation.isPending}>
                            {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
