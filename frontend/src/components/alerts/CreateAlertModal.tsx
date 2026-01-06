import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
import { Switch } from "@/components/ui/switch";
import { alertService } from "@/lib/api/services/alert";
import { workflowService } from "@/lib/api/services/workflow";
import { toast } from "sonner";
import type { AlertEvent, AlertChannel } from "@/types";

const alertSchema = z.object({
    name: z.string().min(1, "Name is required"),
    event: z.enum(['run_failed', 'run_timeout', 'workflow_disabled', 'credential_expired'] as const),
    channel: z.enum(['email', 'slack', 'webhook'] as const),
    workflow_id: z.string().optional(),
    is_active: z.boolean(),
    config: z.object({
        // Email config
        recipients: z.string().optional(),
        // Slack config
        webhook_url: z.string().optional(),
        slack_channel: z.string().optional(),
        // Webhook config
        url: z.string().optional(),
    }).optional()
});

type FormValues = z.infer<typeof alertSchema>;

interface CreateAlertModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateAlertModal({ open, onOpenChange }: CreateAlertModalProps) {
    const queryClient = useQueryClient();

    const { register, control, handleSubmit, watch, reset, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(alertSchema),
        defaultValues: {
            name: "",
            event: "run_failed",
            channel: "email",
            workflow_id: undefined,
            is_active: true,
            config: {}
        }
    });

    const watchChannel = watch("channel");

    // Fetch workflows for optional scoping
    const { data: workflowsData } = useQuery({
        queryKey: ['workflows', 'list'],
        queryFn: () => workflowService.list({ page_size: 100 })
    });

    // Reset when modal closes/opens
    useEffect(() => {
        if (open) {
            reset({
                name: "",
                event: "run_failed",
                channel: "email",
                workflow_id: undefined,
                is_active: true,
                config: {}
            });
        }
    }, [open, reset]);

    const createMutation = useMutation({
        mutationFn: alertService.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['alerts'] });
            toast.success("Alert created successfully");
            onOpenChange(false);
        },
        onError: () => toast.error("Failed to create alert")
    });

    const onSubmit = (data: FormValues) => {
        // Build config based on channel
        const config: Record<string, unknown> = {};
        if (data.channel === 'email' && data.config?.recipients) {
            config.recipients = data.config.recipients.split(',').map(e => e.trim());
        }
        if (data.channel === 'slack') {
            if (data.config?.webhook_url) config.webhook_url = data.config.webhook_url;
            if (data.config?.slack_channel) config.channel = data.config.slack_channel;
        }
        if (data.channel === 'webhook' && data.config?.url) {
            config.url = data.config.url;
        }

        createMutation.mutate({
            name: data.name,
            event: data.event,
            channel: data.channel,
            workflow_id: data.workflow_id || undefined,
            is_active: data.is_active,
            config
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Create New Alert</DialogTitle>
                    <DialogDescription>
                        Configure when and how you want to be notified.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Alert Name</Label>
                        <Input
                            id="name"
                            placeholder="e.g. Critical Failures"
                            {...register("name")}
                        />
                        {errors.name && (
                            <p className="text-xs text-destructive">{errors.name.message}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Event Type</Label>
                            <Controller
                                name="event"
                                control={control}
                                render={({ field }) => (
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="run_failed">Run Failed</SelectItem>
                                            <SelectItem value="run_timeout">Run Timeout</SelectItem>
                                            <SelectItem value="workflow_disabled">Workflow Disabled</SelectItem>
                                            <SelectItem value="credential_expired">Credential Expired</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Channel</Label>
                            <Controller
                                name="channel"
                                control={control}
                                render={({ field }) => (
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="email">Email</SelectItem>
                                            <SelectItem value="slack">Slack</SelectItem>
                                            <SelectItem value="webhook">Webhook</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Scope (Optional)</Label>
                        <Controller
                            name="workflow_id"
                            control={control}
                            render={({ field }) => (
                                <Select value={field.value || "all"} onValueChange={(v) => field.onChange(v === 'all' ? undefined : v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Workflows" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Workflows</SelectItem>
                                        {workflowsData?.results.map(w => (
                                            <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        <p className="text-xs text-muted-foreground">
                            Leave empty to receive alerts for all workflows.
                        </p>
                    </div>

                    {/* Dynamic channel config */}
                    <div className="space-y-4 border-t pt-4">
                        <Label className="text-muted-foreground">Channel Configuration</Label>

                        {watchChannel === 'email' && (
                            <div className="space-y-2">
                                <Label htmlFor="recipients">Recipients</Label>
                                <Input
                                    id="recipients"
                                    placeholder="email1@example.com, email2@example.com"
                                    {...register("config.recipients")}
                                />
                                <p className="text-xs text-muted-foreground">Comma-separated email addresses.</p>
                            </div>
                        )}

                        {watchChannel === 'slack' && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="slack_webhook">Slack Webhook URL</Label>
                                    <Input
                                        id="slack_webhook"
                                        placeholder="https://hooks.slack.com/services/..."
                                        {...register("config.webhook_url")}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="slack_channel">Channel (Optional)</Label>
                                    <Input
                                        id="slack_channel"
                                        placeholder="#alerts"
                                        {...register("config.slack_channel")}
                                    />
                                </div>
                            </>
                        )}

                        {watchChannel === 'webhook' && (
                            <div className="space-y-2">
                                <Label htmlFor="webhook_url">Webhook URL</Label>
                                <Input
                                    id="webhook_url"
                                    placeholder="https://your-server.com/webhook"
                                    {...register("config.url")}
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                            <Label>Active</Label>
                            <div className="text-sm text-muted-foreground">
                                Enable this alert immediately.
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

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending}>
                            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Create Alert
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
