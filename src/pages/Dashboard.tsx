import { useState, useMemo } from 'react';
import { useAppContext } from '@/store/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CheckSquare, Target, Flame, TrendingUp, AlertTriangle, Clock, Plus, ArrowRight, Zap } from 'lucide-react';
import { getHabitStreak, getAverageGoalProgress, getOffTrackGoals } from '@/lib/stats';
import { format, isToday, addDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Task } from '@/types';

export default function Dashboard() {
  const {
    data, addTask, toggleTaskDone, logHabit,
    getTodayTasks, getOverdueTasks, completionRateThisWeek, tasksCompletedPerDayThisWeek, avgCompletionTime,
    getPinnedFocus, setPinnedFocus,
  } = useAppContext();
  const navigate = useNavigate();
  const { tasks, goals, events, habits } = data;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayTasks = getTodayTasks();
  const overdue = getOverdueTasks();
  const weeklyRate = completionRateThisWeek();
  const perDay = tasksCompletedPerDayThisWeek();
  const avgTime = avgCompletionTime();
  const avgGoalProgress = getAverageGoalProgress(goals);
  const offTrackGoals = getOffTrackGoals(goals);
  const pinnedIds = getPinnedFocus(todayStr);
  const pinnedTasks = tasks.filter(t => pinnedIds.includes(t.id) && t.status !== 'done');
  const todayEvents = events.filter(e => isToday(new Date(e.startDateTime)));
  const doneToday = tasks.filter(t => t.completedAt && format(new Date(t.completedAt), 'yyyy-MM-dd') === todayStr);
  const weekDone = perDay.reduce((sum, d) => sum + d.count, 0);

  // Quick add
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDue, setQuickDue] = useState<string>('today');

  const handleQuickAdd = () => {
    if (!quickTitle.trim()) return;
    const dueDate = quickDue === 'today' ? todayStr
      : quickDue === 'tomorrow' ? format(addDays(new Date(), 1), 'yyyy-MM-dd')
      : quickDue === 'next-week' ? format(addDays(new Date(), 7), 'yyyy-MM-dd')
      : undefined;
    addTask({
      id: crypto.randomUUID(), title: quickTitle.trim(), status: 'todo', priority: 'med',
      dueDate, createdAt: new Date().toISOString(), tags: [], subtasks: [],
    });
    setQuickTitle('');
  };

  // Pin/unpin
  const togglePin = (taskId: string) => {
    if (pinnedIds.includes(taskId)) {
      setPinnedFocus(todayStr, pinnedIds.filter(id => id !== taskId));
    } else if (pinnedIds.length < 3) {
      setPinnedFocus(todayStr, [...pinnedIds, taskId]);
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Good {greeting}, {data.profile.name}</h1>
        <p className="text-muted-foreground text-sm mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Quick Add */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary shrink-0" />
            <Input value={quickTitle} onChange={e => setQuickTitle(e.target.value)}
              placeholder="Quick add a task…" className="h-9"
              onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd(); }} />
            <div className="flex border border-border rounded-md overflow-hidden shrink-0">
              {[{ k: 'today', l: 'Today' }, { k: 'tomorrow', l: 'Tmrw' }, { k: 'next-week', l: '+7d' }, { k: 'none', l: 'None' }].map(({ k, l }) => (
                <button key={k} onClick={() => setQuickDue(k)}
                  className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${quickDue === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                  {l}
                </button>
              ))}
            </div>
            <Button size="sm" onClick={handleQuickAdd} className="shrink-0"><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2"><CheckSquare className="h-4 w-4 text-primary" /></div>
          <div><p className="text-2xl font-bold">{doneToday.length}</p><p className="text-xs text-muted-foreground">Done today</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2"><TrendingUp className="h-4 w-4 text-primary" /></div>
          <div><p className="text-2xl font-bold">{weeklyRate}%</p><p className="text-xs text-muted-foreground">Weekly rate</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2"><CheckSquare className="h-4 w-4 text-primary" /></div>
          <div><p className="text-2xl font-bold">{weekDone}</p><p className="text-xs text-muted-foreground">Done this week</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2"><Clock className="h-4 w-4 text-primary" /></div>
          <div><p className="text-2xl font-bold">{avgTime}</p><p className="text-xs text-muted-foreground">Avg completion</p></div>
        </CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Today Focus (pinned) */}
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
                <button onClick={() => toggleTaskDone(task.id)}
                  className="h-4 w-4 rounded border border-muted-foreground hover:border-primary transition-colors shrink-0" />
                <span className="text-sm flex-1">{task.title}</span>
                <button onClick={() => togglePin(task.id)} className="text-[10px] text-muted-foreground hover:text-destructive">Unpin</button>
              </div>
            ))}
            {/* Today tasks to pin */}
            {todayTasks.filter(t => !pinnedIds.includes(t.id)).slice(0, 5).map(task => (
              <div key={task.id} className="flex items-center gap-3 rounded-md border border-border p-3 opacity-70 hover:opacity-100 transition-opacity">
                <button onClick={() => toggleTaskDone(task.id)}
                  className="h-4 w-4 rounded border border-muted-foreground hover:border-primary transition-colors shrink-0" />
                <span className="text-sm flex-1">{task.title}</span>
                {pinnedIds.length < 3 && (
                  <button onClick={() => togglePin(task.id)} className="text-[10px] text-primary hover:underline">Pin</button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Today's Schedule */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Today's Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayEvents.length === 0 && <p className="text-sm text-muted-foreground">No events today.</p>}
            {todayEvents.map(event => (
              <div key={event.id} className="flex items-center gap-3 rounded-md border border-border p-3">
                <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(event.startDateTime), 'h:mm a')} — {format(new Date(event.endDateTime), 'h:mm a')}
                    {event.location && ` · ${event.location}`}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Overdue Warnings */}
        {overdue.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" /> Overdue ({overdue.length})
                </CardTitle>
                <Button size="sm" variant="outline" onClick={() => navigate('/tasks?tab=overdue')} className="text-xs">
                  Fix it <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {overdue.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center justify-between text-sm rounded-md border border-destructive/20 bg-destructive/5 p-2.5">
                    <span>{t.title}</span>
                    <span className="text-xs text-destructive font-medium">{t.dueDate}</span>
                  </div>
                ))}
                {overdue.length > 5 && <p className="text-xs text-muted-foreground text-center mt-1">+{overdue.length - 5} more</p>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Habits */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Flame className="h-4 w-4 text-primary" /> Habits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
              {habits.map(h => {
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
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
