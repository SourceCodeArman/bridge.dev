import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { connectorService } from "@/lib/api/services/connector";
import { credentialService } from "@/lib/api/services/credential";
import type { Connector } from "@/types/models";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import DynamicFieldRenderer from '../workflow/fields/DynamicFieldRenderer';
import OAuthButton from "../workflow/fields/OAuthButton";
import HeaderBuilder from './HeaderBuilder';

// Component to display and copy callback URL
function CallbackUrlDisplay({ service }: { service: string }) {
    const [copied, setCopied] = useState(false);
    const callbackUrl = `${window.location.protocol}//${window.location.host}/api/v1/core/integrations/${service}/callback/`;

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
            <div className="flex items-center gap-2 p-2 bg-background rounded-md border">
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
    initialConnectorId?: string;
    authType?: string;
}

const mcpAuthFields: Record<string, string[]> = {
    'bearer': ['bearer_token', 'allowed_domains_mode', 'allowed_domains'],
    'header': ['headers_json', 'allowed_domains_mode', 'allowed_domains'],
    'mcp-oauth2': ['client_id', 'client_secret', 'authorization_url', 'token_url', 'scope', 'oauth_redirect_url', 'server_url', 'allowed_domains_mode', 'allowed_domains', 'access_token', 'refresh_token'],
    'multiple-headers': ['headers_json', 'allowed_domains_mode', 'allowed_domains'],
};

export function CreateCredentialModal({ open, onOpenChange, initialConnectorId, authType: requestedAuthType }: CreateCredentialModalProps) {
    const [selectedConnectorId, setSelectedConnectorId] = useState<string>("");
    const queryClient = useQueryClient();

    // Fetch all connectors from API
    const { data: connectorsData, isLoading: connectorsLoading } = useQuery({
        queryKey: ['connectors'],
        queryFn: connectorService.list,
        staleTime: 5 * 60 * 1000,
    });

    // Get connectors array from paginated response
    const connectors = connectorsData?.results || [];

    // Filter connectors that have auth_config (can create credentials for them)
    const credentialConnectors = useMemo(() => {
        return connectors.filter((c: Connector) =>
            c.manifest?.auth_config?.type &&
            (c.manifest?.auth_config?.fields?.length ?? 0) > 0
        );
    }, [connectors]);

    // Get selected connector
    const selectedConnector = credentialConnectors.find((c: Connector) => c.slug === selectedConnectorId);
    console.log(selectedConnector);
    const authConfig = selectedConnector?.manifest?.auth_config;
    const connectorAuthType = authConfig?.type;
    const authFields = authConfig?.fields || [];

    // Filter visible fields based on auth type (for MCP) and hidden status
    const visibleFields = useMemo(() => {
        let fields = authFields.filter((f: any) => !f.hidden);

        if (selectedConnector?.slug === 'mcp-client-tool' && requestedAuthType) {
            const allowedFieldNames = mcpAuthFields[requestedAuthType];
            if (allowedFieldNames) {
                fields = fields.filter((f: any) => allowedFieldNames.includes(f.name));
            }
        }
        return fields;
    }, [authFields, selectedConnector, requestedAuthType]);

    // Check if this is an OAuth connector
    // Check if this is an OAuth connector
    const isOAuthConnector = connectorAuthType === 'oauth';
    const isMcpOAuth = selectedConnector?.slug === 'mcp-client-tool' && requestedAuthType === 'mcp-oauth2';

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
            setSelectedConnectorId(initialConnectorId || "");
        }
    }, [open, reset, initialConnectorId]);

    // Keep form connector_id in sync with local state (handling initial prop & selection)
    useEffect(() => {
        if (selectedConnector) {
            setValue("connector_id", String(selectedConnector.slug), { shouldValidate: true, shouldDirty: true });
            // Only autoset name if generic
            setValue("name", `${selectedConnector.display_name} Credential`);
            setValue("credentials", {});
        }
    }, [selectedConnector, setValue]);



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
            type: requestedAuthType || connectorAuthType || 'api_key'
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl h-[calc(100vh-3rem)] flex flex-col p-0 gap-0 [&>button]:hidden">
                <div className="p-6 pb-2 border-b">
                    <DialogHeader className="flex flex-row items-center justify-between gap-2">
                        <div className="flex flex-col items-start justify-between gap-2">
                            <DialogTitle>Create New Credential</DialogTitle>
                            <DialogDescription>
                                Connect to an app or service.
                            </DialogDescription>
                        </div>
                        <DialogTrigger>
                            <X className="w-6 h-6" />
                        </DialogTrigger>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 px-6 py-2">
                    <form id="create-credential-form" onSubmit={handleSubmit(onSubmit, (errors) => console.error("Form validation errors:", errors))} className="space-y-4">
                        <input type="hidden" {...register("connector_id")} />
                        <div className="space-y-2 flex flex-col items-start justify-between">
                            <Label>App or Service</Label>
                            <Select
                                value={selectedConnectorId}
                                onValueChange={(slug) => {
                                    setSelectedConnectorId(slug);
                                    const connector = credentialConnectors.find(c => c.slug === slug);
                                    if (connector) {
                                        setValue("connector_id", String(connector.slug), { shouldValidate: true, shouldDirty: true });
                                        setValue("name", `${connector.display_name} Credential`, { shouldValidate: true });
                                        setValue("credentials", {});
                                    }
                                }}
                                disabled={connectorsLoading}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={
                                        connectorsLoading
                                            ? "Loading services..."
                                            : "Select an app or service..."
                                    } />
                                </SelectTrigger>
                                <SelectContent>
                                    {credentialConnectors.map((connector: Connector) => (
                                        <SelectItem key={connector.slug} value={connector.slug || ''}>
                                            <div className="flex flex-col items-start">
                                                <span>{connector.display_name}</span>
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

                        {/* Dynamic Auth Fields */}
                        {selectedConnector && visibleFields.length > 0 && (
                            <div className="space-y-4 border-t pt-4">
                                <Label className="text-muted-foreground">Authentication Details</Label>
                                {visibleFields.map((field: any) => {
                                    // Conditional visibility for allowed_domains
                                    if (field.name === 'allowed_domains' && watchedCredentials?.allowed_domains_mode !== 'specific') {
                                        return null;
                                    }

                                    if (field.name === 'headers_json') {
                                        return (
                                            <div key={field.name} className="space-y-2">
                                                <Label>Headers</Label>
                                                <Controller
                                                    name="credentials.headers_json"
                                                    control={control}
                                                    rules={{ required: field.required }}
                                                    render={({ field: { value, onChange } }) => (
                                                        <HeaderBuilder value={value} onChange={onChange} />
                                                    )}
                                                />
                                            </div>
                                        );
                                    }

                                    if (field.name === 'oauth_redirect_url') {
                                        return (
                                            <div key={field.name} className="pt-2">
                                                <CallbackUrlDisplay service={selectedConnector?.slug || ''} />
                                            </div>
                                        );
                                    }

                                    return (
                                        <Controller
                                            key={field.name}
                                            name={`credentials.${field.name}`}
                                            control={control}
                                            rules={{ required: field.required }}
                                            render={({ field: { onChange, value }, fieldState: { error } }) => (
                                                <DynamicFieldRenderer
                                                    fieldName={field.name}
                                                    schema={field}
                                                    value={value}
                                                    onChange={onChange}
                                                    required={field.required}
                                                    error={error?.message}
                                                    allValues={watchedCredentials}
                                                />
                                            )}
                                        />
                                    );
                                })}

                                {/* OAuth Flow Section - only for OAuth connectors */}
                                {isOAuthConnector && (
                                    <div className="pt-2 space-y-3">
                                        <CallbackUrlDisplay service={selectedConnector?.slug || ''} />

                                        <OAuthButton
                                            clientId={watchedCredentials?.client_id || ''}
                                            clientSecret={watchedCredentials?.client_secret || ''}
                                            redirectUri={`${window.location.protocol}//${window.location.host}/api/v1/core/integrations/google/callback/`}
                                            connectorType={selectedConnectorId}
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
                                )}

                                {isMcpOAuth && (
                                    <div className="pt-2 space-y-3">
                                        <OAuthButton
                                            clientId={watchedCredentials?.client_id || ''}
                                            clientSecret={watchedCredentials?.client_secret || ''}
                                            redirectUri={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/core/integrations/mcp-client-tool/callback/`}
                                            mode="generic"
                                            authorizationUrl={watchedCredentials?.authorization_url}
                                            tokenUrl={watchedCredentials?.token_url}
                                            scope={watchedCredentials?.scope}
                                            onSuccess={(tokens: any) => {
                                                if (tokens.access_token) setValue('credentials.access_token', tokens.access_token, { shouldValidate: true, shouldDirty: true });
                                                if (tokens.refresh_token) setValue('credentials.refresh_token', tokens.refresh_token, { shouldValidate: true, shouldDirty: true });
                                            }}
                                            disabled={!watchedCredentials?.client_id || !watchedCredentials?.client_secret || !watchedCredentials?.authorization_url || !watchedCredentials?.token_url}
                                            label="Connect Account"
                                        />
                                        <input type="hidden" {...register("credentials.access_token")} />
                                        <input type="hidden" {...register("credentials.refresh_token")} />
                                    </div>
                                )}
                            </div>
                        )}

                    </form>
                </div>

                <div className="py-4 px-6 border-t mt-auto">
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" form="create-credential-form" disabled={!selectedConnectorId || createMutation.isPending}>
                            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Create Credential
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog >
    );
}
