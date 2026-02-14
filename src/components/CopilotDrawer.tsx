import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import {
  Send, Square, Bot, User, ChevronDown, Wrench, Database, AlertCircle,
  Sparkles, ShieldCheck, X, Plus, MessageSquare, Trash2, Bug,
  ListChecks, Play, CheckCircle2, XCircle, Edit3, Clock, AlertTriangle, Calendar,
  Inbox, ArrowRight, FileText, Target, Archive,
} from 'lucide-react';
import { useAppContext } from '@/store/AppContext';
import { useAuth } from '@/hooks/useAuth';
import { mergePreferences } from '@/types/preferences';
import {
  CopilotMessage, CopilotThread, CopilotPlan, PendingConfirmation, ToolRun,
  CopilotMode, ScheduleOperation, ScheduleConflict, TriageItem, TriageDecision,
  sendCopilotMessage, confirmCopilotAction, approvePlan, cancelPlan,
  loadThreads, loadThreadMessages, deleteThread,
} from '@/lib/copilot';
import ReactMarkdown from 'react-markdown';

interface CopilotDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMessage?: string;
}

// ── Format time for display ──
function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  } catch { return iso; }
}
function formatDuration(startIso: string, endIso: string): string {
  try {
    const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  } catch { return ''; }
}

// ── Schedule Preview Card ──
function SchedulePreviewCard({
  operations,
  conflicts,
  alternatives,
  onSelectAlternative,
}: {
  operations?: ScheduleOperation[] | null;
  conflicts?: ScheduleConflict[] | null;
  alternatives?: { start_at: string; end_at: string; reason: string }[] | null;
  onSelectAlternative?: (alt: { start_at: string; end_at: string }) => void;
}) {
  if (!operations || operations.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2.5 space-y-2 mt-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Calendar className="h-3.5 w-3.5 text-primary" />
        Schedule Preview
      </div>

      {/* Operations timeline */}
      <div className="space-y-1.5">
        {operations.map((op, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
              op.op === 'create' ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}>
              {op.op.toUpperCase()}
            </span>
            <span className="capitalize text-muted-foreground">{op.kind}:</span>
            <span className="font-medium truncate flex-1">{op.title}</span>
          </div>
        ))}
        {operations.map((op, i) => (
          <div key={`time-${i}`} className="flex items-center gap-2 text-[11px] text-muted-foreground pl-1">
            <Clock className="h-3 w-3" />
            <span>{formatDate(op.start_at)} {formatTime(op.start_at)}–{formatTime(op.end_at)}</span>
            <span className="text-[10px]">({formatDuration(op.start_at, op.end_at)})</span>
            {op.recurrence && (
              <Badge variant="outline" className="text-[9px] h-4">Recurring</Badge>
            )}
          </div>
        ))}
      </div>

      {/* Conflicts */}
      {conflicts && conflicts.length > 0 && (
        <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 space-y-1">
          <div className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''} detected
          </div>
          {conflicts.map((c, i) => (
            <div key={i} className="text-[10px] text-muted-foreground pl-4">
              • {c.title} ({formatTime(c.start_at)}–{formatTime(c.end_at)})
            </div>
          ))}
        </div>
      )}

      {/* Alternatives */}
      {alternatives && alternatives.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground font-medium">Suggested alternatives:</p>
          {alternatives.map((alt, i) => (
            <button
              key={i}
              onClick={() => onSelectAlternative?.(alt)}
              className="w-full text-left rounded border border-border hover:border-primary/40 hover:bg-primary/5 p-1.5 text-[10px] transition-colors"
            >
              <span className="font-medium">{formatDate(alt.start_at)} {formatTime(alt.start_at)}–{formatTime(alt.end_at)}</span>
              <span className="text-muted-foreground ml-1">— {alt.reason}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Action label helpers ──
const ACTION_LABELS: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  convert_task: { label: 'Task', icon: ListChecks, color: 'text-primary' },
  convert_note: { label: 'Note', icon: FileText, color: 'text-blue-500' },
  convert_event: { label: 'Event', icon: Calendar, color: 'text-purple-500' },
  convert_goal: { label: 'Goal', icon: Target, color: 'text-amber-500' },
  archive: { label: 'Archive', icon: Archive, color: 'text-muted-foreground' },
  leave: { label: 'Skip', icon: X, color: 'text-muted-foreground' },
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'text-primary bg-primary/10',
  med: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
  low: 'text-muted-foreground bg-muted',
};

// ── Inbox Triage Review Card ──
function InboxTriageReviewCard({
  items,
  onDecisionsChange,
  decisions,
}: {
  items: TriageItem[];
  decisions: TriageDecision[];
  onDecisionsChange: (decisions: TriageDecision[]) => void;
}) {
  if (!items || items.length === 0) return null;

  // Summary chips
  const summary = { convert_task: 0, convert_note: 0, convert_event: 0, convert_goal: 0, archive: 0, leave: 0 };
  for (const d of decisions) {
    if (d.action in summary) (summary as any)[d.action]++;
  }

  const updateDecision = (itemId: string, patch: Partial<TriageDecision>) => {
    onDecisionsChange(decisions.map(d => d.item_id === itemId ? { ...d, ...patch } : d));
  };

  const hasLowConfidence = items.some(it => {
    const d = decisions.find(dd => dd.item_id === it.item_id);
    return d && d.action !== 'leave' && it.confidence === 'low';
  });

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2.5 space-y-2 mt-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Inbox className="h-3.5 w-3.5 text-primary" />
        Inbox Triage Review
        <span className="text-muted-foreground font-normal">({items.length} items)</span>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-1.5">
        {summary.convert_task > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">Tasks: {summary.convert_task}</span>}
        {summary.convert_note > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">Notes: {summary.convert_note}</span>}
        {summary.convert_event > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500">Events: {summary.convert_event}</span>}
        {summary.convert_goal > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">Goals: {summary.convert_goal}</span>}
        {summary.archive > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Archive: {summary.archive}</span>}
        {summary.leave > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Skip: {summary.leave}</span>}
      </div>

      {/* Low confidence warning */}
      {hasLowConfidence && (
        <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded px-2 py-1">
          <AlertTriangle className="h-3 w-3" />
          Some items have low confidence — review before applying.
        </div>
      )}

      {/* Items list */}
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
        {items.map(item => {
          const d = decisions.find(dd => dd.item_id === item.item_id);
          if (!d) return null;
          const actionInfo = ACTION_LABELS[d.action] || ACTION_LABELS.leave;
          const IconComp = actionInfo.icon;

          return (
            <div key={item.item_id} className="rounded border border-border bg-background p-2 space-y-1">
              {/* Row 1: Original content + confidence */}
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] text-muted-foreground truncate flex-1" title={item.original_content}>
                  {item.original_title || item.original_content.slice(0, 60)}
                </p>
                <span className={`text-[9px] px-1 py-0.5 rounded font-medium shrink-0 ${CONFIDENCE_STYLES[item.confidence]}`}>
                  {item.confidence.toUpperCase()}
                </span>
              </div>

              {/* Row 2: Action selector + title */}
              <div className="flex items-center gap-1.5">
                <select
                  value={d.action}
                  onChange={(e) => updateDecision(item.item_id, { action: e.target.value })}
                  className="text-[10px] h-6 px-1 rounded border border-border bg-background text-foreground"
                >
                  <option value="convert_task">→ Task</option>
                  <option value="convert_note">→ Note</option>
                  <option value="convert_event">→ Event</option>
                  <option value="convert_goal">→ Goal</option>
                  <option value="archive">Archive</option>
                  <option value="leave">Skip</option>
                </select>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={(d.fields?.title as string) || ''}
                  onChange={(e) => updateDecision(item.item_id, { fields: { ...d.fields, title: e.target.value } })}
                  className="text-[11px] h-6 px-1.5 rounded border border-border bg-background text-foreground flex-1 min-w-0"
                  placeholder="Title"
                />
              </div>

              {/* Row 3: Reason */}
              {item.reason && (
                <p className="text-[9px] text-muted-foreground italic">{item.reason}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Plan Preview Card ──
function PlanPreviewCard({
  plan,
  onApprove,
  onCancel,
  onEdit,
  isExecuting,
  executionResult,
  triageDecisions,
  onTriageDecisionsChange,
  defaultShowTools = false,
  defaultExpanded = false,
}: {
  plan: CopilotPlan;
  onApprove: () => void;
  onCancel: () => void;
  onEdit: () => void;
  isExecuting: boolean;
  executionResult?: { summary: string; toolRuns: ToolRun[] } | null;
  triageDecisions?: TriageDecision[];
  onTriageDecisionsChange?: (decisions: TriageDecision[]) => void;
  defaultShowTools?: boolean;
  defaultExpanded?: boolean;
}) {
  const [showTools, setShowTools] = useState(defaultShowTools);
  const isApproved = plan.approved === true;
  const isCancelled = plan.approved === false;
  const isPending = plan.approved === undefined;

  const hasScheduleOps = plan.schedule_operations && plan.schedule_operations.length > 0;
  const hasTriageItems = plan.triage_items && plan.triage_items.length > 0;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{plan.title}</span>
        <Badge variant="outline" className="text-[10px] h-5">
          {plan.steps.length} step{plan.steps.length > 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Schedule preview (if scheduling plan) */}
      {hasScheduleOps && (
        <SchedulePreviewCard
          operations={plan.schedule_operations}
          conflicts={plan.schedule_conflicts}
          alternatives={plan.schedule_alternatives}
        />
      )}

      {/* Triage review (if triage plan) */}
      {hasTriageItems && triageDecisions && onTriageDecisionsChange && (
        <InboxTriageReviewCard
          items={plan.triage_items!}
          decisions={triageDecisions}
          onDecisionsChange={onTriageDecisionsChange}
        />
      )}

      {/* Steps */}
      <div className="space-y-1.5">
        {plan.steps.map((step, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-[10px] font-mono text-muted-foreground mt-0.5 w-4 shrink-0">{i + 1}.</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs">{step.label}</p>
              {step.requires_confirmation && (
                <span className="text-[9px] text-amber-600 dark:text-amber-400">⚠️ Requires confirmation</span>
              )}
            </div>
            {executionResult?.toolRuns?.[i] && (
              executionResult.toolRuns[i].ok
                ? <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                : <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Impact summary */}
      <div className="flex gap-3 text-[10px] text-muted-foreground">
        {plan.overall_impact.creates > 0 && (
          <span className="text-primary">+{plan.overall_impact.creates} create{plan.overall_impact.creates > 1 ? 's' : ''}</span>
        )}
        {plan.overall_impact.updates > 0 && (
          <span className="text-amber-600 dark:text-amber-400">~{plan.overall_impact.updates} update{plan.overall_impact.updates > 1 ? 's' : ''}</span>
        )}
        {(plan.overall_impact.archives || 0) > 0 && (
          <span className="text-muted-foreground">📦 {plan.overall_impact.archives} archive{plan.overall_impact.archives > 1 ? 's' : ''}</span>
        )}
        {plan.overall_impact.deletes > 0 && (
          <span className="text-destructive">⚠️ {plan.overall_impact.deletes} delete{plan.overall_impact.deletes > 1 ? 's' : ''} (destructive)</span>
        )}
      </div>

      {/* Assumptions */}
      {plan.assumptions.length > 0 && (
        <div className="text-[10px] text-muted-foreground">
          <span className="font-medium">Assumptions: </span>
          {plan.assumptions.join('; ')}
        </div>
      )}

      {/* Tools (collapsed) */}
      <Collapsible open={showTools} onOpenChange={setShowTools}>
        <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
          <Wrench className="h-3 w-3" />
          Tools to be called
          <ChevronDown className={`h-3 w-3 transition-transform ${showTools ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-1">
          <div className="space-y-0.5 pl-4">
            {plan.steps.map((step, i) => (
              <p key={i} className="text-[10px] text-muted-foreground font-mono">
                {step.tool}({Object.keys(step.args).join(', ')})
              </p>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Execution result */}
      {executionResult && (
        <div className="rounded border border-primary/20 bg-primary/5 p-2 text-xs">
          <ReactMarkdown>{executionResult.summary}</ReactMarkdown>
        </div>
      )}

      {/* Buttons */}
      {isPending && !executionResult && (
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground italic">
            Copilot will not change anything until you approve.
          </p>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs gap-1" onClick={onApprove} disabled={isExecuting}>
              <Play className="h-3 w-3" /> Approve & Apply
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onEdit} disabled={isExecuting}>
              <Edit3 className="h-3 w-3" /> Edit
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel} disabled={isExecuting}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {isApproved && !executionResult && isExecuting && (
        <div className="flex items-center gap-2 text-xs text-primary">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Executing plan…
        </div>
      )}

      {isCancelled && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <X className="h-3 w-3" /> Plan cancelled
        </div>
      )}
    </div>
  );
}

export function CopilotDrawer({ open, onOpenChange, initialMessage }: CopilotDrawerProps) {
  const ctx = useAppContext();
  const { profile } = useAuth();
  const userPrefs = mergePreferences(profile?.preferences);
  const [threads, setThreads] = useState<CopilotThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDebug, setErrorDebug] = useState<{ requestId?: string; status?: number; response?: string; route?: string } | null>(null);
  const [showThreadList, setShowThreadList] = useState(false);
  const [mode, setMode] = useState<CopilotMode>(userPrefs.copilot.default_mode === 'plan_do' ? 'plan_do' : 'chat');
  const [executionResults, setExecutionResults] = useState<Map<number, { summary: string; toolRuns: ToolRun[] }>>(new Map());
  const [triageDecisionsMap, setTriageDecisionsMap] = useState<Map<number, TriageDecision[]>>(new Map());
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
    setExecutionResults(new Map());
  }, []);

  const startNewChat = useCallback(() => {
    setActiveThreadId(null);
    setMessages([]);
    setShowThreadList(false);
    setExecutionResults(new Map());
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
    setErrorDebug(null);
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
      mode,
      onContent: (content) => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && !last.pendingPlan) {
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
      onPlanGenerated: (plan, threadId) => {
        setActiveThreadId(threadId);
        const planMsg: CopilotMessage = {
          role: 'assistant',
          content: `📋 Here's my plan:`,
          pendingPlan: plan,
          timestamp: new Date().toISOString(),
        };
        const msgIndex = messages.length + 1; // +1 for user msg already added
        // Initialize triage decisions from plan's triage_items
        if (plan.triage_items && plan.triage_items.length > 0) {
          const includesMed = userPrefs.triage.default_confidence === 'high_med';
          const initialDecisions: TriageDecision[] = plan.triage_items.map(item => ({
            item_id: item.item_id,
            action: (item.confidence === 'high' || (includesMed && item.confidence === 'med')) ? item.suggested_action : 'leave',
            fields: { title: item.suggested.title, ...( item.suggested.due_date ? { due_date: item.suggested.due_date } : {}), ...(item.suggested.priority ? { priority: item.suggested.priority } : {}), ...(item.suggested.tags?.length ? { tags: item.suggested.tags } : {}) },
          }));
          setTriageDecisionsMap(prev => new Map(prev).set(msgIndex, initialDecisions));
        }
        setMessages(prev => [...prev, planMsg]);
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
          if (i === prev.length - 1 && m.role === 'assistant' && !m.pendingPlan) {
            return {
              ...m,
              actionsTaken: currentActionsTaken.length > 0 ? currentActionsTaken : undefined,
              dataUsed: currentDataUsed.length > 0 ? currentDataUsed : undefined,
            };
          }
          return m;
        }));
        loadThreads().then(setThreads);
        ctx.refreshData?.();
      },
      onError: (err) => {
        setError(err);
        try {
          const parsed = JSON.parse(err);
          setErrorDebug({ requestId: parsed.requestId, stage: parsed.stage, status: parsed.status, response: err, route: window.location.pathname } as any);
        } catch {
          setErrorDebug({ response: err, route: window.location.pathname });
        }
        setIsStreaming(false);
      },
      abortSignal: abortController.signal,
    });
  }, [messages, isStreaming, activeThreadId, ctx, mode]);

  const handleApprovePlan = useCallback(async (msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg.pendingPlan || !activeThreadId) return;

    // Inject triage decisions into plan steps if available
    const plan = { ...msg.pendingPlan };
    const decisions = triageDecisionsMap.get(msgIndex);
    if (decisions && decisions.length > 0) {
      // Find triage_commit step and inject decisions
      plan.steps = plan.steps.map(step => {
        if (step.tool === 'triage_commit') {
          return { ...step, args: { ...step.args, decisions: decisions.filter(d => d.action !== 'leave'), confirm: true } };
        }
        return step;
      });
    }

    setMessages(prev => prev.map((m, i) =>
      i === msgIndex ? { ...m, pendingPlan: { ...m.pendingPlan!, approved: true } } : m
    ));
    setIsStreaming(true);
    setError(null);

    await approvePlan({
      plan,
      threadId: activeThreadId,
      onDone: (summary, toolRuns, actionsTaken) => {
        setExecutionResults(prev => new Map(prev).set(msgIndex, { summary, toolRuns }));
        setMessages(prev => {
          const updated = [...prev];
          updated.push({
            role: 'assistant',
            content: summary,
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

  const handleCancelPlan = useCallback(async (msgIndex: number) => {
    setMessages(prev => prev.map((m, i) =>
      i === msgIndex ? { ...m, pendingPlan: { ...m.pendingPlan!, approved: false } } : m
    ));
    if (activeThreadId) {
      await cancelPlan({ threadId: activeThreadId });
    }
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: 'Plan cancelled.',
      timestamp: new Date().toISOString(),
    }]);
  }, [activeThreadId]);

  const handleEditPlan = useCallback((msgIndex: number) => {
    setMessages(prev => prev.map((m, i) =>
      i === msgIndex ? { ...m, pendingPlan: { ...m.pendingPlan!, approved: false } } : m
    ));
    setInput('');
    textareaRef.current?.focus();
  }, []);

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
              {/* Mode toggle */}
              <div className="flex items-center rounded-md border border-border overflow-hidden mr-1">
                <button
                  onClick={() => setMode('chat')}
                  className={`px-2 py-1 text-[10px] font-medium transition-colors ${
                    mode === 'chat'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setMode('plan_do')}
                  className={`px-2 py-1 text-[10px] font-medium transition-colors ${
                    mode === 'plan_do'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Plan & Do
                </button>
              </div>
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
                <p className="text-sm text-muted-foreground">
                  {mode === 'plan_do'
                    ? 'Tell me what to do. I\'ll create a plan for your approval before acting.'
                    : 'Ask me anything about your LifeOS data, or tell me to take action.'}
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {mode === 'plan_do'
                    ? ['Create 3 tasks for my thesis', 'Block 90min tomorrow for deep work', 'Schedule gym every weekday at 8am'].map(s => (
                        <button key={s} onClick={() => sendMessage(s)}
                          className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted/50 transition-colors text-muted-foreground">
                          {s}
                        </button>
                      ))
                    : ['What\'s my plan today?', 'Show overdue tasks', 'Create a focus block', 'Triage my inbox'].map(s => (
                        <button key={s} onClick={() => sendMessage(s)}
                          className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted/50 transition-colors text-muted-foreground">
                          {s}
                        </button>
                      ))
                  }
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

                  {/* Plan Preview */}
                  {msg.pendingPlan && (
                    <PlanPreviewCard
                      plan={msg.pendingPlan}
                      onApprove={() => handleApprovePlan(i)}
                      onCancel={() => handleCancelPlan(i)}
                      onEdit={() => handleEditPlan(i)}
                      isExecuting={isStreaming}
                      executionResult={executionResults.get(i)}
                      triageDecisions={triageDecisionsMap.get(i)}
                      onTriageDecisionsChange={(decisions) => setTriageDecisionsMap(prev => new Map(prev).set(i, decisions))}
                      defaultShowTools={userPrefs.copilot.show_tool_details}
                      defaultExpanded={userPrefs.copilot.confirm_level === 'strict'}
                    />
                  )}

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
          <div className="mx-4 mb-2 space-y-1.5">
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 min-w-0 truncate">{error}</span>
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => { setError(null); setErrorDebug(null); }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            {errorDebug && (
              <Button
                variant="outline" size="sm"
                className="h-6 text-[10px] gap-1 w-full"
                onClick={() => {
                  const pack = {
                    requestId: errorDebug.requestId || 'unknown',
                    status: errorDebug.status,
                    response: errorDebug.response?.slice(0, 500),
                    route: errorDebug.route,
                    userId: 'masked',
                    ts: new Date().toISOString(),
                  };
                  navigator.clipboard.writeText(JSON.stringify(pack, null, 2));
                }}
              >
                <Bug className="h-3 w-3" /> Copy Debug Pack
              </Button>
            )}
            <Button
              variant="ghost" size="sm"
              className="h-6 text-[10px] gap-1 w-full text-muted-foreground"
              onClick={() => { setError(null); setErrorDebug(null); sendMessage(messages[messages.length - 2]?.content || input || ''); }}
            >
              Retry last message
            </Button>
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
              placeholder={mode === 'plan_do' ? 'Describe what you want done…' : 'Ask or instruct Copilot...'}
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
            {mode === 'plan_do'
              ? 'Plan & Do: Copilot will propose a plan for your approval before acting.'
              : 'All tools execute server-side. Destructive actions require approval.'}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
