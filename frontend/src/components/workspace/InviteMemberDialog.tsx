import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
import { toast } from "sonner";
import type { WorkspaceRole } from "@/types";

const inviteSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    role: z.enum(["admin", "member", "viewer"] as const),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface InviteMemberDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function InviteMemberDialog({ open, onOpenChange }: InviteMemberDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<InviteFormValues>({
        resolver: zodResolver(inviteSchema),
        defaultValues: {
            email: "",
            role: "member",
        },
    });

    const onSubmit = async (data: InviteFormValues) => {
        setIsSubmitting(true);

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));

        toast.success(`Invitation sent to ${data.email}`);
        console.log("Invite member:", data);

        form.reset();
        setIsSubmitting(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                    <DialogDescription>
                        Send an invitation email to add a new member to your workspace.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email address</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="colleague@company.com"
                            {...form.register("email")}
                        />
                        {form.formState.errors.email && (
                            <p className="text-xs text-destructive">
                                {form.formState.errors.email.message}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select
                            value={form.watch("role")}
                            onValueChange={(value: WorkspaceRole) => form.setValue("role", value as any)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent className="p-0!">
                                <SelectItem value="admin" className="w-full h-full rounded-b-none! rounded-t-sm!">
                                    <div className="flex flex-col items-start">
                                        <span className="font-medium">Admin</span>
                                        <span className="text-xs text-muted-foreground">
                                            Can manage members and settings
                                        </span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="member" className="w-full h-full rounded-none!">
                                    <div className="flex flex-col items-start">
                                        <span className="font-medium">Member</span>
                                        <span className="text-xs text-muted-foreground">
                                            Can create and edit workflows
                                        </span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="viewer" className="w-full h-full rounded-b-sm! rounded-t-none!">
                                    <div className="flex flex-col items-start">
                                        <span className="font-medium">Viewer</span>
                                        <span className="text-xs text-muted-foreground">
                                            Read-only access to workflows
                                        </span>
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Send Invitation
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
