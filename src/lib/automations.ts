import { AppData, Task, FocusBlock, NotificationItem } from '@/types';
import { Template, TemplateItem, AutomationRule, AutomationRunLog, AutomationCondition } from '@/types/templates';
import { format, addDays, addMinutes, differenceInMinutes, startOfWeek } from 'date-fns';
import { detectInboxContent, deriveTitle } from '@/lib/inbox';

// ── Built-in Templates ──
const now = new Date().toISOString();

export const BUILT_IN_TEMPLATES: Template[] = [
  {
    id: 'tpl-weekly-reset', name: 'Weekly Reset (Monday)', description: 'Start your week strong with planning tasks',
    category: 'weekly', createdAt: now, updatedAt: now, isBuiltIn: true,
    defaultSchedule: { type: 'weekly', time: '09:00', daysOfWeek: [1] },
    items: [
      { kind: 'task', title: 'Review goals progress', priority: 'high', dueOffsetDays: 0, tags: ['planning'] },
      { kind: 'task', title: 'Clean inbox to zero', priority: 'med', dueOffsetDays: 0, tags: ['planning'] },
      { kind: 'task', title: 'Plan this week\'s priorities', priority: 'high', dueOffsetDays: 0, tags: ['planning'], autoCommitToWeek: true },
      { kind: 'task', title: 'Schedule focus blocks for the week', priority: 'med', dueOffsetDays: 0, tags: ['planning'] },
      { kind: 'task', title: 'Review and archive completed items', priority: 'low', dueOffsetDays: 0, tags: ['planning'] },
    ],
  },
  {
    id: 'tpl-study-sprint', name: 'Study Sprint (Exam Week)', description: 'Intensive study blocks + practice habit',
    category: 'study', createdAt: now, updatedAt: now, isBuiltIn: true,
    defaultSchedule: { type: 'none' },
    items: [
      { kind: 'focusBlock', title: 'Morning study session', startTime: '09:00', durationMinutes: 90, dayOffsetDays: 0 },
      { kind: 'focusBlock', title: 'Afternoon study session', startTime: '14:00', durationMinutes: 90, dayOffsetDays: 0 },
      { kind: 'task', title: 'Review study notes', priority: 'high', dueOffsetDays: 0, tags: ['study'] },
      { kind: 'task', title: 'Practice problems set', priority: 'high', dueOffsetDays: 1, tags: ['study'] },
      { kind: 'habit', title: 'Practice problems', frequency: 'weekly', targetCountPerPeriod: 5, category: 'study' },
    ],
  },
  {
    id: 'tpl-morning-routine', name: 'Morning Routine', description: 'Build a consistent morning routine',
    category: 'daily', createdAt: now, updatedAt: now, isBuiltIn: true,
    defaultSchedule: { type: 'none' },
    items: [
      { kind: 'habit', title: 'Meditate', frequency: 'daily', targetCountPerPeriod: 7, category: 'health' },
      { kind: 'habit', title: 'Exercise', frequency: 'daily', targetCountPerPeriod: 7, category: 'health' },
      { kind: 'habit', title: 'Journal', frequency: 'daily', targetCountPerPeriod: 7, category: 'personal' },
      { kind: 'focusBlock', title: 'Morning focus block', startTime: '08:00', durationMinutes: 60, dayOffsetDays: 0 },
    ],
  },
  {
    id: 'tpl-fitness-week', name: 'Fitness Week', description: 'Structured workout week with events and habits',
    category: 'health', createdAt: now, updatedAt: now, isBuiltIn: true,
    defaultSchedule: { type: 'none' },
    items: [
      { kind: 'event', title: 'Upper body workout', startTime: '07:00', durationMinutes: 60, category: 'health', dayOffsetDays: 0 },
      { kind: 'event', title: 'Cardio session', startTime: '07:00', durationMinutes: 45, category: 'health', dayOffsetDays: 2 },
      { kind: 'event', title: 'Lower body workout', startTime: '07:00', durationMinutes: 60, category: 'health', dayOffsetDays: 4 },
      { kind: 'habit', title: 'Workout 4x/week', frequency: 'weekly', targetCountPerPeriod: 4, category: 'health' },
    ],
  },
];

// ── Built-in Automations ──
export const BUILT_IN_AUTOMATIONS: AutomationRule[] = [
  {
    id: 'auto-deep-work-high', name: 'Auto-schedule deep work for High priority tasks',
    enabled: false, createdAt: now, updatedAt: now,
    trigger: { type: 'task_status_changed' },
    conditions: [{ type: 'task_priority_is', value: 'high' }],
    actions: [{ type: 'create_focus_block_next_free', payload: { title: 'Deep work', durationMinutes: 60 } }],
    throttle: { maxRunsPerDay: 3, cooldownMinutes: 30 },
  },
  {
    id: 'auto-inbox-overflow', name: 'Inbox overflow warning',
    enabled: false, createdAt: now, updatedAt: now,
    trigger: { type: 'time', schedule: { type: 'daily', time: '18:00' } },
    conditions: [{ type: 'limit_unprocessed_inbox_gte', value: 10 }],
    actions: [{ type: 'create_notification', payload: { type: 'inbox_unprocessed', title: 'Inbox overflow', message: 'You have 10+ unprocessed inbox items', severity: 'warning', route: '/inbox?filter=unprocessed' } }],
    throttle: { maxRunsPerDay: 1, cooldownMinutes: 60 },
  },
  {
    id: 'auto-sunday-review', name: 'Sunday weekly review reminder',
    enabled: false, createdAt: now, updatedAt: now,
    trigger: { type: 'time', schedule: { type: 'weekly', time: '17:00', daysOfWeek: [7] } },
    conditions: [],
    actions: [{ type: 'create_notification', payload: { type: 'weekly_review_missing', title: 'Weekly review time', message: 'Time to review your week and plan ahead', severity: 'info', route: '/planning' } }],
    throttle: { maxRunsPerDay: 1, cooldownMinutes: 120 },
  },
];

// ── Template Application ──
export interface ApplyTemplateResult {
  createdRefs: { kind: string; id: string }[];
  summary: Record<string, number>;
}

export function applyTemplate(
  template: Template,
  runDate: string,
  data: AppData,
): { newData: AppData; result: ApplyTemplateResult } {
  let d = { ...data };
  const refs: { kind: string; id: string }[] = [];
  const summary: Record<string, number> = {};

  const inc = (k: string) => { summary[k] = (summary[k] || 0) + 1; };

  for (const item of template.items) {
    switch (item.kind) {
      case 'task': {
        const dueDate = item.dueOffsetDays !== undefined ? format(addDays(new Date(runDate), item.dueOffsetDays), 'yyyy-MM-dd') : undefined;
        const task: Task = {
          id: crypto.randomUUID(), title: item.title, description: item.description,
          status: 'todo', priority: item.priority || 'med', dueDate,
          createdAt: new Date().toISOString(), tags: item.tags || [],
          project: item.project, estimatedMinutes: item.estimatedMinutes,
          subtasks: [],
        };
        d = { ...d, tasks: [...d.tasks, task] };
        refs.push({ kind: 'task', id: task.id });
        inc('tasks');

        if (item.autoCommitToWeek) {
          const weekStart = format(startOfWeek(new Date(runDate), { weekStartsOn: 1 }), 'yyyy-MM-dd');
          const existingPlan = d.weeklyPlans.find(p => p.weekStartDate === weekStart);
          if (existingPlan) {
            d = { ...d, weeklyPlans: d.weeklyPlans.map(p => p.id === existingPlan.id ? { ...p, committedTaskIds: [...p.committedTaskIds, task.id] } : p) };
          } else {
            d = { ...d, weeklyPlans: [...d.weeklyPlans, { id: crypto.randomUUID(), weekStartDate: weekStart, committedTaskIds: [task.id], createdAt: new Date().toISOString() }] };
          }
        }
        break;
      }
      case 'event': {
        const dayDate = item.dayOffsetDays !== undefined ? addDays(new Date(runDate), item.dayOffsetDays) : new Date(runDate);
        const [h, m] = (item.startTime || '09:00').split(':').map(Number);
        const startDT = new Date(dayDate); startDT.setHours(h, m, 0, 0);
        const endDT = addMinutes(startDT, item.durationMinutes);
        const event = {
          id: crypto.randomUUID(), title: item.title,
          startDateTime: startDT.toISOString(), endDateTime: endDT.toISOString(),
          category: item.category || 'personal' as const,
          notes: item.notes, recurring: null,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        d = { ...d, events: [...d.events, event] };
        refs.push({ kind: 'event', id: event.id });
        inc('events');
        break;
      }
      case 'focusBlock': {
        const dayDate = item.dayOffsetDays !== undefined ? addDays(new Date(runDate), item.dayOffsetDays) : new Date(runDate);
        let startDT: Date;
        if (item.startTime) {
          const [h, m] = item.startTime.split(':').map(Number);
          startDT = new Date(dayDate); startDT.setHours(h, m, 0, 0);
        } else {
          startDT = findNextFreeWindow(d, format(dayDate, 'yyyy-MM-dd'), item.durationMinutes);
        }
        const endDT = addMinutes(startDT, item.durationMinutes);

        let linkedTaskId: string | undefined;
        if (item.linkedTaskTitle) {
          const linkedTask: Task = {
            id: crypto.randomUUID(), title: item.linkedTaskTitle,
            status: 'todo', priority: 'med',
            createdAt: new Date().toISOString(), tags: [], subtasks: [],
          };
          d = { ...d, tasks: [...d.tasks, linkedTask] };
          refs.push({ kind: 'task', id: linkedTask.id });
          inc('tasks');
          linkedTaskId = linkedTask.id;
        }

        const block: FocusBlock = {
          id: crypto.randomUUID(), title: item.title,
          startDateTime: startDT.toISOString(), endDateTime: endDT.toISOString(),
          linkedTaskId, status: 'planned',
          notes: item.notes,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        d = { ...d, focusBlocks: [...d.focusBlocks, block] };
        refs.push({ kind: 'focusBlock', id: block.id });
        inc('focusBlocks');
        break;
      }
      case 'habit': {
        if (d.habits.some(h => h.title === item.title && h.status === 'active')) break;
        const habit = {
          id: crypto.randomUUID(), title: item.title,
          frequency: item.frequency, targetCountPerPeriod: item.targetCountPerPeriod,
          category: item.category || 'personal' as const,
          description: '', logs: [] as string[],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          status: 'active' as const,
        };
        d = { ...d, habits: [...d.habits, habit] };
        refs.push({ kind: 'habit', id: habit.id });
        inc('habits');
        break;
      }
      case 'goal': {
        const goal = {
          id: crypto.randomUUID(), title: item.title,
          description: item.description, category: item.category || 'custom' as const,
          status: 'active' as const, startDate: runDate,
          targetDate: format(addDays(new Date(runDate), item.targetOffsetDays || 30), 'yyyy-MM-dd'),
          progressType: item.progressType || 'manual' as const,
          progressValue: 0, linkedTaskIds: [] as string[],
          milestones: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        d = { ...d, goals: [...d.goals, goal] };
        refs.push({ kind: 'goal', id: goal.id });
        inc('goals');
        break;
      }
      case 'inbox': {
        const detected = detectInboxContent(item.content);
        const inboxItem = {
          id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          content: item.content, title: deriveTitle(item.content),
          source: 'manual' as const, status: 'unprocessed' as const,
          tags: item.tags || [], pinned: false, detected,
        };
        d = { ...d, inboxItems: [...d.inboxItems, inboxItem] };
        refs.push({ kind: 'inbox', id: inboxItem.id });
        inc('inbox');
        break;
      }
      case 'note': {
        const note = {
          id: crypto.randomUUID(), title: item.title, content: item.content,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          tags: item.tags || [], pinned: false,
        };
        d = { ...d, notes: [...d.notes, note] };
        refs.push({ kind: 'note', id: note.id });
        inc('notes');
        break;
      }
    }
  }

  return { newData: d, result: { createdRefs: refs, summary } };
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
  // Fallback: just put it at 9am
  const fallback = new Date(day); fallback.setHours(9, 0, 0, 0);
  return fallback;
}

// ── Automation Rule Evaluation ──
export function evaluateConditions(conditions: AutomationCondition[], data: AppData, context?: { taskId?: string; inboxContent?: string }): boolean {
  for (const cond of conditions) {
    switch (cond.type) {
      case 'task_priority_is': {
        if (!context?.taskId) return false;
        const task = data.tasks.find(t => t.id === context.taskId);
        if (!task || task.priority !== cond.value) return false;
        break;
      }
      case 'task_has_tag': {
        if (!context?.taskId) return false;
        const task = data.tasks.find(t => t.id === context.taskId);
        if (!task || !task.tags.includes(cond.value)) return false;
        break;
      }
      case 'inbox_contains_text': {
        if (!context?.inboxContent?.toLowerCase().includes(cond.value.toLowerCase())) return false;
        break;
      }
      case 'time_is_after': {
        const now = new Date();
        const [h, m] = cond.value.split(':').map(Number);
        const check = new Date(now); check.setHours(h, m, 0, 0);
        if (now < check) return false;
        break;
      }
      case 'day_of_week_is': {
        const dayJS = new Date().getDay(); // 0=Sun
        const dayISO = dayJS === 0 ? 7 : dayJS;
        if (dayISO !== cond.value) return false;
        break;
      }
      case 'limit_unprocessed_inbox_gte': {
        const count = data.inboxItems.filter(i => i.status === 'unprocessed').length;
        if (count < cond.value) return false;
        break;
      }
      case 'goal_category_is': {
        // For goal triggers - always pass for now (context doesn't carry goalId)
        break;
      }
    }
  }
  return true;
}

export function isThrottled(rule: AutomationRule, logs: AutomationRunLog[]): boolean {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayRuns = logs.filter(l => l.ruleId === rule.id && l.ranAt.startsWith(todayStr) && l.status === 'success');
  if (todayRuns.length >= rule.throttle.maxRunsPerDay) return true;

  if (rule.lastRunAt) {
    const lastRun = new Date(rule.lastRunAt);
    const cooldownEnd = addMinutes(lastRun, rule.throttle.cooldownMinutes);
    if (new Date() < cooldownEnd) return true;
  }

  return false;
}

export function shouldRunTimeRule(rule: AutomationRule): boolean {
  if (rule.trigger.type !== 'time') return false;
  const { schedule } = rule.trigger;
  const now = new Date();
  const [h, m] = schedule.time.split(':').map(Number);
  const scheduledTime = new Date(now); scheduledTime.setHours(h, m, 0, 0);
  const diff = Math.abs(now.getTime() - scheduledTime.getTime());
  if (diff > 2 * 60 * 1000) return false; // 2 minute window

  if (schedule.type === 'weekly' && schedule.daysOfWeek) {
    const dayJS = now.getDay();
    const dayISO = dayJS === 0 ? 7 : dayJS;
    if (!schedule.daysOfWeek.includes(dayISO)) return false;
  }

  // Check if already ran today
  const todayStr = format(now, 'yyyy-MM-dd');
  if (rule.lastRunAt && rule.lastRunAt.startsWith(todayStr)) return false;

  return true;
}

export function executeActions(
  rule: AutomationRule,
  data: AppData,
  allTemplates: Template[],
  context?: { taskId?: string },
): { newData: AppData; log: AutomationRunLog } {
  let d = { ...data };
  const createdRefs: { kind: string; id: string }[] = [];

  for (const action of rule.actions) {
    switch (action.type) {
      case 'create_task': {
        const task: Task = {
          id: crypto.randomUUID(), title: action.payload.title,
          description: action.payload.description, status: 'todo',
          priority: action.payload.priority || 'med',
          dueDate: action.payload.dueDate,
          createdAt: new Date().toISOString(), tags: action.payload.tags || [],
          subtasks: [],
        };
        d = { ...d, tasks: [...d.tasks, task] };
        createdRefs.push({ kind: 'task', id: task.id });
        break;
      }
      case 'create_focus_block_next_free': {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const start = findNextFreeWindow(d, todayStr, action.payload.durationMinutes);
        const end = addMinutes(start, action.payload.durationMinutes);
        const block: FocusBlock = {
          id: crypto.randomUUID(), title: action.payload.title,
          startDateTime: start.toISOString(), endDateTime: end.toISOString(),
          linkedTaskId: action.payload.linkedTaskId || context?.taskId,
          status: 'planned',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        d = { ...d, focusBlocks: [...d.focusBlocks, block] };
        createdRefs.push({ kind: 'focusBlock', id: block.id });
        break;
      }
      case 'create_notification': {
        const notif: NotificationItem = {
          id: crypto.randomUUID(), type: action.payload.type,
          title: action.payload.title, message: action.payload.message,
          severity: action.payload.severity, createdAt: new Date().toISOString(),
          action: action.payload.route ? { label: 'View', route: action.payload.route } : undefined,
        };
        d = { ...d, notifications: [...d.notifications, notif] };
        createdRefs.push({ kind: 'notification', id: notif.id });
        break;
      }
      case 'add_inbox_item': {
        const detected = detectInboxContent(action.payload.content);
        const item = {
          id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          content: action.payload.content, title: deriveTitle(action.payload.content),
          source: 'manual' as const, status: 'unprocessed' as const,
          tags: action.payload.tags || [], pinned: false, detected,
        };
        d = { ...d, inboxItems: [...d.inboxItems, item] };
        createdRefs.push({ kind: 'inbox', id: item.id });
        break;
      }
      case 'apply_template': {
        const tpl = allTemplates.find(t => t.id === action.payload.templateId);
        if (tpl) {
          const { newData, result } = applyTemplate(tpl, format(new Date(), 'yyyy-MM-dd'), d);
          d = newData;
          createdRefs.push(...result.createdRefs);
        }
        break;
      }
      case 'archive_inbox_item': {
        d = { ...d, inboxItems: d.inboxItems.map(i => i.id === action.payload.inboxId ? { ...i, status: 'archived' as const, updatedAt: new Date().toISOString() } : i) };
        break;
      }
    }
  }

  const log: AutomationRunLog = {
    id: crypto.randomUUID(), ruleId: rule.id, ranAt: new Date().toISOString(),
    status: 'success', createdEntityRefs: createdRefs,
    undoToken: createdRefs.length > 0 ? { kind: 'entityBatch', ids: createdRefs } : undefined,
  };

  return { newData: d, log };
}
