import { Task, Goal, Habit } from '@/types';
import { isBefore, startOfDay, startOfWeek, endOfWeek, isWithinInterval, differenceInDays, format } from 'date-fns';

export function getOverdueTasks(tasks: Task[]): Task[] {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  return tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < todayStr);
}

export function getTasksDoneToday(tasks: Task[]): Task[] {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  return tasks.filter(t => t.completedAt && format(new Date(t.completedAt), 'yyyy-MM-dd') === todayStr);
}

export function getTasksDueToday(tasks: Task[]): Task[] {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  return tasks.filter(t => t.dueDate === todayStr && t.status !== 'done');
}

export function getWeeklyCompletionRate(tasks: Task[]): number {
  const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
  const we = endOfWeek(new Date(), { weekStartsOn: 1 });
  const weekTasks = tasks.filter(t => t.dueDate && isWithinInterval(new Date(t.dueDate), { start: ws, end: we }));
  if (weekTasks.length === 0) return 0;
  const done = weekTasks.filter(t => t.status === 'done').length;
  return Math.round((done / weekTasks.length) * 100);
}

export function getGoalOnTrack(goal: Goal): boolean {
  const now = new Date();
  const start = new Date(goal.startDate);
  const end = new Date(goal.targetDate);
  const totalDays = differenceInDays(end, start);
  if (totalDays <= 0) return true;
  const elapsed = differenceInDays(now, start);
  const timeRatio = Math.max(0, Math.min(1, elapsed / totalDays));
  const progressRatio = goal.progressValue / 100;
  return progressRatio + 0.05 >= timeRatio;
}

export function getOffTrackGoals(goals: Goal[]): Goal[] {
  return goals.filter(g => g.status === 'active' && !getGoalOnTrack(g));
}

export function getAverageGoalProgress(goals: Goal[]): number {
  const active = goals.filter(g => g.status === 'active');
  if (active.length === 0) return 0;
  return Math.round(active.reduce((sum, g) => sum + g.progressValue, 0) / active.length);
}

export function getHabitStreak(habit: Habit): number {
  if (habit.logs.length === 0) return 0;
  const sorted = [...new Set(habit.logs)].sort().reverse();
  let streak = 0;
  let checkDate = startOfDay(new Date());
  const checkStr = format(checkDate, 'yyyy-MM-dd');

  for (const log of sorted) {
    const expected = format(checkDate, 'yyyy-MM-dd');
    if (log === expected) {
      streak++;
      checkDate = new Date(checkDate);
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (streak === 0 && log < expected) {
      // Allow skipping today
      checkDate.setDate(checkDate.getDate() - 1);
      if (format(checkDate, 'yyyy-MM-dd') === log) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else break;
    } else break;
  }
  return streak;
}

export function getHabitWeeklyAdherence(habit: Habit): number {
  const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
  const we = endOfWeek(new Date(), { weekStartsOn: 1 });
  const weekLogs = habit.logs.filter(l => isWithinInterval(new Date(l), { start: ws, end: we }));
  return Math.round((weekLogs.length / habit.targetCountPerPeriod) * 100);
}
