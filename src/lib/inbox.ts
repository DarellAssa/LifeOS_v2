import { InboxItemDetected } from '@/types';
import { format, addDays } from 'date-fns';

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
const TIME_REGEX = /\b(\d{1,2}):(\d{2})\b/;
const TOMORROW_REGEX = /\btomorrow\b/i;
const TODAY_REGEX = /\btoday\b/i;
const DAY_REGEX = /\b(mon|tue|wed|thu|fri|sat|sun)\b/i;

const EVENT_KEYWORDS = /\b(call|meet|meeting|appointment|at\s+\d|conference|standup|sync|lunch|dinner|interview)\b/i;
const TASK_KEYWORDS = /\b(todo|submit|email|finish|send|complete|fix|update|review|prepare|write|create|build|implement)\b/i;
const GOAL_KEYWORDS = /\b(goal:|by end of|target|i want to|achieve|milestone|objective)\b/i;
const HABIT_KEYWORDS = /\b(daily|every day|habit|routine|streak|each morning|each evening)\b/i;
const FOCUS_KEYWORDS = /\b(focus|deep work|block|pomodoro|concentration)\b/i;
const CHECKBOX_REGEX = /^-\s*\[\s*\]/;

export function detectInboxContent(content: string): InboxItemDetected {
  const urls = content.match(URL_REGEX) || [];

  let suggestedType: InboxItemDetected['suggestedType'];
  if (EVENT_KEYWORDS.test(content) || TIME_REGEX.test(content)) {
    suggestedType = 'event';
  } else if (CHECKBOX_REGEX.test(content) || TASK_KEYWORDS.test(content)) {
    suggestedType = 'task';
  } else if (GOAL_KEYWORDS.test(content)) {
    suggestedType = 'goal';
  } else if (HABIT_KEYWORDS.test(content)) {
    suggestedType = 'habit';
  } else if (FOCUS_KEYWORDS.test(content)) {
    suggestedType = 'focus';
  } else {
    suggestedType = 'note';
  }

  let suggestedDateTime: string | undefined;
  const now = new Date();
  const timeMatch = content.match(TIME_REGEX);

  if (TODAY_REGEX.test(content)) {
    const d = new Date(now);
    if (timeMatch) {
      d.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), 0, 0);
    } else {
      d.setHours(9, 0, 0, 0);
    }
    suggestedDateTime = d.toISOString();
  } else if (TOMORROW_REGEX.test(content)) {
    const d = addDays(now, 1);
    if (timeMatch) {
      d.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), 0, 0);
    } else {
      d.setHours(9, 0, 0, 0);
    }
    suggestedDateTime = d.toISOString();
  } else if (timeMatch) {
    const d = new Date(now);
    d.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), 0, 0);
    if (d < now) d.setDate(d.getDate() + 1);
    suggestedDateTime = d.toISOString();
  } else if (DAY_REGEX.test(content)) {
    const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const match = content.match(DAY_REGEX)!;
    const targetDay = dayMap[match[1].toLowerCase()];
    const currentDay = now.getDay();
    let daysAhead = targetDay - currentDay;
    if (daysAhead <= 0) daysAhead += 7;
    const d = addDays(now, daysAhead);
    d.setHours(9, 0, 0, 0);
    suggestedDateTime = d.toISOString();
  }

  return { urls, suggestedType, suggestedDateTime };
}

export function deriveTitle(content: string): string {
  const firstLine = content.split('\n')[0].trim();
  return firstLine.length > 60 ? firstLine.slice(0, 57) + '...' : firstLine;
}
