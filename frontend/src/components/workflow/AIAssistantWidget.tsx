import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    ChevronLeft,
    ChevronRight,
    Send,
    Sparkles,
    Loader2,
    Zap,
    Plus,
    GitBranch,
    Trash2,
    Check,
    X,
} from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { workflowService } from '@/lib/api/services/workflow';

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

interface AIAssistantWidgetProps {
    workflowId: string;
    nodes: Node[];
    edges: Edge[];
    onApplyWorkflow?: (definition: any) => void;
    onApplyActions?: (actions: AssistantAction[]) => void;
    onAddNode?: (type: string, connectorData?: any) => void;
}

export function AIAssistantWidget({
    workflowId,
    nodes,
    edges,
    onApplyWorkflow,
    onApplyActions,
    onAddNode,
}: AIAssistantWidgetProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: "Hi! I'm your AI workflow assistant. I can help you build workflows, configure nodes, or debug issues. What would you like to do?",
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [pendingActions, setPendingActions] = useState<AssistantAction[] | null>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Track if history has been loaded
    const [historyLoaded, setHistoryLoaded] = useState(false);

    // Load chat history when panel expands (not on mount)
    useEffect(() => {
        if (isExpanded && workflowId && !historyLoaded) {
            loadChatHistory();
        }
    }, [isExpanded, workflowId, historyLoaded]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages]);

    // Focus input when expanded
    useEffect(() => {
        if (isExpanded && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isExpanded]);

    const loadChatHistory = async () => {
        if (historyLoaded) return;

        try {
            // Load initial 10 messages for fast render
            const response = await workflowService.getChatHistory(workflowId, 10);
            if (response.data?.messages?.length > 0) {
                const historicalMessages: Message[] = response.data.messages.map((msg: any) => ({
                    id: msg.id,
                    role: msg.role,
                    content: msg.content,
                    timestamp: new Date(msg.created_at),
                    actions: msg.actions,
                }));
                setMessages(prev => {
                    const welcomeMessage = prev[0];
                    return welcomeMessage ? [welcomeMessage, ...historicalMessages] : historicalMessages;
                });
            }
            setHistoryLoaded(true);

            // Background prefetch remaining history
            workflowService.getChatHistory(workflowId, 50).then(fullResponse => {
                if (fullResponse.data?.messages?.length > 10) {
                    const allMessages: Message[] = fullResponse.data.messages.map((msg: any) => ({
                        id: msg.id,
                        role: msg.role,
                        content: msg.content,
                        timestamp: new Date(msg.created_at),
                        actions: msg.actions,
                    }));
                    // Replace with full history
                    setMessages(prev => [prev[0], ...allMessages]);
                }
            }).catch(console.error);
        } catch (error) {
            console.error('Failed to load chat history:', error);
            setHistoryLoaded(true);
        }
    };

    const handleSendMessage = async () => {
        if (!input.trim() || isLoading) return;

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
            });

            const assistantMessage: Message = {
                id: response.data.message_id || (Date.now() + 1).toString(),
                role: 'assistant',
                content: response.data.message,
                timestamp: new Date(),
                actions: response.data.actions,
            };

            setMessages((prev) => [...prev, assistantMessage]);

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
        try {
            await workflowService.clearChatHistory(workflowId);
            setMessages([{
                id: '1',
                role: 'assistant',
                content: "Chat history cleared. How can I help you?",
                timestamp: new Date(),
            }]);
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
        <div
            className={cn(
                'fixed right-0 top-0 h-screen bg-background border-l border-border transition-all duration-300 ease-in-out z-20 flex flex-col',
                isExpanded ? 'w-[400px]' : 'w-[60px]'
            )}
        >
            {/* Toggle Button */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="absolute -left-10 top-4 w-10 h-10 bg-primary text-primary-foreground rounded-l-lg flex items-center justify-center hover:bg-primary/90 transition-colors shadow-lg"
                aria-label={isExpanded ? 'Collapse AI Assistant' : 'Expand AI Assistant'}
            >
                {isExpanded ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>

            {/* Collapsed State */}
            {!isExpanded && (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                    <div className="writing-mode-vertical text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        <span className="rotate-180" style={{ writingMode: 'vertical-rl' }}>
                            AI Assistant
                        </span>
                    </div>
                </div>
            )}

            {/* Expanded State */}
            {isExpanded && (
                <>
                    {/* Header */}
                    <div className="p-4 border-b border-border">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                                    <Sparkles className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm">AI Assistant</h3>
                                    <p className="text-xs text-muted-foreground">Powered by Gemini</p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleClearHistory}
                                title="Clear chat history"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

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
                                        <p className="whitespace-pre-wrap">{message.content}</p>
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
                </>
            )}
        </div>
    );
}
