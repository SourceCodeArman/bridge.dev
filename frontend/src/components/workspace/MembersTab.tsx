import { useState } from "react";
import { MoreHorizontal, UserPlus, Shield, Crown, User, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MOCK_WORKSPACE_MEMBERS } from "@/lib/mockData";
import { InviteMemberDialog } from "./InviteMemberDialog";
import type { WorkspaceRole } from "@/types";
import { toast } from "sonner";

const roleConfig: Record<WorkspaceRole, { label: string; icon: typeof Crown; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    owner: { label: "Owner", icon: Crown, variant: "default" },
    admin: { label: "Admin", icon: Shield, variant: "secondary" },
    member: { label: "Member", icon: User, variant: "outline" },
    viewer: { label: "Viewer", icon: Eye, variant: "outline" },
};

export function MembersTab() {
    const [inviteOpen, setInviteOpen] = useState(false);
    const members = MOCK_WORKSPACE_MEMBERS;

    const handleRoleChange = (memberId: string, newRole: WorkspaceRole) => {
        toast.success(`Role updated to ${newRole}`);
        console.log("Change role:", memberId, newRole);
    };

    const handleRemoveMember = (memberId: string) => {
        toast.success("Member removed from workspace");
        console.log("Remove member:", memberId);
    };

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Team Members</CardTitle>
                        <CardDescription>
                            Manage who has access to this workspace and their permissions.
                        </CardDescription>
                    </div>
                    <Button onClick={() => setInviteOpen(true)}>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Invite Member
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Member</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Joined</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {members.map((member) => {
                                const role = roleConfig[member.role];
                                const RoleIcon = role.icon;
                                const isOwner = member.role === "owner";

                                return (
                                    <TableRow key={member.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9">
                                                    <AvatarFallback className="text-sm">
                                                        {member.first_name[0]}{member.last_name[0]}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium">
                                                        {member.first_name} {member.last_name}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {member.email}
                                                    </p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={role.variant} className="gap-1">
                                                <RoleIcon className="w-3 h-3" />
                                                {role.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {new Date(member.joined_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            {!isOwner && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreHorizontal className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleRoleChange(member.id, "admin")}>
                                                            <Shield className="w-4 h-4 mr-2" />
                                                            Make Admin
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleRoleChange(member.id, "member")}>
                                                            <User className="w-4 h-4 mr-2" />
                                                            Make Member
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleRoleChange(member.id, "viewer")}>
                                                            <Eye className="w-4 h-4 mr-2" />
                                                            Make Viewer
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive"
                                                            onClick={() => handleRemoveMember(member.id)}
                                                        >
                                                            Remove from workspace
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} />
        </>
    );
}
