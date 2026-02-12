import { Task, Goal, Habit, GoalDisplayStatus } from '@/types';
import { startOfDay, startOfWeek, endOfWeek, isWithinInterval, differenceInDays, format } from 'date-fns';

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

// ── Goal Progress & Status Logic ──────────────────────────────────────
export function computeGoalProgress(goal: Goal, tasks: Task[]): number {
  if (goal.progressType === 'manual') return goal.progressValue;
  const linked = tasks.filter(t => goal.linkedTaskIds.includes(t.id));
  if (linked.length === 0) return 0;
  const done = linked.filter(t => t.status === 'done').length;
  return Math.round((done / linked.length) * 100);
}

export function getGoalDisplayStatus(goal: Goal, tasks: Task[]): GoalDisplayStatus {
  const progress = computeGoalProgress(goal, tasks);
  if (progress >= 100) return 'Completed';

  const now = new Date();
  const start = new Date(goal.startDate);
  const end = new Date(goal.targetDate);

  if (now < start) return 'Not started';
  if (now > end && progress < 100) return 'Overdue';

  const totalDays = differenceInDays(end, start);
  if (totalDays <= 0) return 'On track';
  const elapsed = differenceInDays(now, start);
  const timeRatio = Math.max(0, Math.min(1, elapsed / totalDays));
  const progressRatio = Math.max(0, Math.min(1, progress / 100));

  return progressRatio + 0.05 >= timeRatio ? 'On track' : 'Behind';
}

export function getGoalOnTrack(goal: Goal, tasks?: Task[]): boolean {
  const status = getGoalDisplayStatus(goal, tasks || []);
  return status === 'On track' || status === 'Not started' || status === 'Completed';
}

export function getOffTrackGoals(goals: Goal[], tasks: Task[]): Goal[] {
  return goals.filter(g => g.status === 'active' && !getGoalOnTrack(g, tasks));
}

export function getAverageGoalProgress(goals: Goal[], tasks: Task[]): number {
  const active = goals.filter(g => g.status === 'active');
  if (active.length === 0) return 0;
  return Math.round(active.reduce((sum, g) => sum + computeGoalProgress(g, tasks), 0) / active.length);
}

export function getGoalsDueSoon(goals: Goal[], days: number = 14): Goal[] {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const futureStr = format(new Date(Date.now() + days * 86400000), 'yyyy-MM-dd');
  return goals.filter(g => g.status === 'active' && g.targetDate >= todayStr && g.targetDate <= futureStr);
}

// ── Habit helpers ─────────────────────────────────────────────────────
export function getHabitStreak(habit: Habit): number {
  if (habit.logs.length === 0) return 0;
  const sorted = [...new Set(habit.logs)].sort().reverse();
  let streak = 0;
  let checkDate = startOfDay(new Date());

  for (const log of sorted) {
    const expected = format(checkDate, 'yyyy-MM-dd');
    if (log === expected) {
      streak++;
      checkDate = new Date(checkDate);
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (streak === 0 && log < expected) {
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
