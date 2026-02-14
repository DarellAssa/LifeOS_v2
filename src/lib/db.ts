// Database sync layer — maps AppData to/from Supabase tables
import { supabase } from '@/integrations/supabase/client';
import { AppData, Task, Goal, CalendarEvent, FocusBlock, Habit, DailyCheckIn, LifeScoreSnapshot, WeeklyPlan, NotificationItem, NotificationSettings, DEFAULT_NOTIFICATION_SETTINGS, InboxItem, Note } from '@/types';
import { Template, AutomationRule, AutomationRunLog } from '@/types/templates';

// ── Fetch all user data in parallel ──
export async function fetchAllUserData(userId: string): Promise<AppData> {
  const [
    { data: tasks },
    { data: goals },
    { data: events },
    { data: focusBlocks },
    { data: habits },
    { data: checkins },
    { data: scores },
    { data: plans },
    { data: notifs },
    { data: notifSettings },
    { data: inboxItems },
    { data: notes },
    { data: templates },
    { data: rules },
    { data: logs },
    { data: pinnedRows },
  ] = await Promise.all([
    supabase.from('tasks').select('*').eq('user_id', userId).is('deleted_at', null),
    supabase.from('goals').select('*').eq('user_id', userId).is('deleted_at', null),
    supabase.from('calendar_events').select('*').eq('user_id', userId).is('deleted_at', null),
    supabase.from('focus_blocks').select('*').eq('user_id', userId).is('deleted_at', null),
    supabase.from('habits').select('*').eq('user_id', userId).is('deleted_at', null),
    supabase.from('daily_checkins').select('*').eq('user_id', userId),
    supabase.from('life_score_snapshots').select('*').eq('user_id', userId),
    supabase.from('weekly_plans').select('*').eq('user_id', userId),
    supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(200),
    supabase.from('notification_settings').select('*').eq('id', userId).single(),
    supabase.from('inbox_items').select('*').eq('user_id', userId).is('deleted_at', null),
    supabase.from('notes').select('*').eq('user_id', userId).is('deleted_at', null),
    supabase.from('templates').select('*').eq('user_id', userId).is('deleted_at', null),
    supabase.from('automation_rules').select('*').eq('user_id', userId).is('deleted_at', null),
    supabase.from('automation_run_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    supabase.from('pinned_focus').select('*').eq('user_id', userId),
  ]);

  const pinnedFocus: Record<string, string[]> = {};
  (pinnedRows || []).forEach((r: any) => { pinnedFocus[r.date] = r.task_ids || []; });

  const ns = notifSettings as any;
  const notificationSettings: NotificationSettings = ns ? {
    quietHoursEnabled: ns.quiet_hours_enabled,
    quietHoursStart: ns.quiet_hours_start,
    quietHoursEnd: ns.quiet_hours_end,
    enabledTypes: ns.enabled_types,
    dueSoonDays: ns.due_soon_days,
    eventUpcomingMinutes: ns.event_upcoming_minutes,
    dailyDigestTime: ns.daily_digest_time,
    maxNotificationsPerDay: ns.max_notifications_per_day,
  } : DEFAULT_NOTIFICATION_SETTINGS;

  return {
    schemaVersion: 9,
    profile: { name: '', timezone: 'UTC', weekStartDay: 'monday' },
    pinnedFocus,
    tasks: (tasks || []).map(dbToTask),
    goals: (goals || []).map(dbToGoal),
    events: (events || []).map(dbToEvent),
    focusBlocks: (focusBlocks || []).map(dbToFocusBlock),
    habits: (habits || []).map(dbToHabit),
    dailyCheckIns: (checkins || []).map(dbToCheckIn),
    lifeScoreSnapshots: (scores || []).map(dbToScore),
    weeklyPlans: (plans || []).map(dbToPlan),
    notifications: (notifs || []).map(dbToNotification),
    notificationSettings,
    inboxItems: (inboxItems || []).map(dbToInboxItem),
    notes: (notes || []).map(dbToNote),
    templates: (templates || []).map(dbToTemplate),
    automationRules: (rules || []).map(dbToRule),
    automationLogs: (logs || []).map(dbToLog),
  };
}

// ── DB Mappers ──
function dbToTask(r: any): Task {
  return {
    id: r.id, title: r.title, description: r.description, status: r.status, priority: r.priority,
    dueDate: r.due_date, completedAt: r.completed_at, tags: r.tags || [], project: r.project,
    estimatedMinutes: r.estimated_minutes, goalId: r.goal_id, subtasks: r.subtasks || [],
    recurring: r.recurring, scheduledStart: r.scheduled_start, scheduledEnd: r.scheduled_end,
    createdAt: r.created_at,
  };
}
function dbToGoal(r: any): Goal {
  return {
    id: r.id, title: r.title, description: r.description, category: r.category, status: r.status,
    startDate: r.start_date, targetDate: r.target_date, progressType: r.progress_type,
    progressValue: r.progress_value, linkedTaskIds: r.linked_task_ids || [], milestones: r.milestones || [],
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function dbToEvent(r: any): CalendarEvent {
  return {
    id: r.id, title: r.title, startDateTime: r.start_date_time, endDateTime: r.end_date_time,
    location: r.location, notes: r.notes, category: r.category, recurring: r.recurring,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function dbToFocusBlock(r: any): FocusBlock {
  return {
    id: r.id, title: r.title, startDateTime: r.start_date_time, endDateTime: r.end_date_time,
    linkedTaskId: r.linked_task_id, linkedGoalId: r.linked_goal_id, status: r.status,
    notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function dbToHabit(r: any): Habit {
  return {
    id: r.id, title: r.title, description: r.description, frequency: r.frequency,
    targetCountPerPeriod: r.target_count_per_period, category: r.category, logs: r.logs || [],
    createdAt: r.created_at, updatedAt: r.updated_at, status: r.status,
  };
}
function dbToCheckIn(r: any): DailyCheckIn {
  return {
    id: r.id, date: r.date, mood: r.mood, energy: r.energy, focus: r.focus,
    highlights: r.highlights, blockers: r.blockers, gratitude: r.gratitude,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function dbToScore(r: any): LifeScoreSnapshot {
  return { id: r.id, date: r.date, score: r.score, breakdown: r.breakdown, createdAt: r.created_at };
}
function dbToPlan(r: any): WeeklyPlan {
  return { id: r.id, weekStartDate: r.week_start_date, committedTaskIds: r.committed_task_ids || [], createdAt: r.created_at };
}
function dbToNotification(r: any): NotificationItem {
  return {
    id: r.id, type: r.type, title: r.title, message: r.message, severity: r.severity,
    createdAt: r.created_at, readAt: r.read_at, dismissedAt: r.dismissed_at,
    snoozedUntil: r.snoozed_until, entityRef: r.entity_ref, action: r.action,
  };
}
function dbToInboxItem(r: any): InboxItem {
  return {
    id: r.id, createdAt: r.created_at, updatedAt: r.updated_at, content: r.content,
    title: r.title, source: r.source, status: r.status, tags: r.tags || [],
    pinned: r.pinned, detected: r.detected || { urls: [] }, conversion: r.conversion,
  };
}
function dbToNote(r: any): Note {
  return {
    id: r.id, title: r.title, content: r.content, createdAt: r.created_at,
    updatedAt: r.updated_at, tags: r.tags || [], pinned: r.pinned,
  };
}
function dbToTemplate(r: any): Template {
  return {
    id: r.id, name: r.name, description: r.description, category: r.category,
    createdAt: r.created_at, updatedAt: r.updated_at, isBuiltIn: r.is_built_in,
    items: r.items || [], defaultSchedule: r.default_schedule,
  };
}
function dbToRule(r: any): AutomationRule {
  return {
    id: r.id, name: r.name, enabled: r.enabled, createdAt: r.created_at,
    updatedAt: r.updated_at, trigger: r.trigger, conditions: r.conditions || [],
    actions: r.actions || [], throttle: r.throttle || { maxRunsPerDay: 5, cooldownMinutes: 30 },
    lastRunAt: r.last_run_at,
  };
}
function dbToLog(r: any): AutomationRunLog {
  return {
    id: r.id, ruleId: r.rule_id, ranAt: r.ran_at, status: r.status,
    reason: r.reason, createdEntityRefs: r.created_entity_refs || [], undoToken: r.undo_token,
  };
}

// ── Write helpers (fire-and-forget with error handling) ──
export async function dbUpsertTask(userId: string, task: Task) {
  await supabase.from('tasks').upsert({
    id: task.id, user_id: userId, title: task.title, description: task.description,
    status: task.status, priority: task.priority, due_date: task.dueDate,
    completed_at: task.completedAt, tags: task.tags as any, project: task.project,
    estimated_minutes: task.estimatedMinutes, goal_id: task.goalId, subtasks: task.subtasks as any,
    recurring: task.recurring as any, scheduled_start: task.scheduledStart, scheduled_end: task.scheduledEnd,
  } as any);
}
export async function dbDeleteTask(userId: string, id: string) {
  await supabase.from('tasks').update({ deleted_at: new Date().toISOString() } as any).eq('id', id).eq('user_id', userId);
}
export async function dbUpsertGoal(userId: string, goal: Goal) {
  await supabase.from('goals').upsert({
    id: goal.id, user_id: userId, title: goal.title, description: goal.description,
    category: goal.category, status: goal.status, start_date: goal.startDate,
    target_date: goal.targetDate, progress_type: goal.progressType, progress_value: goal.progressValue,
    linked_task_ids: goal.linkedTaskIds as any, milestones: goal.milestones as any,
  } as any);
}
export async function dbDeleteGoal(userId: string, id: string) {
  await supabase.from('goals').update({ deleted_at: new Date().toISOString() } as any).eq('id', id).eq('user_id', userId);
}
export async function dbUpsertEvent(userId: string, event: CalendarEvent) {
  await supabase.from('calendar_events').upsert({
    id: event.id, user_id: userId, title: event.title, start_date_time: event.startDateTime,
    end_date_time: event.endDateTime, location: event.location, notes: event.notes,
    category: event.category, recurring: event.recurring as any,
  } as any);
}
export async function dbDeleteEvent(userId: string, id: string) {
  await supabase.from('calendar_events').update({ deleted_at: new Date().toISOString() } as any).eq('id', id).eq('user_id', userId);
}
export async function dbUpsertFocusBlock(userId: string, fb: FocusBlock) {
  await supabase.from('focus_blocks').upsert({
    id: fb.id, user_id: userId, title: fb.title, start_date_time: fb.startDateTime,
    end_date_time: fb.endDateTime, linked_task_id: fb.linkedTaskId, linked_goal_id: fb.linkedGoalId,
    status: fb.status, notes: fb.notes,
  } as any);
}
export async function dbDeleteFocusBlock(userId: string, id: string) {
  await supabase.from('focus_blocks').update({ deleted_at: new Date().toISOString() } as any).eq('id', id).eq('user_id', userId);
}
export async function dbUpsertHabit(userId: string, habit: Habit) {
  await supabase.from('habits').upsert({
    id: habit.id, user_id: userId, title: habit.title, description: habit.description,
    frequency: habit.frequency, target_count_per_period: habit.targetCountPerPeriod,
    category: habit.category, logs: habit.logs as any, status: habit.status,
  } as any);
}
export async function dbDeleteHabit(userId: string, id: string) {
  await supabase.from('habits').update({ deleted_at: new Date().toISOString() } as any).eq('id', id).eq('user_id', userId);
}
export async function dbUpsertCheckIn(userId: string, ci: DailyCheckIn) {
  await supabase.from('daily_checkins').upsert({
    id: ci.id, user_id: userId, date: ci.date, mood: ci.mood, energy: ci.energy,
    focus: ci.focus, highlights: ci.highlights, blockers: ci.blockers, gratitude: ci.gratitude,
  } as any);
}
export async function dbDeleteCheckIn(userId: string, date: string) {
  await supabase.from('daily_checkins').delete().eq('user_id', userId).eq('date', date);
}
export async function dbUpsertScore(userId: string, s: LifeScoreSnapshot) {
  await supabase.from('life_score_snapshots').upsert({
    id: s.id, user_id: userId, date: s.date, score: s.score, breakdown: s.breakdown as any,
  } as any);
}
export async function dbUpsertWeeklyPlan(userId: string, p: WeeklyPlan) {
  await supabase.from('weekly_plans').upsert({
    id: p.id, user_id: userId, week_start_date: p.weekStartDate, committed_task_ids: p.committedTaskIds as any,
  } as any);
}
export async function dbUpsertNotification(userId: string, n: NotificationItem) {
  await supabase.from('notifications').upsert({
    id: n.id, user_id: userId, type: n.type, title: n.title, message: n.message,
    severity: n.severity, read_at: n.readAt, dismissed_at: n.dismissedAt,
    snoozed_until: n.snoozedUntil, entity_ref: n.entityRef as any, action: n.action as any,
  } as any);
}
export async function dbUpdateNotification(userId: string, id: string, updates: Partial<NotificationItem>) {
  const dbU: Record<string, any> = {};
  if (updates.readAt !== undefined) dbU.read_at = updates.readAt;
  if (updates.dismissedAt !== undefined) dbU.dismissed_at = updates.dismissedAt;
  if (updates.snoozedUntil !== undefined) dbU.snoozed_until = updates.snoozedUntil;
  await supabase.from('notifications').update(dbU).eq('id', id).eq('user_id', userId);
}
export async function dbUpsertNotificationSettings(userId: string, s: NotificationSettings) {
  await supabase.from('notification_settings').upsert({
    id: userId, quiet_hours_enabled: s.quietHoursEnabled, quiet_hours_start: s.quietHoursStart,
    quiet_hours_end: s.quietHoursEnd, enabled_types: s.enabledTypes as any, due_soon_days: s.dueSoonDays,
    event_upcoming_minutes: s.eventUpcomingMinutes, daily_digest_time: s.dailyDigestTime,
    max_notifications_per_day: s.maxNotificationsPerDay,
  } as any);
}
export async function dbUpsertInboxItem(userId: string, item: InboxItem) {
  await supabase.from('inbox_items').upsert({
    id: item.id, user_id: userId, content: item.content, title: item.title,
    source: item.source, status: item.status, tags: item.tags as any, pinned: item.pinned,
    detected: item.detected as any, conversion: item.conversion as any,
  } as any);
}
export async function dbDeleteInboxItem(userId: string, id: string) {
  await supabase.from('inbox_items').update({ deleted_at: new Date().toISOString() } as any).eq('id', id).eq('user_id', userId);
}
export async function dbUpsertNote(userId: string, note: Note) {
  await supabase.from('notes').upsert({
    id: note.id, user_id: userId, title: note.title, content: note.content,
    tags: note.tags as any, pinned: note.pinned,
  } as any);
}
export async function dbDeleteNote(userId: string, id: string) {
  await supabase.from('notes').update({ deleted_at: new Date().toISOString() } as any).eq('id', id).eq('user_id', userId);
}
export async function dbUpsertTemplate(userId: string, t: Template) {
  await supabase.from('templates').upsert({
    id: t.id, user_id: userId, name: t.name, description: t.description, category: t.category,
    is_built_in: t.isBuiltIn, items: t.items as any, default_schedule: t.defaultSchedule as any,
  } as any);
}
export async function dbDeleteTemplate(userId: string, id: string) {
  await supabase.from('templates').update({ deleted_at: new Date().toISOString() } as any).eq('id', id).eq('user_id', userId);
}
export async function dbUpsertAutomationRule(userId: string, r: AutomationRule) {
  await supabase.from('automation_rules').upsert({
    id: r.id, user_id: userId, name: r.name, enabled: r.enabled, trigger: r.trigger as any,
    conditions: r.conditions as any, actions: r.actions as any, throttle: r.throttle as any, last_run_at: r.lastRunAt,
  } as any);
}
export async function dbDeleteAutomationRule(userId: string, id: string) {
  await supabase.from('automation_rules').update({ deleted_at: new Date().toISOString() } as any).eq('id', id).eq('user_id', userId);
}
export async function dbInsertAutomationLog(userId: string, log: AutomationRunLog) {
  await supabase.from('automation_run_logs').insert({
    id: log.id, user_id: userId, rule_id: log.ruleId, ran_at: log.ranAt,
    status: log.status, reason: log.reason, created_entity_refs: log.createdEntityRefs as any,
    undo_token: log.undoToken as any,
  } as any);
}
export async function dbUpsertPinnedFocus(userId: string, date: string, taskIds: string[]) {
  await supabase.from('pinned_focus').upsert({ user_id: userId, date, task_ids: taskIds as any } as any, { onConflict: 'user_id,date' });
}
export async function dbDeleteDemoData(userId: string) {
  await Promise.all([
    supabase.from('tasks').delete().eq('user_id', userId).eq('is_demo', true),
    supabase.from('goals').delete().eq('user_id', userId).eq('is_demo', true),
    supabase.from('calendar_events').delete().eq('user_id', userId).eq('is_demo', true),
    supabase.from('focus_blocks').delete().eq('user_id', userId).eq('is_demo', true),
    supabase.from('habits').delete().eq('user_id', userId).eq('is_demo', true),
    supabase.from('daily_checkins').delete().eq('user_id', userId).eq('is_demo', true),
    supabase.from('inbox_items').delete().eq('user_id', userId).eq('is_demo', true),
    supabase.from('notes').delete().eq('user_id', userId).eq('is_demo', true),
    supabase.from('templates').delete().eq('user_id', userId).eq('is_demo', true),
    supabase.from('automation_rules').delete().eq('user_id', userId).eq('is_demo', true),
    supabase.from('notifications').delete().eq('user_id', userId).eq('is_demo', true),
  ]);
}

// Seed demo data into DB
export async function seedDemoData(userId: string) {
  const { seedData } = await import('@/store/seedData');
  const now = new Date().toISOString();

  await Promise.all([
    ...seedData.tasks.map(t => supabase.from('tasks').insert({
      user_id: userId, title: t.title, description: t.description,
      status: t.status, priority: t.priority, due_date: t.dueDate,
      completed_at: t.completedAt, tags: t.tags as any, project: t.project,
      estimated_minutes: t.estimatedMinutes, goal_id: t.goalId, subtasks: t.subtasks as any,
      recurring: t.recurring as any, scheduled_start: t.scheduledStart, scheduled_end: t.scheduledEnd,
      is_demo: true,
    } as any)),
    ...seedData.goals.map(g => supabase.from('goals').insert({
      user_id: userId, title: g.title, description: g.description,
      category: g.category, status: g.status, start_date: g.startDate,
      target_date: g.targetDate, progress_type: g.progressType, progress_value: g.progressValue,
      linked_task_ids: g.linkedTaskIds as any, milestones: g.milestones as any, is_demo: true,
    } as any)),
    ...seedData.events.map(e => supabase.from('calendar_events').insert({
      user_id: userId, title: e.title, start_date_time: e.startDateTime,
      end_date_time: e.endDateTime, location: e.location, notes: e.notes,
      category: e.category, recurring: e.recurring as any, is_demo: true,
    } as any)),
    ...seedData.focusBlocks.map(fb => supabase.from('focus_blocks').insert({
      user_id: userId, title: fb.title, start_date_time: fb.startDateTime,
      end_date_time: fb.endDateTime, linked_task_id: fb.linkedTaskId, linked_goal_id: fb.linkedGoalId,
      status: fb.status, notes: fb.notes, is_demo: true,
    } as any)),
    ...seedData.habits.map(h => supabase.from('habits').insert({
      user_id: userId, title: h.title, description: h.description,
      frequency: h.frequency, target_count_per_period: h.targetCountPerPeriod,
      category: h.category, logs: h.logs as any, status: h.status, is_demo: true,
    } as any)),
  ]);
}
