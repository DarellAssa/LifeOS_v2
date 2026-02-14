import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Send, Square, Bot, User, ChevronDown, Wrench, Database, AlertCircle, Sparkles, ShieldCheck, X, Plus, MessageSquare, Trash2 } from 'lucide-react';
import { useAppContext } from '@/store/AppContext';
import {
  CopilotMessage, CopilotThread, PendingConfirmation,
  sendCopilotMessage, confirmCopilotAction,
  loadThreads, loadThreadMessages, deleteThread,
} from '@/lib/copilot';
import ReactMarkdown from 'react-markdown';

interface CopilotDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMessage?: string;
}

export function CopilotDrawer({ open, onOpenChange, initialMessage }: CopilotDrawerProps) {
  const ctx = useAppContext();
  const [threads, setThreads] = useState<CopilotThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showThreadList, setShowThreadList] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const processedInitialRef = useRef<string | null>(null);

  // Load threads on open
  useEffect(() => {
    if (open) {
      loadThreads().then(setThreads);
    }
  }, [open]);

  // Handle initial message
  useEffect(() => {
    if (open && initialMessage && initialMessage !== processedInitialRef.current && !isStreaming) {
      processedInitialRef.current = initialMessage;
      setInput('');
      setActiveThreadId(null);
      setMessages([]);
      setTimeout(() => sendMessage(initialMessage), 100);
    }
  }, [open, initialMessage]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Focus textarea
  useEffect(() => {
    if (open && textareaRef.current && !showThreadList) {
      setTimeout(() => textareaRef.current?.focus(), 200);
    }
  }, [open, showThreadList]);

  const openThread = useCallback(async (threadId: string) => {
    const msgs = await loadThreadMessages(threadId);
    setMessages(msgs);
    setActiveThreadId(threadId);
    setShowThreadList(false);
  }, []);

  const startNewChat = useCallback(() => {
    setActiveThreadId(null);
    setMessages([]);
    setShowThreadList(false);
  }, []);

  const handleDeleteThread = useCallback(async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteThread(threadId);
    setThreads(prev => prev.filter(t => t.id !== threadId));
    if (activeThreadId === threadId) {
      setActiveThreadId(null);
      setMessages([]);
    }
  }, [activeThreadId]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;
    setError(null);

    const userMsg: CopilotMessage = { role: 'user', content: text.trim(), timestamp: new Date().toISOString() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput('');
    setIsStreaming(true);

    const abortController = new AbortController();
    abortRef.current = abortController;

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let currentActionsTaken: string[] = [];
    let currentDataUsed: string[] = [];

    await sendCopilotMessage({
      message: text.trim(),
      threadId: activeThreadId,
      clientContext: { timezone: tz },
      onContent: (content) => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content } : m);
          }
          return [...prev, {
            role: 'assistant', content,
            actionsTaken: currentActionsTaken.length > 0 ? currentActionsTaken : undefined,
            dataUsed: currentDataUsed.length > 0 ? currentDataUsed : undefined,
            timestamp: new Date().toISOString(),
          }];
        });
      },
      onConfirmationRequired: (confirmation, partialContent, threadId) => {
        setActiveThreadId(threadId);
        const confirmMsg: CopilotMessage = {
          role: 'assistant',
          content: partialContent || 'I need your approval before proceeding with the following actions:',
          pendingConfirmation: confirmation,
          actionsTaken: currentActionsTaken.length > 0 ? currentActionsTaken : undefined,
          dataUsed: currentDataUsed.length > 0 ? currentDataUsed : undefined,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, confirmMsg]);
        setIsStreaming(false);
        abortRef.current = null;
      },
      onMetadata: (actionsTaken, dataUsed, threadId) => {
        currentActionsTaken = actionsTaken;
        currentDataUsed = dataUsed;
        if (threadId) setActiveThreadId(threadId);
      },
      onDone: (threadId) => {
        setIsStreaming(false);
        abortRef.current = null;
        if (threadId) setActiveThreadId(threadId);
        setMessages(prev => prev.map((m, i) => {
          if (i === prev.length - 1 && m.role === 'assistant') {
            return {
              ...m,
              actionsTaken: currentActionsTaken.length > 0 ? currentActionsTaken : undefined,
              dataUsed: currentDataUsed.length > 0 ? currentDataUsed : undefined,
            };
          }
          return m;
        }));
        // Refresh thread list
        loadThreads().then(setThreads);
        // Refresh app data to reflect any server-side changes
        ctx.refreshData?.();
      },
      onError: (err) => {
        setError(err);
        setIsStreaming(false);
      },
      abortSignal: abortController.signal,
    });
  }, [messages, isStreaming, activeThreadId, ctx]);

  const handleConfirm = useCallback(async (msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg.pendingConfirmation || !activeThreadId) return;

    setIsStreaming(true);
    setError(null);

    await confirmCopilotAction({
      actionId: msg.pendingConfirmation.actionId,
      toolCalls: msg.pendingConfirmation.actions,
      threadId: activeThreadId,
      onDone: (actionsTaken) => {
        setMessages(prev => {
          const updated = [...prev];
          updated[msgIndex] = {
            ...updated[msgIndex],
            pendingConfirmation: { ...updated[msgIndex].pendingConfirmation!, confirmed: true },
          };
          updated.push({
            role: 'assistant',
            content: `✅ Done! ${actionsTaken.join('. ')}`,
            actionsTaken,
            timestamp: new Date().toISOString(),
          });
          return updated;
        });
        setIsStreaming(false);
        ctx.refreshData?.();
      },
      onError: (err) => {
        setError(err);
        setIsStreaming(false);
      },
    });
  }, [messages, activeThreadId, ctx]);

  const handleReject = useCallback((msgIndex: number) => {
    setMessages(prev => {
      const updated = [...prev];
      updated[msgIndex] = {
        ...updated[msgIndex],
        pendingConfirmation: { ...updated[msgIndex].pendingConfirmation!, confirmed: false },
      };
      updated.push({
        role: 'assistant',
        content: 'Understood — action cancelled.',
        timestamp: new Date().toISOString(),
      });
      return updated;
    });
  }, []);

  const stopGenerating = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Thread list view
  if (showThreadList) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="p-4 pb-2 border-b border-border">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4 text-primary" />
                Chat History
              </SheetTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={startNewChat}>
                <Plus className="h-3 w-3 mr-1" /> New Chat
              </Button>
            </div>
          </SheetHeader>
          <ScrollArea className="flex-1 px-4">
            <div className="py-4 space-y-2">
              {threads.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No chat history yet.</p>
              )}
              {threads.map(t => (
                <button
                  key={t.id}
                  onClick={() => openThread(t.id)}
                  className="w-full text-left rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors flex items-center justify-between group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(t.updatedAt).toLocaleDateString()}</p>
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={(e) => handleDeleteThread(t.id, e)}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </button>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="p-4 pb-2 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              LifeOS Copilot
            </SheetTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { loadThreads().then(setThreads); setShowThreadList(true); }}>
                <MessageSquare className="h-3 w-3 mr-1" /> History
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={startNewChat}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4" ref={scrollRef}>
          <div className="py-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12 space-y-3">
                <Bot className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">Ask me anything about your LifeOS data, or tell me to take action.</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {['What\'s my plan today?', 'Show overdue tasks', 'Create a focus block', 'Triage my inbox'].map(s => (
                    <button key={s} onClick={() => sendMessage(s)}
                      className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted/50 transition-colors text-muted-foreground">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div className={`max-w-[85%] space-y-1 ${msg.role === 'user' ? 'items-end' : ''}`}>
                  <div className={`rounded-lg px-3 py-2 text-sm ${msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 border border-border'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:my-1 [&>ol]:my-1">
                        <ReactMarkdown>{msg.content || (isStreaming && i === messages.length - 1 ? '...' : '')}</ReactMarkdown>
                      </div>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>

                  {/* Confirmation UI */}
                  {msg.pendingConfirmation && msg.pendingConfirmation.confirmed === undefined && (
                    <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-accent-foreground">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Confirmation required
                      </div>
                      <div className="space-y-1">
                        {msg.pendingConfirmation.actions.map((action, j) => (
                          <p key={j} className="text-xs text-muted-foreground">• {action.description}</p>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" className="h-7 text-xs" onClick={() => handleConfirm(i)} disabled={isStreaming}>
                          Approve
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleReject(i)} disabled={isStreaming}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {msg.pendingConfirmation?.confirmed === true && (
                    <div className="flex items-center gap-1 text-[10px] text-primary">
                      <ShieldCheck className="h-3 w-3" /> Approved & executed
                    </div>
                  )}
                  {msg.pendingConfirmation?.confirmed === false && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <X className="h-3 w-3" /> Cancelled
                    </div>
                  )}

                  {/* Actions taken */}
                  {msg.actionsTaken && msg.actionsTaken.length > 0 && (
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                        <Wrench className="h-3 w-3" />
                        {msg.actionsTaken.length} action{msg.actionsTaken.length > 1 ? 's' : ''} taken
                        <ChevronDown className="h-3 w-3" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-1">
                        <div className="space-y-0.5 pl-4">
                          {msg.actionsTaken.map((a, j) => (
                            <p key={j} className="text-[10px] text-muted-foreground">• {a}</p>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* Data used */}
                  {msg.dataUsed && msg.dataUsed.length > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Database className="h-3 w-3" />
                      Used: {msg.dataUsed.join(', ')}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="shrink-0 h-6 w-6 rounded-full bg-foreground/10 flex items-center justify-center mt-0.5">
                    <User className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            ))}

            {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex gap-2.5">
                <div className="shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-primary animate-pulse" />
                </div>
                <div className="bg-muted/50 border border-border rounded-lg px-3 py-2">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Error */}
        {error && (
          <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask or instruct Copilot..."
              className="min-h-[40px] max-h-[120px] resize-none text-sm"
              rows={1}
              disabled={isStreaming}
            />
            {isStreaming ? (
              <Button size="icon" variant="outline" onClick={stopGenerating} className="shrink-0 h-10 w-10">
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="icon" onClick={() => sendMessage(input)} disabled={!input.trim()} className="shrink-0 h-10 w-10">
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-[9px] text-muted-foreground mt-1.5 text-center">
            All tools execute server-side. Destructive actions require approval.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
