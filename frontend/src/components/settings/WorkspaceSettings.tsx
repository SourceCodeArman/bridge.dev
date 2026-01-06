import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { toast } from "sonner";
// Assuming workspace context or service exists, mocking for UI structure
// In a real app we'd fetch the current workspace

const workspaceSchema = z.object({
    name: z.string().min(3, "Name must be at least 3 characters"),
    slug: z.string().min(3, "Slug must be at least 3 characters").regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and dashes"),
    description: z.string().optional(),
});

type WorkspaceFormValues = z.infer<typeof workspaceSchema>;

export function WorkspaceSettings() {
    // Mock data/hooks - replace with actual API integration
    const isLoading = false;
    const isSaving = false;

    const form = useForm<WorkspaceFormValues>({
        resolver: zodResolver(workspaceSchema),
        defaultValues: {
            name: "My Workspace", // Placeholder
            slug: "my-workspace",
            description: "Default workspace for team collaboration"
        }
    });

    const onSubmit = (data: WorkspaceFormValues) => {
        toast.promise(new Promise(resolve => setTimeout(resolve, 1000)), {
            loading: 'Updating workspace...',
            success: 'Workspace updated successfully',
            error: 'Failed to update workspace'
        });
        console.log("Update workspace:", data);
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Workspace General Settings</CardTitle>
                    <CardDescription>
                        Manage your workspace identifier and display information.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="ws-name">Workspace Name</Label>
                            <Input
                                id="ws-name"
                                {...form.register("name")}
                            />
                            {form.formState.errors.name && (
                                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="ws-slug">Workspace URL Slug</Label>
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground text-sm">bridge.dev/ws/</span>
                                <Input
                                    id="ws-slug"
                                    {...form.register("slug")}
                                    className="font-mono"
                                />
                            </div>
                            {form.formState.errors.slug && (
                                <p className="text-xs text-destructive">{form.formState.errors.slug.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="ws-desc">Description</Label>
                            <Textarea
                                id="ws-desc"
                                {...form.register("description")}
                                className="min-h-[100px]"
                            />
                        </div>

                        <div className="flex justify-end">
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
