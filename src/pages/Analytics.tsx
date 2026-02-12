import { useState, useMemo } from 'react';
import { useAppContext } from '@/store/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { subDays, format, isWithinInterval, startOfDay, endOfDay, differenceInMinutes } from 'date-fns';
import { getHabitWeeklyAdherence } from '@/lib/stats';

type TimeRange = 'week' | 'month' | 'quarter' | 'year';
const rangeDays: Record<TimeRange, number> = { week: 7, month: 30, quarter: 90, year: 365 };

export default function Analytics() {
  const { data } = useAppContext();
  const [range, setRange] = useState<TimeRange>('month');
  const days = rangeDays[range];

  const taskCompletionData = useMemo(() => {
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = subDays(new Date(), i);
      const dayStr = format(day, 'yyyy-MM-dd');
      const completed = data.tasks.filter(t => t.completedAt && format(new Date(t.completedAt), 'yyyy-MM-dd') === dayStr).length;
      const created = data.tasks.filter(t => format(new Date(t.createdAt), 'yyyy-MM-dd') === dayStr).length;
      result.push({ date: format(day, days <= 7 ? 'EEE' : 'MMM d'), completed, created });
    }
    return result;
  }, [data.tasks, days]);

  const totalCreated = data.tasks.length;
  const totalCompleted = data.tasks.filter(t => t.status === 'done').length;
  const completionRate = totalCreated > 0 ? Math.round((totalCompleted / totalCreated) * 100) : 0;

  const avgCompletionTime = useMemo(() => {
    const withTime = data.tasks.filter(t => t.completedAt && t.createdAt);
    if (withTime.length === 0) return 'N/A';
    const avg = withTime.reduce((sum, t) => sum + differenceInMinutes(new Date(t.completedAt!), new Date(t.createdAt)), 0) / withTime.length;
    if (avg < 60) return `${Math.round(avg)}m`;
    if (avg < 1440) return `${Math.round(avg / 60)}h`;
    return `${Math.round(avg / 1440)}d`;
  }, [data.tasks]);

  const topTags = useMemo(() => {
    const counts: Record<string, number> = {};
    data.tasks.forEach(t => t.tags.forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [data.tasks]);

  const goalDistribution = useMemo(() => {
    const buckets = [
      { label: '0-25%', count: 0 }, { label: '26-50%', count: 0 },
      { label: '51-75%', count: 0 }, { label: '76-100%', count: 0 },
    ];
    data.goals.filter(g => g.status === 'active').forEach(g => {
      if (g.progressValue <= 25) buckets[0].count++;
      else if (g.progressValue <= 50) buckets[1].count++;
      else if (g.progressValue <= 75) buckets[2].count++;
      else buckets[3].count++;
    });
    return buckets;
  }, [data.goals]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <div className="flex rounded-md border border-border">
          {(['week', 'month', 'quarter', 'year'] as const).map(r => (
            <button key={r} onClick={() => setRange(r)} className={`px-3 py-1.5 text-xs font-medium capitalize ${range === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'} ${r === 'week' ? 'rounded-l-md' : r === 'year' ? 'rounded-r-md' : ''}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{totalCreated}</p><p className="text-xs text-muted-foreground">Tasks created</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{totalCompleted}</p><p className="text-xs text-muted-foreground">Tasks completed</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{completionRate}%</p><p className="text-xs text-muted-foreground">Completion rate</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{avgCompletionTime}</p><p className="text-xs text-muted-foreground">Avg completion time</p></CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Task completion chart */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Task Completion</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={taskCompletionData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="completed" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Goal distribution */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Goal Progress Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={goalDistribution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Habit adherence */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Habit Adherence</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.habits.map(h => {
                const adherence = getHabitWeeklyAdherence(h);
                return (
                  <div key={h.id} className="flex items-center justify-between">
                    <span className="text-sm">{h.title}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(adherence, 100)}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{adherence}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top tags */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Top Tags</CardTitle></CardHeader>
          <CardContent>
            {topTags.length === 0 && <p className="text-sm text-muted-foreground">No tags yet.</p>}
            <div className="space-y-2">
              {topTags.map(([tag, count]) => (
                <div key={tag} className="flex items-center justify-between">
                  <Badge variant="secondary">{tag}</Badge>
                  <span className="text-sm text-muted-foreground">{count} tasks</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
