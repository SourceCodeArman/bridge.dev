import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { credentialService } from "@/lib/api/services/credential";
import { toast } from "sonner";
import type { Connector, AuthField } from "@/types";
import OAuthButton from "../workflow/fields/OAuthButton";

interface CreateCredentialModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    connectors: Connector[];
}

export function CreateCredentialModal({ open, onOpenChange, connectors }: CreateCredentialModalProps) {
    const [selectedConnectorId, setSelectedConnectorId] = useState<string>("");
    const queryClient = useQueryClient();

    const selectedConnector = connectors.find(c => c.id === selectedConnectorId);
    // Filter connectors that actually require auth or are custom
    const authConnectors = connectors.filter(c =>
        c.manifest?.auth_config?.type !== 'none' || c.manifest?.auth_config?.fields?.length
    );

    // Dynamic schema generation based on selected connector
    // We start with a base schema and refine it
    const formSchema = z.object({
        name: z.string().min(1, "Name is required"),
        connector_id: z.string().min(1, "Connector is required"),
        // Dynamic fields will be validated manually or loosely typed here for simplicity
        // In a strictly typed system we'd generate Zod schema on the fly
        credentials: z.record(z.string(), z.string())
    });

    type FormValues = z.infer<typeof formSchema>;

    const { register, control, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            connector_id: "",
            credentials: {}
        }
    });

    // Reset when modal closes/opens
    useEffect(() => {
        if (open) {
            reset({ name: "", connector_id: "", credentials: {} });
            setSelectedConnectorId("");
        }
    }, [open, reset]);

    // Update connector_id in form when local state changes
    useEffect(() => {
        if (selectedConnectorId) {
            setValue("connector_id", selectedConnectorId);
            // Also try to preset name
            const connector = connectors.find(c => c.id === selectedConnectorId);
            if (connector) {
                setValue("name", `${connector.display_name} Credential`);
            }
        }
    }, [selectedConnectorId, setValue, connectors]);

    const createMutation = useMutation({
        mutationFn: credentialService.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['credentials'] });
            toast.success("Credential created successfully");
            onOpenChange(false);
        },
        onError: () => toast.error("Failed to create credential")
    });

    const onSubmit = (data: FormValues) => {
        createMutation.mutate({
            ...data,
            type: selectedConnector?.manifest?.auth_config?.type
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create New Credential</DialogTitle>
                    <DialogDescription>
                        Configure authentication for a connector.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Connector</Label>
                        <Select
                            value={selectedConnectorId}
                            onValueChange={setSelectedConnectorId}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a connector..." />
                            </SelectTrigger>
                            <SelectContent>
                                {authConnectors.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                        <div className="flex items-center gap-2">
                                            {/* Icon could go here */}
                                            {c.display_name}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.connector_id && (
                            <p className="text-xs text-destructive">{errors.connector_id.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="name">Credential Name</Label>
                        <Input
                            id="name"
                            placeholder="e.g. Production API Key"
                            {...register("name")}
                        />
                        {errors.name && (
                            <p className="text-xs text-destructive">{errors.name.message}</p>
                        )}
                    </div>

                    {selectedConnector && selectedConnector.manifest.auth_config.fields && (
                        <div className="space-y-4 border-t pt-4">
                            <Label className="text-muted-foreground">Authentication Details</Label>
                            {selectedConnector.manifest.auth_config.fields.map((field: AuthField) => {
                                // Skip hidden fields from manual input, we'll handle them via state/OAuth
                                if (field.hidden === true) return null;

                                return (
                                    <div key={field.name} className="space-y-2">
                                        <Label htmlFor={`creds-${field.name}`}>
                                            {field.label || field.name} {field.required && <span className="text-destructive">*</span>}
                                        </Label>
                                        <Controller
                                            name={`credentials.${field.name}`}
                                            control={control}
                                            rules={{ required: field.required ? `${field.label || field.name} is required` : false }}
                                            render={({ field: { onChange, value } }) => (
                                                <Input
                                                    id={`creds-${field.name}`}
                                                    type={field.type === 'password' ? 'password' : 'text'}
                                                    value={value as string || ''}
                                                    onChange={onChange}
                                                    placeholder={field.description || field.label || field.name}
                                                />
                                            )}
                                        />
                                    </div>
                                )
                            })}

                            {/* OAuth Flow Section */}
                            {selectedConnector.manifest.auth_config.type === 'oauth' && (
                                <div className="pt-2">
                                    <OAuthButton
                                        clientId={control._formValues.credentials?.client_id || ''}
                                        clientSecret={control._formValues.credentials?.client_secret || ''}
                                        redirectUri={`${window.location.protocol}//${window.location.host}/api/v1/core/integrations/google/callback/`} // This needs to match backend expectation or just use a dummy one if backend handles it dynamically
                                        // Actually, backend now expects us to send redirect_uri so it can match.
                                        // For localhost dev: http://localhost:5173 (or whatever frontend origin is)
                                        // But wait, the popup callback sends a message to window.opener.
                                        // The redirect_uri passed to Google must match what is configured in Google Console.
                                        // Let's assume standard localhost:5173 for now or window.location.origin
                                        // The backend doesn't enforce a specific one, but Google does.
                                        // We will pass window.location.origin to the hook, assuming the user added that to Google Console.
                                        onSuccess={(tokens) => {
                                            if (tokens.access_token) setValue('credentials.access_token', tokens.access_token);
                                            if (tokens.refresh_token) setValue('credentials.refresh_token', tokens.refresh_token);
                                        }}
                                        disabled={!control._formValues.credentials?.client_id || !control._formValues.credentials?.client_secret}
                                        label="Connect Account"
                                    />
                                    {/* Hidden fields for tokens to ensure they are submitted */}
                                    <Controller name="credentials.access_token" control={control} render={() => <input type="hidden" />} />
                                    <Controller name="credentials.refresh_token" control={control} render={() => <input type="hidden" />} />
                                </div>
                            )}

                        </div>
                    )}

                    {selectedConnector && !selectedConnector.manifest.auth_config?.fields?.length && (
                        <div className="flex items-center justify-center p-4 bg-muted/50 rounded-md text-sm text-muted-foreground">
                            This connector does not require any additional configuration.
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!selectedConnectorId || createMutation.isPending}>
                            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Create Credential
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
