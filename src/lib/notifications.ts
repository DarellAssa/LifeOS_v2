import { AppData, NotificationItem, NotificationType, NotificationSettings, DEFAULT_NOTIFICATION_SETTINGS } from '@/types';
import { format, addDays, startOfWeek, endOfWeek, differenceInMinutes } from 'date-fns';
import { getGoalDisplayStatus } from './stats';

function fingerprint(type: NotificationType, kind: string, id: string, date: string): string {
  return `${type}:${kind}:${id}:${date}`;
}

function existingFingerprints(notifications: NotificationItem[], todayStr: string): Set<string> {
  const set = new Set<string>();
  notifications.forEach(n => {
    if (n.dismissedAt) return;
    if (n.snoozedUntil && n.snoozedUntil > new Date().toISOString()) return;
    const ref = n.entityRef;
    const date = format(new Date(n.createdAt), 'yyyy-MM-dd');
    set.add(fingerprint(n.type, ref?.kind || '', ref?.id || '', date));
  });
  return set;
}

function isQuietHours(settings: NotificationSettings): boolean {
  if (!settings.quietHoursEnabled) return false;
  const now = new Date();
  const hhmm = format(now, 'HH:mm');
  const { quietHoursStart, quietHoursEnd } = settings;
  if (quietHoursStart <= quietHoursEnd) {
    return hhmm >= quietHoursStart && hhmm < quietHoursEnd;
  }
  return hhmm >= quietHoursStart || hhmm < quietHoursEnd;
}

export function generateNotifications(data: AppData): NotificationItem[] {
  const settings = data.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS;
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const now = new Date();
  const existing = existingFingerprints(data.notifications, todayStr);
  const newNotifs: NotificationItem[] = [];

  const todayCreatedCount = data.notifications.filter(n => format(new Date(n.createdAt), 'yyyy-MM-dd') === todayStr).length;
  let budget = Math.max(0, settings.maxNotificationsPerDay - todayCreatedCount);

  function tryAdd(n: Omit<NotificationItem, 'id' | 'createdAt'>) {
    if (budget <= 0) return;
    const ref = n.entityRef;
    const fp = fingerprint(n.type, ref?.kind || '', ref?.id || '', todayStr);
    if (existing.has(fp)) return;
    existing.add(fp);
    budget--;
    newNotifs.push({ ...n, id: crypto.randomUUID(), createdAt: now.toISOString() });
  }

  // 1) Overdue tasks
  if (settings.enabledTypes.task_overdue) {
    const overdueTasks = data.tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < todayStr);
    if (overdueTasks.length > 5) {
      tryAdd({
        type: 'task_overdue', title: `You have ${overdueTasks.length} overdue tasks`,
        message: `${overdueTasks.length} tasks are past their due date. Review and reschedule them.`,
        severity: 'critical',
        entityRef: { kind: 'task', id: 'summary' },
        action: { label: 'View overdue', route: '/tasks' },
      });
    } else {
      overdueTasks.forEach(t => {
        const daysOver = Math.floor((now.getTime() - new Date(t.dueDate!).getTime()) / 86400000);
        tryAdd({
          type: 'task_overdue', title: `"${t.title}" is overdue`,
          message: `This task was due ${t.dueDate}${daysOver > 1 ? ` (${daysOver} days ago)` : ''}.`,
          severity: daysOver >= 7 || t.priority === 'high' ? 'critical' : 'warning',
          entityRef: { kind: 'task', id: t.id },
          action: { label: 'Fix', route: '/tasks' },
        });
      });
    }
  }

  // 2) Due soon tasks
  if (settings.enabledTypes.task_due_soon) {
    const dueSoonEnd = format(addDays(now, settings.dueSoonDays), 'yyyy-MM-dd');
    const dueSoon = data.tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate > todayStr && t.dueDate <= dueSoonEnd);
    dueSoon.forEach(t => {
      tryAdd({
        type: 'task_due_soon', title: `"${t.title}" due soon`,
        message: `Due ${t.dueDate}.`,
        severity: t.priority === 'high' ? 'warning' : 'info',
        entityRef: { kind: 'task', id: t.id },
        action: { label: 'View', route: '/tasks' },
      });
    });
  }

  // 3) Goals behind/overdue
  if (settings.enabledTypes.goal_behind || settings.enabledTypes.goal_overdue) {
    data.goals.filter(g => g.status === 'active').forEach(g => {
      const status = getGoalDisplayStatus(g, data.tasks);
      if (status === 'Behind' && settings.enabledTypes.goal_behind) {
        tryAdd({
          type: 'goal_behind', title: `"${g.title}" is behind`,
          message: 'Progress is lagging behind the timeline.',
          severity: 'warning',
          entityRef: { kind: 'goal', id: g.id },
          action: { label: 'View', route: '/goals' },
        });
      }
      if (status === 'Overdue' && settings.enabledTypes.goal_overdue) {
        tryAdd({
          type: 'goal_overdue', title: `"${g.title}" is overdue`,
          message: `Target date ${g.targetDate} has passed.`,
          severity: 'critical',
          entityRef: { kind: 'goal', id: g.id },
          action: { label: 'View', route: '/goals' },
        });
      }
    });
  }

  // 4) Upcoming events (within eventUpcomingMinutes)
  if (settings.enabledTypes.event_upcoming) {
    data.events.forEach(e => {
      const start = new Date(e.startDateTime);
      const minsUntil = differenceInMinutes(start, now);
      if (minsUntil > 0 && minsUntil <= settings.eventUpcomingMinutes) {
        tryAdd({
          type: 'event_upcoming', title: `"${e.title}" starts soon`,
          message: `Starts at ${format(start, 'h:mm a')}${e.location ? ` at ${e.location}` : ''}.`,
          severity: 'info',
          entityRef: { kind: 'event', id: e.id },
          action: { label: 'View', route: '/calendar' },
        });
      }
    });
  }

  // 5) Missed focus blocks
  if (settings.enabledTypes.focus_missed) {
    data.focusBlocks.filter(fb => fb.status === 'planned' && new Date(fb.endDateTime) < now && format(new Date(fb.startDateTime), 'yyyy-MM-dd') === todayStr).forEach(fb => {
      tryAdd({
        type: 'focus_missed', title: `Focus block "${fb.title}" was missed`,
        message: `Planned ${format(new Date(fb.startDateTime), 'h:mm a')} – ${format(new Date(fb.endDateTime), 'h:mm a')}.`,
        severity: 'warning',
        entityRef: { kind: 'focusBlock', id: fb.id },
        action: { label: 'View', route: '/calendar' },
      });
    });
  }

  // 6) Missed habits (after 18:00)
  if (settings.enabledTypes.habit_missed && now.getHours() >= 18) {
    const activeDaily = data.habits.filter(h => h.status === 'active' && h.frequency === 'daily');
    const missed = activeDaily.filter(h => !h.logs.includes(todayStr));
    if (missed.length > 5) {
      tryAdd({
        type: 'habit_missed', title: `${missed.length} habits not logged today`,
        message: 'Log your habits before the day ends.',
        severity: 'warning',
        entityRef: { kind: 'habit', id: 'summary' },
        action: { label: 'Log', route: '/habits' },
      });
    } else {
      missed.forEach(h => {
        tryAdd({
          type: 'habit_missed', title: `"${h.title}" not logged today`,
          message: 'Don\'t break your streak!',
          severity: 'warning',
          entityRef: { kind: 'habit', id: h.id },
          action: { label: 'Log', route: '/habits' },
        });
      });
    }

    // Weekly habits at risk (Fri-Sun)
    const dow = now.getDay();
    if (dow === 0 || dow === 5 || dow === 6) {
      const ws = startOfWeek(now, { weekStartsOn: 1 });
      const we = endOfWeek(now, { weekStartsOn: 1 });
      const wsStr = format(ws, 'yyyy-MM-dd');
      const weStr = format(we, 'yyyy-MM-dd');
      const remainingDays = dow === 0 ? 0 : 7 - dow;
      data.habits.filter(h => h.status === 'active' && h.frequency === 'weekly').forEach(h => {
        const weekLogs = h.logs.filter(l => l >= wsStr && l <= weStr).length;
        const needed = h.targetCountPerPeriod - weekLogs;
        if (needed > remainingDays) {
          tryAdd({
            type: 'habit_missed', title: `"${h.title}" weekly target at risk`,
            message: `Need ${needed} more completions with ${remainingDays} days left.`,
            severity: needed > remainingDays + 1 ? 'critical' : 'warning',
            entityRef: { kind: 'habit', id: h.id },
            action: { label: 'Log', route: '/habits' },
          });
        }
      });
    }
  }

  // 7) Missing daily check-in (after 20:00)
  if (settings.enabledTypes.checkin_missing && now.getHours() >= 20) {
    const hasCheckIn = data.dailyCheckIns.some(c => c.date === todayStr);
    if (!hasCheckIn) {
      tryAdd({
        type: 'checkin_missing', title: 'Daily check-in not done',
        message: 'Take 2 minutes to reflect on your day.',
        severity: 'info',
        entityRef: { kind: 'checkin', id: todayStr },
        action: { label: 'Check in', route: '/' },
      });
    }
  }

  // 8) Weekly review missing (Sunday)
  if (settings.enabledTypes.weekly_review_missing && now.getDay() === 0) {
    const wsStr = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const hasPlan = data.weeklyPlans.some(p => p.weekStartDate === wsStr);
    if (!hasPlan) {
      tryAdd({
        type: 'weekly_review_missing', title: 'Weekly plan not created',
        message: 'Plan your upcoming week before it starts.',
        severity: 'info',
        entityRef: { kind: 'weeklyPlan', id: wsStr },
        action: { label: 'Plan', route: '/planning' },
      });
    }
  }

  return newNotifs;
}

export { isQuietHours };
