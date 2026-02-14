import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { AppData, Task, Goal, CalendarEvent, FocusBlock, Habit, DailyCheckIn, LifeScoreSnapshot, WeeklyPlan, UserProfile, GoalDisplayStatus, NotificationItem, NotificationSettings, DEFAULT_NOTIFICATION_SETTINGS, InboxItem, Note, Template, AutomationRule, AutomationRunLog } from '@/types';
import { ApplyTemplateResult, applyTemplate as applyTemplateEngine, evaluateConditions, isThrottled, shouldRunTimeRule, executeActions, BUILT_IN_TEMPLATES, BUILT_IN_AUTOMATIONS } from '@/lib/automations';
import { toast } from '@/hooks/use-toast';
import { format, startOfWeek, endOfWeek, isWithinInterval, differenceInMinutes, addDays, addMinutes, isSameDay, parseISO, subDays } from 'date-fns';
import { computeGoalProgress, getGoalDisplayStatus, getGoalsDueSoon as getGoalsDueSoonUtil, computeLifeScore } from '@/lib/stats';
import { generateNotifications, isQuietHours } from '@/lib/notifications';
import { detectInboxContent, deriveTitle } from '@/lib/inbox';
import { useAuth } from '@/hooks/useAuth';
import { fetchAllUserData, dbUpsertTask, dbDeleteTask, dbUpsertGoal, dbDeleteGoal, dbUpsertEvent, dbDeleteEvent, dbUpsertFocusBlock, dbDeleteFocusBlock, dbUpsertHabit, dbDeleteHabit, dbUpsertCheckIn, dbDeleteCheckIn, dbUpsertScore, dbUpsertWeeklyPlan, dbUpsertNotification, dbUpdateNotification, dbUpsertNotificationSettings, dbUpsertInboxItem, dbDeleteInboxItem, dbUpsertNote, dbDeleteNote, dbUpsertTemplate, dbDeleteTemplate, dbUpsertAutomationRule, dbDeleteAutomationRule, dbInsertAutomationLog, dbUpsertPinnedFocus } from '@/lib/db';

const SCHEMA_VERSION = 9;

function emptyData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: { name: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, weekStartDay: 'monday' },
    pinnedFocus: {},
    tasks: [], goals: [], events: [], focusBlocks: [], habits: [],
    dailyCheckIns: [], lifeScoreSnapshots: [], weeklyPlans: [],
    notifications: [], notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
    inboxItems: [], notes: [],
    templates: [], automationRules: [], automationLogs: [],
  };
}

interface AppContextType {
  data: AppData;
  // Tasks
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleTaskDone: (id: string) => void;
  changeTaskStatus: (id: string, status: Task['status']) => void;
  scheduleTask: (taskId: string, startDateTime: string, endDateTime: string) => void;
  unscheduleTask: (taskId: string) => void;
  // Goals
  addGoal: (goal: Goal) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  archiveGoal: (id: string) => void;
  completeGoal: (id: string) => void;
  // Goal linking
  linkTaskToGoal: (taskId: string, goalId: string) => void;
  unlinkTaskFromGoal: (taskId: string) => void;
  // Goal selectors
  getActiveGoals: () => Goal[];
  getBehindGoals: () => Goal[];
  getGoalsDueSoon: (days?: number) => Goal[];
  getGoalProgress: (goalId: string) => number;
  getGoalStatus: (goalId: string) => GoalDisplayStatus;
  // Events
  addEvent: (event: CalendarEvent) => void;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  // Focus Blocks
  addFocusBlock: (block: FocusBlock) => void;
  updateFocusBlock: (id: string, updates: Partial<FocusBlock>) => void;
  deleteFocusBlock: (id: string) => void;
  markFocusBlockCompleted: (id: string) => void;
  markFocusBlockSkipped: (id: string) => void;
  createFocusBlockFromTask: (taskId: string, startDateTime: string, durationMinutes: number) => void;
  // Habits
  addHabit: (habit: Habit) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  archiveHabit: (id: string) => void;
  logHabit: (id: string, date: string) => void;
  toggleHabitLog: (id: string, date: string) => void;
  // Daily Check-ins
  upsertDailyCheckIn: (dateISO: string, payload: Omit<DailyCheckIn, 'id' | 'date' | 'createdAt' | 'updatedAt'>) => void;
  deleteDailyCheckIn: (dateISO: string) => void;
  getCheckInForDate: (dateISO: string) => DailyCheckIn | undefined;
  // Life Score
  generateLifeScoreForDate: (dateISO: string) => LifeScoreSnapshot;
  getLifeScoreForDate: (dateISO: string) => LifeScoreSnapshot | undefined;
  // Plans
  addWeeklyPlan: (plan: WeeklyPlan) => void;
  updateWeeklyPlan: (id: string, updates: Partial<WeeklyPlan>) => void;
  getOrCreateCurrentWeekPlan: () => WeeklyPlan;
  // Pinned focus
  setPinnedFocus: (date: string, taskIds: string[]) => void;
  getPinnedFocus: (date: string) => string[];
  // Profile
  updateProfile: (updates: Partial<UserProfile>) => void;
  // Data management
  exportData: () => string;
  importData: (json: string, mode: 'replace' | 'merge') => void;
  resetData: () => void;
  // Task selectors
  getTodayTasks: () => Task[];
  getOverdueTasks: () => Task[];
  getThisWeekCommittedTasks: () => Task[];
  completionRateThisWeek: () => number;
  tasksCompletedPerDayThisWeek: () => { date: string; count: number }[];
  avgCompletionTime: () => string;
  // Calendar selectors
  getEventsForDay: (dateISO: string) => CalendarEvent[];
  getBlocksForDay: (dateISO: string) => FocusBlock[];
  getAgendaForDay: (dateISO: string) => AgendaItem[];
  getPlannedFocusMinutes: (startDate: string, endDate: string) => number;
  getCompletedFocusMinutes: (startDate: string, endDate: string) => number;
  // Notifications
  addNotification: (item: NotificationItem) => void;
  markNotificationRead: (id: string) => void;
  dismissNotification: (id: string) => void;
  snoozeNotification: (id: string, untilISO: string) => void;
  markAllRead: () => void;
  clearDismissed: (olderThanDays?: number) => void;
  updateNotificationSettings: (updates: Partial<NotificationSettings>) => void;
  runNotificationGeneration: () => void;
  getUnreadNotificationCount: () => number;
  // Inbox
  addInboxItem: (content: string, source?: InboxItem['source']) => InboxItem;
  updateInboxItem: (id: string, updates: Partial<InboxItem>) => void;
  deleteInboxItem: (id: string) => void;
  archiveInboxItem: (id: string) => void;
  pinInboxItem: (id: string, pinned: boolean) => void;
  setInboxStatus: (id: string, status: InboxItem['status']) => void;
  convertInboxToTask: (inboxId: string, payload: Partial<Task>) => void;
  convertInboxToGoal: (inboxId: string, payload: Partial<Goal>) => void;
  convertInboxToEvent: (inboxId: string, payload: Partial<CalendarEvent>) => void;
  convertInboxToHabit: (inboxId: string, payload: Partial<Habit>) => void;
  convertInboxToFocusBlock: (inboxId: string, payload: Partial<FocusBlock>) => void;
  convertInboxToNote: (inboxId: string, payload: Partial<Note>) => void;
  // Notes
  createNote: (note: Note) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  pinNote: (id: string, pinned: boolean) => void;
  // Templates
  createTemplate: (tpl: Template) => void;
  updateTemplate: (id: string, updates: Partial<Template>) => void;
  deleteTemplate: (id: string) => void;
  duplicateTemplate: (id: string) => void;
  runTemplate: (templateId: string, runDate: string) => ApplyTemplateResult | null;
  // Automations
  createAutomationRule: (rule: AutomationRule) => void;
  updateAutomationRule: (id: string, updates: Partial<AutomationRule>) => void;
  deleteAutomationRule: (id: string) => void;
  toggleRuleEnabled: (id: string) => void;
  undoAutomationRun: (logId: string) => void;
}

export type AgendaItem = {
  type: 'event' | 'focus';
  id: string;
  title: string;
  startDateTime: string;
  endDateTime: string;
  category?: string;
  status?: string;
  linkedTaskId?: string;
  linkedGoalId?: string;
  location?: string;
  notes?: string;
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [data, setData] = useState<AppData>(emptyData);
  const [loaded, setLoaded] = useState(false);
  const userId = user?.id;

  // Load data from DB on mount
  useEffect(() => {
    if (!userId) return;
    fetchAllUserData(userId).then(d => {
      // Set profile name from auth profile
      if (profile?.first_name) {
        d.profile.name = profile.first_name;
      }
      if (profile?.week_start) {
        d.profile.weekStartDay = profile.week_start === 'sun' ? 'sunday' : 'monday';
      }
      if (profile?.timezone) {
        d.profile.timezone = profile.timezone;
      }
      setData(d);
      setLoaded(true);
    });
  }, [userId, profile?.first_name, profile?.week_start, profile?.timezone]);

  const update = useCallback((fn: (prev: AppData) => AppData) => {
    setData(prev => fn(prev));
  }, []);

  // ── Tasks ──
  const addTask = useCallback((task: Task) => {
    update(d => ({ ...d, tasks: [...d.tasks, task] }));
    if (userId) dbUpsertTask(userId, task);
    toast({ title: 'Task created', description: task.title });
  }, [update, userId]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    update(d => {
      const updated = d.tasks.map(t => t.id === id ? { ...t, ...updates } : t);
      const task = updated.find(t => t.id === id);
      if (task && userId) dbUpsertTask(userId, task);
      return { ...d, tasks: updated };
    });
  }, [update, userId]);

  const deleteTask = useCallback((id: string) => {
    update(d => ({
      ...d,
      tasks: d.tasks.filter(t => t.id !== id),
      goals: d.goals.map(g => ({ ...g, linkedTaskIds: g.linkedTaskIds.filter(tid => tid !== id) })),
      focusBlocks: d.focusBlocks.map(fb => fb.linkedTaskId === id ? { ...fb, linkedTaskId: undefined } : fb),
    }));
    if (userId) dbDeleteTask(userId, id);
    toast({ title: 'Task deleted' });
  }, [update, userId]);

  const toggleTaskDone = useCallback((id: string) => {
    update(d => ({
      ...d,
      tasks: d.tasks.map(t => {
        if (t.id !== id) return t;
        const isDone = t.status === 'done';
        return { ...t, status: isDone ? 'todo' as const : 'done' as const, completedAt: isDone ? undefined : new Date().toISOString() };
      }),
    }));
    const task = data.tasks.find(t => t.id === id);
    if (task && task.status !== 'done') toast({ title: 'Task completed! ✓', description: task.title });
  }, [update, data.tasks]);

  const changeTaskStatus = useCallback((id: string, status: Task['status']) => {
    update(d => ({
      ...d,
      tasks: d.tasks.map(t => t.id !== id ? t : { ...t, status, completedAt: status === 'done' ? new Date().toISOString() : undefined }),
    }));
  }, [update]);

  const scheduleTask = useCallback((taskId: string, startDateTime: string, endDateTime: string) => {
    update(d => ({ ...d, tasks: d.tasks.map(t => t.id === taskId ? { ...t, scheduledStart: startDateTime, scheduledEnd: endDateTime } : t) }));
    toast({ title: 'Task scheduled' });
  }, [update]);

  const unscheduleTask = useCallback((taskId: string) => {
    update(d => ({ ...d, tasks: d.tasks.map(t => t.id === taskId ? { ...t, scheduledStart: undefined, scheduledEnd: undefined } : t) }));
    toast({ title: 'Task unscheduled' });
  }, [update]);

  // ── Goals ──
  const addGoal = useCallback((goal: Goal) => {
    update(d => ({ ...d, goals: [...d.goals, goal] }));
    toast({ title: 'Goal created', description: goal.title });
  }, [update]);

  const updateGoal = useCallback((id: string, updates: Partial<Goal>) => {
    update(d => ({ ...d, goals: d.goals.map(g => g.id === id ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g) }));
  }, [update]);

  const deleteGoal = useCallback((id: string) => {
    update(d => ({
      ...d,
      goals: d.goals.filter(g => g.id !== id),
      tasks: d.tasks.map(t => t.goalId === id ? { ...t, goalId: undefined } : t),
      focusBlocks: d.focusBlocks.map(fb => fb.linkedGoalId === id ? { ...fb, linkedGoalId: undefined } : fb),
    }));
    toast({ title: 'Goal deleted' });
  }, [update]);

  const archiveGoal = useCallback((id: string) => {
    update(d => ({ ...d, goals: d.goals.map(g => g.id === id ? { ...g, status: 'paused' as const, updatedAt: new Date().toISOString() } : g) }));
    if (userId) {
      const goal = data.goals.find(g => g.id === id);
      if (goal) dbUpsertGoal(userId, { ...goal, status: 'paused', updatedAt: new Date().toISOString() });
    }
    toast({ title: 'Goal paused' });
  }, [update, userId, data.goals]);

  const completeGoal = useCallback((id: string) => {
    update(d => ({ ...d, goals: d.goals.map(g => g.id === id ? { ...g, status: 'completed' as const, updatedAt: new Date().toISOString() } : g) }));
    toast({ title: 'Goal completed! 🎉' });
  }, [update]);

  // ── Goal Linking ──
  const linkTaskToGoal = useCallback((taskId: string, goalId: string) => {
    update(d => ({
      ...d,
      tasks: d.tasks.map(t => t.id === taskId ? { ...t, goalId } : t),
      goals: d.goals.map(g => g.id === goalId ? { ...g, linkedTaskIds: g.linkedTaskIds.includes(taskId) ? g.linkedTaskIds : [...g.linkedTaskIds, taskId], updatedAt: new Date().toISOString() } : g),
    }));
    toast({ title: 'Task linked to goal' });
  }, [update]);

  const unlinkTaskFromGoal = useCallback((taskId: string) => {
    update(d => ({
      ...d,
      tasks: d.tasks.map(t => t.id === taskId ? { ...t, goalId: undefined } : t),
      goals: d.goals.map(g => ({ ...g, linkedTaskIds: g.linkedTaskIds.filter(id => id !== taskId), updatedAt: new Date().toISOString() })),
    }));
    toast({ title: 'Task unlinked from goal' });
  }, [update]);

  // ── Goal Selectors ──
  const getActiveGoals = useCallback(() => data.goals.filter(g => g.status === 'active'), [data.goals]);

  const getBehindGoals = useCallback(() => {
    return data.goals.filter(g => g.status === 'active' && getGoalDisplayStatus(g, data.tasks) === 'Behind');
  }, [data.goals, data.tasks]);

  const getGoalsDueSoon = useCallback((days: number = 14) => {
    return getGoalsDueSoonUtil(data.goals, days);
  }, [data.goals]);

  const getGoalProgress = useCallback((goalId: string): number => {
    const goal = data.goals.find(g => g.id === goalId);
    if (!goal) return 0;
    return computeGoalProgress(goal, data.tasks);
  }, [data.goals, data.tasks]);

  const getGoalStatus = useCallback((goalId: string): GoalDisplayStatus => {
    const goal = data.goals.find(g => g.id === goalId);
    if (!goal) return 'Not started';
    return getGoalDisplayStatus(goal, data.tasks);
  }, [data.goals, data.tasks]);

  // ── Events ──
  const addEvent = useCallback((event: CalendarEvent) => {
    update(d => ({ ...d, events: [...d.events, { ...event, createdAt: event.createdAt || new Date().toISOString(), updatedAt: event.updatedAt || new Date().toISOString() }] }));
    toast({ title: 'Event created', description: event.title });
  }, [update]);
  const updateEvent = useCallback((id: string, updates: Partial<CalendarEvent>) =>
    update(d => ({ ...d, events: d.events.map(e => e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e) })), [update]);
  const deleteEvent = useCallback((id: string) => {
    update(d => ({ ...d, events: d.events.filter(e => e.id !== id) }));
    toast({ title: 'Event deleted' });
  }, [update]);

  // ── Focus Blocks ──
  const addFocusBlock = useCallback((block: FocusBlock) => {
    update(d => ({ ...d, focusBlocks: [...d.focusBlocks, block] }));
    toast({ title: 'Focus block created', description: block.title });
  }, [update]);

  const updateFocusBlock = useCallback((id: string, updates: Partial<FocusBlock>) => {
    update(d => ({ ...d, focusBlocks: d.focusBlocks.map(fb => fb.id === id ? { ...fb, ...updates, updatedAt: new Date().toISOString() } : fb) }));
  }, [update]);

  const deleteFocusBlock = useCallback((id: string) => {
    update(d => ({ ...d, focusBlocks: d.focusBlocks.filter(fb => fb.id !== id) }));
    toast({ title: 'Focus block deleted' });
  }, [update]);

  const markFocusBlockCompleted = useCallback((id: string) => {
    update(d => ({ ...d, focusBlocks: d.focusBlocks.map(fb => fb.id === id ? { ...fb, status: 'done' as const, updatedAt: new Date().toISOString() } : fb) }));
    if (userId) {
      const fb = data.focusBlocks.find(f => f.id === id);
      if (fb) dbUpsertFocusBlock(userId, { ...fb, status: 'done', updatedAt: new Date().toISOString() });
    }
    toast({ title: 'Focus block completed ✓' });
  }, [update, userId, data.focusBlocks]);

  const markFocusBlockSkipped = useCallback((id: string) => {
    update(d => ({ ...d, focusBlocks: d.focusBlocks.map(fb => fb.id === id ? { ...fb, status: 'missed' as const, updatedAt: new Date().toISOString() } : fb) }));
    if (userId) {
      const fb = data.focusBlocks.find(f => f.id === id);
      if (fb) dbUpsertFocusBlock(userId, { ...fb, status: 'missed', updatedAt: new Date().toISOString() });
    }
    toast({ title: 'Focus block missed' });
  }, [update, userId, data.focusBlocks]);

  const createFocusBlockFromTask = useCallback((taskId: string, startDateTime: string, durationMinutes: number) => {
    const task = data.tasks.find(t => t.id === taskId);
    if (!task) return;
    const endDateTime = addMinutes(new Date(startDateTime), durationMinutes).toISOString();
    const block: FocusBlock = {
      id: crypto.randomUUID(), title: task.title,
      startDateTime, endDateTime,
      linkedTaskId: taskId, linkedGoalId: task.goalId,
      status: 'planned', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    update(d => ({
      ...d,
      focusBlocks: [...d.focusBlocks, block],
      tasks: d.tasks.map(t => t.id === taskId ? { ...t, scheduledStart: startDateTime, scheduledEnd: endDateTime } : t),
    }));
    toast({ title: 'Focus block created from task', description: task.title });
  }, [update, data.tasks]);

  // ── Habits ──
  const addHabit = useCallback((habit: Habit) => {
    update(d => ({ ...d, habits: [...d.habits, habit] }));
    toast({ title: 'Habit created', description: habit.title });
  }, [update]);
  const updateHabit = useCallback((id: string, updates: Partial<Habit>) =>
    update(d => ({ ...d, habits: d.habits.map(h => h.id === id ? { ...h, ...updates, updatedAt: new Date().toISOString() } : h) })), [update]);
  const deleteHabit = useCallback((id: string) => { update(d => ({ ...d, habits: d.habits.filter(h => h.id !== id) })); toast({ title: 'Habit deleted' }); }, [update]);
  const archiveHabit = useCallback((id: string) => {
    update(d => ({ ...d, habits: d.habits.map(h => h.id === id ? { ...h, status: 'archived' as const, updatedAt: new Date().toISOString() } : h) }));
    toast({ title: 'Habit archived' });
  }, [update]);
  const logHabit = useCallback((id: string, date: string) => {
    update(d => ({ ...d, habits: d.habits.map(h => h.id === id ? { ...h, logs: h.logs.includes(date) ? h.logs : [...h.logs, date], updatedAt: new Date().toISOString() } : h) }));
    toast({ title: 'Habit logged ✓' });
  }, [update]);
  const toggleHabitLog = useCallback((id: string, date: string) => {
    update(d => ({
      ...d,
      habits: d.habits.map(h => {
        if (h.id !== id) return h;
        const logs = h.logs.includes(date) ? h.logs.filter(l => l !== date) : [...h.logs, date];
        return { ...h, logs, updatedAt: new Date().toISOString() };
      }),
    }));
  }, [update]);

  // ── Daily Check-ins ──
  const upsertDailyCheckIn = useCallback((dateISO: string, payload: Omit<DailyCheckIn, 'id' | 'date' | 'createdAt' | 'updatedAt'>) => {
    update(d => {
      const existing = d.dailyCheckIns.find(c => c.date === dateISO);
      if (existing) {
        return { ...d, dailyCheckIns: d.dailyCheckIns.map(c => c.date === dateISO ? { ...c, ...payload, updatedAt: new Date().toISOString() } : c) };
      }
      const newCheckIn: DailyCheckIn = { id: crypto.randomUUID(), date: dateISO, ...payload, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      return { ...d, dailyCheckIns: [...d.dailyCheckIns, newCheckIn] };
    });
    toast({ title: 'Check-in saved ✓' });
  }, [update]);

  const deleteDailyCheckIn = useCallback((dateISO: string) => {
    update(d => ({ ...d, dailyCheckIns: d.dailyCheckIns.filter(c => c.date !== dateISO) }));
    toast({ title: 'Check-in deleted' });
  }, [update]);

  const getCheckInForDate = useCallback((dateISO: string): DailyCheckIn | undefined => {
    return data.dailyCheckIns.find(c => c.date === dateISO);
  }, [data.dailyCheckIns]);

  // ── Life Score ──
  const generateLifeScoreForDate = useCallback((dateISO: string): LifeScoreSnapshot => {
    const { score, breakdown } = computeLifeScore(data, dateISO);
    const existing = data.lifeScoreSnapshots.find(s => s.date === dateISO);
    const snapshot: LifeScoreSnapshot = {
      id: existing?.id || crypto.randomUUID(),
      date: dateISO,
      score,
      breakdown,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    update(d => {
      const filtered = d.lifeScoreSnapshots.filter(s => s.date !== dateISO);
      return { ...d, lifeScoreSnapshots: [...filtered, snapshot] };
    });
    return snapshot;
  }, [data, update]);

  const getLifeScoreForDate = useCallback((dateISO: string): LifeScoreSnapshot | undefined => {
    return data.lifeScoreSnapshots.find(s => s.date === dateISO);
  }, [data.lifeScoreSnapshots]);

  // ── Weekly Plans ──
  const addWeeklyPlan = useCallback((plan: WeeklyPlan) => update(d => ({ ...d, weeklyPlans: [...d.weeklyPlans, plan] })), [update]);
  const updateWeeklyPlan = useCallback((id: string, updates: Partial<WeeklyPlan>) => update(d => ({ ...d, weeklyPlans: d.weeklyPlans.map(p => p.id === id ? { ...p, ...updates } : p) })), [update]);

  const getOrCreateCurrentWeekPlan = useCallback((): WeeklyPlan => {
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const existing = data.weeklyPlans.find(p => p.weekStartDate === weekStart);
    if (existing) return existing;
    return { id: crypto.randomUUID(), weekStartDate: weekStart, committedTaskIds: [], createdAt: new Date().toISOString() };
  }, [data.weeklyPlans]);

  // ── Pinned Focus ──
  const setPinnedFocus = useCallback((date: string, taskIds: string[]) => {
    update(d => ({ ...d, pinnedFocus: { ...d.pinnedFocus, [date]: taskIds.slice(0, 3) } }));
  }, [update]);
  const getPinnedFocus = useCallback((date: string): string[] => data.pinnedFocus[date] || [], [data.pinnedFocus]);

  // ── Profile ──
  const updateProfile = useCallback((updates: Partial<UserProfile>) => update(d => ({ ...d, profile: { ...d.profile, ...updates } })), [update]);

  // ── Data management ──
  const exportData = useCallback(() => JSON.stringify(data, null, 2), [data]);
  const importData = useCallback((json: string, mode: 'replace' | 'merge') => {
    try {
      const imported = JSON.parse(json) as AppData;
      if (mode === 'replace') {
        setData({ ...imported, schemaVersion: SCHEMA_VERSION, focusBlocks: imported.focusBlocks || [], dailyCheckIns: imported.dailyCheckIns || [], lifeScoreSnapshots: imported.lifeScoreSnapshots || [], notifications: imported.notifications || [], notificationSettings: imported.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS, inboxItems: (imported as any).inboxItems || [], notes: (imported as any).notes || [], templates: (imported as any).templates || BUILT_IN_TEMPLATES, automationRules: (imported as any).automationRules || BUILT_IN_AUTOMATIONS, automationLogs: (imported as any).automationLogs || [] });
      } else {
        update(d => ({
          ...d,
          tasks: [...d.tasks, ...imported.tasks.filter(t => !d.tasks.some(x => x.id === t.id))],
          goals: [...d.goals, ...imported.goals.filter(g => !d.goals.some(x => x.id === g.id))],
          events: [...d.events, ...imported.events.filter(e => !d.events.some(x => x.id === e.id))],
          habits: [...d.habits, ...imported.habits.filter(h => !d.habits.some(x => x.id === h.id))],
          focusBlocks: [...d.focusBlocks, ...(imported.focusBlocks || []).filter(fb => !d.focusBlocks.some(x => x.id === fb.id))],
          dailyCheckIns: [...d.dailyCheckIns, ...(imported.dailyCheckIns || []).filter(c => !d.dailyCheckIns.some(x => x.date === c.date))],
          lifeScoreSnapshots: [...d.lifeScoreSnapshots, ...(imported.lifeScoreSnapshots || []).filter(s => !d.lifeScoreSnapshots.some(x => x.date === s.date))],
          notifications: [...d.notifications, ...(imported.notifications || []).filter(n => !d.notifications.some(x => x.id === n.id))],
          inboxItems: [...d.inboxItems, ...((imported as any).inboxItems || []).filter((i: any) => !d.inboxItems.some(x => x.id === i.id))],
          notes: [...d.notes, ...((imported as any).notes || []).filter((n: any) => !d.notes.some(x => x.id === n.id))],
          templates: [...d.templates, ...((imported as any).templates || []).filter((t: any) => !d.templates.some(x => x.id === t.id))],
          automationRules: [...d.automationRules, ...((imported as any).automationRules || []).filter((r: any) => !d.automationRules.some(x => x.id === r.id))],
          automationLogs: [...d.automationLogs, ...((imported as any).automationLogs || []).filter((l: any) => !d.automationLogs.some(x => x.id === l.id))],
        }));
      }
      toast({ title: `Data ${mode === 'replace' ? 'replaced' : 'merged'} successfully` });
    } catch { toast({ title: 'Import failed', variant: 'destructive' }); }
  }, [update]);

  const resetData = useCallback(() => {
    setData(emptyData());
    toast({ title: 'Data reset' });
  }, []);

  // ── Task Selectors ──
  const getTodayTasks = useCallback((): Task[] => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return data.tasks.filter(t => t.status !== 'done' && t.status !== 'canceled' && ((t.dueDate && t.dueDate === todayStr) || t.status === 'doing'));
  }, [data.tasks]);

  const getOverdueTasks = useCallback((): Task[] => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return data.tasks.filter(t => t.status !== 'done' && t.status !== 'canceled' && t.dueDate && t.dueDate < todayStr);
  }, [data.tasks]);

  const getThisWeekCommittedTasks = useCallback((): Task[] => {
    const plan = data.weeklyPlans.find(p => p.weekStartDate === format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    if (!plan) return [];
    return data.tasks.filter(t => plan.committedTaskIds.includes(t.id));
  }, [data.tasks, data.weeklyPlans]);

  const completionRateThisWeek = useCallback((): number => {
    const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
    const we = endOfWeek(new Date(), { weekStartsOn: 1 });
    const weekTasks = data.tasks.filter(t => t.dueDate && isWithinInterval(new Date(t.dueDate), { start: ws, end: we }));
    if (weekTasks.length === 0) return 0;
    return Math.round((weekTasks.filter(t => t.status === 'done').length / weekTasks.length) * 100);
  }, [data.tasks]);

  const tasksCompletedPerDayThisWeek = useCallback((): { date: string; count: number }[] => {
    const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(ws, i);
      const dayStr = format(d, 'yyyy-MM-dd');
      return { date: format(d, 'EEE'), count: data.tasks.filter(t => t.completedAt && format(new Date(t.completedAt), 'yyyy-MM-dd') === dayStr).length };
    });
  }, [data.tasks]);

  const avgCompletionTime = useCallback((): string => {
    const completed = data.tasks.filter(t => t.completedAt && t.createdAt);
    if (completed.length === 0) return 'N/A';
    const totalMin = completed.reduce((sum, t) => sum + differenceInMinutes(new Date(t.completedAt!), new Date(t.createdAt)), 0);
    const avg = totalMin / completed.length;
    if (avg < 60) return `${Math.round(avg)}m`;
    if (avg < 1440) return `${(avg / 60).toFixed(1)}h`;
    return `${(avg / 1440).toFixed(1)}d`;
  }, [data.tasks]);

  // ── Calendar Selectors ──
  const getEventsForDay = useCallback((dateISO: string): CalendarEvent[] => {
    const day = parseISO(dateISO);
    return data.events.filter(e => isSameDay(new Date(e.startDateTime), day));
  }, [data.events]);

  const getBlocksForDay = useCallback((dateISO: string): FocusBlock[] => {
    const day = parseISO(dateISO);
    return data.focusBlocks.filter(fb => isSameDay(new Date(fb.startDateTime), day));
  }, [data.focusBlocks]);

  const getAgendaForDay = useCallback((dateISO: string): AgendaItem[] => {
    const events: AgendaItem[] = getEventsForDay(dateISO).map(e => ({
      type: 'event', id: e.id, title: e.title, startDateTime: e.startDateTime, endDateTime: e.endDateTime,
      category: e.category, location: e.location, notes: e.notes,
    }));
    const blocks: AgendaItem[] = getBlocksForDay(dateISO).map(fb => ({
      type: 'focus', id: fb.id, title: fb.title, startDateTime: fb.startDateTime, endDateTime: fb.endDateTime,
      status: fb.status, linkedTaskId: fb.linkedTaskId, linkedGoalId: fb.linkedGoalId, notes: fb.notes,
    }));
    return [...events, ...blocks].sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
  }, [getEventsForDay, getBlocksForDay]);

  const getPlannedFocusMinutes = useCallback((startDate: string, endDate: string): number => {
    const s = new Date(startDate); const e = new Date(endDate);
    return data.focusBlocks
      .filter(fb => { const d = new Date(fb.startDateTime); return d >= s && d <= e; })
      .reduce((sum, fb) => sum + differenceInMinutes(new Date(fb.endDateTime), new Date(fb.startDateTime)), 0);
  }, [data.focusBlocks]);

  const getCompletedFocusMinutes = useCallback((startDate: string, endDate: string): number => {
    const s = new Date(startDate); const e = new Date(endDate);
    return data.focusBlocks
      .filter(fb => fb.status === 'done' && new Date(fb.startDateTime) >= s && new Date(fb.startDateTime) <= e)
      .reduce((sum, fb) => sum + differenceInMinutes(new Date(fb.endDateTime), new Date(fb.startDateTime)), 0);
  }, [data.focusBlocks]);

  // ── Notifications ──
  const addNotification = useCallback((item: NotificationItem) => {
    update(d => ({ ...d, notifications: [...d.notifications, item] }));
  }, [update]);

  const markNotificationRead = useCallback((id: string) => {
    update(d => ({ ...d, notifications: d.notifications.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n) }));
  }, [update]);

  const dismissNotification = useCallback((id: string) => {
    update(d => ({ ...d, notifications: d.notifications.map(n => n.id === id ? { ...n, dismissedAt: new Date().toISOString() } : n) }));
  }, [update]);

  const snoozeNotification = useCallback((id: string, untilISO: string) => {
    update(d => ({ ...d, notifications: d.notifications.map(n => n.id === id ? { ...n, snoozedUntil: untilISO } : n) }));
    toast({ title: 'Notification snoozed' });
  }, [update]);

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    update(d => ({ ...d, notifications: d.notifications.map(n => n.readAt ? n : { ...n, readAt: now }) }));
    toast({ title: 'All notifications marked read' });
  }, [update]);

  const clearDismissed = useCallback((olderThanDays: number = 30) => {
    const cutoff = subDays(new Date(), olderThanDays).toISOString();
    update(d => ({ ...d, notifications: d.notifications.filter(n => !n.dismissedAt || n.dismissedAt > cutoff) }));
  }, [update]);

  const updateNotificationSettings = useCallback((updates: Partial<NotificationSettings>) => {
    update(d => ({ ...d, notificationSettings: { ...d.notificationSettings, ...updates } }));
    toast({ title: 'Notification settings updated' });
  }, [update]);

  const runNotificationGeneration = useCallback(() => {
    const newNotifs = generateNotifications(data);
    if (newNotifs.length > 0) {
      update(d => ({ ...d, notifications: [...d.notifications, ...newNotifs] }));
      const settings = data.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS;
      if (!isQuietHours(settings)) {
        const critical = newNotifs.filter(n => n.severity === 'critical' || n.severity === 'warning');
        critical.slice(0, 2).forEach(n => {
          toast({ title: n.title, description: n.message });
        });
      }
    }
  }, [data, update]);

  const getUnreadNotificationCount = useCallback((): number => {
    return data.notifications.filter(n => !n.readAt && !n.dismissedAt && (!n.snoozedUntil || n.snoozedUntil <= new Date().toISOString())).length;
  }, [data.notifications]);

  // Generate notifications on load and periodically
  const lastGenRef = useRef<string>('');
  useEffect(() => {
    const key = format(new Date(), 'yyyy-MM-dd-HH');
    if (lastGenRef.current !== key) {
      lastGenRef.current = key;
      const newNotifs = generateNotifications(data);
      if (newNotifs.length > 0) {
        setData(prev => ({ ...prev, notifications: [...prev.notifications, ...newNotifs] }));
      }
    }
  }, [data.tasks, data.goals, data.habits, data.focusBlocks, data.dailyCheckIns, data.inboxItems]);

  // ── Inbox ──
  const addInboxItem = useCallback((content: string, source: InboxItem['source'] = 'manual'): InboxItem => {
    const now = new Date().toISOString();
    const detected = detectInboxContent(content);
    const item: InboxItem = {
      id: crypto.randomUUID(), createdAt: now, updatedAt: now,
      content, title: deriveTitle(content), source, status: 'unprocessed',
      tags: [], pinned: false, detected,
    };
    update(d => ({ ...d, inboxItems: [...d.inboxItems, item] }));
    toast({ title: 'Saved to Inbox', description: item.title });
    return item;
  }, [update]);

  const updateInboxItem = useCallback((id: string, updates: Partial<InboxItem>) => {
    update(d => ({
      ...d, inboxItems: d.inboxItems.map(i => {
        if (i.id !== id) return i;
        const updated = { ...i, ...updates, updatedAt: new Date().toISOString() };
        if (updates.content) updated.detected = detectInboxContent(updates.content);
        return updated;
      }),
    }));
  }, [update]);

  const deleteInboxItem = useCallback((id: string) => {
    update(d => ({ ...d, inboxItems: d.inboxItems.filter(i => i.id !== id) }));
    toast({ title: 'Inbox item deleted' });
  }, [update]);

  const archiveInboxItem = useCallback((id: string) => {
    update(d => ({ ...d, inboxItems: d.inboxItems.map(i => i.id === id ? { ...i, status: 'archived' as const, updatedAt: new Date().toISOString() } : i) }));
    toast({ title: 'Archived' });
  }, [update]);

  const pinInboxItem = useCallback((id: string, pinned: boolean) => {
    update(d => ({ ...d, inboxItems: d.inboxItems.map(i => i.id === id ? { ...i, pinned, updatedAt: new Date().toISOString() } : i) }));
  }, [update]);

  const setInboxStatus = useCallback((id: string, status: InboxItem['status']) => {
    update(d => ({ ...d, inboxItems: d.inboxItems.map(i => i.id === id ? { ...i, status, updatedAt: new Date().toISOString() } : i) }));
  }, [update]);

  const markInboxConverted = useCallback((inboxId: string, kind: InboxItem['conversion'] extends undefined ? never : NonNullable<InboxItem['conversion']>['kind'], entityId: string) => {
    update(d => ({
      ...d, inboxItems: d.inboxItems.map(i => i.id === inboxId ? {
        ...i, status: 'converted' as const, updatedAt: new Date().toISOString(),
        conversion: { kind, entityId, convertedAt: new Date().toISOString() },
      } : i),
    }));
  }, [update]);

  const convertInboxToTask = useCallback((inboxId: string, payload: Partial<Task>) => {
    const item = data.inboxItems.find(i => i.id === inboxId);
    if (!item) return;
    const task: Task = {
      id: crypto.randomUUID(), title: payload.title || item.title || deriveTitle(item.content),
      description: payload.description || item.content, status: payload.status || 'todo',
      priority: payload.priority || 'med', dueDate: payload.dueDate,
      createdAt: new Date().toISOString(), tags: payload.tags || item.tags,
      subtasks: payload.subtasks || [], goalId: payload.goalId,
    };
    update(d => ({
      ...d, tasks: [...d.tasks, task],
      inboxItems: d.inboxItems.map(i => i.id === inboxId ? { ...i, status: 'converted' as const, updatedAt: new Date().toISOString(), conversion: { kind: 'task' as const, entityId: task.id, convertedAt: new Date().toISOString() } } : i),
    }));
    toast({ title: 'Converted to Task', description: task.title });
  }, [update, data.inboxItems]);

  const convertInboxToGoal = useCallback((inboxId: string, payload: Partial<Goal>) => {
    const item = data.inboxItems.find(i => i.id === inboxId);
    if (!item) return;
    const now = new Date().toISOString();
    const goal: Goal = {
      id: crypto.randomUUID(), title: payload.title || item.title || deriveTitle(item.content),
      description: payload.description || item.content, category: payload.category || 'custom',
      status: 'active', startDate: payload.startDate || format(new Date(), 'yyyy-MM-dd'),
      targetDate: payload.targetDate || format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      progressType: payload.progressType || 'manual', progressValue: payload.progressValue || 0,
      linkedTaskIds: payload.linkedTaskIds || [], milestones: payload.milestones || [],
      createdAt: now, updatedAt: now,
    };
    update(d => ({
      ...d, goals: [...d.goals, goal],
      inboxItems: d.inboxItems.map(i => i.id === inboxId ? { ...i, status: 'converted' as const, updatedAt: now, conversion: { kind: 'goal' as const, entityId: goal.id, convertedAt: now } } : i),
    }));
    toast({ title: 'Converted to Goal', description: goal.title });
  }, [update, data.inboxItems]);

  const convertInboxToEvent = useCallback((inboxId: string, payload: Partial<CalendarEvent>) => {
    const item = data.inboxItems.find(i => i.id === inboxId);
    if (!item) return;
    const now = new Date().toISOString();
    const startDT = payload.startDateTime || item.detected.suggestedDateTime || now;
    const event: CalendarEvent = {
      id: crypto.randomUUID(), title: payload.title || item.title || deriveTitle(item.content),
      startDateTime: startDT,
      endDateTime: payload.endDateTime || addMinutes(new Date(startDT), 60).toISOString(),
      location: payload.location, notes: payload.notes || item.content,
      category: payload.category || 'personal', recurring: payload.recurring || null,
      createdAt: now, updatedAt: now,
    };
    update(d => ({
      ...d, events: [...d.events, event],
      inboxItems: d.inboxItems.map(i => i.id === inboxId ? { ...i, status: 'converted' as const, updatedAt: now, conversion: { kind: 'event' as const, entityId: event.id, convertedAt: now } } : i),
    }));
    toast({ title: 'Converted to Event', description: event.title });
  }, [update, data.inboxItems]);

  const convertInboxToHabit = useCallback((inboxId: string, payload: Partial<Habit>) => {
    const item = data.inboxItems.find(i => i.id === inboxId);
    if (!item) return;
    const now = new Date().toISOString();
    const habit: Habit = {
      id: crypto.randomUUID(), title: payload.title || item.title || deriveTitle(item.content),
      description: payload.description || item.content,
      frequency: payload.frequency || 'daily', targetCountPerPeriod: payload.targetCountPerPeriod || 1,
      category: payload.category || 'personal', logs: [], createdAt: now, updatedAt: now, status: 'active',
    };
    update(d => ({
      ...d, habits: [...d.habits, habit],
      inboxItems: d.inboxItems.map(i => i.id === inboxId ? { ...i, status: 'converted' as const, updatedAt: now, conversion: { kind: 'habit' as const, entityId: habit.id, convertedAt: now } } : i),
    }));
    toast({ title: 'Converted to Habit', description: habit.title });
  }, [update, data.inboxItems]);

  const convertInboxToFocusBlock = useCallback((inboxId: string, payload: Partial<FocusBlock>) => {
    const item = data.inboxItems.find(i => i.id === inboxId);
    if (!item) return;
    const now = new Date().toISOString();
    const startDT = payload.startDateTime || item.detected.suggestedDateTime || now;
    const block: FocusBlock = {
      id: crypto.randomUUID(), title: payload.title || `Focus: ${item.title || deriveTitle(item.content)}`,
      startDateTime: startDT,
      endDateTime: payload.endDateTime || addMinutes(new Date(startDT), 60).toISOString(),
      linkedTaskId: payload.linkedTaskId, linkedGoalId: payload.linkedGoalId,
      status: 'planned', notes: payload.notes || item.content, createdAt: now, updatedAt: now,
    };
    update(d => ({
      ...d, focusBlocks: [...d.focusBlocks, block],
      inboxItems: d.inboxItems.map(i => i.id === inboxId ? { ...i, status: 'converted' as const, updatedAt: now, conversion: { kind: 'focusBlock' as const, entityId: block.id, convertedAt: now } } : i),
    }));
    toast({ title: 'Converted to Focus Block', description: block.title });
  }, [update, data.inboxItems]);

  const convertInboxToNote = useCallback((inboxId: string, payload: Partial<Note>) => {
    const item = data.inboxItems.find(i => i.id === inboxId);
    if (!item) return;
    const now = new Date().toISOString();
    const note: Note = {
      id: crypto.randomUUID(), title: payload.title || item.title || deriveTitle(item.content),
      content: payload.content || item.content, createdAt: now, updatedAt: now,
      tags: payload.tags || item.tags, pinned: payload.pinned || false,
    };
    update(d => ({
      ...d, notes: [...d.notes, note],
      inboxItems: d.inboxItems.map(i => i.id === inboxId ? { ...i, status: 'converted' as const, updatedAt: now, conversion: { kind: 'note' as const, entityId: note.id, convertedAt: now } } : i),
    }));
    toast({ title: 'Converted to Note', description: note.title });
  }, [update, data.inboxItems]);

  // ── Notes ──
  const createNote = useCallback((note: Note) => {
    update(d => ({ ...d, notes: [...d.notes, note] }));
    toast({ title: 'Note created', description: note.title });
  }, [update]);

  const updateNote = useCallback((id: string, updates: Partial<Note>) => {
    update(d => ({ ...d, notes: d.notes.map(n => n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n) }));
  }, [update]);

  const deleteNote = useCallback((id: string) => {
    update(d => ({ ...d, notes: d.notes.filter(n => n.id !== id) }));
    toast({ title: 'Note deleted' });
  }, [update]);

  const pinNote = useCallback((id: string, pinned: boolean) => {
    update(d => ({ ...d, notes: d.notes.map(n => n.id === id ? { ...n, pinned, updatedAt: new Date().toISOString() } : n) }));
  }, [update]);

  // ── Templates ──
  const createTemplate = useCallback((tpl: Template) => {
    update(d => ({ ...d, templates: [...d.templates, tpl] }));
    toast({ title: 'Template created', description: tpl.name });
  }, [update]);

  const updateTemplate = useCallback((id: string, updates: Partial<Template>) => {
    update(d => ({ ...d, templates: d.templates.map(t => t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t) }));
    toast({ title: 'Template updated' });
  }, [update]);

  const deleteTemplate = useCallback((id: string) => {
    update(d => ({ ...d, templates: d.templates.filter(t => t.id !== id) }));
    toast({ title: 'Template deleted' });
  }, [update]);

  const duplicateTemplate = useCallback((id: string) => {
    const tpl = data.templates.find(t => t.id === id);
    if (!tpl) return;
    const now = new Date().toISOString();
    const dup: Template = { ...tpl, id: crypto.randomUUID(), name: `${tpl.name} (copy)`, isBuiltIn: false, createdAt: now, updatedAt: now };
    update(d => ({ ...d, templates: [...d.templates, dup] }));
    toast({ title: 'Template duplicated' });
  }, [update, data.templates]);

  const runTemplate = useCallback((templateId: string, runDate: string): ApplyTemplateResult | null => {
    const tpl = data.templates.find(t => t.id === templateId);
    if (!tpl) return null;
    const { newData, result } = applyTemplateEngine(tpl, runDate, data);
    setData(newData);
    toast({ title: 'Template applied', description: `Created ${result.createdRefs.length} items` });
    return result;
  }, [data]);

  // ── Automation Rules ──
  const createAutomationRule = useCallback((rule: AutomationRule) => {
    update(d => ({ ...d, automationRules: [...d.automationRules, rule] }));
    toast({ title: 'Automation rule created', description: rule.name });
  }, [update]);

  const updateAutomationRule = useCallback((id: string, updates: Partial<AutomationRule>) => {
    update(d => ({ ...d, automationRules: d.automationRules.map(r => r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r) }));
    toast({ title: 'Rule updated' });
  }, [update]);

  const deleteAutomationRule = useCallback((id: string) => {
    update(d => ({ ...d, automationRules: d.automationRules.filter(r => r.id !== id) }));
    toast({ title: 'Rule deleted' });
  }, [update]);

  const toggleRuleEnabled = useCallback((id: string) => {
    update(d => ({
      ...d, automationRules: d.automationRules.map(r => r.id === id ? { ...r, enabled: !r.enabled, updatedAt: new Date().toISOString() } : r),
    }));
  }, [update]);

  const undoAutomationRun = useCallback((logId: string) => {
    const log = data.automationLogs.find(l => l.id === logId);
    if (!log?.undoToken) return;
    update(d => {
      let nd = { ...d };
      for (const ref of log.undoToken!.ids) {
        switch (ref.kind) {
          case 'task': nd = { ...nd, tasks: nd.tasks.filter(t => t.id !== ref.id) }; break;
          case 'event': nd = { ...nd, events: nd.events.filter(e => e.id !== ref.id) }; break;
          case 'focusBlock': nd = { ...nd, focusBlocks: nd.focusBlocks.filter(fb => fb.id !== ref.id) }; break;
          case 'habit': nd = { ...nd, habits: nd.habits.filter(h => h.id !== ref.id) }; break;
          case 'goal': nd = { ...nd, goals: nd.goals.filter(g => g.id !== ref.id) }; break;
          case 'notification': nd = { ...nd, notifications: nd.notifications.filter(n => n.id !== ref.id) }; break;
          case 'inbox': nd = { ...nd, inboxItems: nd.inboxItems.filter(i => i.id !== ref.id) }; break;
          case 'note': nd = { ...nd, notes: nd.notes.filter(n => n.id !== ref.id) }; break;
        }
      }
      nd = { ...nd, automationLogs: nd.automationLogs.map(l => l.id === logId ? { ...l, undoToken: undefined } : l) };
      return nd;
    });
    toast({ title: 'Automation undone' });
  }, [update, data.automationLogs]);

  // ── Automation Time Tick ──
  const lastAutoTickRef = useRef<string>('');
  useEffect(() => {
    const tick = () => {
      const key = format(new Date(), 'yyyy-MM-dd-HH-mm');
      if (lastAutoTickRef.current === key) return;
      lastAutoTickRef.current = key;

      setData(prev => {
        let d = { ...prev };
        const enabledRules = d.automationRules.filter(r => r.enabled && r.trigger.type === 'time');
        for (const rule of enabledRules) {
          if (!shouldRunTimeRule(rule)) continue;
          if (isThrottled(rule, d.automationLogs)) {
            d = { ...d, automationLogs: [...d.automationLogs, { id: crypto.randomUUID(), ruleId: rule.id, ranAt: new Date().toISOString(), status: 'throttled', reason: 'Rate limited', createdEntityRefs: [] }] };
            continue;
          }
          if (!evaluateConditions(rule.conditions, d)) {
            d = { ...d, automationLogs: [...d.automationLogs, { id: crypto.randomUUID(), ruleId: rule.id, ranAt: new Date().toISOString(), status: 'skipped', reason: 'Conditions not met', createdEntityRefs: [] }] };
            continue;
          }
          const { newData, log } = executeActions(rule, d, d.templates);
          d = { ...newData, automationRules: newData.automationRules.map(r => r.id === rule.id ? { ...r, lastRunAt: new Date().toISOString() } : r), automationLogs: [...newData.automationLogs, log] };
        }
        return d;
      });
    };

    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AppContext.Provider value={{
      data, addTask, updateTask, deleteTask, toggleTaskDone, changeTaskStatus, scheduleTask, unscheduleTask,
      addGoal, updateGoal, deleteGoal, archiveGoal, completeGoal,
      linkTaskToGoal, unlinkTaskFromGoal,
      getActiveGoals, getBehindGoals, getGoalsDueSoon, getGoalProgress, getGoalStatus,
      addEvent, updateEvent, deleteEvent,
      addFocusBlock, updateFocusBlock, deleteFocusBlock, markFocusBlockCompleted, markFocusBlockSkipped, createFocusBlockFromTask,
      addHabit, updateHabit, deleteHabit, archiveHabit, logHabit, toggleHabitLog,
      upsertDailyCheckIn, deleteDailyCheckIn, getCheckInForDate,
      generateLifeScoreForDate, getLifeScoreForDate,
      addWeeklyPlan, updateWeeklyPlan, getOrCreateCurrentWeekPlan,
      setPinnedFocus, getPinnedFocus,
      updateProfile, exportData, importData, resetData,
      getTodayTasks, getOverdueTasks, getThisWeekCommittedTasks,
      completionRateThisWeek, tasksCompletedPerDayThisWeek, avgCompletionTime,
      getEventsForDay, getBlocksForDay, getAgendaForDay, getPlannedFocusMinutes, getCompletedFocusMinutes,
      addNotification, markNotificationRead, dismissNotification, snoozeNotification, markAllRead, clearDismissed,
      updateNotificationSettings, runNotificationGeneration, getUnreadNotificationCount,
      addInboxItem, updateInboxItem, deleteInboxItem, archiveInboxItem, pinInboxItem, setInboxStatus,
      convertInboxToTask, convertInboxToGoal, convertInboxToEvent, convertInboxToHabit, convertInboxToFocusBlock, convertInboxToNote,
      createNote, updateNote, deleteNote, pinNote,
      createTemplate, updateTemplate, deleteTemplate, duplicateTemplate, runTemplate,
      createAutomationRule, updateAutomationRule, deleteAutomationRule, toggleRuleEnabled, undoAutomationRun,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
