import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { AppData, Task, Goal, CalendarEvent, Habit, WeeklyPlan, UserProfile, PinnedFocus } from '@/types';
import { seedData } from './seedData';
import { toast } from '@/hooks/use-toast';
import { format, startOfWeek, endOfWeek, isWithinInterval, isBefore, startOfDay, isToday, differenceInMinutes } from 'date-fns';

const STORAGE_KEY = 'lifeos-data';
const SCHEMA_VERSION = 2;

function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed.schemaVersion === SCHEMA_VERSION) return parsed;
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
  // Goals
  addGoal: (goal: Goal) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  // Events
  addEvent: (event: CalendarEvent) => void;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  // Habits
  addHabit: (habit: Habit) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  logHabit: (id: string, date: string) => void;
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
  // Derived selectors
  getTodayTasks: () => Task[];
  getOverdueTasks: () => Task[];
  getThisWeekCommittedTasks: () => Task[];
  completionRateThisWeek: () => number;
  tasksCompletedPerDayThisWeek: () => { date: string; count: number }[];
  avgCompletionTime: () => string;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(loadData);

  useEffect(() => { saveData(data); }, [data]);

  const update = useCallback((fn: (prev: AppData) => AppData) => {
    setData(prev => fn(prev));
  }, []);

  // Tasks
  const addTask = useCallback((task: Task) => {
    update(d => ({ ...d, tasks: [...d.tasks, task] }));
    toast({ title: 'Task created', description: task.title });
  }, [update]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    update(d => ({ ...d, tasks: d.tasks.map(t => t.id === id ? { ...t, ...updates } : t) }));
  }, [update]);

  const deleteTask = useCallback((id: string) => {
    update(d => ({ ...d, tasks: d.tasks.filter(t => t.id !== id) }));
    toast({ title: 'Task deleted' });
  }, [update]);

  const toggleTaskDone = useCallback((id: string) => {
    update(d => ({
      ...d,
      tasks: d.tasks.map(t => {
        if (t.id !== id) return t;
        const isDone = t.status === 'done';
        return {
          ...t,
          status: isDone ? 'todo' as const : 'done' as const,
          completedAt: isDone ? undefined : new Date().toISOString(),
        };
      }),
    }));
    const task = data.tasks.find(t => t.id === id);
    if (task && task.status !== 'done') {
      toast({ title: 'Task completed! ✓', description: task.title });
    }
  }, [update, data.tasks]);

  const changeTaskStatus = useCallback((id: string, status: Task['status']) => {
    update(d => ({
      ...d,
      tasks: d.tasks.map(t => {
        if (t.id !== id) return t;
        return {
          ...t,
          status,
          completedAt: status === 'done' ? new Date().toISOString() : undefined,
        };
      }),
    }));
  }, [update]);

  // Goals
  const addGoal = useCallback((goal: Goal) => {
    update(d => ({ ...d, goals: [...d.goals, goal] }));
    toast({ title: 'Goal created', description: goal.title });
  }, [update]);
  const updateGoal = useCallback((id: string, updates: Partial<Goal>) =>
    update(d => ({ ...d, goals: d.goals.map(g => g.id === id ? { ...g, ...updates } : g) })), [update]);
  const deleteGoal = useCallback((id: string) => {
    update(d => ({ ...d, goals: d.goals.filter(g => g.id !== id) }));
    toast({ title: 'Goal deleted' });
  }, [update]);

  // Events
  const addEvent = useCallback((event: CalendarEvent) => {
    update(d => ({ ...d, events: [...d.events, event] }));
    toast({ title: 'Event created', description: event.title });
  }, [update]);
  const updateEvent = useCallback((id: string, updates: Partial<CalendarEvent>) =>
    update(d => ({ ...d, events: d.events.map(e => e.id === id ? { ...e, ...updates } : e) })), [update]);
  const deleteEvent = useCallback((id: string) => {
    update(d => ({ ...d, events: d.events.filter(e => e.id !== id) }));
    toast({ title: 'Event deleted' });
  }, [update]);

  // Habits
  const addHabit = useCallback((habit: Habit) => {
    update(d => ({ ...d, habits: [...d.habits, habit] }));
    toast({ title: 'Habit created', description: habit.title });
  }, [update]);
  const updateHabit = useCallback((id: string, updates: Partial<Habit>) =>
    update(d => ({ ...d, habits: d.habits.map(h => h.id === id ? { ...h, ...updates } : h) })), [update]);
  const deleteHabit = useCallback((id: string) => {
    update(d => ({ ...d, habits: d.habits.filter(h => h.id !== id) }));
  }, [update]);
  const logHabit = useCallback((id: string, date: string) => {
    update(d => ({
      ...d,
      habits: d.habits.map(h => h.id === id
        ? { ...h, logs: h.logs.includes(date) ? h.logs : [...h.logs, date] }
        : h
      ),
    }));
    toast({ title: 'Habit logged ✓' });
  }, [update]);

  // Weekly Plans
  const addWeeklyPlan = useCallback((plan: WeeklyPlan) =>
    update(d => ({ ...d, weeklyPlans: [...d.weeklyPlans, plan] })), [update]);
  const updateWeeklyPlan = useCallback((id: string, updates: Partial<WeeklyPlan>) =>
    update(d => ({ ...d, weeklyPlans: d.weeklyPlans.map(p => p.id === id ? { ...p, ...updates } : p) })), [update]);

  const getOrCreateCurrentWeekPlan = useCallback((): WeeklyPlan => {
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const existing = data.weeklyPlans.find(p => p.weekStartDate === weekStart);
    if (existing) return existing;
    const plan: WeeklyPlan = {
      id: crypto.randomUUID(),
      weekStartDate: weekStart,
      committedTaskIds: [],
      createdAt: new Date().toISOString(),
    };
    // We don't call addWeeklyPlan here to avoid side effects during render
    // Instead return a transient plan - caller should save if needed
    return plan;
  }, [data.weeklyPlans]);

  // Pinned Focus
  const setPinnedFocus = useCallback((date: string, taskIds: string[]) => {
    update(d => ({
      ...d,
      pinnedFocus: { ...d.pinnedFocus, [date]: taskIds.slice(0, 3) },
    }));
  }, [update]);

  const getPinnedFocus = useCallback((date: string): string[] => {
    return data.pinnedFocus[date] || [];
  }, [data.pinnedFocus]);

  // Profile
  const updateProfile = useCallback((updates: Partial<UserProfile>) =>
    update(d => ({ ...d, profile: { ...d.profile, ...updates } })), [update]);

  // Data management
  const exportData = useCallback(() => JSON.stringify(data, null, 2), [data]);
  const importData = useCallback((json: string, mode: 'replace' | 'merge') => {
    try {
      const imported = JSON.parse(json) as AppData;
      if (mode === 'replace') { setData(imported); }
      else {
        update(d => ({
          ...d,
          tasks: [...d.tasks, ...imported.tasks.filter(t => !d.tasks.some(x => x.id === t.id))],
          goals: [...d.goals, ...imported.goals.filter(g => !d.goals.some(x => x.id === g.id))],
          events: [...d.events, ...imported.events.filter(e => !d.events.some(x => x.id === e.id))],
          habits: [...d.habits, ...imported.habits.filter(h => !d.habits.some(x => x.id === h.id))],
        }));
      }
      toast({ title: `Data ${mode === 'replace' ? 'replaced' : 'merged'} successfully` });
    } catch {
      toast({ title: 'Import failed', description: 'Invalid JSON file', variant: 'destructive' });
    }
  }, [update]);

  const resetData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setData(JSON.parse(JSON.stringify(seedData)));
    toast({ title: 'Data reset to defaults' });
  }, []);

  // Derived selectors
  const getTodayTasks = useCallback((): Task[] => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return data.tasks.filter(t =>
      t.status !== 'done' && (
        (t.dueDate && t.dueDate === todayStr) ||
        t.status === 'doing'
      )
    );
  }, [data.tasks]);

  const getOverdueTasks = useCallback((): Task[] => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return data.tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < todayStr);
  }, [data.tasks]);

  const getThisWeekCommittedTasks = useCallback((): Task[] => {
    const plan = data.weeklyPlans.find(p =>
      p.weekStartDate === format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    );
    if (!plan) return [];
    return data.tasks.filter(t => plan.committedTaskIds.includes(t.id));
  }, [data.tasks, data.weeklyPlans]);

  const completionRateThisWeek = useCallback((): number => {
    const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
    const we = endOfWeek(new Date(), { weekStartsOn: 1 });
    const weekTasks = data.tasks.filter(t =>
      t.dueDate && isWithinInterval(new Date(t.dueDate), { start: ws, end: we })
    );
    if (weekTasks.length === 0) return 0;
    const done = weekTasks.filter(t => t.status === 'done').length;
    return Math.round((done / weekTasks.length) * 100);
  }, [data.tasks]);

  const tasksCompletedPerDayThisWeek = useCallback((): { date: string; count: number }[] => {
    const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
    const result: { date: string; count: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(ws);
      d.setDate(d.getDate() + i);
      const dayStr = format(d, 'yyyy-MM-dd');
      const count = data.tasks.filter(t => t.completedAt && format(new Date(t.completedAt), 'yyyy-MM-dd') === dayStr).length;
      result.push({ date: format(d, 'EEE'), count });
    }
    return result;
  }, [data.tasks]);

  const avgCompletionTime = useCallback((): string => {
    const completed = data.tasks.filter(t => t.completedAt && t.createdAt);
    if (completed.length === 0) return 'N/A';
    const totalMin = completed.reduce((sum, t) =>
      sum + differenceInMinutes(new Date(t.completedAt!), new Date(t.createdAt)), 0);
    const avg = totalMin / completed.length;
    if (avg < 60) return `${Math.round(avg)}m`;
    if (avg < 1440) return `${(avg / 60).toFixed(1)}h`;
    return `${(avg / 1440).toFixed(1)}d`;
  }, [data.tasks]);

  return (
    <AppContext.Provider value={{
      data, addTask, updateTask, deleteTask, toggleTaskDone, changeTaskStatus,
      addGoal, updateGoal, deleteGoal,
      addEvent, updateEvent, deleteEvent,
      addHabit, updateHabit, deleteHabit, logHabit,
      addWeeklyPlan, updateWeeklyPlan, getOrCreateCurrentWeekPlan,
      setPinnedFocus, getPinnedFocus,
      updateProfile, exportData, importData, resetData,
      getTodayTasks, getOverdueTasks, getThisWeekCommittedTasks,
      completionRateThisWeek, tasksCompletedPerDayThisWeek, avgCompletionTime,
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
