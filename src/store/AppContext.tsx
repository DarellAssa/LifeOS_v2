import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AppData, Task, Goal, CalendarEvent, FocusBlock, Habit, DailyCheckIn, LifeScoreSnapshot, WeeklyPlan, UserProfile, GoalDisplayStatus } from '@/types';
import { seedData } from './seedData';
import { toast } from '@/hooks/use-toast';
import { format, startOfWeek, endOfWeek, isWithinInterval, differenceInMinutes, addDays, addMinutes, isSameDay, parseISO } from 'date-fns';
import { computeGoalProgress, getGoalDisplayStatus, getGoalsDueSoon as getGoalsDueSoonUtil, computeLifeScore } from '@/lib/stats';

const STORAGE_KEY = 'lifeos-data';
const SCHEMA_VERSION = 5;

function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed.schemaVersion === SCHEMA_VERSION) return parsed;
      // Migration from v2/v3/v4 to v5
      if (parsed.schemaVersion >= 2) {
        return {
          ...parsed,
          schemaVersion: SCHEMA_VERSION,
          focusBlocks: (parsed as any).focusBlocks || [],
          dailyCheckIns: (parsed as any).dailyCheckIns || [],
          lifeScoreSnapshots: (parsed as any).lifeScoreSnapshots || [],
          goals: parsed.goals.map((g: any) => ({
            ...g,
            createdAt: g.createdAt || new Date().toISOString(),
            updatedAt: g.updatedAt || new Date().toISOString(),
            milestones: (g.milestones || []).map((m: any) => ({
              id: m.id, title: m.title, date: m.date || m.targetDate, done: m.done ?? m.completed ?? false,
            })),
          })),
          events: parsed.events.map((e: any) => ({
            ...e,
            createdAt: e.createdAt || new Date().toISOString(),
            updatedAt: e.updatedAt || new Date().toISOString(),
            recurring: e.recurring === 'daily' ? { type: 'daily', interval: 1 } :
              e.recurring === 'weekly' ? { type: 'weekly', interval: 1 } :
              e.recurring === 'monthly' ? { type: 'monthly', interval: 1 } :
              typeof e.recurring === 'object' ? e.recurring : null,
          })),
          habits: parsed.habits.map((h: any) => ({
            ...h,
            category: h.category || 'personal',
            description: h.description || '',
            createdAt: h.createdAt || new Date().toISOString(),
            updatedAt: h.updatedAt || new Date().toISOString(),
            status: h.status || 'active',
          })),
        };
      }
    }
  } catch { /* use seed */ }
  return JSON.parse(JSON.stringify(seedData));
}

function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
  const [data, setData] = useState<AppData>(loadData);

  useEffect(() => { saveData(data); }, [data]);

  const update = useCallback((fn: (prev: AppData) => AppData) => {
    setData(prev => fn(prev));
  }, []);

  // ── Tasks ──
  const addTask = useCallback((task: Task) => {
    update(d => ({ ...d, tasks: [...d.tasks, task] }));
    toast({ title: 'Task created', description: task.title });
  }, [update]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    update(d => ({ ...d, tasks: d.tasks.map(t => t.id === id ? { ...t, ...updates } : t) }));
  }, [update]);

  const deleteTask = useCallback((id: string) => {
    update(d => ({
      ...d,
      tasks: d.tasks.filter(t => t.id !== id),
      goals: d.goals.map(g => ({ ...g, linkedTaskIds: g.linkedTaskIds.filter(tid => tid !== id) })),
      focusBlocks: d.focusBlocks.map(fb => fb.linkedTaskId === id ? { ...fb, linkedTaskId: undefined } : fb),
    }));
    toast({ title: 'Task deleted' });
  }, [update]);

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
    update(d => ({ ...d, goals: d.goals.map(g => g.id === id ? { ...g, status: 'archived' as const, updatedAt: new Date().toISOString() } : g) }));
    toast({ title: 'Goal archived' });
  }, [update]);

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
    update(d => ({ ...d, focusBlocks: d.focusBlocks.map(fb => fb.id === id ? { ...fb, status: 'completed' as const, updatedAt: new Date().toISOString() } : fb) }));
    toast({ title: 'Focus block completed ✓' });
  }, [update]);

  const markFocusBlockSkipped = useCallback((id: string) => {
    update(d => ({ ...d, focusBlocks: d.focusBlocks.map(fb => fb.id === id ? { ...fb, status: 'skipped' as const, updatedAt: new Date().toISOString() } : fb) }));
    toast({ title: 'Focus block skipped' });
  }, [update]);

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
      if (mode === 'replace') { setData({ ...imported, schemaVersion: SCHEMA_VERSION, focusBlocks: imported.focusBlocks || [], dailyCheckIns: imported.dailyCheckIns || [], lifeScoreSnapshots: imported.lifeScoreSnapshots || [] }); } else {
        update(d => ({
          ...d,
          tasks: [...d.tasks, ...imported.tasks.filter(t => !d.tasks.some(x => x.id === t.id))],
          goals: [...d.goals, ...imported.goals.filter(g => !d.goals.some(x => x.id === g.id))],
          events: [...d.events, ...imported.events.filter(e => !d.events.some(x => x.id === e.id))],
          habits: [...d.habits, ...imported.habits.filter(h => !d.habits.some(x => x.id === h.id))],
          focusBlocks: [...d.focusBlocks, ...(imported.focusBlocks || []).filter(fb => !d.focusBlocks.some(x => x.id === fb.id))],
          dailyCheckIns: [...d.dailyCheckIns, ...(imported.dailyCheckIns || []).filter(c => !d.dailyCheckIns.some(x => x.date === c.date))],
          lifeScoreSnapshots: [...d.lifeScoreSnapshots, ...(imported.lifeScoreSnapshots || []).filter(s => !d.lifeScoreSnapshots.some(x => x.date === s.date))],
        }));
      }
      toast({ title: `Data ${mode === 'replace' ? 'replaced' : 'merged'} successfully` });
    } catch { toast({ title: 'Import failed', variant: 'destructive' }); }
  }, [update]);

  const resetData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setData(JSON.parse(JSON.stringify(seedData)));
    toast({ title: 'Data reset to defaults' });
  }, []);

  // ── Task Selectors ──
  const getTodayTasks = useCallback((): Task[] => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return data.tasks.filter(t => t.status !== 'done' && ((t.dueDate && t.dueDate === todayStr) || t.status === 'doing'));
  }, [data.tasks]);

  const getOverdueTasks = useCallback((): Task[] => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return data.tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < todayStr);
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
      .filter(fb => fb.status === 'completed' && new Date(fb.startDateTime) >= s && new Date(fb.startDateTime) <= e)
      .reduce((sum, fb) => sum + differenceInMinutes(new Date(fb.endDateTime), new Date(fb.startDateTime)), 0);
  }, [data.focusBlocks]);

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
