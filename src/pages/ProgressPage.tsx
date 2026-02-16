import { useMemo } from 'react';
import { useAppContext } from '@/store/AppContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/PageHeader';
import { Target, Repeat, BarChart3, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { computeGoalProgress, getGoalDisplayStatus, getHabitStreak } from '@/lib/stats';

export default function ProgressPage() {
  const { data, logHabit, completionRateThisWeek } = useAppContext();
  const navigate = useNavigate();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { tasks, goals, habits } = data;

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
    <div className="max-w-2xl mx-auto space-y-8 py-2">
      <PageHeader
        title="Progress"
        subtitle="Goals, habits & how you're doing"
        action={
          <Button variant="outline" size="sm" onClick={() => navigate('/analytics')} className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Analytics
          </Button>
        }
      />

      {/* Metric chips */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { value: doneThisWeek, label: 'tasks this week' },
          { value: `${topStreak}d`, label: 'best streak' },
          { value: `${goalsOnTrack}/${goals.filter(g => g.status === 'active').length}`, label: 'on track' },
        ].map((m, i) => (
          <div key={i} className="surface-1 px-4 py-3 text-center">
            <div className="text-lg font-semibold">{m.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Goals */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="section-label flex items-center gap-2">
            <Target className="h-3.5 w-3.5" /> Goals
          </h2>
          <button onClick={() => navigate('/goals')} className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {activeGoals.length === 0 ? (
          <div className="surface-1 py-12 text-center text-sm text-muted-foreground">
            No active goals yet
          </div>
        ) : (
          <div className="surface-1 overflow-hidden">
            {activeGoals.map((goal, i) => {
              const progress = computeGoalProgress(goal, tasks);
              const status = getGoalDisplayStatus(goal, tasks);
              return (
                <div key={goal.id} className={`px-5 py-3.5 space-y-2.5 row-hover ${i > 0 ? 'border-t border-border/25' : ''}`}>
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
        <div className="flex items-center justify-between px-1">
          <h2 className="section-label flex items-center gap-2">
            <Repeat className="h-3.5 w-3.5" /> Habits
          </h2>
          <button onClick={() => navigate('/habits')} className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {activeHabits.length === 0 ? (
          <div className="surface-1 py-12 text-center text-sm text-muted-foreground">
            No habits yet
          </div>
        ) : (
          <div className="surface-1 overflow-hidden">
            {activeHabits.map((habit, i) => {
              const streak = getHabitStreak(habit);
              const loggedToday = habit.logs.includes(todayStr);
              return (
                <div key={habit.id} className={`flex items-center gap-3 px-5 py-3 row-hover ${i > 0 ? 'border-t border-border/25' : ''}`}>
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
    </div>
  );
}
