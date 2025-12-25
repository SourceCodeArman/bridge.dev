import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, LayoutTemplate, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function QuickActions() {
    const navigate = useNavigate();

    return (
        <Card>
            <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                    Get started with common tasks
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
                <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => navigate('/workflows/new')}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Workflow
                </Button>
                <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => navigate('/templates')}
                >
                    <LayoutTemplate className="mr-2 h-4 w-4" />
                    Browse Templates
                </Button>
                <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => navigate('/connectors')}
                >
                    <Zap className="mr-2 h-4 w-4" />
                    Connect New Service
                </Button>
            </CardContent>
        </Card>
    );
}
