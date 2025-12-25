import { Link } from "react-router-dom";
import { ROUTES } from "@/router/routes";
import {
    BookOpen,
    Code,
    HelpCircle,
    Plug,
    Rocket,
    Workflow,
    ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocsPagination } from "@/components/docs/DocsPagination";

const quickLinks = [
    {
        title: "Getting Started",
        description: "Learn the basics and create your first workflow",
        href: ROUTES.DOCS_GETTING_STARTED,
        icon: <Rocket className="h-6 w-6" />,
    },
    {
        title: "API Reference",
        description: "Explore the full API documentation",
        href: ROUTES.DOCS_API,
        icon: <Code className="h-6 w-6" />,
    },
    {
        title: "Connectors",
        description: "Discover available integrations",
        href: ROUTES.DOCS_CONNECTORS,
        icon: <Plug className="h-6 w-6" />,
    },
    {
        title: "Examples",
        description: "Browse workflow templates and tutorials",
        href: ROUTES.DOCS_WORKFLOWS,
        icon: <Workflow className="h-6 w-6" />,
    },
];

export default function DocsHomePage() {
    return (
        <div className="space-y-12">
            {/* Hero section */}
            <div className="text-center pb-8 border-b border-border">
                <div className="flex justify-center mb-4">
                    <div className="p-3 bg-primary/10 rounded-xl">
                        <BookOpen className="h-10 w-10 text-primary" />
                    </div>
                </div>
                <h1 className="text-4xl font-bold tracking-tight mb-4">
                    Bridge Documentation
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    Everything you need to build powerful automations with Bridge.
                    From getting started to advanced workflows, we've got you covered.
                </p>
            </div>

            {/* Quick links grid */}
            <div>
                <h2 className="text-xl font-semibold mb-4">Quick Links</h2>
                <div className="grid gap-4 md:grid-cols-2">
                    {quickLinks.map((link) => (
                        <Link key={link.href} to={link.href}>
                            <Card className="h-full transition-all hover:border-primary/50 hover:shadow-md">
                                <CardHeader className="flex flex-row items-center gap-4">
                                    <div className="p-2 bg-muted rounded-lg text-primary">
                                        {link.icon}
                                    </div>
                                    <div className="flex-1">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            {link.title}
                                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                        </CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground">
                                        {link.description}
                                    </p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>

            {/* FAQ teaser */}
            <div className="bg-muted/50 rounded-xl p-6">
                <div className="flex items-start gap-4">
                    <div className="p-2 bg-muted/70 rounded-lg shadow-sm border-muted">
                        <HelpCircle className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold mb-1">Have Questions?</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                            Check out our frequently asked questions for quick answers.
                        </p>
                        <Link
                            to={ROUTES.DOCS_FAQ}
                            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                            View FAQ
                            <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>
                </div>
            </div>

            <DocsPagination
                next={{
                    label: "Getting Started",
                    href: ROUTES.DOCS_GETTING_STARTED,
                }}
            />
        </div>
    );
}
