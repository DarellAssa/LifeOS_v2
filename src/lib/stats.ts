import { Task, Goal, Habit, GoalDisplayStatus, FocusBlock, AppData, LifeScoreBreakdown } from '@/types';
import { startOfDay, startOfWeek, endOfWeek, isWithinInterval, differenceInDays, differenceInMinutes, format, subDays } from 'date-fns';

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

export function getHabitBestStreak(habit: Habit): number {
  if (habit.logs.length === 0) return 0;
  const sorted = [...new Set(habit.logs)].sort();
  let best = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = differenceInDays(curr, prev);
    if (diff === 1) { current++; best = Math.max(best, current); }
    else if (diff > 1) current = 1;
  }
  return best;
}

export function getHabitWeeklyAdherence(habit: Habit): number {
  const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
  const we = endOfWeek(new Date(), { weekStartsOn: 1 });
  const weekLogs = habit.logs.filter(l => isWithinInterval(new Date(l), { start: ws, end: we }));
  return Math.round((weekLogs.length / habit.targetCountPerPeriod) * 100);
}

export function getHabitAdherenceForRange(habit: Habit, days: number): number {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const startStr = format(subDays(new Date(), days - 1), 'yyyy-MM-dd');
  const logsInRange = habit.logs.filter(l => l >= startStr && l <= todayStr);
  if (habit.frequency === 'daily') {
    return Math.round((logsInRange.length / days) * 100);
  }
  // weekly: target per week * number of weeks in range
  const weeks = Math.max(1, Math.ceil(days / 7));
  const expected = habit.targetCountPerPeriod * weeks;
  return Math.min(100, Math.round((logsInRange.length / expected) * 100));
}

// ── Life Score ────────────────────────────────────────────────────────
export function computeLifeScore(data: AppData, dateISO: string): { score: number; breakdown: LifeScoreBreakdown } {
  const { tasks, focusBlocks, habits, goals } = data;

  // 1) Tasks component
  const tasksDueToday = tasks.filter(t => t.dueDate === dateISO);
  const tasksDoneTodayCount = tasksDueToday.filter(t => t.status === 'done').length;
  let tasksScore: number;
  if (tasksDueToday.length > 0) {
    tasksScore = (tasksDoneTodayCount / tasksDueToday.length) * 100;
  } else {
    tasksScore = 70; // baseline
  }
  const overdueCount = tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < dateISO).length;
  tasksScore -= Math.min(20, overdueCount * 5);
  tasksScore = Math.max(0, Math.min(100, tasksScore));

  // 2) Focus component
  const dayBlocks = focusBlocks.filter(fb => format(new Date(fb.startDateTime), 'yyyy-MM-dd') === dateISO);
  const plannedMin = dayBlocks.reduce((s, fb) => s + differenceInMinutes(new Date(fb.endDateTime), new Date(fb.startDateTime)), 0);
  const completedMin = dayBlocks.filter(fb => fb.status === 'completed').reduce((s, fb) => s + differenceInMinutes(new Date(fb.endDateTime), new Date(fb.startDateTime)), 0);
  let focusScore: number;
  if (plannedMin > 0) {
    focusScore = (completedMin / plannedMin) * 100;
  } else {
    focusScore = 60; // baseline
  }
  focusScore = Math.max(0, Math.min(100, focusScore));

  // 3) Habits component
  const activeHabits = habits.filter(h => (h as any).status !== 'archived');
  const dailyHabits = activeHabits.filter(h => h.frequency === 'daily');
  const weeklyHabits = activeHabits.filter(h => h.frequency === 'weekly');
  let habitsScore: number;
  if (activeHabits.length === 0) {
    habitsScore = 65; // baseline
  } else {
    let dailyRatio = 0;
    if (dailyHabits.length > 0) {
      const loggedToday = dailyHabits.filter(h => h.logs.includes(dateISO)).length;
      dailyRatio = loggedToday / dailyHabits.length;
    }
    let weeklyRatio = 0;
    if (weeklyHabits.length > 0) {
      const ws = startOfWeek(new Date(dateISO), { weekStartsOn: 1 });
      const we = endOfWeek(new Date(dateISO), { weekStartsOn: 1 });
      const avgProgress = weeklyHabits.reduce((sum, h) => {
        const weekLogs = h.logs.filter(l => l >= format(ws, 'yyyy-MM-dd') && l <= format(we, 'yyyy-MM-dd'));
        return sum + Math.min(1, weekLogs.length / h.targetCountPerPeriod);
      }, 0) / weeklyHabits.length;
      weeklyRatio = avgProgress;
    }
    const totalHabits = dailyHabits.length + weeklyHabits.length;
    habitsScore = ((dailyRatio * dailyHabits.length + weeklyRatio * weeklyHabits.length) / totalHabits) * 100;
  }
  habitsScore = Math.max(0, Math.min(100, habitsScore));

  // 4) Goals component
  const activeGoals = goals.filter(g => g.status === 'active');
  let goalsScore = 70;
  activeGoals.forEach(g => {
    const status = getGoalDisplayStatus(g, tasks);
    if (status === 'On track' || status === 'Not started') goalsScore += 5;
    else if (status === 'Behind') goalsScore -= 10;
    else if (status === 'Overdue') goalsScore -= 15;
  });
  goalsScore = Math.max(0, Math.min(100, Math.max(goalsScore, 70 - 40))); // cap penalties
  goalsScore = Math.max(0, Math.min(100, Math.min(goalsScore, 70 + 20))); // cap bonuses

  const score = Math.round((tasksScore + focusScore + habitsScore + goalsScore) / 4);

  return {
    score,
    breakdown: {
      tasks: Math.round(tasksScore),
      focus: Math.round(focusScore),
      habits: Math.round(habitsScore),
      goals: Math.round(goalsScore),
    },
  };
}
