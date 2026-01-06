import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from "react-router-dom";
import { ROUTES } from "@/router/routes";
import { HelpCircle, MessageSquarePlus, Book, Github } from "lucide-react";
import { DocsPagination } from "@/components/docs/DocsPagination";

interface FaqItem {
    question: string;
    answer: React.ReactNode;
    category: string;
}

const faqItems: FaqItem[] = [
    {
        category: "General",
        question: "What is Bridge?",
        answer: (
            <>
                Bridge is a no-code integration platform that allows you to automate
                workflows between different applications and services. You can create
                workflows visually using our canvas builder, connect to popular
                services, and run automations on triggers or schedules.
            </>
        ),
    },
    {
        category: "General",
        question: "What is a workflow?",
        answer: (
            <>
                A workflow is a series of automated steps that run in sequence. Each
                workflow starts with a trigger (like a webhook, schedule, or database
                event) and contains one or more actions (like sending an email,
                updating a spreadsheet, or calling an API).
            </>
        ),
    },
    {
        category: "General",
        question: "How much does Bridge cost?",
        answer: (
            <>
                Bridge offers a free tier for individuals and small projects. For
                larger teams and advanced features, please contact us for pricing
                information. All plans include core workflow features and a generous
                number of monthly runs.
            </>
        ),
    },
    {
        category: "Workflows",
        question: "How do I create a workflow?",
        answer: (
            <>
                To create a workflow, go to your dashboard and click "Create Workflow".
                Name your workflow, then use the canvas builder to add a trigger node
                and connect it to action nodes. Once you're done, save and activate
                your workflow. See our{" "}
                <Link to={ROUTES.DOCS_GETTING_STARTED} className="text-primary hover:underline">
                    Getting Started guide
                </Link>{" "}
                for more details.
            </>
        ),
    },
    {
        category: "Workflows",
        question: "Can I test a workflow before activating it?",
        answer: (
            <>
                Yes! You can use the "Test Run" feature to execute your workflow with
                sample data. This allows you to verify that everything works correctly
                before activating the workflow for live events.
            </>
        ),
    },
    {
        category: "Workflows",
        question: "How do I debug a failed run?",
        answer: (
            <>
                When a run fails, go to the Runs page and click on the failed run to
                view its details. You'll see a step-by-step breakdown showing exactly
                where the failure occurred, along with input/output data for each step.
                Common issues include missing credentials, invalid data formats, or
                network timeouts.
            </>
        ),
    },
    {
        category: "Connectors",
        question: "What services can I connect to?",
        answer: (
            <>
                Bridge supports many popular services including Slack, Gmail, Google
                Sheets, OpenAI, Anthropic, Supabase, and more. You can also use the
                HTTP connector to integrate with any REST API. See our{" "}
                <Link to={ROUTES.DOCS_CONNECTORS} className="text-primary hover:underline">
                    Connectors documentation
                </Link>{" "}
                for the full list.
            </>
        ),
    },
    {
        category: "Connectors",
        question: "How do I add credentials for a service?",
        answer: (
            <>
                Go to Settings → Credentials and click "Add Credential". Select the
                connector type and follow the authentication flow. For OAuth services
                (like Google), you'll be redirected to authorize Bridge. For API key
                services, you'll need to enter your key manually.
            </>
        ),
    },
    {
        category: "Connectors",
        question: "Are my credentials secure?",
        answer: (
            <>
                Yes, all credentials are encrypted at rest using industry-standard
                encryption. Secrets are never logged or displayed in plain text.
                Access to credentials is controlled by workspace-level permissions.
            </>
        ),
    },
    {
        category: "Technical",
        question: "What happens if a workflow fails?",
        answer: (
            <>
                Failed workflows are automatically retried based on your retry
                configuration. You can configure alerts to be notified via email or
                Slack when failures occur. Failed runs are logged with detailed error
                information for debugging.
            </>
        ),
    },
    {
        category: "Technical",
        question: "Is there an API for Bridge?",
        answer: (
            <>
                Yes! Bridge provides a full REST API for managing workflows, runs,
                credentials, and more. See our{" "}
                <Link to={ROUTES.DOCS_API} className="text-primary hover:underline">
                    API documentation
                </Link>{" "}
                for details.
            </>
        ),
    },
    {
        category: "Technical",
        question: "What are the rate limits?",
        answer: (
            <>
                API requests are limited to 1000 requests per hour per user. Workflow
                executions have varying limits based on your plan. Contact us if you
                need higher limits for your use case.
            </>
        ),
    },
];

export default function FaqPage() {
    const categories = [...new Set(faqItems.map((item) => item.category))];

    return (
        <div className="max-w-7xl mx-auto space-y-16">
            {/* Header */}
            <div className="text-center space-y-4 pb-8">
                <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-background border border-border mb-2">
                    <HelpCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h1 className="text-4xl font-bold tracking-tight bg-linear-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                    Frequently Asked Questions
                </h1>
                <p className="text-xl text-muted-foreground max-w-xl mx-auto">
                    Everything you need to know about the product and billing.
                </p>
            </div>

            <div className="grid gap-12">
                {categories.map((category) => (
                    <div key={category} className="space-y-6">
                        <h2 className="text-xl font-semibold text-foreground border-l-2 border-primary pl-4">{category}</h2>
                        <Accordion type="single" collapsible className="w-full">
                            {faqItems
                                .filter((item) => item.category === category)
                                .map((item, index) => (
                                    <AccordionItem
                                        key={index}
                                        value={`${category}-${index}`}
                                        className="border-border bg-background/30 px-4 rounded-lg mb-2 data-[state=open]:bg-background data-[state=open]:border-border transition-all"
                                    >
                                        <AccordionTrigger className="text-left text-foreground hover:text-foreground py-4 hover:no-underline font-medium">
                                            {item.question}
                                        </AccordionTrigger>
                                        <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
                                            {item.answer}
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                        </Accordion>
                    </div>
                ))}
            </div>

            {/* Support CTA */}
            <div className="mt-16 bg-background rounded-2xl border border-border p-8 text-center space-y-4">
                <div className="flex justify-center gap-4 text-muted-foreground">
                    <MessageSquarePlus className="h-6 w-6" />
                    <Book className="h-6 w-6" />
                    <Github className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">Still have questions?</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                    Can't find the answer you're looking for? Please check our full documentation or chat to our friendly team.
                </p>
                <div className="flex justify-center gap-3 pt-2">
                    <Link to={ROUTES.DOCS} className="px-4 py-2 bg-card hover:bg-neutral-700 text-foreground rounded-lg text-sm font-medium transition-colors">
                        Documentation
                    </Link>
                    <a href="mailto:support@bridge.dev" className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm font-medium transition-colors">
                        Contact Support
                    </a>
                </div>

            </div>

            <DocsPagination
                prev={{
                    label: "Workflow Examples",
                    href: ROUTES.DOCS_WORKFLOWS,
                }}
            />
        </div >
    );
}
