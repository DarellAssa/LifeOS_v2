

# LifeOS — Your Personal Life Operating System

A single platform to organize your entire life: tasks, goals, calendar, habits, stats, and planning — all in one place with a premium Notion × Linear aesthetic.

---

## Phase 1: Foundation & Core Layout

### App Shell & Navigation
- Left sidebar with navigation: Dashboard, Tasks, Goals, Calendar, Habits, Analytics, Planning, Settings
- Collapsible sidebar with icons in mini mode
- Top header bar with global search input and dark mode toggle
- Command palette (⌘K) for quick actions: add task, add event, add goal, jump to any page

### Data Layer
- Central state store using React Context with localStorage persistence
- Schema versioning for future-proof data storage
- Seed sample data on first load (tasks, goals, events, habits) so the app feels alive immediately
- Utility functions for streaks, completion rates, on-track logic

---

## Phase 2: Tasks Module

- Full CRUD for tasks with fields: title, description, status (todo/doing/done), priority, due date, tags, project, subtasks, estimated time, recurring option, goal linking
- **List view** with filters (status, priority, due date, tag, project) and smart sorting (overdue first → due soon → priority)
- **Kanban view** toggle with drag-and-drop between status columns
- **Week view** grouping tasks by due date
- **Overdue view** showing only past-due tasks
- Bulk actions: mark done, change priority, add tags
- Completion logging with timestamps

---

## Phase 3: Goals Module

- Full CRUD for goals with categories (health, career, finance, study, personal, custom)
- Goal dashboard: Active / Completed / Archived tabs
- Goal detail page with:
  - Progress bar + on-track/off-track indicator (computed from time elapsed vs progress)
  - Milestones timeline with CRUD
  - Linked tasks list — create tasks directly under a goal
- Progress tracking: manual slider OR automatic task-based computation (toggle between methods)

---

## Phase 4: Calendar Module

- Full CRUD for events with start/end times, location, notes, category, recurring option
- Three views: Day, Week, Month
- Event blocks rendered in the week view timeline
- Quick-add event from Dashboard
- Settings panel with "Connect Google Calendar" / "Connect Outlook" placeholder (coming soon modal)
- JSON import/export for calendar data

---

## Phase 5: Habits & Routines

- Full CRUD for habits with frequency (daily/weekly) and target count per period
- Habit list showing current streak and weekly adherence percentage
- One-click "Log today" button
- Streak calculation and weekly completion tracking
- Dashboard cards reflecting habit streaks

---

## Phase 6: Dashboard — The "Home" That Makes It Addictive

- **Today Focus**: Top 3 pinned tasks for the day
- **Schedule Today**: Today's calendar events pulled from the calendar module
- **Progress Snapshot** cards: tasks done today, weekly completion rate %, habit streaks, average goal progress
- **Falling Behind** section: overdue tasks + off-track goals
- **Quick Add** bar: instantly add a task, event, or habit log
- All sections update in real-time as the user takes actions

---

## Phase 7: Analytics & Statistics

- Time range toggle: week / month / quarter / year
- Charts: task completion over time, completion rate %, overdue count trend, goal progress distribution, habit adherence trend
- KPI cards: total tasks created vs completed, average completion time, most common tags/projects
- All analytics computed from real stored data

---

## Phase 8: Planning Module

- **Weekly Review** page: last week summary (completed, missed, overdue carryover), "Plan this week" to commit to 5–10 tasks, stored as a Weekly Plan object
- **Monthly Goals** page: select top goals for the month, key milestones, progress check-in prompts

---

## Phase 9: Settings & Polish

- Profile settings: name, timezone, preferred week start (Mon/Sun)
- Data management: export all data to JSON, import JSON (replace or merge), reset data with confirmation
- Calendar integration placeholder UI
- Help modal explaining core flows (add tasks, plan week, link tasks to goals, view analytics)
- Dark mode toggle
- Toast notifications for all actions
- Empty states with guided prompts ("Add your first goal", etc.)
- Responsive design: desktop-first, mobile-workable

