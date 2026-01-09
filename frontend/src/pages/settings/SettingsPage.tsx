import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Bell, Key, AlertTriangle } from "lucide-react";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { DangerZoneSettings } from "@/components/settings/DangerZoneSettings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
    return (
        <div className="space-y-6 max-w-5xl mx-auto py-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">
                    Manage your account and preferences.
                </p>
            </div>

            <Tabs defaultValue="account" className="space-y-6">
                <TabsList className="w-full justify-start h-auto p-1 bg-muted/50 rounded-lg">
                    <TabsTrigger value="account" className="flex-1 w-full py-2">
                        <User className="w-4 h-4 mr-2" />
                        Account
                    </TabsTrigger>

                    <TabsTrigger value="notifications" className="flex-1 w-full py-2">
                        <Bell className="w-4 h-4 mr-2" />
                        Notifications
                    </TabsTrigger>
                    <TabsTrigger value="api" className="flex-1 w-full py-2">
                        <Key className="w-4 h-4 mr-2" />
                        API
                    </TabsTrigger>
                    <TabsTrigger value="danger" className="flex-1 w-full py-2 text-destructive data-[state=active]:text-destructive">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Danger Zone
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="account">
                    <AccountSettings />
                </TabsContent>



                <TabsContent value="notifications">
                    <Card>
                        <CardHeader>
                            <CardTitle>Notifications</CardTitle>
                            <CardDescription>Manage your email and in-app notifications.</CardDescription>
                        </CardHeader>
                        <CardContent className="py-8 text-center text-muted-foreground">
                            Notification settings coming soon.
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="api">
                    <Card>
                        <CardHeader>
                            <CardTitle>API Access</CardTitle>
                            <CardDescription>Manage API keys and access tokens.</CardDescription>
                        </CardHeader>
                        <CardContent className="py-8 text-center text-muted-foreground">
                            API key management coming soon. See Task 38.
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="danger">
                    <DangerZoneSettings />
                </TabsContent>
            </Tabs>
        </div>
    );
}
