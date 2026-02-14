import { supabase } from '@/integrations/supabase/client';

// ── Types ──
export interface CopilotMessage {
  id?: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  actionsTaken?: string[];
  dataUsed?: string[];
  pendingConfirmation?: PendingConfirmation;
  pendingPlan?: CopilotPlan;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: Record<string, unknown>;
  timestamp: string;
}

export interface PendingAction {
  id: string;
  name: string;
  arguments: string;
  description: string;
}

export interface PendingConfirmation {
  actionId: string;
  actions: PendingAction[];
  confirmed?: boolean;
}

export interface CopilotThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

// ── Plan types ──
export interface PlanStep {
  label: string;
  tool: string;
  args: Record<string, unknown>;
  requires_confirmation: boolean;
  expected_impact: { creates: number; updates: number; deletes: number };
}

export interface ScheduleOperation {
  op: 'create' | 'update' | 'noop';
  kind: 'event' | 'focus';
  title: string;
  start_at: string;
  end_at: string;
  recurrence?: { rrule?: string; count?: number; until?: string } | null;
  route: string;
  risk: 'low' | 'medium' | 'high';
  target_id?: string;
}

export interface ScheduleConflict {
  kind: 'event' | 'focus';
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  route: string;
}

// ── Triage types ──
export interface TriageItem {
  item_id: string;
  original_title: string | null;
  original_content: string;
  suggested_action: 'convert_task' | 'convert_note' | 'convert_event' | 'convert_goal' | 'archive' | 'leave';
  confidence: 'low' | 'med' | 'high';
  suggested: {
    title: string;
    notes?: string | null;
    due_date?: string | null;
    start_at?: string | null;
    end_at?: string | null;
    priority?: 'low' | 'med' | 'high' | null;
    tags?: string[];
    category?: string | null;
  };
  reason: string;
}

export interface TriageDecision {
  item_id: string;
  action: string;
  fields: Record<string, unknown>;
}

export interface CopilotPlan {
  title: string;
  goal: string;
  steps: PlanStep[];
  overall_impact: { creates: number; updates: number; deletes: number };
  assumptions: string[];
  questions: string[];
  schedule_operations?: ScheduleOperation[] | null;
  schedule_conflicts?: ScheduleConflict[] | null;
  schedule_alternatives?: { start_at: string; end_at: string; reason: string }[] | null;
  triage_items?: TriageItem[] | null;
  approved?: boolean; // undefined = pending, true = approved, false = cancelled
  requestId?: string;
  planHash?: string;
}

export interface ToolRun {
  stepIndex: number;
  tool: string;
  ok: boolean;
  summary: string;
  entities: { kind: string; id: string; title: string; route: string }[];
  error?: string;
}

export type CopilotMode = 'chat' | 'plan_do';

// ── API Client ──
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copilot`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  };
}

// ── Thread Management ──
export async function loadThreads(): Promise<CopilotThread[]> {
  const { data, error } = await supabase
    .from('copilot_threads')
    .select('id, title, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error || !data) return [];
  return data.map((t: any) => ({
    id: t.id,
    title: t.title || 'New chat',
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  }));
}

export async function loadThreadMessages(threadId: string): Promise<CopilotMessage[]> {
  const { data, error } = await supabase
    .from('copilot_messages')
    .select('id, role, content, tool_name, tool_args, tool_result, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error || !data) return [];
  return data
    .filter((m: any) => m.role === 'user' || m.role === 'assistant')
    .map((m: any) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content || '',
      toolName: m.tool_name,
      toolArgs: m.tool_args,
      toolResult: m.tool_result,
      timestamp: m.created_at,
    }));
}

export async function deleteThread(threadId: string): Promise<void> {
  await supabase.from('copilot_threads').delete().eq('id', threadId);
}

// ── Send Message (supports both chat and plan_do modes) ──
export async function sendCopilotMessage({
  message,
  threadId,
  clientContext,
  mode = 'chat',
  onContent,
  onConfirmationRequired,
  onPlanGenerated,
  onMetadata,
  onDone,
  onError,
  abortSignal,
}: {
  message: string;
  threadId?: string | null;
  clientContext?: { timezone?: string; weekStart?: string };
  mode?: CopilotMode;
  onContent: (content: string) => void;
  onConfirmationRequired: (confirmation: PendingConfirmation, partialContent: string, threadId: string) => void;
  onPlanGenerated?: (plan: CopilotPlan, threadId: string) => void;
  onMetadata: (actionsTaken: string[], dataUsed: string[], threadId: string) => void;
  onDone: (threadId: string) => void;
  onError: (error: string) => void;
  abortSignal?: AbortSignal;
}) {
  try {
    const headers = await getAuthHeaders();
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message, threadId, clientContext, mode }),
      signal: abortSignal,
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({ message: `HTTP ${resp.status}` }));
      const errMsg = errData.message || errData.error || `Error ${resp.status}`;
      onError(JSON.stringify({ message: errMsg, requestId: errData.requestId, stage: errData.stage, status: resp.status }));
      return;
    }

    const contentType = resp.headers.get('Content-Type') || '';

    // JSON response
    if (contentType.includes('application/json')) {
      const data = await resp.json();
      const rThreadId = data.threadId || threadId || '';

      // Plan response
      if (data.type === 'plan' && data.plan) {
        // Attach requestId and planHash to plan for approval validation
        const planWithAuth = { ...data.plan, requestId: data.requestId, planHash: data.planHash };
        onPlanGenerated?.(planWithAuth, rThreadId);
        return;
      }

      // Needs followup
      if (data.type === 'needs_followup') {
        onContent(data.question || 'Could you provide more details?');
        onDone(rThreadId);
        return;
      }

      if (data.type === 'confirmation_required') {
        onMetadata(data.actionsTaken || [], data.dataUsed || [], rThreadId);
        onConfirmationRequired(
          { actionId: data.actionId, actions: data.pendingActions },
          data.message || '',
          rThreadId,
        );
        return;
      }

      if (data.type === 'final') {
        onMetadata(data.actionsTaken || [], data.dataUsed || [], rThreadId);
        onContent(data.content || '');
        onDone(rThreadId);
        return;
      }

      if (data.type === 'confirmation_executed') {
        onMetadata(data.actionsTaken || [], [], rThreadId);
        onContent('✅ Actions executed successfully.');
        onDone(rThreadId);
        return;
      }

      onError(data.error || 'Unknown response');
      return;
    }

    // Streaming response
    if (!resp.body) { onError('No response body'); return; }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';
    let fullContent = '';
    let resolvedThreadId = threadId || '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') break;

        try {
          const parsed = JSON.parse(jsonStr);

          if (parsed.copilot_metadata) {
            resolvedThreadId = parsed.copilot_metadata.threadId || resolvedThreadId;
            onMetadata(parsed.copilot_metadata.actionsTaken || [], parsed.copilot_metadata.dataUsed || [], resolvedThreadId);
            continue;
          }

          const choice = parsed.choices?.[0];
          if (!choice) continue;
          const delta = choice.delta;
          if (delta?.content) {
            fullContent += delta.content;
            onContent(fullContent);
          }
          if (choice.finish_reason === 'stop') break;
        } catch {
          textBuffer = line + '\n' + textBuffer;
          break;
        }
      }
    }

    onDone(resolvedThreadId);
  } catch (err: any) {
    if (err.name === 'AbortError') onDone(threadId || '');
    else onError(err.message || 'Network error');
  }
}

export async function confirmCopilotAction({
  actionId,
  toolCalls,
  threadId,
  onDone,
  onError,
}: {
  actionId: string;
  toolCalls: PendingAction[];
  threadId: string;
  onDone: (actionsTaken: string[]) => void;
  onError: (error: string) => void;
}) {
  try {
    const headers = await getAuthHeaders();
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        threadId,
        confirmedActionId: actionId,
        confirmedToolCalls: toolCalls.map(tc => ({
          name: tc.name,
          arguments: tc.arguments,
        })),
      }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
      onError(errData.error || `Error ${resp.status}`);
      return;
    }

    const data = await resp.json();
    onDone(data.actionsTaken || []);
  } catch (err: any) {
    onError(err.message || 'Network error');
  }
}

// ── Plan approval ──
export async function approvePlan({
  plan,
  threadId,
  onDone,
  onError,
}: {
  plan: CopilotPlan;
  threadId: string;
  onDone: (summary: string, toolRuns: ToolRun[], actionsTaken: string[]) => void;
  onError: (error: string) => void;
}) {
  try {
    const headers = await getAuthHeaders();
    const resp = await fetch(`${CHAT_URL}/approve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ threadId, plan, requestId: plan.requestId, planHash: plan.planHash }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
      onError(errData.error || `Error ${resp.status}`);
      return;
    }

    const data = await resp.json();
    onDone(data.summary || '', data.toolRuns || [], data.actionsTaken || []);
  } catch (err: any) {
    onError(err.message || 'Network error');
  }
}

export async function cancelPlan({
  threadId,
}: {
  threadId: string;
}) {
  try {
    const headers = await getAuthHeaders();
    await fetch(`${CHAT_URL}/cancel`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ threadId }),
    });
  } catch { /* best effort */ }
}
