import { GoalCategory, HabitCategory, HabitFrequency, TaskPriority, EventCategory, NotificationType, NotificationSeverity } from './index';

// ── Template Items (discriminated union) ──
export type TemplateItemTask = {
  kind: 'task';
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueOffsetDays?: number;
  tags?: string[];
  project?: string;
  estimatedMinutes?: number;
  autoCommitToWeek?: boolean;
};

export type TemplateItemEvent = {
  kind: 'event';
  title: string;
  startTime: string;
  durationMinutes: number;
  category?: EventCategory;
  dayOffsetDays?: number;
  notes?: string;
};

export type TemplateItemFocusBlock = {
  kind: 'focusBlock';
  title: string;
  startTime?: string;
  durationMinutes: number;
  dayOffsetDays?: number;
  linkedTaskTitle?: string;
  notes?: string;
};

export type TemplateItemHabit = {
  kind: 'habit';
  title: string;
  frequency: HabitFrequency;
  targetCountPerPeriod: number;
  category?: HabitCategory;
};

export type TemplateItemGoal = {
  kind: 'goal';
  title: string;
  description?: string;
  category?: GoalCategory;
  targetOffsetDays?: number;
  progressType?: 'manual' | 'linked';
};

export type TemplateItemInbox = {
  kind: 'inbox';
  content: string;
  tags?: string[];
};

export type TemplateItemNote = {
  kind: 'note';
  title: string;
  content: string;
  tags?: string[];
};

export type TemplateItem =
  | TemplateItemTask
  | TemplateItemEvent
  | TemplateItemFocusBlock
  | TemplateItemHabit
  | TemplateItemGoal
  | TemplateItemInbox
  | TemplateItemNote;

export type TemplateCategory = 'daily' | 'weekly' | 'project' | 'study' | 'health' | 'custom';

export interface TemplateSchedule {
  type: 'none' | 'daily' | 'weekly';
  time?: string;
  daysOfWeek?: number[];
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  createdAt: string;
  updatedAt: string;
  isBuiltIn: boolean;
  items: TemplateItem[];
  defaultSchedule?: TemplateSchedule;
}

// ── Automation Triggers ──
export type AutomationTrigger =
  | { type: 'time'; schedule: { type: 'daily' | 'weekly'; time: string; daysOfWeek?: number[] } }
  | { type: 'task_status_changed' }
  | { type: 'goal_status_changed' }
  | { type: 'inbox_item_added' }
  | { type: 'focus_block_missed' }
  | { type: 'checkin_missing' };

// ── Automation Conditions ──
export type AutomationCondition =
  | { type: 'task_priority_is'; value: TaskPriority }
  | { type: 'task_has_tag'; value: string }
  | { type: 'goal_category_is'; value: GoalCategory }
  | { type: 'inbox_contains_text'; value: string }
  | { type: 'time_is_after'; value: string }
  | { type: 'day_of_week_is'; value: number }
  | { type: 'limit_unprocessed_inbox_gte'; value: number };

// ── Automation Actions ──
export type AutomationAction =
  | { type: 'create_task'; payload: { title: string; description?: string; priority?: TaskPriority; tags?: string[]; dueDate?: string } }
  | { type: 'create_focus_block_next_free'; payload: { title: string; durationMinutes: number; linkedTaskId?: string } }
  | { type: 'create_notification'; payload: { type: NotificationType; title: string; message: string; severity: NotificationSeverity; route?: string } }
  | { type: 'add_inbox_item'; payload: { content: string; tags?: string[] } }
  | { type: 'apply_template'; payload: { templateId: string } }
  | { type: 'archive_inbox_item'; payload: { inboxId: string } };

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  throttle: { maxRunsPerDay: number; cooldownMinutes: number };
  lastRunAt?: string;
}

export type AutomationRunStatus = 'success' | 'skipped' | 'throttled' | 'failed';

export interface AutomationRunLog {
  id: string;
  ruleId: string;
  ranAt: string;
  status: AutomationRunStatus;
  reason?: string;
  createdEntityRefs: { kind: string; id: string }[];
  undoToken?: { kind: 'entityBatch'; ids: { kind: string; id: string }[] };
}
