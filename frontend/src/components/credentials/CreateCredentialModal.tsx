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
        c.manifest?.auth?.type !== 'none' || c.manifest?.auth?.fields?.length
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
        createMutation.mutate(data);
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

                    {selectedConnector && selectedConnector.manifest.auth.fields && (
                        <div className="space-y-4 border-t pt-4">
                            <Label className="text-muted-foreground">Authentication Details</Label>
                            {selectedConnector.manifest.auth.fields.map((field: AuthField) => (
                                <div key={field.name} className="space-y-2">
                                    <Label htmlFor={`creds-${field.name}`}>
                                        {field.label} {field.required && <span className="text-destructive">*</span>}
                                    </Label>
                                    <Controller
                                        name={`credentials.${field.name}`}
                                        control={control}
                                        rules={{ required: field.required ? `${field.label} is required` : false }}
                                        render={({ field: { onChange, value } }) => (
                                            <Input
                                                id={`creds-${field.name}`}
                                                type={field.type === 'password' ? 'password' : 'text'}
                                                value={value as string || ''}
                                                onChange={onChange}
                                                placeholder={field.label}
                                            />
                                        )}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {selectedConnector && !selectedConnector.manifest.auth?.fields?.length && (
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
