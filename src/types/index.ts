// LifeOS Core Types

export type TaskStatus = 'todo' | 'doing' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export type RecurringOption = 'daily' | 'weekly' | 'monthly' | null;

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
  tags: string[];
  project: string;
  estimatedMinutes: number | null;
  recurring: RecurringOption;
  goalId: string | null;
  subtasks: Subtask[];
  isTodayFocus: boolean;
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
  weekStartDate: string;
  committedTaskIds: string[];
  createdAt: string;
}

export interface UserProfile {
  name: string;
  timezone: string;
  weekStartDay: 'monday' | 'sunday';
}

export interface AppData {
  schemaVersion: number;
  tasks: Task[];
  goals: Goal[];
  events: CalendarEvent[];
  habits: Habit[];
  weeklyPlans: WeeklyPlan[];
  profile: UserProfile;
}
