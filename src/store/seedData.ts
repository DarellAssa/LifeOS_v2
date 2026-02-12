import { AppData } from '@/types';
import { format, subDays, addDays } from 'date-fns';

const today = new Date();
const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
const fmtDT = (d: Date, h: number, m = 0) => {
  const dt = new Date(d);
  dt.setHours(h, m, 0, 0);
  return dt.toISOString();
};

export const seedData: AppData = {
  schemaVersion: 2,
  profile: {
    name: 'Alex',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    weekStartDay: 'monday',
  },
  pinnedFocus: {
    [fmt(today)]: ['t1', 't2'],
  },
  tasks: [
    {
      id: 't1', title: 'Write project proposal', description: 'Draft the Q1 project proposal for the team', status: 'doing', priority: 'high',
      dueDate: fmt(today), createdAt: subDays(today, 3).toISOString(), completedAt: undefined,
      tags: ['work'], project: 'Q1 Planning', estimatedMinutes: 60, goalId: 'g1',
      subtasks: [
        { id: 'st1', title: 'Outline key objectives', done: true },
        { id: 'st2', title: 'Define milestones', done: false },
      ],
    },
    {
      id: 't2', title: 'Morning run — 5K', description: '', status: 'todo', priority: 'med',
      dueDate: fmt(today), createdAt: subDays(today, 1).toISOString(),
      tags: ['health'], project: undefined, estimatedMinutes: 30, goalId: 'g2',
      subtasks: [], recurring: { type: 'daily', interval: 1 },
    },
    {
      id: 't3', title: 'Read chapter 4 of Deep Work', status: 'todo', priority: 'low',
      dueDate: fmt(addDays(today, 1)), createdAt: subDays(today, 2).toISOString(),
      tags: ['study'], project: 'Reading', estimatedMinutes: 45, goalId: 'g3',
      subtasks: [],
    },
    {
      id: 't4', title: 'Review budget spreadsheet', description: 'Monthly finances review', status: 'todo', priority: 'high',
      dueDate: fmt(subDays(today, 1)), createdAt: subDays(today, 5).toISOString(),
      tags: ['finance'], estimatedMinutes: 20, subtasks: [],
      recurring: { type: 'monthly', interval: 1 },
    },
    {
      id: 't5', title: 'Prepare presentation slides', status: 'done', priority: 'high',
      dueDate: fmt(subDays(today, 2)), createdAt: subDays(today, 7).toISOString(), completedAt: subDays(today, 2).toISOString(),
      tags: ['work'], project: 'Q1 Planning', estimatedMinutes: 90, goalId: 'g1', subtasks: [],
    },
    {
      id: 't6', title: 'Grocery shopping', description: 'Weekly groceries', status: 'done', priority: 'med',
      dueDate: fmt(subDays(today, 1)), createdAt: subDays(today, 2).toISOString(), completedAt: subDays(today, 1).toISOString(),
      tags: ['personal'], estimatedMinutes: 40, subtasks: [],
      recurring: { type: 'weekly', interval: 1 },
    },
    {
      id: 't7', title: 'Update portfolio website', description: 'Add recent projects', status: 'todo', priority: 'med',
      dueDate: fmt(addDays(today, 3)), createdAt: subDays(today, 1).toISOString(),
      tags: ['career'], project: 'Personal Brand', estimatedMinutes: 120, goalId: 'g1', subtasks: [],
    },
    {
      id: 't8', title: 'Fix login page bug', status: 'doing', priority: 'high',
      dueDate: fmt(today), createdAt: subDays(today, 1).toISOString(),
      tags: ['work', 'urgent'], project: 'Q1 Planning', subtasks: [
        { id: 'st3', title: 'Reproduce the issue', done: true },
        { id: 'st4', title: 'Write fix', done: false },
        { id: 'st5', title: 'Test on staging', done: false },
      ],
    },
    {
      id: 't9', title: 'Plan team offsite agenda', status: 'todo', priority: 'low',
      dueDate: fmt(addDays(today, 5)), createdAt: subDays(today, 1).toISOString(),
      tags: ['work'], project: 'Q1 Planning', subtasks: [],
    },
    {
      id: 't10', title: 'Submit expense report', status: 'todo', priority: 'med',
      dueDate: fmt(subDays(today, 3)), createdAt: subDays(today, 6).toISOString(),
      tags: ['finance', 'work'], subtasks: [],
    },
  ],
  goals: [
    {
      id: 'g1', title: 'Get promoted to Senior', description: 'Achieve senior-level role by mid-year', category: 'career', status: 'active',
      startDate: fmt(subDays(today, 60)), targetDate: fmt(addDays(today, 120)),
      progressType: 'manual', progressValue: 35, targetMetric: 'Promotion', currentMetric: '',
      linkedTaskIds: ['t1', 't5', 't7'], milestones: [
        { id: 'm1', title: 'Complete leadership training', targetDate: fmt(addDays(today, 30)), completed: false },
        { id: 'm2', title: 'Lead 2 projects', targetDate: fmt(addDays(today, 90)), completed: false },
      ],
    },
    {
      id: 'g2', title: 'Run a half-marathon', description: 'Train consistently and complete a half-marathon', category: 'health', status: 'active',
      startDate: fmt(subDays(today, 30)), targetDate: fmt(addDays(today, 90)),
      progressType: 'manual', progressValue: 25, targetMetric: '21.1 km', currentMetric: '5 km',
      linkedTaskIds: ['t2'], milestones: [
        { id: 'm3', title: 'Run 10K without stopping', targetDate: fmt(addDays(today, 30)), completed: false },
      ],
    },
    {
      id: 'g3', title: 'Read 24 books this year', description: 'Two books per month', category: 'study', status: 'active',
      startDate: fmt(subDays(today, 45)), targetDate: fmt(addDays(today, 320)),
      progressType: 'manual', progressValue: 12, targetMetric: '24 books', currentMetric: '3 books',
      linkedTaskIds: ['t3'], milestones: [],
    },
    {
      id: 'g4', title: 'Build 6-month emergency fund', description: 'Save enough to cover 6 months of expenses', category: 'finance', status: 'active',
      startDate: fmt(subDays(today, 90)), targetDate: fmt(addDays(today, 180)),
      progressType: 'manual', progressValue: 45, targetMetric: '$18,000', currentMetric: '$8,100',
      linkedTaskIds: ['t4'], milestones: [],
    },
  ],
  events: [
    {
      id: 'e1', title: 'Team standup', startDateTime: fmtDT(today, 9, 0), endDateTime: fmtDT(today, 9, 30),
      location: 'Zoom', notes: '', category: 'work', recurring: 'daily',
    },
    {
      id: 'e2', title: 'Lunch with Sarah', startDateTime: fmtDT(today, 12, 30), endDateTime: fmtDT(today, 13, 30),
      location: 'Cafe Roma', notes: 'Catch up on weekend plans', category: 'personal', recurring: null,
    },
    {
      id: 'e3', title: 'Gym session', startDateTime: fmtDT(today, 17, 30), endDateTime: fmtDT(today, 18, 30),
      location: 'City Gym', notes: 'Leg day', category: 'health', recurring: 'weekly',
    },
    {
      id: 'e4', title: 'Product review meeting', startDateTime: fmtDT(addDays(today, 1), 14, 0), endDateTime: fmtDT(addDays(today, 1), 15, 0),
      location: 'Conference Room B', notes: '', category: 'work', recurring: null,
    },
  ],
  habits: [
    { id: 'h1', title: 'Meditate 10 min', frequency: 'daily', targetCountPerPeriod: 7, logs: [fmt(subDays(today, 1)), fmt(subDays(today, 2)), fmt(subDays(today, 3)), fmt(subDays(today, 5))] },
    { id: 'h2', title: 'Read 30 min', frequency: 'daily', targetCountPerPeriod: 7, logs: [fmt(subDays(today, 1)), fmt(subDays(today, 2)), fmt(subDays(today, 4))] },
    { id: 'h3', title: 'Exercise', frequency: 'weekly', targetCountPerPeriod: 4, logs: [fmt(subDays(today, 1)), fmt(subDays(today, 3)), fmt(subDays(today, 6))] },
    { id: 'h4', title: 'Journal', frequency: 'daily', targetCountPerPeriod: 7, logs: [fmt(subDays(today, 1)), fmt(subDays(today, 2)), fmt(subDays(today, 3)), fmt(subDays(today, 4)), fmt(subDays(today, 5))] },
  ],
  weeklyPlans: [],
};
