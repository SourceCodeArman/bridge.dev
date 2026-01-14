import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Copy, Check } from "lucide-react";
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
import type { AuthField } from "@/types";
import OAuthButton from "../workflow/fields/OAuthButton";

// Google services with service-specific scopes
const GOOGLE_SERVICES = [
    { id: 'google-sheets', name: 'Google Sheets', description: 'Spreadsheets and data' },
    { id: 'google-calendar', name: 'Google Calendar', description: 'Events and scheduling' },
    { id: 'gmail', name: 'Gmail', description: 'Email sending and reading' },
];


// OAuth auth fields for Google services
const GOOGLE_AUTH_FIELDS: AuthField[] = [
    { name: 'client_id', type: 'string', required: true, label: 'Client ID', description: 'OAuth Client ID from Google Cloud Console' },
    { name: 'client_secret', type: 'password', required: true, label: 'Client Secret', description: 'OAuth Client Secret from Google Cloud Console' },
];

// Component to display and copy callback URL
function CallbackUrlDisplay() {
    const [copied, setCopied] = useState(false);
    const callbackUrl = `${window.location.protocol}//${window.location.host}/api/v1/core/integrations/google/callback/`;

    const handleCopy = async () => {
        await navigator.clipboard.writeText(callbackUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
                Authorized redirect URI (add this to Google Cloud Console)
            </Label>
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md border">
                <code className="flex-1 text-xs break-all select-all">
                    {callbackUrl}
                </code>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0"
                    onClick={handleCopy}
                >
                    {copied ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                        <Copy className="h-3.5 w-3.5" />
                    )}
                </Button>
            </div>
        </div>
    );
}

interface CreateCredentialModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateCredentialModal({ open, onOpenChange }: CreateCredentialModalProps) {
    const [selectedServiceId, setSelectedServiceId] = useState<string>("");
    const queryClient = useQueryClient();

    const selectedService = GOOGLE_SERVICES.find(s => s.id === selectedServiceId);

    // Dynamic schema generation
    const formSchema = z.object({
        name: z.string().min(1, "Name is required"),
        connector_id: z.string().min(1, "Service is required"),
        credentials: z.record(z.string(), z.any())
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

    // Watch credentials to get client_id/secret for OAuth button
    const watchedCredentials = useWatch({
        control,
        name: "credentials",
    });

    // Reset when modal closes/opens
    useEffect(() => {
        if (open) {
            reset({ name: "", connector_id: "", credentials: {} });
            setSelectedServiceId("");
        }
    }, [open, reset]);

    // Update connector_id in form when local state changes
    useEffect(() => {
        if (selectedServiceId) {
            setValue("connector_id", selectedServiceId);
            const service = GOOGLE_SERVICES.find(s => s.id === selectedServiceId);
            if (service) {
                setValue("name", `${service.name} Credential`);
            }
        }
    }, [selectedServiceId, setValue]);

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
        console.log("Submitting form data:", data);
        createMutation.mutate({
            ...data,
            type: 'oauth'
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create New Credential</DialogTitle>
                    <DialogDescription>
                        Connect to an app or service.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit, (errors) => console.error("Form validation errors:", errors))} className="space-y-4">
                    <div className="space-y-2">
                        <Label>App or Service</Label>
                        <Select
                            value={selectedServiceId}
                            onValueChange={setSelectedServiceId}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select an app or service..." />
                            </SelectTrigger>
                            <SelectContent>
                                {GOOGLE_SERVICES.map((service) => (
                                    <SelectItem key={service.id} value={service.id}>
                                        <div className="flex flex-col items-start">
                                            <span>{service.name}</span>
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
                            placeholder="e.g. My Google Sheets"
                            {...register("name")}
                        />
                        {errors.name && (
                            <p className="text-xs text-destructive">{errors.name.message}</p>
                        )}
                    </div>

                    {selectedService && (
                        <div className="space-y-4 border-t pt-4">
                            <Label className="text-muted-foreground">Authentication Details</Label>
                            {GOOGLE_AUTH_FIELDS.map((field) => (
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
                            ))}

                            {/* OAuth Flow Section */}
                            <div className="pt-2 space-y-3">
                                <CallbackUrlDisplay />

                                <OAuthButton
                                    clientId={watchedCredentials?.client_id || ''}
                                    clientSecret={watchedCredentials?.client_secret || ''}
                                    redirectUri={`${window.location.protocol}//${window.location.host}/api/v1/core/integrations/google/callback/`}
                                    connectorType={selectedServiceId}
                                    onSuccess={(tokens) => {
                                        if (tokens.access_token) setValue('credentials.access_token', tokens.access_token, { shouldValidate: true, shouldDirty: true });
                                        if (tokens.refresh_token) setValue('credentials.refresh_token', tokens.refresh_token, { shouldValidate: true, shouldDirty: true });
                                    }}
                                    disabled={!watchedCredentials?.client_id || !watchedCredentials?.client_secret}
                                    label="Connect Account"
                                />
                                {/* Hidden fields for tokens */}
                                <input type="hidden" {...register("credentials.access_token")} />
                                <input type="hidden" {...register("credentials.refresh_token")} />
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!selectedServiceId || createMutation.isPending}>
                            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Create Credential
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
