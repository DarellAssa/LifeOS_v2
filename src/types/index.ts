// LifeOS Core Types

export type TaskStatus = 'todo' | 'doing' | 'done';
export type TaskPriority = 'low' | 'med' | 'high';

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface RecurringConfig {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  createdAt: string;
  completedAt?: string;
  tags: string[];
  project?: string;
  estimatedMinutes?: number;
  goalId?: string;
  subtasks: Subtask[];
  recurring?: RecurringConfig;
  scheduledStart?: string;
  scheduledEnd?: string;
}

export type GoalCategory = 'health' | 'career' | 'finance' | 'study' | 'personal' | 'custom';
export type GoalStatus = 'active' | 'completed' | 'archived';
export type ProgressType = 'manual' | 'linked';
export type GoalDisplayStatus = 'Not started' | 'On track' | 'Behind' | 'Overdue' | 'Completed';

export interface Milestone {
  id: string;
  title: string;
  date?: string;
  done: boolean;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  category: GoalCategory;
  status: GoalStatus;
  startDate: string;
  targetDate: string;
  progressType: ProgressType;
  progressValue: number;
  linkedTaskIds: string[];
  milestones: Milestone[];
  createdAt: string;
  updatedAt: string;
}

export type EventCategory = 'work' | 'personal' | 'study' | 'health' | 'custom';
export type RecurringOption = 'daily' | 'weekly' | 'monthly' | null;

export interface CalendarEvent {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime: string;
  location?: string;
  notes?: string;
  category: EventCategory;
  recurring?: RecurringConfig | null;
  createdAt?: string;
  updatedAt?: string;
}

export type FocusBlockStatus = 'planned' | 'completed' | 'skipped';

export interface FocusBlock {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime: string;
  linkedTaskId?: string;
  linkedGoalId?: string;
  status: FocusBlockStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type HabitFrequency = 'daily' | 'weekly';
export type HabitCategory = 'health' | 'study' | 'career' | 'finance' | 'personal' | 'custom';
export type HabitStatus = 'active' | 'archived';

export interface Habit {
  id: string;
  title: string;
  description?: string;
  frequency: HabitFrequency;
  targetCountPerPeriod: number;
  category: HabitCategory;
  logs: string[];
  createdAt: string;
  updatedAt: string;
  status: HabitStatus;
}

export interface DailyCheckIn {
  id: string;
  date: string;
  mood: number;
  energy: number;
  focus: number;
  highlights?: string;
  blockers?: string;
  gratitude?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LifeScoreBreakdown {
  tasks: number;
  focus: number;
  habits: number;
  goals: number;
}

export interface LifeScoreSnapshot {
  id: string;
  date: string;
  score: number;
  breakdown: LifeScoreBreakdown;
  createdAt: string;
}

export type NotificationType =
  | 'task_overdue'
  | 'task_due_soon'
  | 'goal_behind'
  | 'goal_overdue'
  | 'event_upcoming'
  | 'focus_missed'
  | 'habit_missed'
  | 'checkin_missing'
  | 'weekly_review_missing'
  | 'inbox_unprocessed';

export type NotificationSeverity = 'info' | 'warning' | 'critical';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  createdAt: string;
  readAt?: string;
  dismissedAt?: string;
  snoozedUntil?: string;
  entityRef?: { kind: 'task' | 'goal' | 'event' | 'focusBlock' | 'habit' | 'checkin' | 'weeklyPlan'; id: string };
  action?: { label: string; route: string };
}

export interface NotificationSettings {
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  enabledTypes: Record<NotificationType, boolean>;
  dueSoonDays: number;
  eventUpcomingMinutes: number;
  dailyDigestTime?: string;
  maxNotificationsPerDay: number;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  enabledTypes: {
    task_overdue: true,
    task_due_soon: true,
    goal_behind: true,
    goal_overdue: true,
    event_upcoming: true,
    focus_missed: true,
    habit_missed: true,
    checkin_missing: true,
    weekly_review_missing: true,
    inbox_unprocessed: true,
  },
  dueSoonDays: 2,
  eventUpcomingMinutes: 60,
  dailyDigestTime: '09:00',
  maxNotificationsPerDay: 12,
};

export interface WeeklyPlan {
  id: string;
  weekStartDate: string;
  committedTaskIds: string[];
  createdAt: string;
}

export interface UserProfile {
  name: string;
  timezone: string;
  weekStartDay: 'monday' | 'sunday';
}

export interface PinnedFocus {
  [isoDate: string]: string[];
}

export type InboxItemSource = 'manual' | 'clipboard' | 'share' | 'import';
export type InboxItemStatus = 'unprocessed' | 'processing' | 'converted' | 'archived';
export type ConversionKind = 'task' | 'goal' | 'event' | 'habit' | 'focusBlock' | 'note';

export interface InboxItemDetected {
  urls: string[];
  suggestedType?: 'task' | 'goal' | 'event' | 'habit' | 'focus' | 'note';
  suggestedDateTime?: string;
}

export interface InboxItemConversion {
  kind: ConversionKind;
  entityId: string;
  convertedAt: string;
}

export interface InboxItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  content: string;
  title?: string;
  source: InboxItemSource;
  status: InboxItemStatus;
  tags: string[];
  pinned: boolean;
  detected: InboxItemDetected;
  conversion?: InboxItemConversion;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  pinned: boolean;
}

export type { Template, TemplateItem, TemplateCategory, TemplateSchedule, AutomationRule, AutomationTrigger, AutomationCondition, AutomationAction, AutomationRunLog, AutomationRunStatus } from './templates';

export interface AppData {
  schemaVersion: number;
  tasks: Task[];
  goals: Goal[];
  events: CalendarEvent[];
  focusBlocks: FocusBlock[];
  habits: Habit[];
  dailyCheckIns: DailyCheckIn[];
  lifeScoreSnapshots: LifeScoreSnapshot[];
  weeklyPlans: WeeklyPlan[];
  notifications: NotificationItem[];
  notificationSettings: NotificationSettings;
  inboxItems: InboxItem[];
  notes: Note[];
  profile: UserProfile;
  pinnedFocus: PinnedFocus;
  templates: import('./templates').Template[];
  automationRules: import('./templates').AutomationRule[];
  automationLogs: import('./templates').AutomationRunLog[];
}
