import { AppData, Task, Goal, CalendarEvent, FocusBlock, Habit, InboxItem, Note } from '@/types';
import { format, addMinutes, isSameDay } from 'date-fns';

// ── Memory Pack Builder ──
export function buildMemoryPack(data: AppData): string {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const parts: string[] = [];

  // Today's agenda
  const todayEvents = data.events.filter(e => isSameDay(new Date(e.startDateTime), now));
  const todayBlocks = data.focusBlocks.filter(fb => isSameDay(new Date(fb.startDateTime), now));
  const agenda = [...todayEvents.map(e => `[Event] ${e.title} ${format(new Date(e.startDateTime), 'HH:mm')}-${format(new Date(e.endDateTime), 'HH:mm')}`),
    ...todayBlocks.map(fb => `[Focus] ${fb.title} ${format(new Date(fb.startDateTime), 'HH:mm')}-${format(new Date(fb.endDateTime), 'HH:mm')} (${fb.status})`)
  ].sort();
  parts.push(`## Today (${todayStr})\nAgenda: ${agenda.length ? agenda.join('; ') : 'Empty'}`);

  // Overdue tasks
  const overdue = data.tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < todayStr);
  if (overdue.length > 0) {
    parts.push(`## Overdue Tasks (${overdue.length})\n${overdue.slice(0, 10).map(t => `- "${t.title}" due ${t.dueDate} [${t.priority}]`).join('\n')}`);
  }

  // Due soon
  const dueSoon = data.tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate >= todayStr && t.dueDate <= format(new Date(now.getTime() + 3 * 86400000), 'yyyy-MM-dd'));
  if (dueSoon.length > 0) {
    parts.push(`## Due Soon (${dueSoon.length})\n${dueSoon.slice(0, 8).map(t => `- "${t.title}" due ${t.dueDate} [${t.priority}]`).join('\n')}`);
  }

  // Active goals
  const activeGoals = data.goals.filter(g => g.status === 'active');
  if (activeGoals.length > 0) {
    parts.push(`## Active Goals (${activeGoals.length})\n${activeGoals.slice(0, 6).map(g => `- "${g.title}" (${g.category}) progress ${g.progressValue}% target ${g.targetDate}`).join('\n')}`);
  }

  // Unprocessed inbox
  const unprocessed = data.inboxItems.filter(i => i.status === 'unprocessed');
  if (unprocessed.length > 0) {
    parts.push(`## Inbox (${unprocessed.length} unprocessed)\n${unprocessed.slice(0, 5).map(i => `- "${i.title || i.content.slice(0, 60)}"`).join('\n')}`);
  }

  // Habits today
  const activeHabits = data.habits.filter(h => h.status === 'active');
  const dailyHabits = activeHabits.filter(h => h.frequency === 'daily');
  const loggedToday = dailyHabits.filter(h => h.logs.includes(todayStr));
  parts.push(`## Habits\nDaily: ${loggedToday.length}/${dailyHabits.length} logged today\n${activeHabits.slice(0, 5).map(h => `- "${h.title}" (${h.frequency}) streak: ${getSimpleStreak(h, todayStr)}`).join('\n')}`);

  // Weekly plan
  const currentWeekStart = getWeekStart(now);
  const weekPlan = data.weeklyPlans.find(p => p.weekStartDate === currentWeekStart);
  if (weekPlan) {
    const committed = data.tasks.filter(t => weekPlan.committedTaskIds.includes(t.id));
    const done = committed.filter(t => t.status === 'done').length;
    parts.push(`## This Week Plan\n${done}/${committed.length} committed tasks done`);
  }

  // Templates available
  if (data.templates.length > 0) {
    parts.push(`## Templates (${data.templates.length})\n${data.templates.slice(0, 5).map(t => `- "${t.name}" (${t.category})`).join('\n')}`);
  }

  // Summary counts
  parts.push(`## Summary\nTasks: ${data.tasks.length} total, ${data.tasks.filter(t => t.status === 'done').length} done\nGoals: ${data.goals.length}\nEvents: ${data.events.length}\nHabits: ${activeHabits.length} active\nNotes: ${data.notes.length}\nInbox: ${data.inboxItems.length} total, ${unprocessed.length} unprocessed`);

  const pack = parts.join('\n\n');
  // Hard limit ~8k chars
  return pack.length > 8000 ? pack.slice(0, 8000) + '\n...(truncated)' : pack;
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

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return format(d, 'yyyy-MM-dd');
}

// ── Tool Execution (client-side) ──
export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  tool_call_id: string;
  output: any;
  actionsTaken: string[];
  dataUsed: string[];
}

export function executeToolCall(
  toolCall: ToolCall,
  data: AppData,
  storeMethods: any
): ToolResult {
  const args = JSON.parse(toolCall.function.arguments);
  const actionsTaken: string[] = [];
  const dataUsed: string[] = [];

  switch (toolCall.function.name) {
    case 'search_lifeos': {
      const results: any[] = [];
      const query = (args.query || '').toLowerCase();
      const types = args.types || [];
      const limit = args.limit || 10;
      const filters = args.filters || {};

      if (types.includes('tasks')) {
        let tasks = data.tasks;
        if (filters.status === 'overdue') tasks = tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < format(new Date(), 'yyyy-MM-dd'));
        else if (filters.status) tasks = tasks.filter(t => t.status === filters.status);
        if (filters.priority) tasks = tasks.filter(t => t.priority === filters.priority);
        const matched = tasks.filter(t => t.title.toLowerCase().includes(query) || (t.description || '').toLowerCase().includes(query) || query === '');
        results.push(...matched.slice(0, limit).map(t => ({
          kind: 'task', id: t.id, title: t.title,
          summary: `Status: ${t.status}, Priority: ${t.priority}, Due: ${t.dueDate || 'none'}`,
          metadata: { status: t.status, priority: t.priority, dueDate: t.dueDate, tags: t.tags, project: t.project }
        })));
        dataUsed.push(`${matched.length} tasks`);
      }
      if (types.includes('goals')) {
        const matched = data.goals.filter(g => g.title.toLowerCase().includes(query) || query === '');
        results.push(...matched.slice(0, limit).map(g => ({
          kind: 'goal', id: g.id, title: g.title,
          summary: `Status: ${g.status}, Category: ${g.category}, Progress: ${g.progressValue}%, Target: ${g.targetDate}`,
          metadata: { status: g.status, category: g.category, progressValue: g.progressValue, targetDate: g.targetDate }
        })));
        dataUsed.push(`${matched.length} goals`);
      }
      if (types.includes('events')) {
        const matched = data.events.filter(e => e.title.toLowerCase().includes(query) || query === '');
        results.push(...matched.slice(0, limit).map(e => ({
          kind: 'event', id: e.id, title: e.title,
          summary: `${format(new Date(e.startDateTime), 'MMM d HH:mm')} - ${format(new Date(e.endDateTime), 'HH:mm')} (${e.category})`,
          metadata: { startDateTime: e.startDateTime, endDateTime: e.endDateTime, category: e.category }
        })));
        dataUsed.push(`${matched.length} events`);
      }
      if (types.includes('habits')) {
        const matched = data.habits.filter(h => h.title.toLowerCase().includes(query) || query === '');
        results.push(...matched.slice(0, limit).map(h => ({
          kind: 'habit', id: h.id, title: h.title,
          summary: `${h.frequency}, Target: ${h.targetCountPerPeriod}/period, Category: ${h.category}`,
          metadata: { frequency: h.frequency, category: h.category, status: h.status }
        })));
        dataUsed.push(`${matched.length} habits`);
      }
      if (types.includes('inbox')) {
        const matched = data.inboxItems.filter(i => (i.content || '').toLowerCase().includes(query) || (i.title || '').toLowerCase().includes(query) || query === '');
        results.push(...matched.slice(0, limit).map(i => ({
          kind: 'inbox', id: i.id, title: i.title || i.content.slice(0, 60),
          summary: `Status: ${i.status}, Source: ${i.source}`,
          metadata: { status: i.status, tags: i.tags, detected: i.detected }
        })));
        dataUsed.push(`${matched.length} inbox items`);
      }
      if (types.includes('notes')) {
        const matched = data.notes.filter(n => n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query) || query === '');
        results.push(...matched.slice(0, limit).map(n => ({
          kind: 'note', id: n.id, title: n.title,
          summary: n.content.slice(0, 100),
          metadata: { tags: n.tags, pinned: n.pinned }
        })));
        dataUsed.push(`${matched.length} notes`);
      }
      if (types.includes('focusBlocks')) {
        const matched = data.focusBlocks.filter(fb => fb.title.toLowerCase().includes(query) || query === '');
        results.push(...matched.slice(0, limit).map(fb => ({
          kind: 'focusBlock', id: fb.id, title: fb.title,
          summary: `${format(new Date(fb.startDateTime), 'MMM d HH:mm')} (${fb.status})`,
          metadata: { status: fb.status, linkedTaskId: fb.linkedTaskId }
        })));
        dataUsed.push(`${matched.length} focus blocks`);
      }

      return { tool_call_id: toolCall.id, output: { results }, actionsTaken: [], dataUsed };
    }

    case 'create_task': {
      const task: Task = {
        id: crypto.randomUUID(),
        title: args.title,
        description: args.description,
        status: 'todo',
        priority: args.priority || 'med',
        dueDate: args.dueDate,
        createdAt: new Date().toISOString(),
        tags: args.tags || [],
        project: args.project,
        estimatedMinutes: args.estimatedMinutes,
        goalId: args.goalId,
        subtasks: [],
      };
      storeMethods.addTask(task);
      actionsTaken.push(`Created task "${task.title}"`);
      return { tool_call_id: toolCall.id, output: { id: task.id }, actionsTaken, dataUsed: [] };
    }

    case 'update_task': {
      storeMethods.updateTask(args.id, args.patch);
      actionsTaken.push(`Updated task ${args.id}`);
      return { tool_call_id: toolCall.id, output: { ok: true }, actionsTaken, dataUsed: [] };
    }

    case 'schedule_task_focus_block': {
      const task = data.tasks.find(t => t.id === args.taskId);
      if (!task) return { tool_call_id: toolCall.id, output: { error: 'Task not found' }, actionsTaken: [], dataUsed: [] };

      let startDT: Date;
      if (args.startTime) {
        const [h, m] = args.startTime.split(':').map(Number);
        startDT = new Date(args.date);
        startDT.setHours(h, m, 0, 0);
      } else {
        startDT = findNextFreeWindow(data, args.date, args.durationMinutes);
      }
      const endDT = addMinutes(startDT, args.durationMinutes);

      storeMethods.createFocusBlockFromTask(args.taskId, startDT.toISOString(), args.durationMinutes);
      actionsTaken.push(`Scheduled focus block for "${task.title}" at ${format(startDT, 'HH:mm')}-${format(endDT, 'HH:mm')}`);
      return {
        tool_call_id: toolCall.id,
        output: { focusBlockId: 'created', scheduledStart: startDT.toISOString(), scheduledEnd: endDT.toISOString() },
        actionsTaken, dataUsed: []
      };
    }

    case 'create_event': {
      const event: CalendarEvent = {
        id: crypto.randomUUID(),
        title: args.title,
        startDateTime: args.startDateTime,
        endDateTime: args.endDateTime,
        category: args.category || 'personal',
        notes: args.notes,
        recurring: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      storeMethods.addEvent(event);
      actionsTaken.push(`Created event "${event.title}"`);
      return { tool_call_id: toolCall.id, output: { id: event.id }, actionsTaken, dataUsed: [] };
    }

    case 'create_goal': {
      const goal: Goal = {
        id: crypto.randomUUID(),
        title: args.title,
        description: args.description,
        category: args.category || 'custom',
        status: 'active',
        startDate: args.startDate,
        targetDate: args.targetDate,
        progressType: args.progressType || 'manual',
        progressValue: 0,
        linkedTaskIds: [],
        milestones: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      storeMethods.addGoal(goal);
      actionsTaken.push(`Created goal "${goal.title}"`);
      return { tool_call_id: toolCall.id, output: { id: goal.id }, actionsTaken, dataUsed: [] };
    }

    case 'triage_inbox': {
      const converted: any[] = [];
      for (const inboxId of args.inboxIds || []) {
        const item = data.inboxItems.find(i => i.id === inboxId);
        if (!item) continue;
        switch (args.convertTo) {
          case 'task':
            storeMethods.convertInboxToTask(inboxId, { title: item.title, ...(args.defaults || {}) });
            break;
          case 'event':
            storeMethods.convertInboxToEvent(inboxId, { title: item.title, ...(args.defaults || {}) });
            break;
          case 'goal':
            storeMethods.convertInboxToGoal(inboxId, { title: item.title, ...(args.defaults || {}) });
            break;
          case 'note':
            storeMethods.convertInboxToNote(inboxId, { title: item.title, content: item.content, ...(args.defaults || {}) });
            break;
          default:
            storeMethods.convertInboxToTask(inboxId, { title: item.title });
        }
        converted.push({ inboxId, kind: args.convertTo, entityId: 'created' });
      }
      actionsTaken.push(`Converted ${converted.length} inbox items to ${args.convertTo}s`);
      return { tool_call_id: toolCall.id, output: { converted }, actionsTaken, dataUsed: [] };
    }

    case 'apply_template': {
      const result = storeMethods.runTemplate(args.templateId, args.runDate);
      if (result) {
        actionsTaken.push(`Applied template: created ${Object.entries(result.summary).map(([k, v]) => `${v} ${k}`).join(', ')}`);
        return { tool_call_id: toolCall.id, output: { created: result.summary }, actionsTaken, dataUsed: [] };
      }
      return { tool_call_id: toolCall.id, output: { error: 'Template not found' }, actionsTaken: [], dataUsed: [] };
    }

    default:
      return { tool_call_id: toolCall.id, output: { error: `Unknown tool: ${toolCall.function.name}` }, actionsTaken: [], dataUsed: [] };
  }
}

function findNextFreeWindow(data: AppData, dateISO: string, durationMinutes: number): Date {
  const day = new Date(dateISO);
  const allItems = [
    ...data.events.filter(e => format(new Date(e.startDateTime), 'yyyy-MM-dd') === dateISO)
      .map(e => ({ start: new Date(e.startDateTime), end: new Date(e.endDateTime) })),
    ...data.focusBlocks.filter(fb => format(new Date(fb.startDateTime), 'yyyy-MM-dd') === dateISO)
      .map(fb => ({ start: new Date(fb.startDateTime), end: new Date(fb.endDateTime) })),
  ].sort((a, b) => a.start.getTime() - b.start.getTime());

  let cursor = new Date(day); cursor.setHours(8, 0, 0, 0);
  const endOfDay = new Date(day); endOfDay.setHours(20, 0, 0, 0);

  for (const item of allItems) {
    if (addMinutes(cursor, durationMinutes) <= item.start) return cursor;
    cursor = item.end > cursor ? item.end : cursor;
  }

  if (addMinutes(cursor, durationMinutes) <= endOfDay) return cursor;
  const fallback = new Date(day); fallback.setHours(9, 0, 0, 0);
  return fallback;
}

// ── Streaming Client ──
export interface CopilotMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  actionsTaken?: string[];
  dataUsed?: string[];
  timestamp: string;
}

export async function streamCopilotMessage({
  messages,
  memoryPack,
  toolResults,
  onDelta,
  onToolCalls,
  onDone,
  onError,
  abortSignal,
}: {
  messages: { role: string; content: string; tool_calls?: any[] }[];
  memoryPack: string;
  toolResults?: { tool_call_id: string; output: any }[];
  onDelta: (text: string) => void;
  onToolCalls: (calls: ToolCall[]) => void;
  onDone: () => void;
  onError: (error: string) => void;
  abortSignal?: AbortSignal;
}) {
  const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copilot`;

  try {
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages, memoryPack, toolResults }),
      signal: abortSignal,
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
      onError(errData.error || `Error ${resp.status}`);
      return;
    }

    if (!resp.body) {
      onError('No response body');
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';
    let collectedToolCalls: Record<number, { id: string; function: { name: string; arguments: string } }> = {};
    let hasToolCalls = false;

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
          const choice = parsed.choices?.[0];
          if (!choice) continue;

          const delta = choice.delta;
          if (delta?.content) onDelta(delta.content);

          // Collect tool calls
          if (delta?.tool_calls) {
            hasToolCalls = true;
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!collectedToolCalls[idx]) {
                collectedToolCalls[idx] = { id: tc.id || '', function: { name: '', arguments: '' } };
              }
              if (tc.id) collectedToolCalls[idx].id = tc.id;
              if (tc.function?.name) collectedToolCalls[idx].function.name = tc.function.name;
              if (tc.function?.arguments) collectedToolCalls[idx].function.arguments += tc.function.arguments;
            }
          }

          if (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') break;
        } catch {
          textBuffer = line + '\n' + textBuffer;
          break;
        }
      }
    }

    // Flush remaining
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split('\n')) {
        if (!raw) continue;
        if (raw.endsWith('\r')) raw = raw.slice(0, -1);
        if (!raw.startsWith('data: ')) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    if (hasToolCalls) {
      const calls = Object.values(collectedToolCalls).filter(tc => tc.id && tc.function.name);
      onToolCalls(calls);
    } else {
      onDone();
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      onDone();
    } else {
      onError(err.message || 'Network error');
    }
  }
}
