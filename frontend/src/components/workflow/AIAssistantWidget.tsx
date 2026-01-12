import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Sparkles,
    Loader2,
    Zap,
    Plus,
    GitBranch,
    Trash2,
    Check,
    X,
    MessageSquarePlus,
    ChevronDown,
    Send,
} from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { workflowService } from '@/lib/api/services/workflow';
import ReactMarkdown from 'react-markdown';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetClose,
} from '@/components/ui/sheet';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    actions?: AssistantAction[];
    pending?: boolean;
}

interface AssistantAction {
    type: 'add_node' | 'update_node' | 'delete_node' | 'add_edge' | 'generate_workflow';
    [key: string]: any;
}

interface ChatThread {
    id: string;
    title: string;
    is_active: boolean;
    message_count: number;
    last_message_at?: string;
    created_at: string;
    updated_at: string;
}

interface AIAssistantWidgetProps {
    workflowId: string;
    nodes: Node[];
    edges: Edge[];
    onApplyWorkflow?: (definition: any) => void;
    onApplyActions?: (actions: AssistantAction[]) => void;
    onAddNode?: (type: string, connectorData?: any) => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AIAssistantWidget({
    workflowId,
    nodes,
    edges,
    onApplyWorkflow,
    onApplyActions,
    onAddNode,
    open,
    onOpenChange,
}: AIAssistantWidgetProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [pendingActions, setPendingActions] = useState<AssistantAction[] | null>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Thread management state
    const [threads, setThreads] = useState<ChatThread[]>([]);
    const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
    const [showThreadSelector, setShowThreadSelector] = useState(false);
    const [threadsLoaded, setThreadsLoaded] = useState(false);

    // Load threads when panel opens
    useEffect(() => {
        if (open && workflowId && !threadsLoaded) {
            loadThreads();
        }
    }, [open, workflowId, threadsLoaded]);

    // Load messages when active thread changes
    useEffect(() => {
        if (activeThread) {
            loadChatHistory(activeThread.id);
        }
    }, [activeThread?.id]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages]);

    // Focus input when open
    useEffect(() => {
        if (open && inputRef.current) {
            // Small timeout to allow sheet animation to complete
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [open]);

    const loadThreads = async () => {
        try {
            const response = await workflowService.listThreads(workflowId);
            const threadList = response.data?.threads || [];
            setThreads(threadList);
            setThreadsLoaded(true);

            // Set active thread or create a new one if none exist
            const active = threadList.find((t: ChatThread) => t.is_active);
            if (active) {
                setActiveThread(active);
            } else if (threadList.length === 0) {
                // No threads exist, create the first one
                await handleNewChat();
            } else {
                // No active thread, activate the most recent one
                setActiveThread(threadList[0]);
            }
        } catch (error) {
            console.error('Failed to load threads:', error);
            setThreadsLoaded(true);
        }
    };

    const loadChatHistory = async (threadId: string) => {
        try {
            const response = await workflowService.getChatHistory(workflowId, 50, threadId);
            if (response.data?.messages?.length > 0) {
                const historicalMessages: Message[] = response.data.messages.map((msg: any) => ({
                    id: msg.id,
                    role: msg.role,
                    content: msg.content,
                    timestamp: new Date(msg.created_at),
                    actions: msg.actions,
                }));
                setMessages(historicalMessages);
            } else {
                // Empty thread, show welcome message
                setMessages([{
                    id: 'welcome',
                    role: 'assistant',
                    content: "Hi! I'm your AI workflow assistant. I can help you build workflows, configure nodes, or debug issues. What would you like to do?",
                    timestamp: new Date(),
                }]);
            }
        } catch (error) {
            console.error('Failed to load chat history:', error);
            setMessages([{
                id: 'welcome',
                role: 'assistant',
                content: "Hi! I'm your AI workflow assistant. I can help you build workflows, configure nodes, or debug issues. What would you like to do?",
                timestamp: new Date(),
            }]);
        }
    };

    const handleNewChat = async () => {
        try {
            const response = await workflowService.createThread(workflowId);
            const newThread = response.data?.thread;
            if (newThread) {
                setThreads(prev => [newThread, ...prev]);
                setActiveThread(newThread);
                setMessages([{
                    id: 'welcome',
                    role: 'assistant',
                    content: "Hi! I'm your AI workflow assistant. I can help you build workflows, configure nodes, or debug issues. What would you like to do?",
                    timestamp: new Date(),
                }]);
            }
            setShowThreadSelector(false);
        } catch (error) {
            console.error('Failed to create new thread:', error);
        }
    };

    const handleSwitchThread = async (thread: ChatThread) => {
        if (thread.id === activeThread?.id) {
            setShowThreadSelector(false);
            return;
        }

        try {
            await workflowService.switchThread(workflowId, thread.id);
            setActiveThread({ ...thread, is_active: true });
            setThreads(prev => prev.map(t => ({
                ...t,
                is_active: t.id === thread.id,
            })));
            setShowThreadSelector(false);
        } catch (error) {
            console.error('Failed to switch thread:', error);
        }
    };

    const handleDeleteThread = async (threadId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (threads.length <= 1) {
            // Don't allow deleting the last thread
            return;
        }

        try {
            await workflowService.deleteThread(workflowId, threadId);
            const remainingThreads = threads.filter(t => t.id !== threadId);
            setThreads(remainingThreads);

            // If we deleted the active thread, switch to another one
            if (activeThread?.id === threadId && remainingThreads.length > 0) {
                setActiveThread(remainingThreads[0] ?? null);
            }
        } catch (error) {
            console.error('Failed to delete thread:', error);
        }
    };

    const handleSendMessage = async () => {
        if (!input.trim() || isLoading || !activeThread) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        const userPrompt = input.trim();
        setInput('');
        setIsLoading(true);

        try {
            const response = await workflowService.sendChatMessage(workflowId, userPrompt, {
                llmProvider: 'gemini',
                includeWorkflowContext: true,
                threadId: activeThread.id,
            });

            const assistantMessage: Message = {
                id: response.data.message_id || (Date.now() + 1).toString(),
                role: 'assistant',
                content: response.data.message,
                timestamp: new Date(),
                actions: response.data.actions,
            };

            setMessages((prev) => [...prev, assistantMessage]);

            // Update thread message count
            setThreads(prev => prev.map(t =>
                t.id === activeThread.id
                    ? { ...t, message_count: t.message_count + 2 }
                    : t
            ));

            // If there are actions, show them for approval
            if (response.data.actions && response.data.actions.length > 0) {
                setPendingActions(response.data.actions);
            }
        } catch (error: any) {
            console.error('Error sending message:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `Sorry, I encountered an error: ${error?.response?.data?.message || error?.message || 'Unknown error'}. Please try again.`,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplyActions = useCallback(() => {
        if (pendingActions && onApplyActions) {
            onApplyActions(pendingActions);
            setPendingActions(null);

            // Add confirmation message
            const confirmMessage: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: 'Changes applied to your workflow.',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, confirmMessage]);
        }
    }, [pendingActions, onApplyActions]);

    const handleRejectActions = useCallback(() => {
        setPendingActions(null);

        const rejectMessage: Message = {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'No problem! The changes were not applied. Let me know if you\'d like me to try something different.',
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, rejectMessage]);
    }, []);

    const handleClearHistory = async () => {
        if (!activeThread) return;

        try {
            await workflowService.clearChatHistory(workflowId, activeThread.id);
            setMessages([{
                id: 'welcome',
                role: 'assistant',
                content: "Chat history cleared. How can I help you?",
                timestamp: new Date(),
            }]);

            // Update thread message count
            setThreads(prev => prev.map(t =>
                t.id === activeThread.id
                    ? { ...t, message_count: 0 }
                    : t
            ));
        } catch (error) {
            console.error('Failed to clear history:', error);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const getQuickActions = () => {
        if (nodes.length === 0) {
            return [
                { label: 'Add webhook trigger', icon: Zap, action: () => onAddNode?.('trigger') },
                { label: 'Build with AI', icon: Sparkles, action: () => setInput('Build a workflow that sends Slack notifications when a webhook is triggered') },
            ];
        }

        const hasTrigger = nodes.some(n => n.type === 'trigger');
        if (!hasTrigger) {
            return [
                { label: 'Add trigger', icon: Plus, action: () => onAddNode?.('trigger') },
            ];
        }

        return [
            { label: 'Add action', icon: Plus, action: () => onAddNode?.('action') },
            { label: 'Add condition', icon: GitBranch, action: () => onAddNode?.('condition') },
            { label: 'Optimize', icon: Sparkles, action: () => setInput('How can I optimize this workflow?') },
        ];
    };

    const quickActions = getQuickActions();

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetTrigger asChild>
                <Button className="rounded-full w-12 h-12 p-0 shadow-2xl bg-linear-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white absolute bottom-6 right-6 z-50 overflow-hidden hover:scale-110 transition-transform duration-200">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                    <span className="sr-only">AI Assistant</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[400px] p-0 flex flex-col bg-background border-l border-border gap-0 [&>button]:hidden">

                {/* Header */}
                <SheetHeader className="p-4 border-b border-border">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <div className="text-left">
                                <SheetTitle className="text-sm font-semibold">AI Assistant</SheetTitle>
                                <p className="text-xs text-muted-foreground">Powered by Gemini</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleNewChat}
                                title="New chat"
                            >
                                <MessageSquarePlus className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleClearHistory}
                                title="Clear current chat"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                            <SheetClose asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Close"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </SheetClose>
                        </div>
                    </div>
                </SheetHeader>

                {/* Thread Selector */}
                {threads.length > 0 && (
                    <div className="relative border-b border-border">
                        <button
                            onClick={() => setShowThreadSelector(!showThreadSelector)}
                            className="w-full px-4 py-2 flex items-center justify-between text-sm hover:bg-muted/50 transition-colors"
                        >
                            <span className="truncate font-medium">
                                {activeThread?.title || 'Select chat'}
                            </span>
                            <ChevronDown className={cn(
                                "w-4 h-4 transition-transform",
                                showThreadSelector && "rotate-180"
                            )} />
                        </button>

                        {/* Thread Dropdown */}
                        {showThreadSelector && (
                            <div className="absolute top-full left-0 right-0 bg-background border border-border rounded-b-lg shadow-lg z-10 max-h-[200px] overflow-y-auto">
                                {threads.map((thread) => (
                                    <div
                                        key={thread.id}
                                        onClick={() => handleSwitchThread(thread)}
                                        className={cn(
                                            "px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-muted/50",
                                            thread.id === activeThread?.id && "bg-muted"
                                        )}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{thread.title}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {thread.message_count} message{thread.message_count !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                        {threads.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 ml-2"
                                                onClick={(e) => handleDeleteThread(thread.id, e)}
                                                title="Delete chat"
                                            >
                                                <X className="w-3 h-3" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Quick Actions */}
                {quickActions.length > 0 && !pendingActions && (
                    <div className="p-3 border-b border-border bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-2">Quick actions:</p>
                        <div className="flex flex-wrap gap-2">
                            {quickActions.map((action, idx) => (
                                <Button
                                    key={idx}
                                    variant="outline"
                                    size="sm"
                                    onClick={action.action}
                                    className="text-xs h-7"
                                >
                                    <action.icon className="w-3 h-3 mr-1" />
                                    {action.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Pending Actions Bar */}
                {pendingActions && pendingActions.length > 0 && (
                    <div className="p-3 border-b border-border bg-amber-50 dark:bg-amber-950">
                        <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-2">
                            {pendingActions.length} action(s) ready to apply
                        </p>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                onClick={handleApplyActions}
                                className="flex-1 h-8"
                            >
                                <Check className="w-3 h-3 mr-1" />
                                Apply
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRejectActions}
                                className="flex-1 h-8"
                            >
                                <X className="w-3 h-3 mr-1" />
                                Reject
                            </Button>
                        </div>
                    </div>
                )}

                {/* Messages */}
                <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
                    <div className="space-y-4">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={cn(
                                    'flex',
                                    message.role === 'user' ? 'justify-end' : 'justify-start'
                                )}
                            >
                                <div
                                    className={cn(
                                        'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                                        message.role === 'user'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted'
                                    )}
                                >
                                    {message.role === 'user' ? (
                                        <p className="whitespace-pre-wrap">{message.content}</p>
                                    ) : (
                                        <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                                            <ReactMarkdown
                                                components={{
                                                    // Style code blocks
                                                    code: ({ className, children, ...props }) => {
                                                        const isInline = !className;
                                                        return isInline ? (
                                                            <code className="bg-background/50 px-1 py-0.5 rounded text-xs" {...props}>
                                                                {children}
                                                            </code>
                                                        ) : (
                                                            <code className={cn("block bg-background/50 p-2 rounded text-xs overflow-x-auto", className)} {...props}>
                                                                {children}
                                                            </code>
                                                        );
                                                    },
                                                    // Style pre blocks
                                                    pre: ({ children }) => (
                                                        <pre className="bg-background/50 p-2 rounded overflow-x-auto my-2">
                                                            {children}
                                                        </pre>
                                                    ),
                                                    // Style links
                                                    a: ({ children, href }) => (
                                                        <a
                                                            href={href}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-primary underline hover:no-underline"
                                                        >
                                                            {children}
                                                        </a>
                                                    ),
                                                    // Style lists
                                                    ul: ({ children }) => (
                                                        <ul className="list-disc pl-4 my-1">{children}</ul>
                                                    ),
                                                    ol: ({ children }) => (
                                                        <ol className="list-decimal pl-4 my-1">{children}</ol>
                                                    ),
                                                    li: ({ children }) => (
                                                        <li className="my-0.5">{children}</li>
                                                    ),
                                                    // Style paragraphs
                                                    p: ({ children }) => (
                                                        <p className="my-1">{children}</p>
                                                    ),
                                                    // Style headings
                                                    h1: ({ children }) => (
                                                        <h1 className="text-lg font-bold my-2">{children}</h1>
                                                    ),
                                                    h2: ({ children }) => (
                                                        <h2 className="text-base font-bold my-2">{children}</h2>
                                                    ),
                                                    h3: ({ children }) => (
                                                        <h3 className="text-sm font-bold my-1">{children}</h3>
                                                    ),
                                                    // Style strong/bold
                                                    strong: ({ children }) => (
                                                        <strong className="font-semibold">{children}</strong>
                                                    ),
                                                    // Style blockquotes
                                                    blockquote: ({ children }) => (
                                                        <blockquote className="border-l-2 border-primary pl-2 my-2 italic">
                                                            {children}
                                                        </blockquote>
                                                    ),
                                                }}
                                            >
                                                {message.content}
                                            </ReactMarkdown>
                                        </div>
                                    )}
                                    {message.actions && message.actions.length > 0 && (
                                        <p className="text-xs mt-2 opacity-70">
                                            {message.actions.length} suggested action(s)
                                        </p>
                                    )}
                                    <p className="text-xs opacity-60 mt-1">
                                        {message.timestamp.toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-muted rounded-lg px-3 py-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* Input */}
                <div className="p-4 border-t border-border">
                    <div className="flex gap-2">
                        <Input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Ask me anything..."
                            disabled={isLoading}
                            className="flex-1"
                        />
                        <Button
                            onClick={handleSendMessage}
                            disabled={!input.trim() || isLoading}
                            size="icon"
                        >
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Press Enter to send
                    </p>
                </div>
            </SheetContent>
        </Sheet>
    );
}
