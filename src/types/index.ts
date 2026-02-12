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
  dueDate?: string; // ISO date only (yyyy-MM-dd)
  createdAt: string; // ISO datetime
  completedAt?: string; // ISO datetime
  tags: string[];
  project?: string;
  estimatedMinutes?: number;
  goalId?: string;
  subtasks: Subtask[];
  recurring?: RecurringConfig;
}

export type GoalCategory = 'health' | 'career' | 'finance' | 'study' | 'personal' | 'custom';
export type GoalStatus = 'active' | 'completed' | 'archived';
export type ProgressType = 'manual' | 'linked';

export interface Milestone {
  id: string;
  title: string;
  targetDate: string;
  completed: boolean;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  category: GoalCategory;
  status: GoalStatus;
  startDate: string;
  targetDate: string;
  progressType: ProgressType;
  progressValue: number;
  targetMetric: string;
  currentMetric: string;
  linkedTaskIds: string[];
  milestones: Milestone[];
}

export type EventCategory = 'work' | 'personal' | 'study' | 'health' | 'custom';
export type RecurringOption = 'daily' | 'weekly' | 'monthly' | null;

export interface CalendarEvent {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime: string;
  location: string;
  notes: string;
  category: EventCategory;
  recurring: RecurringOption;
}

export type HabitFrequency = 'daily' | 'weekly';

export interface Habit {
  id: string;
  title: string;
  frequency: HabitFrequency;
  targetCountPerPeriod: number;
  logs: string[]; // ISO date strings
}

export interface WeeklyPlan {
  id: string;
  weekStartDate: string; // ISO date, Monday
  committedTaskIds: string[];
  createdAt: string;
}

export interface UserProfile {
  name: string;
  timezone: string;
  weekStartDay: 'monday' | 'sunday';
}

export interface PinnedFocus {
  [isoDate: string]: string[]; // date -> taskIds (max 3)
}

export interface AppData {
  schemaVersion: number;
  tasks: Task[];
  goals: Goal[];
  events: CalendarEvent[];
  habits: Habit[];
  weeklyPlans: WeeklyPlan[];
  profile: UserProfile;
  pinnedFocus: PinnedFocus;
}
