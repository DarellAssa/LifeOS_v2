import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AppData, Task, Goal, CalendarEvent, Habit, WeeklyPlan, UserProfile } from '@/types';
import { seedData } from './seedData';

const STORAGE_KEY = 'lifeos-data';
const SCHEMA_VERSION = 1;

function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed.schemaVersion === SCHEMA_VERSION) return parsed;
    }
  } catch { /* use seed */ }
  return { ...seedData };
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
  // Profile
  updateProfile: (updates: Partial<UserProfile>) => void;
  // Data management
  exportData: () => string;
  importData: (json: string, mode: 'replace' | 'merge') => void;
  resetData: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(loadData);

  useEffect(() => { saveData(data); }, [data]);

  const update = useCallback((fn: (prev: AppData) => AppData) => {
    setData(prev => fn(prev));
  }, []);

  const addTask = useCallback((task: Task) => update(d => ({ ...d, tasks: [...d.tasks, task] })), [update]);
  const updateTask = useCallback((id: string, updates: Partial<Task>) =>
    update(d => ({ ...d, tasks: d.tasks.map(t => t.id === id ? { ...t, ...updates } : t) })), [update]);
  const deleteTask = useCallback((id: string) => update(d => ({ ...d, tasks: d.tasks.filter(t => t.id !== id) })), [update]);

  const addGoal = useCallback((goal: Goal) => update(d => ({ ...d, goals: [...d.goals, goal] })), [update]);
  const updateGoal = useCallback((id: string, updates: Partial<Goal>) =>
    update(d => ({ ...d, goals: d.goals.map(g => g.id === id ? { ...g, ...updates } : g) })), [update]);
  const deleteGoal = useCallback((id: string) => update(d => ({ ...d, goals: d.goals.filter(g => g.id !== id) })), [update]);

  const addEvent = useCallback((event: CalendarEvent) => update(d => ({ ...d, events: [...d.events, event] })), [update]);
  const updateEvent = useCallback((id: string, updates: Partial<CalendarEvent>) =>
    update(d => ({ ...d, events: d.events.map(e => e.id === id ? { ...e, ...updates } : e) })), [update]);
  const deleteEvent = useCallback((id: string) => update(d => ({ ...d, events: d.events.filter(e => e.id !== id) })), [update]);

  const addHabit = useCallback((habit: Habit) => update(d => ({ ...d, habits: [...d.habits, habit] })), [update]);
  const updateHabit = useCallback((id: string, updates: Partial<Habit>) =>
    update(d => ({ ...d, habits: d.habits.map(h => h.id === id ? { ...h, ...updates } : h) })), [update]);
  const deleteHabit = useCallback((id: string) => update(d => ({ ...d, habits: d.habits.filter(h => h.id !== id) })), [update]);
  const logHabit = useCallback((id: string, date: string) =>
    update(d => ({
      ...d,
      habits: d.habits.map(h => h.id === id
        ? { ...h, logs: h.logs.includes(date) ? h.logs : [...h.logs, date] }
        : h
      ),
    })), [update]);

  const addWeeklyPlan = useCallback((plan: WeeklyPlan) => update(d => ({ ...d, weeklyPlans: [...d.weeklyPlans, plan] })), [update]);
  const updateWeeklyPlan = useCallback((id: string, updates: Partial<WeeklyPlan>) =>
    update(d => ({ ...d, weeklyPlans: d.weeklyPlans.map(p => p.id === id ? { ...p, ...updates } : p) })), [update]);

  const updateProfile = useCallback((updates: Partial<UserProfile>) =>
    update(d => ({ ...d, profile: { ...d.profile, ...updates } })), [update]);

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
    } catch { /* invalid json */ }
  }, [update]);

  const resetData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setData({ ...seedData });
  }, []);

  return (
    <AppContext.Provider value={{
      data, addTask, updateTask, deleteTask, addGoal, updateGoal, deleteGoal,
      addEvent, updateEvent, deleteEvent, addHabit, updateHabit, deleteHabit, logHabit,
      addWeeklyPlan, updateWeeklyPlan, updateProfile, exportData, importData, resetData,
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
