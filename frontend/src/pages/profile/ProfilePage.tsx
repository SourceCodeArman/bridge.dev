import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Upload, Trash2, Mail, Clock, Calendar, Workflow, Play } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { userService } from "@/lib/api/services/user";
import { workflowService } from "@/lib/api/services/workflow";
import { runService } from "@/lib/api/services/run";
import { ChangePasswordCard } from "@/components/profile/ChangePasswordCard";
import { ActivityFeed } from "@/components/profile/ActivityFeed";
import { toast } from "sonner";

export default function ProfilePage() {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Fetch user profile
    const { data: user, isLoading: userLoading } = useQuery({
        queryKey: ['user', 'profile'],
        queryFn: userService.getProfile
    });

    // Fetch stats for summary (mock in reality)
    const { data: workflowsData } = useQuery({
        queryKey: ['workflows', 'list'],
        queryFn: () => workflowService.list({ page_size: 100 })
    });

    const { data: runsData } = useQuery({
        queryKey: ['runs', 'list'],
        queryFn: () => runService.list()
    });

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            await userService.uploadAvatar(file);
            queryClient.invalidateQueries({ queryKey: ['user'] });
            toast.success("Avatar updated successfully");
        } catch {
            toast.error("Failed to upload avatar");
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveAvatar = async () => {
        try {
            await userService.deleteAvatar();
            queryClient.invalidateQueries({ queryKey: ['user'] });
            toast.success("Avatar removed");
        } catch {
            toast.error("Failed to remove avatar");
        }
    };

    if (userLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const workflowCount = workflowsData?.results?.length || 0;
    const runCount = runsData?.results?.length || 0;

    return (
        <div className="space-y-6 mx-auto p-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
                <p className="text-muted-foreground">
                    View and manage your account information.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Profile Card */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                                <div className="relative">
                                    <Avatar className="h-24 w-24">
                                        <AvatarImage src={user?.avatar_url || ''} />
                                        <AvatarFallback className="text-2xl">
                                            {user?.first_name?.[0]}{user?.last_name?.[0]}
                                        </AvatarFallback>
                                    </Avatar>
                                    {isUploading && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                                            <Loader2 className="w-6 h-6 animate-spin text-white" />
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 space-y-4">
                                    <div>
                                        <h2 className="text-2xl font-bold">
                                            {user?.first_name} {user?.last_name}
                                        </h2>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Mail className="w-4 h-4" />
                                            {user?.email}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploading}
                                        >
                                            <Upload className="w-4 h-4 mr-2" />
                                            Change Avatar
                                        </Button>
                                        {user?.avatar_url && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleRemoveAvatar}
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleAvatarUpload}
                                        />
                                    </div>
                                </div>
                            </div>

                            <Separator className="my-6" />

                            {/* Stats Row */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="text-center p-4 bg-muted/50 rounded-lg">
                                    <div className="flex justify-center mb-2">
                                        <Workflow className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                    <p className="text-2xl font-bold">{workflowCount}</p>
                                    <p className="text-xs text-muted-foreground">Workflows</p>
                                </div>
                                <div className="text-center p-4 bg-muted/50 rounded-lg">
                                    <div className="flex justify-center mb-2">
                                        <Play className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                    <p className="text-2xl font-bold">{runCount}</p>
                                    <p className="text-xs text-muted-foreground">Runs</p>
                                </div>
                                <div className="text-center p-4 bg-muted/50 rounded-lg">
                                    <div className="flex justify-center mb-2">
                                        <Clock className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                    <p className="text-sm font-medium">
                                        {user?.timezone || 'UTC'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Timezone</p>
                                </div>
                                <div className="text-center p-4 bg-muted/50 rounded-lg">
                                    <div className="flex justify-center mb-2">
                                        <Calendar className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                    <p className="text-sm font-medium">
                                        {user?.created_at ? format(new Date(user.created_at), 'MMM yyyy') : '-'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Member Since</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <ChangePasswordCard />
                </div>

                {/* Right Column - Activity Feed */}
                <div className="space-y-6">
                    <ActivityFeed />
                </div>
            </div>
        </div>
    );
}
