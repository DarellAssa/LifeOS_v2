import { useAppContext } from '@/store/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckSquare, Target, Flame, TrendingUp, AlertTriangle, Clock, Plus } from 'lucide-react';
import { getOverdueTasks, getTasksDoneToday, getWeeklyCompletionRate, getAverageGoalProgress, getOffTrackGoals, getHabitStreak } from '@/lib/stats';
import { isToday, format } from 'date-fns';

export default function Dashboard() {
  const { data, updateTask, logHabit } = useAppContext();
  const { tasks, goals, events, habits } = data;

  const todayFocus = tasks.filter(t => t.isTodayFocus && t.status !== 'done');
  const todayEvents = events.filter(e => isToday(new Date(e.startDateTime)));
  const doneToday = getTasksDoneToday(tasks);
  const weeklyRate = getWeeklyCompletionRate(tasks);
  const avgGoalProgress = getAverageGoalProgress(goals);
  const overdue = getOverdueTasks(tasks);
  const offTrackGoals = getOffTrackGoals(goals);
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {data.profile.name}</h1>
        <p className="text-muted-foreground text-sm mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><CheckSquare className="h-4 w-4 text-primary" /></div>
            <div><p className="text-2xl font-bold">{doneToday.length}</p><p className="text-xs text-muted-foreground">Done today</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><TrendingUp className="h-4 w-4 text-primary" /></div>
            <div><p className="text-2xl font-bold">{weeklyRate}%</p><p className="text-xs text-muted-foreground">Weekly rate</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><Flame className="h-4 w-4 text-primary" /></div>
            <div><p className="text-2xl font-bold">{habits.length > 0 ? Math.max(...habits.map(h => getHabitStreak(h))) : 0}</p><p className="text-xs text-muted-foreground">Best streak</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><Target className="h-4 w-4 text-primary" /></div>
            <div><p className="text-2xl font-bold">{avgGoalProgress}%</p><p className="text-xs text-muted-foreground">Goal progress</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Today's Focus */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-primary" /> Today's Focus
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayFocus.length === 0 && <p className="text-sm text-muted-foreground">No tasks pinned for today. Pin tasks from the Tasks page.</p>}
            {todayFocus.map(task => (
              <div key={task.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateTask(task.id, { status: 'done', completedAt: new Date().toISOString() })}
                    className="h-4 w-4 rounded border border-muted-foreground hover:border-primary transition-colors"
                  />
                  <span className="text-sm">{task.title}</span>
                </div>
                <Badge variant={task.priority === 'high' ? 'destructive' : 'secondary'} className="text-[10px]">
                  {task.priority}
                </Badge>
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
                <div className="h-2 w-2 rounded-full bg-primary" />
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

        {/* Falling Behind */}
        {(overdue.length > 0 || offTrackGoals.length > 0) && (
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" /> Falling Behind
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-4">
                {overdue.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Overdue Tasks</p>
                    {overdue.slice(0, 5).map(t => (
                      <div key={t.id} className="flex items-center justify-between text-sm rounded-md border border-destructive/20 bg-destructive/5 p-2">
                        <span>{t.title}</span>
                        <span className="text-xs text-destructive">{t.dueDate}</span>
                      </div>
                    ))}
                  </div>
                )}
                {offTrackGoals.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Off-track Goals</p>
                    {offTrackGoals.map(g => (
                      <div key={g.id} className="flex items-center justify-between text-sm rounded-md border border-destructive/20 bg-destructive/5 p-2">
                        <span>{g.title}</span>
                        <span className="text-xs text-destructive">{g.progressValue}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Habits quick log */}
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
                return (
                  <button
                    key={h.id}
                    onClick={() => !loggedToday && logHabit(h.id, todayStr)}
                    disabled={loggedToday}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${loggedToday ? 'border-primary/30 bg-primary/5' : 'border-border hover:border-primary/50'}`}
                  >
                    <div className={`h-3 w-3 rounded-full ${loggedToday ? 'bg-primary' : 'border-2 border-muted-foreground'}`} />
                    <div>
                      <p className="font-medium">{h.title}</p>
                      <p className="text-xs text-muted-foreground">{getHabitStreak(h)} day streak</p>
                    </div>
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
