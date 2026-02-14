import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAppContext } from '@/store/AppContext';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckSquare, Target, Flame, TrendingUp, AlertTriangle, Clock, Plus, ArrowRight, Zap, CalendarDays, Heart, Activity, Brain, Bell, Inbox, LayoutTemplate, Cog } from 'lucide-react';
import { getHabitStreak, computeGoalProgress, getGoalDisplayStatus, computeLifeScore } from '@/lib/stats';
import { format, addDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { GoalDisplayStatus } from '@/types';
import { DailyBriefingCard } from '@/components/DailyBriefingCard';
import { mergePreferences } from '@/types/preferences';

const statusColors: Record<GoalDisplayStatus, string> = {
  'On track': 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
  'Behind': 'bg-destructive/10 text-destructive border-destructive/20',
  'Overdue': 'bg-destructive/10 text-destructive border-destructive/20',
  'Not started': 'bg-muted text-muted-foreground border-border',
  'Completed': 'bg-primary/10 text-primary border-primary/20',
};

const moodLabels = ['😞', '😕', '😐', '🙂', '😊'];

export default function Dashboard() {
  const {
    data, addTask, toggleTaskDone, logHabit, runTemplate,
    getTodayTasks, getOverdueTasks, completionRateThisWeek, tasksCompletedPerDayThisWeek, avgCompletionTime,
    getPinnedFocus, setPinnedFocus, getActiveGoals, getBehindGoals, getGoalsDueSoon: getGoalsDueSoonCtx,
    getAgendaForDay, createFocusBlockFromTask,
    getCheckInForDate, upsertDailyCheckIn, generateLifeScoreForDate, getLifeScoreForDate,
    markNotificationRead,
  } = useAppContext();
  const { profile, isModuleEnabled } = useAuth();
  const navigate = useNavigate();
  const { tasks, goals, habits } = data;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayTasks = getTodayTasks();
  const overdue = getOverdueTasks();
  const weeklyRate = completionRateThisWeek();
  const perDay = tasksCompletedPerDayThisWeek();
  const avgTime = avgCompletionTime();
  const pinnedIds = getPinnedFocus(todayStr);
  const pinnedTasks = tasks.filter(t => pinnedIds.includes(t.id) && t.status !== 'done');
  const doneToday = tasks.filter(t => t.completedAt && format(new Date(t.completedAt), 'yyyy-MM-dd') === todayStr);
  const weekDone = perDay.reduce((sum, d) => sum + d.count, 0);

  const activeGoals = getActiveGoals();
  const behindGoals = getBehindGoals();
  const dueSoonGoals = getGoalsDueSoonCtx(14);

  const topGoals = [...activeGoals].sort((a, b) => {
    const aStatus = getGoalDisplayStatus(a, tasks);
    const bStatus = getGoalDisplayStatus(b, tasks);
    const aBehind = aStatus === 'Behind' || aStatus === 'Overdue' ? 0 : 1;
    const bBehind = bStatus === 'Behind' || bStatus === 'Overdue' ? 0 : 1;
    if (aBehind !== bBehind) return aBehind - bBehind;
    return a.targetDate.localeCompare(b.targetDate);
  }).slice(0, 3);

  // Quick add
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDue, setQuickDue] = useState<string>('today');

  const handleQuickAdd = () => {
    if (!quickTitle.trim()) return;
    const dueDate = quickDue === 'today' ? todayStr : quickDue === 'tomorrow' ? format(addDays(new Date(), 1), 'yyyy-MM-dd') : quickDue === 'next-week' ? format(addDays(new Date(), 7), 'yyyy-MM-dd') : undefined;
    addTask({ id: crypto.randomUUID(), title: quickTitle.trim(), status: 'todo', priority: 'med', dueDate, createdAt: new Date().toISOString(), tags: [], subtasks: [] });
    setQuickTitle('');
  };

  const togglePin = (taskId: string) => {
    if (pinnedIds.includes(taskId)) setPinnedFocus(todayStr, pinnedIds.filter(id => id !== taskId));
    else if (pinnedIds.length < 3) setPinnedFocus(todayStr, [...pinnedIds, taskId]);
  };

  // Today's schedule
  const todayAgenda = useMemo(() => getAgendaForDay(todayStr), [getAgendaForDay, todayStr]);
  const now = new Date();
  const currentItem = todayAgenda.find(item => new Date(item.startDateTime) <= now && new Date(item.endDateTime) > now);

  // Next free window
  const nextFree = useMemo(() => {
    if (todayAgenda.length === 0) return '08:00 – 20:00';
    const nowH = now.getHours() + now.getMinutes() / 60;
    let cursor = Math.max(nowH, 8);
    for (const item of todayAgenda) {
      const s = new Date(item.startDateTime);
      const sH = s.getHours() + s.getMinutes() / 60;
      const e = new Date(item.endDateTime);
      const eH = e.getHours() + e.getMinutes() / 60;
      if (sH > cursor && sH - cursor >= 0.5) {
        const startStr = `${Math.floor(cursor).toString().padStart(2, '0')}:${((cursor % 1) * 60).toString().padStart(2, '0')}`;
        const endStr = `${Math.floor(sH).toString().padStart(2, '0')}:${((sH % 1) * 60).toString().padStart(2, '0')}`;
        return `${startStr} – ${endStr}`;
      }
      cursor = Math.max(cursor, eH);
    }
    if (cursor < 20) {
      const startStr = `${Math.floor(cursor).toString().padStart(2, '0')}:${Math.round((cursor % 1) * 60).toString().padStart(2, '0')}`;
      return `${startStr} – 20:00`;
    }
    return 'No free time today';
  }, [todayAgenda]);

  // Quick schedule suggestions
  const schedulableTasks = useMemo(() => {
    return [...todayTasks, ...overdue.filter(t => !todayTasks.some(tt => tt.id === t.id))]
      .filter(t => !t.scheduledStart)
      .slice(0, 3);
  }, [todayTasks, overdue]);

  const hour = now.getHours();
  const userName = profile?.first_name || 'there';
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  // ── Check-in & Life Score ──
  const todayCheckIn = getCheckInForDate(todayStr);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [ciStep, setCiStep] = useState(1);
  const [ciMood, setCiMood] = useState(todayCheckIn?.mood ?? 3);
  const [ciEnergy, setCiEnergy] = useState(todayCheckIn?.energy ?? 3);
  const [ciFocus, setCiFocus] = useState(todayCheckIn?.focus ?? 3);
  const [ciHighlights, setCiHighlights] = useState(todayCheckIn?.highlights ?? '');
  const [ciBlockers, setCiBlockers] = useState(todayCheckIn?.blockers ?? '');
  const [ciGratitude, setCiGratitude] = useState(todayCheckIn?.gratitude ?? '');

  // Check if user has no data (empty state) - define early for use below
  const hasNoData = tasks.length === 0 && goals.length === 0 && habits.length === 0 && data.events.length === 0;

  // Open copilot via custom event (AppLayout listens)
  const handleOpenCopilot = useCallback((message?: string) => {
    window.dispatchEvent(new CustomEvent('open-copilot', { detail: { message } }));
  }, []);

  // Auto-generate life score on first dashboard load per day (only if user has data)
  const todayScore = getLifeScoreForDate(todayStr);
  useEffect(() => {
    if (!todayScore && !hasNoData) {
      generateLifeScoreForDate(todayStr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayStr, hasNoData]);

  const currentScore = todayScore || { score: 0, breakdown: { tasks: 0, focus: 0, habits: 0, goals: 0 } };

  const handleCheckInSave = () => {
    upsertDailyCheckIn(todayStr, { mood: ciMood, energy: ciEnergy, focus: ciFocus, highlights: ciHighlights || undefined, blockers: ciBlockers || undefined, gratitude: ciGratitude || undefined });
    generateLifeScoreForDate(todayStr);
    setCheckInOpen(false);
    setCiStep(1);
  };

  const openCheckIn = (editing?: boolean) => {
    if (editing && todayCheckIn) {
      setCiMood(todayCheckIn.mood);
      setCiEnergy(todayCheckIn.energy);
      setCiFocus(todayCheckIn.focus);
      setCiHighlights(todayCheckIn.highlights ?? '');
      setCiBlockers(todayCheckIn.blockers ?? '');
      setCiGratitude(todayCheckIn.gratitude ?? '');
    }
    setCiStep(1);
    setCheckInOpen(true);
  };

  // Score recommendations
  const recommendations = useMemo(() => {
    const recs: { text: string; action: string; route: string }[] = [];
    if (overdue.length > 0) recs.push({ text: 'Schedule an overdue task', action: 'Fix', route: '/tasks?tab=overdue' });
    const plannedBlocks = data.focusBlocks.filter(fb => fb.status === 'planned' && format(new Date(fb.startDateTime), 'yyyy-MM-dd') === todayStr);
    if (plannedBlocks.length > 0) recs.push({ text: 'Complete a planned focus block', action: 'Go', route: '/calendar' });
    const activeHabits = habits.filter(h => (h as any).status !== 'archived');
    const unloggedHabits = activeHabits.filter(h => h.frequency === 'daily' && !h.logs.includes(todayStr));
    if (unloggedHabits.length > 0) recs.push({ text: `Log "${unloggedHabits[0].title}"`, action: 'Log', route: '/habits' });
    return recs.slice(0, 3);
  }, [overdue, data.focusBlocks, habits, todayStr]);

  // Top habit streaks
  const topHabitStreaks = useMemo(() => {
    const active = habits.filter(h => (h as any).status !== 'archived');
    return [...active].sort((a, b) => getHabitStreak(b) - getHabitStreak(a)).slice(0, 3);
  }, [habits]);

  // Alerts
  const topAlerts = useMemo(() => {
    return [...data.notifications]
      .filter(n => !n.readAt && !n.dismissedAt && (!n.snoozedUntil || n.snoozedUntil <= new Date().toISOString()))
      .sort((a, b) => {
        const sev = { critical: 0, warning: 1, info: 2 };
        return (sev[a.severity] ?? 2) - (sev[b.severity] ?? 2) || b.createdAt.localeCompare(a.createdAt);
      })
      .slice(0, 3);
  }, [data.notifications]);

  const dailyDigest = useMemo(() => {
    const parts: string[] = [];
    if (overdue.length) parts.push(`${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`);
    if (behindGoals.length) parts.push(`${behindGoals.length} goal${behindGoals.length > 1 ? 's' : ''} behind`);
    const unloggedHabits = habits.filter(h => (h as any).status !== 'archived' && h.frequency === 'daily' && !h.logs.includes(todayStr));
    if (unloggedHabits.length) parts.push(`${unloggedHabits.length} habit${unloggedHabits.length > 1 ? 's' : ''} to log`);
    return parts.length > 0 ? `Today: ${parts.join(', ')}` : null;
  }, [overdue, behindGoals, habits, todayStr]);


  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div data-tour="dashboard-header">
        <h1 className="text-2xl font-bold tracking-tight">Good {greeting}, {userName}</h1>
        <p className="text-muted-foreground text-sm mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Empty state for new users */}
      {hasNoData && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center space-y-4">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Welcome to your LifeOS.</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Start with one small action — your system builds itself.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {isModuleEnabled('tasks') && (
                <Button variant="outline" onClick={() => navigate('/tasks')}>
                  <CheckSquare className="h-4 w-4 mr-2" /> Add a task
                </Button>
              )}
              {isModuleEnabled('inbox') && (
                <Button variant="outline" onClick={() => navigate('/inbox')}>
                  <Inbox className="h-4 w-4 mr-2" /> Capture to inbox
                </Button>
              )}
              {isModuleEnabled('goals') && (
                <Button variant="outline" onClick={() => navigate('/goals')}>
                  <Target className="h-4 w-4 mr-2" /> Create a goal
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Nothing here is pre-filled. LifeOS starts clean by design.
            </p>
          </CardContent>
        </Card>
      )}

      {!hasNoData && (
        <>

      {/* AI Daily Briefing */}
      {mergePreferences(profile?.preferences).briefing.show_on_dashboard && (
        <DailyBriefingCard onOpenCopilot={handleOpenCopilot} />
      )}

      {/* Daily Digest Banner */}
      {dailyDigest && (
        <button onClick={() => navigate('/notifications')} className="w-full flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm hover:bg-primary/10 transition-colors">
          <Bell className="h-4 w-4 text-primary shrink-0" />
          <span>{dailyDigest}</span>
          <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
        </button>
      )}

      {/* Alerts */}
      {topAlerts.length > 0 && (
        <div className="space-y-2">
          {topAlerts.map(n => (
            <div key={n.id} className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${n.severity === 'critical' ? 'border-destructive/30 bg-destructive/5' : n.severity === 'warning' ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-border'}`}>
              <div className={`h-2 w-2 rounded-full shrink-0 ${n.severity === 'critical' ? 'bg-destructive' : n.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{n.title}</p>
                <p className="text-[10px] text-muted-foreground truncate">{n.message}</p>
              </div>
              {n.action && (
                <Button size="sm" variant="outline" className="h-7 text-[10px] shrink-0" onClick={() => { markNotificationRead(n.id); navigate(n.action!.route); }}>
                  {n.action.label}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Daily Check-in + Life Score row */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Daily Check-in</span>
              </div>
              {todayCheckIn ? (
                <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => openCheckIn(true)}>Edit</Button>
              ) : (
                <Button size="sm" className="text-xs h-7" onClick={() => openCheckIn()}>Do check-in (2 min)</Button>
              )}
            </div>
            {todayCheckIn ? (
              <div className="flex items-center gap-4 mt-2">
                <div className="text-center"><span className="text-lg">{moodLabels[todayCheckIn.mood - 1]}</span><p className="text-[10px] text-muted-foreground">Mood</p></div>
                <div className="text-center"><span className="text-lg font-bold">{todayCheckIn.energy}</span><p className="text-[10px] text-muted-foreground">Energy</p></div>
                <div className="text-center"><span className="text-lg font-bold">{todayCheckIn.focus}</span><p className="text-[10px] text-muted-foreground">Focus</p></div>
                {todayCheckIn.highlights && <p className="text-xs text-muted-foreground flex-1 truncate ml-2">{todayCheckIn.highlights}</p>}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">Take 2 minutes to reflect on your day.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Life Score</span>
              </div>
              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => generateLifeScoreForDate(todayStr)}>Refresh</Button>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold">{currentScore.score}</div>
              <div className="flex-1 space-y-1.5">
                {(['tasks', 'focus', 'habits', 'goals'] as const).map(key => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-10 capitalize">{key}</span>
                    <Progress value={currentScore.breakdown[key]} className="h-1.5 flex-1" />
                    <span className="text-[10px] font-medium w-6 text-right">{currentScore.breakdown[key]}</span>
                  </div>
                ))}
              </div>
            </div>
            {recommendations.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Improve your score</p>
                {recommendations.map((r, i) => (
                  <button key={i} onClick={() => navigate(r.route)} className="flex items-center justify-between w-full text-xs rounded-md border border-border p-2 hover:bg-muted/30 transition-colors">
                    <span>{r.text}</span>
                    <Badge variant="secondary" className="text-[8px]">{r.action}</Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Add */}
      <Card data-tour="quick-capture">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary shrink-0" />
            <Input value={quickTitle} onChange={e => setQuickTitle(e.target.value)} placeholder="Quick add a task…" className="h-9"
              onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd(); }} />
            <div className="flex border border-border rounded-md overflow-hidden shrink-0">
              {[{ k: 'today', l: 'Today' }, { k: 'tomorrow', l: 'Tmrw' }, { k: 'next-week', l: '+7d' }, { k: 'none', l: 'None' }].map(({ k, l }) => (
                <button key={k} onClick={() => setQuickDue(k)} className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${quickDue === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{l}</button>
              ))}
            </div>
            <Button size="sm" onClick={handleQuickAdd} className="shrink-0"><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2"><CheckSquare className="h-4 w-4 text-primary" /></div><div><p className="text-2xl font-bold">{doneToday.length}</p><p className="text-xs text-muted-foreground">Done today</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2"><TrendingUp className="h-4 w-4 text-primary" /></div><div><p className="text-2xl font-bold">{weeklyRate}%</p><p className="text-xs text-muted-foreground">Weekly rate</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2"><CheckSquare className="h-4 w-4 text-primary" /></div><div><p className="text-2xl font-bold">{weekDone}</p><p className="text-xs text-muted-foreground">Done this week</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2"><Clock className="h-4 w-4 text-primary" /></div><div><p className="text-2xl font-bold">{avgTime}</p><p className="text-xs text-muted-foreground">Avg completion</p></div></CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Today Focus */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Today's Focus
              <Badge variant="secondary" className="text-[10px] ml-auto">{pinnedTasks.length}/3</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pinnedTasks.length === 0 && <p className="text-sm text-muted-foreground">Pin up to 3 tasks from below.</p>}
            {pinnedTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 rounded-md border border-primary/20 bg-primary/5 p-3">
                <button onClick={() => toggleTaskDone(task.id)} className="h-4 w-4 rounded border border-muted-foreground hover:border-primary transition-colors shrink-0" />
                <span className="text-sm flex-1">{task.title}</span>
                <button onClick={() => togglePin(task.id)} className="text-[10px] text-muted-foreground hover:text-destructive">Unpin</button>
              </div>
            ))}
            {todayTasks.filter(t => !pinnedIds.includes(t.id)).slice(0, 5).map(task => (
              <div key={task.id} className="flex items-center gap-3 rounded-md border border-border p-3 opacity-70 hover:opacity-100 transition-opacity">
                <button onClick={() => toggleTaskDone(task.id)} className="h-4 w-4 rounded border border-muted-foreground hover:border-primary transition-colors shrink-0" />
                <span className="text-sm flex-1">{task.title}</span>
                {pinnedIds.length < 3 && <button onClick={() => togglePin(task.id)} className="text-[10px] text-primary hover:underline">Pin</button>}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Today's Schedule */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Today's Schedule</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => navigate('/calendar')} className="text-xs">View Calendar <ArrowRight className="h-3 w-3 ml-1" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayAgenda.length === 0 && <p className="text-sm text-muted-foreground">No events or focus blocks today.</p>}
            {todayAgenda.slice(0, 6).map(item => {
              const isCurrent = currentItem?.id === item.id;
              return (
                <div key={item.id} className={`flex items-center gap-3 rounded-md border p-2.5 text-sm ${isCurrent ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <div className={`h-2 w-2 rounded-full shrink-0 ${item.type === 'focus' ? 'bg-primary' : 'bg-blue-500'} ${isCurrent ? 'animate-pulse' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      {item.type === 'focus' && <Zap className="h-3 w-3 text-primary shrink-0" />}
                      <p className="text-sm font-medium truncate">{item.title}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(item.startDateTime), 'h:mm a')} – {format(new Date(item.endDateTime), 'h:mm a')}</p>
                  </div>
                  {isCurrent && <Badge className="text-[8px] bg-primary text-primary-foreground">Now</Badge>}
                </div>
              );
            })}
            {todayAgenda.length > 6 && <p className="text-xs text-muted-foreground text-center">+{todayAgenda.length - 6} more</p>}
            <div className="rounded-md border border-dashed border-border p-2.5 text-xs text-muted-foreground">
              Next free: <span className="font-medium text-foreground">{nextFree}</span>
            </div>
          </CardContent>
        </Card>

        {/* Quick Schedule */}
        {schedulableTasks.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Quick Schedule</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {schedulableTasks.map(task => (
                <div key={task.id} className="flex items-center gap-2 text-sm rounded-md border border-border p-2.5">
                  <span className="flex-1 truncate">{task.title}</span>
                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => {
                    const d = new Date(); d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
                    createFocusBlockFromTask(task.id, d.toISOString(), 30);
                  }}>30m</Button>
                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => {
                    const d = new Date(); d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
                    createFocusBlockFromTask(task.id, d.toISOString(), 60);
                  }}>60m</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Goals Snapshot */}
        <Card className={schedulableTasks.length > 0 ? '' : 'md:col-span-2'}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Goals</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => navigate('/goals')} className="text-xs">View all <ArrowRight className="h-3 w-3 ml-1" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xl font-bold">{activeGoals.length}</p>
                <p className="text-[10px] text-muted-foreground">Active</p>
              </div>
              <button onClick={() => navigate('/goals')} className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-center hover:bg-destructive/10 transition-colors">
                <p className="text-xl font-bold text-destructive">{behindGoals.length}</p>
                <p className="text-[10px] text-muted-foreground">Behind</p>
              </button>
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xl font-bold">{dueSoonGoals.length}</p>
                <p className="text-[10px] text-muted-foreground">Due soon</p>
              </div>
            </div>
            {topGoals.length > 0 && (
              <div className="space-y-2">
                {topGoals.map(goal => {
                  const progress = computeGoalProgress(goal, tasks);
                  const displayStatus = getGoalDisplayStatus(goal, tasks);
                  return (
                    <div key={goal.id} className="flex items-center gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/30" onClick={() => navigate('/goals')}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{goal.title}</p>
                          <Badge className={`text-[8px] border ${statusColors[displayStatus]}`}>{displayStatus}</Badge>
                        </div>
                        <Progress value={progress} className="h-1 mt-1.5" />
                      </div>
                      <span className="text-sm font-bold text-muted-foreground">{progress}%</span>
                    </div>
                  );
                })}
              </div>
            )}
            {activeGoals.length === 0 && <p className="text-sm text-muted-foreground text-center">No active goals. <button onClick={() => navigate('/goals')} className="text-primary underline">Create one</button></p>}
          </CardContent>
        </Card>

        {/* Overdue Warnings */}
        {overdue.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" /> Overdue ({overdue.length})</CardTitle>
                <Button size="sm" variant="outline" onClick={() => navigate('/tasks?tab=overdue')} className="text-xs">Fix it <ArrowRight className="h-3 w-3 ml-1" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {overdue.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center justify-between text-sm rounded-md border border-destructive/20 bg-destructive/5 p-2.5">
                    <span>{t.title}</span><span className="text-xs text-destructive font-medium">{t.dueDate}</span>
                  </div>
                ))}
                {overdue.length > 5 && <p className="text-xs text-muted-foreground text-center mt-1">+{overdue.length - 5} more</p>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Habit Streaks */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2"><Flame className="h-4 w-4 text-primary" /> Habits</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => navigate('/habits')} className="text-xs">View all <ArrowRight className="h-3 w-3 ml-1" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
              {topHabitStreaks.map(h => {
                const loggedToday = h.logs.includes(todayStr);
                const streak = getHabitStreak(h);
                return (
                  <button key={h.id} onClick={() => !loggedToday && logHabit(h.id, todayStr)} disabled={loggedToday}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${loggedToday ? 'border-primary/30 bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                    <div className={`h-3 w-3 rounded-full shrink-0 ${loggedToday ? 'bg-primary' : 'border-2 border-muted-foreground'}`} />
                    <div><p className="font-medium">{h.title}</p><p className="text-xs text-muted-foreground">{streak} day streak</p></div>
                  </button>
                );
              })}
              {habits.filter(h => (h as any).status !== 'archived').length === 0 && <p className="text-sm text-muted-foreground col-span-4">No habits yet. <button onClick={() => navigate('/habits')} className="text-primary underline">Create one</button></p>}
            </div>
          </CardContent>
        </Card>
        {/* Templates Quick Run */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2"><LayoutTemplate className="h-4 w-4 text-primary" /> Quick Templates</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => navigate('/templates')} className="text-xs">View all <ArrowRight className="h-3 w-3 ml-1" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.templates.slice(0, 3).map(tpl => (
              <div key={tpl.id} className="flex items-center gap-3 rounded-md border border-border p-2.5 text-sm">
                <span className="flex-1 truncate">{tpl.name}</span>
                <Badge variant="outline" className="text-[8px]">{tpl.items.length} items</Badge>
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => {
                  const result = runTemplate(tpl.id, todayStr);
                  if (result) navigate('/templates');
                }}>Run</Button>
              </div>
            ))}
            {data.templates.length === 0 && <p className="text-sm text-muted-foreground">No templates yet. <button onClick={() => navigate('/templates')} className="text-primary underline">Create one</button></p>}
          </CardContent>
        </Card>

        {/* Automation Activity */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2"><Cog className="h-4 w-4 text-primary" /> Automations</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => navigate('/automations')} className="text-xs">View all <ArrowRight className="h-3 w-3 ml-1" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.automationRules.filter(r => r.enabled).length === 0 ? (
              <div className="text-center py-3">
                <p className="text-sm text-muted-foreground mb-2">No automations enabled.</p>
                <Button size="sm" variant="outline" onClick={() => navigate('/automations')} className="text-xs">Set up automations</Button>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">{data.automationRules.filter(r => r.enabled).length} rule{data.automationRules.filter(r => r.enabled).length > 1 ? 's' : ''} active</p>
                {data.automationLogs.slice(-3).reverse().map(log => {
                  const rule = data.automationRules.find(r => r.id === log.ruleId);
                  return (
                    <div key={log.id} className={`flex items-center gap-2 text-xs rounded-md border p-2 ${log.status === 'failed' ? 'border-destructive/20 bg-destructive/5' : 'border-border'}`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${log.status === 'success' ? 'bg-green-500' : log.status === 'failed' ? 'bg-destructive' : 'bg-muted-foreground'}`} />
                      <span className="flex-1 truncate">{rule?.name || 'Unknown'}</span>
                      <span className="text-muted-foreground">{log.status}</span>
                    </div>
                  );
                })}
              </>
            )}
          </CardContent>
        </Card>
      </div>
      </>
      )}

      {/* Check-in Modal */}
      <Dialog open={checkInOpen} onOpenChange={setCheckInOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Daily Check-in</DialogTitle></DialogHeader>
          {ciStep === 1 && (
            <div className="space-y-5">
              <div>
                <Label className="text-sm mb-2 block">Mood {moodLabels[ciMood - 1]}</Label>
                <Slider value={[ciMood]} onValueChange={v => setCiMood(v[0])} min={1} max={5} step={1} />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>Low</span><span>High</span></div>
              </div>
              <div>
                <Label className="text-sm mb-2 block">Energy: {ciEnergy}/5</Label>
                <Slider value={[ciEnergy]} onValueChange={v => setCiEnergy(v[0])} min={1} max={5} step={1} />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>Low</span><span>High</span></div>
              </div>
              <div>
                <Label className="text-sm mb-2 block">Focus: {ciFocus}/5</Label>
                <Slider value={[ciFocus]} onValueChange={v => setCiFocus(v[0])} min={1} max={5} step={1} />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>Low</span><span>High</span></div>
              </div>
              <Button className="w-full" onClick={() => setCiStep(2)}>Next</Button>
            </div>
          )}
          {ciStep === 2 && (
            <div className="space-y-4">
              <div><Label>Highlights</Label><Textarea value={ciHighlights} onChange={e => setCiHighlights(e.target.value)} rows={2} placeholder="What went well today?" /></div>
              <div><Label>Blockers</Label><Textarea value={ciBlockers} onChange={e => setCiBlockers(e.target.value)} rows={2} placeholder="What held you back?" /></div>
              <div><Label>Gratitude (optional)</Label><Textarea value={ciGratitude} onChange={e => setCiGratitude(e.target.value)} rows={2} placeholder="What are you grateful for?" /></div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setCiStep(1)} className="flex-1">Back</Button>
                <Button onClick={() => setCiStep(3)} className="flex-1">Next</Button>
              </div>
            </div>
          )}
          {ciStep === 3 && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Today's Life Score</p>
                <p className="text-4xl font-bold">{computeLifeScore(data, todayStr).score}</p>
              </div>
              <div className="space-y-1.5">
                {(['tasks', 'focus', 'habits', 'goals'] as const).map(key => {
                  const val = computeLifeScore(data, todayStr).breakdown[key];
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-12 capitalize">{key}</span>
                      <Progress value={val} className="h-1.5 flex-1" />
                      <span className="text-xs font-medium w-6 text-right">{val}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Mood: {moodLabels[ciMood - 1]} · Energy: {ciEnergy}/5 · Focus: {ciFocus}/5
              </p>
              <Button className="w-full" onClick={handleCheckInSave}>Save Check-in</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
