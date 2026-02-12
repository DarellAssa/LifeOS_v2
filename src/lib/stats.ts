import { Task, Goal, Habit } from '@/types';
import { isToday, isBefore, startOfDay, startOfWeek, endOfWeek, isWithinInterval, differenceInDays, format } from 'date-fns';

export function getOverdueTasks(tasks: Task[]): Task[] {
  const now = startOfDay(new Date());
  return tasks.filter(t => t.status !== 'done' && t.dueDate && isBefore(new Date(t.dueDate), now));
}

export function getTasksDoneToday(tasks: Task[]): Task[] {
  return tasks.filter(t => t.completedAt && isToday(new Date(t.completedAt)));
}

export function getTasksDueToday(tasks: Task[]): Task[] {
  return tasks.filter(t => t.dueDate && isToday(new Date(t.dueDate)) && t.status !== 'done');
}

export function getWeeklyCompletionRate(tasks: Task[]): number {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekTasks = tasks.filter(t => t.dueDate && isWithinInterval(new Date(t.dueDate), { start: weekStart, end: weekEnd }));
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
  const sorted = [...habit.logs].sort().reverse();
  let streak = 0;
  let checkDate = startOfDay(new Date());
  for (const log of sorted) {
    const logDate = format(new Date(log), 'yyyy-MM-dd');
    const expected = format(checkDate, 'yyyy-MM-dd');
    if (logDate === expected) {
      streak++;
      checkDate = new Date(checkDate);
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (logDate < expected) {
      // Allow skipping today if not logged yet
      if (streak === 0) {
        checkDate.setDate(checkDate.getDate() - 1);
        if (format(checkDate, 'yyyy-MM-dd') === logDate) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else break;
      } else break;
    }
  }
  return streak;
}

export function getHabitWeeklyAdherence(habit: Habit): number {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekLogs = habit.logs.filter(l => isWithinInterval(new Date(l), { start: weekStart, end: weekEnd }));
  return Math.round((weekLogs.length / habit.targetCountPerPeriod) * 100);
}

export function getLongestStreak(habit: Habit): number {
  if (habit.logs.length === 0) return 0;
  const sorted = [...new Set(habit.logs)].sort();
  let longest = 1, current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = differenceInDays(new Date(sorted[i]), new Date(sorted[i - 1]));
    if (diff === 1) { current++; longest = Math.max(longest, current); }
    else current = 1;
  }
  return longest;
}
