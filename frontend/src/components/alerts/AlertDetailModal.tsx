import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Loader2, Play, Trash2, AlertTriangle } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { alertService } from "@/lib/api/services/alert";
import { AlertEventBadge } from "./AlertEventBadge";
import { AlertChannelIcon } from "./AlertChannelIcon";
import { toast } from "sonner";
import type { Alert } from "@/types";

interface AlertDetailModalProps {
    alert: Alert | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const updateSchema = z.object({
    name: z.string().min(1, "Name is required"),
    event: z.enum(['run_failed', 'run_timeout', 'workflow_disabled', 'credential_expired'] as const),
    channel: z.enum(['email', 'slack', 'webhook'] as const),
    is_active: z.boolean(),
});

type FormValues = z.infer<typeof updateSchema>;

export function AlertDetailModal({ alert, open, onOpenChange }: AlertDetailModalProps) {
    const queryClient = useQueryClient();

    const { register, control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(updateSchema),
        defaultValues: {
            name: "",
            event: "run_failed",
            channel: "email",
            is_active: true
        }
    });

    useEffect(() => {
        if (alert && open) {
            reset({
                name: alert.name,
                event: alert.event,
                channel: alert.channel,
                is_active: alert.is_active
            });
        }
    }, [alert, open, reset]);

    const updateMutation = useMutation({
        mutationFn: (data: FormValues) => {
            if (!alert) return Promise.reject("No alert selected");
            return alertService.update(alert.id, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['alerts'] });
            toast.success("Alert updated");
            onOpenChange(false);
        },
        onError: () => toast.error("Failed to update alert")
    });

    const deleteMutation = useMutation({
        mutationFn: () => {
            if (!alert) return Promise.reject("No alert selected");
            return alertService.delete(alert.id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['alerts'] });
            toast.success("Alert deleted");
            onOpenChange(false);
        },
        onError: () => toast.error("Failed to delete alert")
    });

    const testMutation = useMutation({
        mutationFn: () => {
            if (!alert) return Promise.reject("No alert selected");
            return alertService.test(alert.id);
        },
        onSuccess: (data) => {
            if (data.success) {
                toast.success("Test notification sent");
            } else {
                toast.error(data.message || "Test failed");
            }
        },
        onError: () => toast.error("Failed to send test")
    });

    const onSubmit = (data: FormValues) => {
        updateMutation.mutate(data);
    };

    const handleDelete = () => {
        if (confirm("Are you sure you want to delete this alert?")) {
            deleteMutation.mutate();
        }
    };

    if (!alert) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Alert Details</DialogTitle>
                    <DialogDescription>
                        View and manage alert settings.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Alert Name</Label>
                        <Input
                            id="name"
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

                    <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                            <Label>Active</Label>
                            <div className="text-sm text-muted-foreground">
                                Toggle alert on/off.
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

                    <Separator />

                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <span>Last Triggered</span>
                        <span className="font-mono">
                            {alert.last_triggered_at
                                ? format(new Date(alert.last_triggered_at), 'MMM d, yyyy h:mm a')
                                : 'Never'}
                        </span>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={() => testMutation.mutate()}
                            disabled={testMutation.isPending}
                        >
                            {testMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                <Play className="w-4 h-4 mr-2" />
                            )}
                            Test Alert
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Trash2 className="w-4 h-4" />
                            )}
                        </Button>
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
