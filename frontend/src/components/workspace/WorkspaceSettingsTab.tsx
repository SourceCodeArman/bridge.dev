import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { MOCK_WORKSPACE } from "@/lib/mockData";
import { toast } from "sonner";

const workspaceSchema = z.object({
    name: z.string().min(2, "Workspace name must be at least 2 characters"),
});

type WorkspaceFormValues = z.infer<typeof workspaceSchema>;

export function WorkspaceSettingsTab() {
    const [isSaving, setIsSaving] = useState(false);

    const form = useForm<WorkspaceFormValues>({
        resolver: zodResolver(workspaceSchema),
        defaultValues: {
            name: MOCK_WORKSPACE.name,
        },
    });

    const onSubmit = async (data: WorkspaceFormValues) => {
        setIsSaving(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        toast.success("Workspace settings updated");
        console.log("Update workspace:", data);
        setIsSaving(false);
    };

    const handleLeaveWorkspace = () => {
        toast.success("You have left the workspace");
        console.log("Leave workspace");
    };

    const handleDeleteWorkspace = () => {
        toast.success("Workspace deleted");
        console.log("Delete workspace");
    };

    return (
        <div className="space-y-6">
            {/* General Settings */}
            <Card>
                <CardHeader>
                    <CardTitle>General Settings</CardTitle>
                    <CardDescription>
                        Update your workspace name and basic information.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Workspace Name</Label>
                            <Input
                                id="name"
                                {...form.register("name")}
                                className="max-w-md"
                            />
                            {form.formState.errors.name && (
                                <p className="text-xs text-destructive">
                                    {form.formState.errors.name.message}
                                </p>
                            )}
                        </div>

                        <div className="flex justify-end">
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive/50">
                <CardHeader>
                    <CardTitle className="text-destructive flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Danger Zone
                    </CardTitle>
                    <CardDescription>
                        Irreversible and destructive actions.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <p className="font-medium">Leave Workspace</p>
                            <p className="text-sm text-muted-foreground">
                                Remove yourself from this workspace.
                            </p>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline">Leave</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Leave workspace?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        You will lose access to all workflows and data in this workspace.
                                        You can be invited back by an admin.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleLeaveWorkspace}>
                                        Leave Workspace
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between p-4 border border-destructive/30 rounded-lg bg-destructive/5">
                        <div>
                            <p className="font-medium">Delete Workspace</p>
                            <p className="text-sm text-muted-foreground">
                                Permanently delete this workspace and all its data.
                            </p>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive">Delete</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. All workflows, runs, credentials,
                                        and team member access will be permanently deleted.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={handleDeleteWorkspace}
                                    >
                                        Delete Workspace
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
