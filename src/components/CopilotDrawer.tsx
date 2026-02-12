import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Send, Square, Bot, User, ChevronDown, Wrench, Database, AlertCircle, Sparkles } from 'lucide-react';
import { useAppContext } from '@/store/AppContext';
import { buildMemoryPack, CopilotMessage, streamCopilotMessage, executeToolCall, ToolCall } from '@/lib/copilot';
import ReactMarkdown from 'react-markdown';

interface CopilotDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMessage?: string;
}

const COPILOT_STORAGE_KEY = 'lifeos-copilot-history';
const MAX_HISTORY = 30;

function loadHistory(): CopilotMessage[] {
  try {
    const raw = localStorage.getItem(COPILOT_STORAGE_KEY);
    if (raw) return JSON.parse(raw).slice(-MAX_HISTORY);
  } catch { /* ignore */ }
  return [];
}

function saveHistory(messages: CopilotMessage[]) {
  localStorage.setItem(COPILOT_STORAGE_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
}

export function CopilotDrawer({ open, onOpenChange, initialMessage }: CopilotDrawerProps) {
  const ctx = useAppContext();
  const [messages, setMessages] = useState<CopilotMessage[]>(loadHistory);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const processedInitialRef = useRef<string | null>(null);

  // Handle initial message
  useEffect(() => {
    if (open && initialMessage && initialMessage !== processedInitialRef.current && !isStreaming) {
      processedInitialRef.current = initialMessage;
      setInput('');
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
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 200);
    }
  }, [open]);

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

    const memoryPack = buildMemoryPack(ctx.data);
    let allActionsTaken: string[] = [];
    let allDataUsed: string[] = [];

    // Build API messages (role + content only for context)
    const apiMessages: { role: string; content: string }[] = newMsgs.map(m => ({ role: m.role, content: m.content }));

    // Tool calling loop
    let currentMessages: { role: string; content: string; [key: string]: any }[] = apiMessages;
    let toolResults: any[] | undefined;
    let maxRounds = 5;
    let assistantContent = '';

    const runRound = async () => {
      assistantContent = '';

      await streamCopilotMessage({
        messages: currentMessages,
        memoryPack,
        toolResults,
        onDelta: (chunk) => {
          assistantContent += chunk;
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') {
              return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
            }
            return [...prev, {
              role: 'assistant', content: assistantContent,
              actionsTaken: allActionsTaken, dataUsed: allDataUsed,
              timestamp: new Date().toISOString()
            }];
          });
        },
        onToolCalls: async (calls: ToolCall[]) => {
          // Execute tool calls client-side
          const results = calls.map(tc => {
            const result = executeToolCall(tc, ctx.data, ctx);
            allActionsTaken.push(...result.actionsTaken);
            allDataUsed.push(...result.dataUsed);
            return { tool_call_id: tc.id, output: result.output };
          });

          // Add assistant message with tool_calls to conversation
          currentMessages = [
            ...currentMessages,
            { role: 'assistant', content: assistantContent || '', tool_calls: calls },
            ...results.map(r => ({ role: 'tool' as const, content: JSON.stringify(r.output), tool_call_id: r.tool_call_id }))
          ];
          toolResults = results;

          maxRounds--;
          if (maxRounds > 0 && !abortController.signal.aborted) {
            await runRound();
          } else {
            finishStreaming();
          }
        },
        onDone: () => {
          finishStreaming();
        },
        onError: (err) => {
          setError(err);
          setIsStreaming(false);
        },
        abortSignal: abortController.signal,
      });
    };

    const finishStreaming = () => {
      setIsStreaming(false);
      abortRef.current = null;

      setMessages(prev => {
        const updated = prev.map((m, i) => {
          if (i === prev.length - 1 && m.role === 'assistant') {
            return { ...m, actionsTaken: allActionsTaken.length > 0 ? allActionsTaken : undefined, dataUsed: allDataUsed.length > 0 ? allDataUsed : undefined };
          }
          return m;
        });
        saveHistory(updated);
        return updated;
      });
    };

    await runRound();
  }, [messages, isStreaming, ctx]);

  const stopGenerating = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem(COPILOT_STORAGE_KEY);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="p-4 pb-2 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              LifeOS Copilot
            </SheetTitle>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={clearHistory}>Clear</Button>
            )}
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
            Copilot uses your LifeOS data to answer. Actions modify your data directly.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
