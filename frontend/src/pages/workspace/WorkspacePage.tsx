import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Settings, Activity } from "lucide-react";
import { MembersTab } from "@/components/workspace/MembersTab";
import { WorkspaceSettingsTab } from "@/components/workspace/WorkspaceSettingsTab";
import { ActivityLogTab } from "@/components/workspace/ActivityLogTab";
import { MOCK_WORKSPACE } from "@/lib/mockData";

export default function WorkspacePage() {
    return (
        <div className="space-y-6 max-w-5xl mx-auto py-6">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold tracking-tight">{MOCK_WORKSPACE.name}</h1>
                </div>
                <p className="text-muted-foreground">
                    Manage your team members, roles, and workspace settings.
                </p>
            </div>

            <Tabs defaultValue="members" className="space-y-6">
                <TabsList className="w-full justify-between h-auto p-1 bg-muted/50 rounded-lg">
                    <TabsTrigger value="members" className="flex-1 w-full py-2">
                        <Users className="w-4 h-4 mr-2" />
                        Members
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="flex-1 w-full py-2">
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                    </TabsTrigger>
                    <TabsTrigger value="activity" className="flex-1 w-full py-2">
                        <Activity className="w-4 h-4 mr-2" />
                        Activity
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="members">
                    <MembersTab />
                </TabsContent>

                <TabsContent value="settings">
                    <WorkspaceSettingsTab />
                </TabsContent>

                <TabsContent value="activity">
                    <ActivityLogTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
