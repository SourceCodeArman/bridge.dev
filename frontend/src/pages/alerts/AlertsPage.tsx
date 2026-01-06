import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
    Plus,
    MoreHorizontal,
    Bell,
    Pencil,
    Trash2,
    Play,
    History
} from "lucide-react";
import { alertService } from "@/lib/api/services/alert";
import { AlertEventBadge } from "@/components/alerts/AlertEventBadge";
import { AlertChannelIcon } from "@/components/alerts/AlertChannelIcon";
import { CreateAlertModal } from "@/components/alerts/CreateAlertModal";
import { AlertDetailModal } from "@/components/alerts/AlertDetailModal";
import type { Alert } from "@/types";
import { toast } from "sonner";

export default function AlertsPage() {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const queryClient = useQueryClient();

    // Fetch alerts
    const { data: alertsData, isLoading } = useQuery({
        queryKey: ['alerts'],
        queryFn: () => alertService.list()
    });

    const deleteMutation = useMutation({
        mutationFn: alertService.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['alerts'] });
            toast.success("Alert deleted");
        },
        onError: () => toast.error("Failed to delete alert")
    });

    const testMutation = useMutation({
        mutationFn: alertService.test,
        onSuccess: (data) => {
            if (data.success) {
                toast.success("Test notification sent successfully");
            } else {
                toast.error(data.message || "Test failed");
            }
        },
        onError: () => toast.error("Failed to send test notification")
    });

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this alert? This action cannot be undone.")) {
            deleteMutation.mutate(id);
        }
    };

    const handleTest = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        testMutation.mutate(id);
    };

    const handleEdit = (alert: Alert, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedAlert(alert);
        setIsDetailOpen(true);
    };

    const alerts = alertsData?.results || [];

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-6">
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight">Alerts & Notifications</h1>
                        <p className="text-muted-foreground">
                            Configure alerts for workflow failures, timeouts, and other events.
                        </p>
                    </div>
                    <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                        <Plus className="w-4 h-4" />
                        Create Alert
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="rules" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="rules" className="gap-2">
                        <Bell className="w-4 h-4" />
                        Alert Rules
                    </TabsTrigger>
                    <TabsTrigger value="history" className="gap-2">
                        <History className="w-4 h-4" />
                        History
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="rules">
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-[250px]">Name</TableHead>
                                    <TableHead>Event</TableHead>
                                    <TableHead>Channel</TableHead>
                                    <TableHead>Workflow</TableHead>
                                    <TableHead>Active</TableHead>
                                    <TableHead>Last Triggered</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><div className="h-5 w-32 bg-muted animate-pulse rounded" /></TableCell>
                                            <TableCell><div className="h-5 w-24 bg-muted animate-pulse rounded" /></TableCell>
                                            <TableCell><div className="h-5 w-16 bg-muted animate-pulse rounded" /></TableCell>
                                            <TableCell><div className="h-5 w-24 bg-muted animate-pulse rounded" /></TableCell>
                                            <TableCell><div className="h-5 w-12 bg-muted animate-pulse rounded" /></TableCell>
                                            <TableCell><div className="h-5 w-24 bg-muted animate-pulse rounded" /></TableCell>
                                            <TableCell><div className="h-8 w-8 ml-auto bg-muted animate-pulse rounded" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : alerts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                            No alerts configured. Create one to get notified when workflows fail.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    alerts.map((alert) => (
                                        <TableRow
                                            key={alert.id}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => {
                                                setSelectedAlert(alert);
                                                setIsDetailOpen(true);
                                            }}
                                        >
                                            <TableCell className="font-medium flex items-center gap-2">
                                                <div className="p-1.5 bg-muted rounded-md">
                                                    <Bell className="w-4 h-4 text-muted-foreground" />
                                                </div>
                                                {alert.name}
                                            </TableCell>
                                            <TableCell>
                                                <AlertEventBadge event={alert.event} />
                                            </TableCell>
                                            <TableCell>
                                                <AlertChannelIcon channel={alert.channel} showLabel />
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {alert.workflow_id ? 'Scoped' : 'All Workflows'}
                                            </TableCell>
                                            <TableCell>
                                                <Switch
                                                    checked={alert.is_active}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {alert.last_triggered_at
                                                    ? format(new Date(alert.last_triggered_at), 'MMM d, p')
                                                    : '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={(e) => handleEdit(alert, e)}>
                                                            <Pencil className="w-4 h-4 mr-2" />
                                                            Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={(e) => handleTest(alert.id, e)}>
                                                            <Play className="w-4 h-4 mr-2" />
                                                            Test
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive"
                                                            onClick={(e) => handleDelete(alert.id, e)}
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-2" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <CardTitle>Alert History</CardTitle>
                            <CardDescription>
                                View past alert notifications and their delivery status.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="py-12 text-center text-muted-foreground">
                            Alert history coming soon. This will show past triggered alerts.
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <CreateAlertModal
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
            />

            <AlertDetailModal
                alert={selectedAlert}
                open={isDetailOpen}
                onOpenChange={setIsDetailOpen}
            />
        </div>
    );
}
