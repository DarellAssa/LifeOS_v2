import { useState, useMemo } from 'react';
import { useAppContext } from '@/store/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, subDays, startOfWeek, endOfWeek, subWeeks, startOfMonth, isWithinInterval, differenceInMinutes, eachDayOfInterval, eachWeekOfInterval, addDays } from 'date-fns';

type TimeRange = 'week' | 'month';

export default function Analytics() {
  const { data, avgCompletionTime } = useAppContext();
  const [range, setRange] = useState<TimeRange>('week');

  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');

  // Time range bounds
  const rangeStart = range === 'week' ? startOfWeek(now, { weekStartsOn: 1 }) : startOfMonth(now);
  const rangeEnd = now;

  // Task completion over time
  const completionData = useMemo(() => {
    if (range === 'week') {
      const ws = startOfWeek(now, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => {
        const d = addDays(ws, i);
        const dayStr = format(d, 'yyyy-MM-dd');
        const count = data.tasks.filter(t => t.completedAt && format(new Date(t.completedAt), 'yyyy-MM-dd') === dayStr).length;
        return { date: format(d, 'EEE'), completed: count };
      });
    } else {
      // By week for month
      const weeks = eachWeekOfInterval({ start: subDays(now, 28), end: now }, { weekStartsOn: 1 });
      return weeks.map(ws => {
        const we = addDays(ws, 6);
        const count = data.tasks.filter(t => t.completedAt && {
          check: isWithinInterval(new Date(t.completedAt), { start: ws, end: we })
        }.check).length;
        return { date: `${format(ws, 'MMM d')}`, completed: count };
      });
    }
  }, [data.tasks, range]);

  // Completion rate
  const completionRate = useMemo(() => {
    const inRange = data.tasks.filter(t => t.dueDate && t.dueDate >= format(rangeStart, 'yyyy-MM-dd') && t.dueDate <= todayStr);
    if (inRange.length === 0) return 0;
    return Math.round((inRange.filter(t => t.status === 'done').length / inRange.length) * 100);
  }, [data.tasks, rangeStart, todayStr]);

  // Overdue trend by day
  const overdueData = useMemo(() => {
    if (range === 'week') {
      const ws = startOfWeek(now, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => {
        const d = addDays(ws, i);
        const dayStr = format(d, 'yyyy-MM-dd');
        const count = data.tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < dayStr && t.dueDate >= format(ws, 'yyyy-MM-dd')).length;
        return { date: format(d, 'EEE'), overdue: count };
      });
    }
    return Array.from({ length: 4 }, (_, i) => {
      const d = subDays(now, (3 - i) * 7);
      const dayStr = format(d, 'yyyy-MM-dd');
      const count = data.tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < dayStr).length;
      return { date: format(d, 'MMM d'), overdue: count };
    });
  }, [data.tasks, range]);

  // KPI
  const totalCreated = data.tasks.length;
  const totalCompleted = data.tasks.filter(t => t.status === 'done').length;
  const avgTime = avgCompletionTime();

  const topTags = useMemo(() => {
    const counts: Record<string, number> = {};
    data.tasks.forEach(t => t.tags.forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [data.tasks]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <div className="flex rounded-md border border-border overflow-hidden">
          {(['week', 'month'] as const).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-4 py-1.5 text-xs font-medium ${range === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
              This {r === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{totalCreated}</p><p className="text-xs text-muted-foreground">Tasks created</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{totalCompleted}</p><p className="text-xs text-muted-foreground">Tasks completed</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{completionRate}%</p><p className="text-xs text-muted-foreground">Completion rate</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{avgTime}</p><p className="text-xs text-muted-foreground">Avg completion time</p></CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Task completion chart */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Tasks Completed</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={completionData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="completed" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Overdue trend */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Overdue Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={overdueData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="overdue" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
                  <div className="flex items-center gap-2 flex-1 ml-3">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(count / (topTags[0]?.[1] || 1)) * 100}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-6 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Habit adherence */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Habit Adherence</CardTitle></CardHeader>
          <CardContent>
            {data.habits.length === 0 && <p className="text-sm text-muted-foreground">No habits tracked yet.</p>}
            <div className="space-y-3">
              {data.habits.map(h => {
                const ws = startOfWeek(now, { weekStartsOn: 1 });
                const we = endOfWeek(now, { weekStartsOn: 1 });
                const weekLogs = h.logs.filter(l => l >= format(ws, 'yyyy-MM-dd') && l <= format(we, 'yyyy-MM-dd'));
                const adherence = Math.round((weekLogs.length / h.targetCountPerPeriod) * 100);
                return (
                  <div key={h.id} className="flex items-center justify-between">
                    <span className="text-sm">{h.title}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(adherence, 100)}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{adherence}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
