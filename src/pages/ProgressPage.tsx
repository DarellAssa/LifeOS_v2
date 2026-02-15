import { useMemo } from 'react';
import { useAppContext } from '@/store/AppContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Target, Repeat, BarChart3, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { computeGoalProgress, getGoalDisplayStatus, getHabitStreak } from '@/lib/stats';

export default function ProgressPage() {
  const { data, logHabit, completionRateThisWeek } = useAppContext();
  const navigate = useNavigate();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { tasks, goals, habits } = data;

  const weeklyRate = completionRateThisWeek();
  const doneThisWeek = tasks.filter(t => {
    if (!t.completedAt) return false;
    const d = format(new Date(t.completedAt), 'yyyy-MM-dd');
    const weekAgo = format(new Date(Date.now() - 7 * 86400000), 'yyyy-MM-dd');
    return d >= weekAgo;
  }).length;

  const activeGoals = goals.filter(g => g.status === 'active').slice(0, 3);
  const activeHabits = habits.filter(h => (h as any).status !== 'archived').slice(0, 3);

  const topStreak = useMemo(() => {
    if (habits.length === 0) return 0;
    return Math.max(...habits.map(h => getHabitStreak(h)));
  }, [habits]);

  const goalsOnTrack = useMemo(() => {
    return goals.filter(g => g.status === 'active' && getGoalDisplayStatus(g, tasks) === 'On track').length;
  }, [goals, tasks]);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
        <p className="text-sm text-muted-foreground">Goals, habits & how you're doing</p>
      </div>

      {/* Metric chips */}
      <div className="flex gap-3 flex-wrap">
        <div className="rounded-lg bg-card border border-border px-4 py-2.5">
          <p className="text-lg font-semibold">{doneThisWeek}</p>
          <p className="text-xs text-muted-foreground">Tasks this week</p>
        </div>
        <div className="rounded-lg bg-card border border-border px-4 py-2.5">
          <p className="text-lg font-semibold">{topStreak}d</p>
          <p className="text-xs text-muted-foreground">Best streak</p>
        </div>
        <div className="rounded-lg bg-card border border-border px-4 py-2.5">
          <p className="text-lg font-semibold">{goalsOnTrack}/{goals.filter(g => g.status === 'active').length}</p>
          <p className="text-xs text-muted-foreground">Goals on track</p>
        </div>
      </div>

      {/* Goals */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Target className="h-3.5 w-3.5" /> Goals
          </h2>
          <button onClick={() => navigate('/goals')} className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {activeGoals.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No active goals yet
          </div>
        ) : (
          <div className="space-y-2">
            {activeGoals.map(goal => {
              const progress = computeGoalProgress(goal, tasks);
              const status = getGoalDisplayStatus(goal, tasks);
              return (
                <div key={goal.id} className="rounded-lg bg-card border border-border px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{goal.title}</span>
                    <span className={`text-xs ${status === 'On track' ? 'text-success' : status === 'Behind' ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {status}
                    </span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                  <p className="text-xs text-muted-foreground">Due {format(new Date(goal.targetDate), 'MMM d')}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Habits */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Repeat className="h-3.5 w-3.5" /> Habits
          </h2>
          <button onClick={() => navigate('/habits')} className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {activeHabits.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No habits yet
          </div>
        ) : (
          <div className="space-y-1">
            {activeHabits.map(habit => {
              const streak = getHabitStreak(habit);
              const loggedToday = habit.logs.includes(todayStr);
              return (
                <div key={habit.id} className="flex items-center gap-3 rounded-lg px-4 py-3 bg-card border border-border">
                  <span className="text-sm flex-1">{habit.title}</span>
                  <span className="text-xs text-muted-foreground">{streak}d streak</span>
                  <Button
                    size="sm"
                    variant={loggedToday ? 'secondary' : 'outline'}
                    className="h-7 text-xs"
                    onClick={() => !loggedToday && logHabit(habit.id, todayStr)}
                    disabled={loggedToday}
                  >
                    {loggedToday ? '✓' : 'Log'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Insights link */}
      <section className="rounded-lg bg-card border border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Want deeper insights?</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate('/analytics')} className="gap-1">
          Open Analytics <ChevronRight className="h-3 w-3" />
        </Button>
      </section>
    </div>
  );
}
