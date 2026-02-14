import { AppData, Habit } from '@/types';
import { format, isSameDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

// ── Structured Memory Pack Builder ──
export interface MemoryPackBlock {
  section: string;
  data: Record<string, unknown>;
}

export function buildMemoryPack(data: AppData): string {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const blocks: MemoryPackBlock[] = [];

  // Today's agenda
  const todayEvents = data.events.filter(e => isSameDay(new Date(e.startDateTime), now));
  const todayBlocks = data.focusBlocks.filter(fb => isSameDay(new Date(fb.startDateTime), now));
  blocks.push({
    section: 'today',
    data: {
      date: todayStr,
      events: todayEvents.slice(0, 10).map(e => ({ id: e.id, title: e.title, start: e.startDateTime, end: e.endDateTime, category: e.category })),
      focusBlocks: todayBlocks.slice(0, 10).map(fb => ({ id: fb.id, title: fb.title, start: fb.startDateTime, end: fb.endDateTime, status: fb.status })),
    },
  });

  // Overdue tasks
  const overdue = data.tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < todayStr);
  if (overdue.length > 0) {
    blocks.push({
      section: 'overdue_tasks',
      data: {
        count: overdue.length,
        items: overdue.slice(0, 10).map(t => ({ id: t.id, title: t.title, dueDate: t.dueDate, priority: t.priority })),
      },
    });
  }

  // Due soon
  const threeDaysLater = format(new Date(now.getTime() + 3 * 86400000), 'yyyy-MM-dd');
  const dueSoon = data.tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate >= todayStr && t.dueDate <= threeDaysLater);
  if (dueSoon.length > 0) {
    blocks.push({
      section: 'due_soon',
      data: {
        count: dueSoon.length,
        items: dueSoon.slice(0, 8).map(t => ({ id: t.id, title: t.title, dueDate: t.dueDate, priority: t.priority })),
      },
    });
  }

  // Active goals
  const activeGoals = data.goals.filter(g => g.status === 'active');
  if (activeGoals.length > 0) {
    blocks.push({
      section: 'active_goals',
      data: {
        count: activeGoals.length,
        items: activeGoals.slice(0, 6).map(g => ({ id: g.id, title: g.title, category: g.category, progress: g.progressValue, targetDate: g.targetDate })),
      },
    });
  }

  // Unprocessed inbox
  const unprocessed = data.inboxItems.filter(i => i.status === 'unprocessed');
  if (unprocessed.length > 0) {
    blocks.push({
      section: 'inbox',
      data: {
        count: unprocessed.length,
        items: unprocessed.slice(0, 5).map(i => ({ id: i.id, title: i.title || i.content.slice(0, 60), content: i.content.slice(0, 100) })),
      },
    });
  }

  // Habits
  const activeHabits = data.habits.filter(h => h.status === 'active');
  const dailyHabits = activeHabits.filter(h => h.frequency === 'daily');
  const loggedToday = dailyHabits.filter(h => h.logs.includes(todayStr));
  blocks.push({
    section: 'habits',
    data: {
      dailyLoggedToday: loggedToday.length,
      dailyTotal: dailyHabits.length,
      items: activeHabits.slice(0, 5).map(h => ({ id: h.id, title: h.title, frequency: h.frequency, streak: getSimpleStreak(h, todayStr) })),
    },
  });

  // Summary counts
  blocks.push({
    section: 'summary',
    data: {
      tasks: { total: data.tasks.length, done: data.tasks.filter(t => t.status === 'done').length },
      goals: data.goals.length,
      events: data.events.length,
      habits: activeHabits.length,
      notes: data.notes.length,
      inbox: { total: data.inboxItems.length, unprocessed: unprocessed.length },
      templates: data.templates.length,
    },
  });

  // Templates
  if (data.templates.length > 0) {
    blocks.push({
      section: 'templates',
      data: {
        items: data.templates.slice(0, 5).map(t => ({ id: t.id, name: t.name, category: t.category })),
      },
    });
  }

  // Convert to compact JSON string
  const pack = JSON.stringify(blocks);
  return pack.length > 10000 ? pack.slice(0, 10000) + '...(truncated)' : pack;
}

function getSimpleStreak(habit: Habit, todayStr: string): number {
  let streak = 0;
  const d = new Date(todayStr);
  for (let i = 0; i < 60; i++) {
    const ds = format(d, 'yyyy-MM-dd');
    if (habit.logs.includes(ds)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

// ── Types ──
export interface CopilotMessage {
  role: 'user' | 'assistant';
  content: string;
  actionsTaken?: string[];
  dataUsed?: string[];
  pendingConfirmation?: PendingConfirmation;
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

export async function sendCopilotMessage({
  messages,
  memoryPack,
  onContent,
  onConfirmationRequired,
  onMetadata,
  onDone,
  onError,
  abortSignal,
}: {
  messages: { role: string; content: string }[];
  memoryPack: string;
  onContent: (content: string) => void;
  onConfirmationRequired: (confirmation: PendingConfirmation, partialContent: string) => void;
  onMetadata: (actionsTaken: string[], dataUsed: string[]) => void;
  onDone: () => void;
  onError: (error: string) => void;
  abortSignal?: AbortSignal;
}) {
  try {
    const headers = await getAuthHeaders();
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages, memoryPack }),
      signal: abortSignal,
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
      onError(errData.error || `Error ${resp.status}`);
      return;
    }

    const contentType = resp.headers.get('Content-Type') || '';

    // JSON response (confirmation required, or final non-streamed)
    if (contentType.includes('application/json')) {
      const data = await resp.json();

      if (data.type === 'confirmation_required') {
        onMetadata(data.actionsTaken || [], data.dataUsed || []);
        onConfirmationRequired(
          { actionId: data.actionId, actions: data.pendingActions },
          data.message || ''
        );
        return;
      }

      if (data.type === 'final') {
        onMetadata(data.actionsTaken || [], data.dataUsed || []);
        onContent(data.content || '');
        onDone();
        return;
      }

      if (data.type === 'confirmation_executed') {
        onMetadata(data.actionsTaken || [], []);
        onContent('✅ Actions executed successfully.');
        onDone();
        return;
      }

      onError(data.error || 'Unknown response');
      return;
    }

    // Streaming response (text/event-stream)
    if (!resp.body) { onError('No response body'); return; }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';
    let fullContent = '';

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

          // Check for copilot metadata event
          if (parsed.copilot_metadata) {
            onMetadata(parsed.copilot_metadata.actionsTaken || [], parsed.copilot_metadata.dataUsed || []);
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
          // Incomplete JSON, put back
          textBuffer = line + '\n' + textBuffer;
          break;
        }
      }
    }

    onDone();
  } catch (err: any) {
    if (err.name === 'AbortError') onDone();
    else onError(err.message || 'Network error');
  }
}

export async function confirmCopilotAction({
  actionId,
  toolCalls,
  onDone,
  onError,
}: {
  actionId: string;
  toolCalls: PendingAction[];
  onDone: (actionsTaken: string[]) => void;
  onError: (error: string) => void;
}) {
  try {
    const headers = await getAuthHeaders();
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        confirmedActionId: actionId,
        confirmedToolCalls: toolCalls.map(tc => ({
          name: tc.name,
          arguments: tc.arguments,
        })),
        messages: [],
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
