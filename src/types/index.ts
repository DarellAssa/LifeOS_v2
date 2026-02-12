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

export interface Habit {
  id: string;
  title: string;
  frequency: HabitFrequency;
  targetCountPerPeriod: number;
  logs: string[];
}

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

export interface AppData {
  schemaVersion: number;
  tasks: Task[];
  goals: Goal[];
  events: CalendarEvent[];
  focusBlocks: FocusBlock[];
  habits: Habit[];
  weeklyPlans: WeeklyPlan[];
  profile: UserProfile;
  pinnedFocus: PinnedFocus;
}
