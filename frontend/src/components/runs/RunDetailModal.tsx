import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RunStatusBadge } from "./RunStatusBadge";
import { runService } from "@/lib/api/services/run";
import { type Run } from "@/types";
import { Play, AlertCircle, Clock, Calendar, Terminal, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface RunDetailModalProps {
    run: Run | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onReplay?: (run: Run) => void;
}

export function RunDetailModal({ run, open, onOpenChange, onReplay }: RunDetailModalProps) {
    const { data: steps, isLoading: isLoadingSteps } = useQuery({
        queryKey: ['run', run?.id, 'steps'],
        queryFn: () => runService.getSteps(run!.id),
        enabled: !!run?.id && open
    });

    const { data: logs, isLoading: isLoadingLogs } = useQuery({
        queryKey: ['run', run?.id, 'logs'],
        queryFn: () => runService.getLogs(run!.id),
        enabled: !!run?.id && open
    });

    if (!run) return null;

    const duration = run.completed_at && run.started_at
        ? ((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(2)
        : null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[800px] sm:w-[540px] flex flex-col p-6 overflow-hidden">
                <SheetHeader className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <SheetTitle className="text-xl font-semibold">Run Details</SheetTitle>
                        <RunStatusBadge status={run.status} />
                    </div>
                    <SheetDescription className="flex flex-col gap-2">
                        <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4" />
                                {format(new Date(run.started_at), 'PPP p')}
                            </span>
                            {duration && (
                                <span className="flex items-center gap-1.5">
                                    <Clock className="w-4 h-4" />
                                    {duration}s
                                </span>
                            )}
                        </div>
                        <div className="text-sm text-muted-foreground font-mono">
                            ID: {run.id}
                        </div>
                    </SheetDescription>
                </SheetHeader>

                {run.error && (
                    <Alert variant="destructive" className="mb-6">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription className="font-mono text-xs mt-2">
                            {run.error}
                        </AlertDescription>
                    </Alert>
                )}

                <Tabs defaultValue="steps" className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
                        <TabsTrigger
                            value="steps"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-3 px-1"
                        >
                            <Activity className="w-4 h-4 mr-2" />
                            Steps
                        </TabsTrigger>
                        <TabsTrigger
                            value="logs"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-3 px-1"
                        >
                            <Terminal className="w-4 h-4 mr-2" />
                            Logs
                        </TabsTrigger>
                        <TabsTrigger
                            value="metadata"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-3 px-1"
                        >
                            <Activity className="w-4 h-4 mr-2" />
                            Metadata
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="steps" className="flex-1 overflow-hidden mt-6">
                        <ScrollArea className="h-full pr-4">
                            {isLoadingSteps ? (
                                <div className="text-center py-8 text-muted-foreground">Loading steps...</div>
                            ) : !steps?.length ? (
                                <div className="text-center py-8 text-muted-foreground">No steps recorded</div>
                            ) : (
                                <Accordion type="single" collapsible className="space-y-4">
                                    {steps.map((step) => (
                                        <AccordionItem key={step.id} value={step.id} className="border rounded-lg px-4">
                                            <AccordionTrigger className="hover:no-underline py-4">
                                                <div className="flex items-center gap-4 w-full pr-4">
                                                    <RunStatusBadge status={step.status} className="scale-90" />
                                                    <div className="flex flex-col items-start gap-1">
                                                        <span className="font-medium text-sm">{step.node_name || step.node_id}</span>
                                                        <span className="text-xs text-muted-foreground capitalize">
                                                            {step.id.split('-')[0]}...
                                                        </span>
                                                    </div>
                                                    {step.completed_at && step.started_at && (
                                                        <span className="ml-auto text-xs text-muted-foreground font-mono">
                                                            {((new Date(step.completed_at).getTime() - new Date(step.started_at).getTime()) / 1000).toFixed(2)}s
                                                        </span>
                                                    )}
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div className="space-y-4 pt-2 pb-4">
                                                    {step.error && (
                                                        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm font-mono break-all">
                                                            {step.error}
                                                        </div>
                                                    )}

                                                    {step.input && (
                                                        <div className="space-y-2">
                                                            <div className="text-xs font-semibold text-muted-foreground uppercase">Inputs</div>
                                                            <pre className="bg-muted p-3 rounded-md text-xs font-mono overflow-auto max-h-[200px]">
                                                                {JSON.stringify(step.input, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}

                                                    {step.output && (
                                                        <div className="space-y-2">
                                                            <div className="text-xs font-semibold text-muted-foreground uppercase">Outputs</div>
                                                            <pre className="bg-muted p-3 rounded-md text-xs font-mono overflow-auto max-h-[200px]">
                                                                {JSON.stringify(step.output, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            )}
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="logs" className="flex-1 overflow-hidden mt-6">
                        <ScrollArea className="h-full">
                            {isLoadingLogs ? (
                                <div className="text-center py-8 text-muted-foreground">Loading logs...</div>
                            ) : !logs?.length ? (
                                <div className="text-center py-8 text-muted-foreground">No logs available</div>
                            ) : (
                                <div className="space-y-2 font-mono text-xs">
                                    {logs.map((log, i) => (
                                        <div key={i} className="flex gap-4 p-2 hover:bg-muted/50 rounded">
                                            <span className="text-muted-foreground min-w-[140px]">
                                                {format(new Date(log.timestamp), 'PP pp')}
                                            </span>
                                            <span className={cn(
                                                log.level === 'error' ? 'text-destructive' :
                                                    log.level === 'warn' ? 'text-yellow-500' :
                                                        'text-foreground'
                                            )}>
                                                {log.message}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>
                </Tabs>

                <SheetFooter className="mt-6 pt-4 border-t">
                    <Button
                        className="w-full sm:w-auto"
                        onClick={() => onReplay?.(run)}
                        disabled={run.status === 'running' || run.status === 'pending'}
                    >
                        <Play className="w-4 h-4 mr-2" />
                        Replay Run
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
