import { useState, useMemo } from 'react';
import { useAppContext } from '@/store/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, isWithinInterval, addDays, eachWeekOfInterval, differenceInMinutes } from 'date-fns';
import { computeGoalProgress, getGoalDisplayStatus } from '@/lib/stats';
import { Target, Zap } from 'lucide-react';

type TimeRange = 'week' | 'month';

export default function Analytics() {
  const { data, avgCompletionTime, getPlannedFocusMinutes, getCompletedFocusMinutes } = useAppContext();
  const [range, setRange] = useState<TimeRange>('week');

  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const rangeStart = range === 'week' ? startOfWeek(now, { weekStartsOn: 1 }) : startOfMonth(now);
  const rangeEnd = range === 'week' ? endOfWeek(now, { weekStartsOn: 1 }) : now;

  // Task completion over time
  const completionData = useMemo(() => {
    if (range === 'week') {
      const ws = startOfWeek(now, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => {
        const d = addDays(ws, i);
        const dayStr = format(d, 'yyyy-MM-dd');
        return { date: format(d, 'EEE'), completed: data.tasks.filter(t => t.completedAt && format(new Date(t.completedAt), 'yyyy-MM-dd') === dayStr).length };
      });
    }
    const weeks = eachWeekOfInterval({ start: subDays(now, 28), end: now }, { weekStartsOn: 1 });
    return weeks.map(ws => {
      const we = addDays(ws, 6);
      return { date: format(ws, 'MMM d'), completed: data.tasks.filter(t => t.completedAt && isWithinInterval(new Date(t.completedAt), { start: ws, end: we })).length };
    });
  }, [data.tasks, range]);

  const completionRate = useMemo(() => {
    const inRange = data.tasks.filter(t => t.dueDate && t.dueDate >= format(rangeStart, 'yyyy-MM-dd') && t.dueDate <= todayStr);
    if (inRange.length === 0) return 0;
    return Math.round((inRange.filter(t => t.status === 'done').length / inRange.length) * 100);
  }, [data.tasks, rangeStart, todayStr]);

  const overdueData = useMemo(() => {
    if (range === 'week') {
      const ws = startOfWeek(now, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => {
        const d = addDays(ws, i);
        const dayStr = format(d, 'yyyy-MM-dd');
        return { date: format(d, 'EEE'), overdue: data.tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < dayStr && t.dueDate >= format(ws, 'yyyy-MM-dd')).length };
      });
    }
    return Array.from({ length: 4 }, (_, i) => {
      const d = subDays(now, (3 - i) * 7);
      return { date: format(d, 'MMM d'), overdue: data.tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < format(d, 'yyyy-MM-dd')).length };
    });
  }, [data.tasks, range]);

  const totalCreated = data.tasks.length;
  const totalCompleted = data.tasks.filter(t => t.status === 'done').length;
  const avgTime = avgCompletionTime();

  const topTags = useMemo(() => {
    const counts: Record<string, number> = {};
    data.tasks.forEach(t => t.tags.forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [data.tasks]);

  // ── Goal Analytics ──
  const activeGoals = data.goals.filter(g => g.status === 'active');

  const goalDistribution = useMemo(() => {
    const buckets = [
      { label: '0–20%', count: 0 }, { label: '21–40%', count: 0 }, { label: '41–60%', count: 0 },
      { label: '61–80%', count: 0 }, { label: '81–99%', count: 0 }, { label: '100%', count: 0 },
    ];
    activeGoals.forEach(g => {
      const p = computeGoalProgress(g, data.tasks);
      if (p >= 100) buckets[5].count++;
      else if (p >= 81) buckets[4].count++;
      else if (p >= 61) buckets[3].count++;
      else if (p >= 41) buckets[2].count++;
      else if (p >= 21) buckets[1].count++;
      else buckets[0].count++;
    });
    return buckets;
  }, [activeGoals, data.tasks]);

  const goalStatusCounts = useMemo(() => {
    let onTrack = 0, behind = 0, overdue = 0;
    activeGoals.forEach(g => {
      const s = getGoalDisplayStatus(g, data.tasks);
      if (s === 'On track' || s === 'Not started') onTrack++;
      else if (s === 'Behind') behind++;
      else if (s === 'Overdue') overdue++;
    });
    return { onTrack, behind, overdue };
  }, [activeGoals, data.tasks]);

  const linkedGoals = activeGoals.filter(g => g.progressType === 'linked');
  const manualGoals = activeGoals.filter(g => g.progressType === 'manual');
  const linkedAvg = linkedGoals.length > 0 ? Math.round(linkedGoals.reduce((s, g) => s + computeGoalProgress(g, data.tasks), 0) / linkedGoals.length) : 0;
  const manualAvg = manualGoals.length > 0 ? Math.round(manualGoals.reduce((s, g) => s + computeGoalProgress(g, data.tasks), 0) / manualGoals.length) : 0;

  // ── Focus Block Analytics ──
  const rangeStartISO = rangeStart.toISOString();
  const rangeEndISO = rangeEnd.toISOString();
  const plannedMins = getPlannedFocusMinutes(rangeStartISO, rangeEndISO);
  const completedMins = getCompletedFocusMinutes(rangeStartISO, rangeEndISO);
  const focusRate = plannedMins > 0 ? Math.round((completedMins / plannedMins) * 100) : 0;
  const focusBlocksCompleted = data.focusBlocks.filter(fb => fb.status === 'completed' && new Date(fb.startDateTime) >= rangeStart && new Date(fb.startDateTime) <= rangeEnd).length;

  const focusPerDay = useMemo(() => {
    if (range === 'week') {
      const ws = startOfWeek(now, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => {
        const d = addDays(ws, i);
        const dayStr = format(d, 'yyyy-MM-dd');
        const dayBlocks = data.focusBlocks.filter(fb => format(new Date(fb.startDateTime), 'yyyy-MM-dd') === dayStr);
        const planned = dayBlocks.reduce((s, fb) => s + differenceInMinutes(new Date(fb.endDateTime), new Date(fb.startDateTime)), 0);
        const completed = dayBlocks.filter(fb => fb.status === 'completed').reduce((s, fb) => s + differenceInMinutes(new Date(fb.endDateTime), new Date(fb.startDateTime)), 0);
        return { date: format(d, 'EEE'), planned, completed };
      });
    }
    const weeks = eachWeekOfInterval({ start: subDays(now, 28), end: now }, { weekStartsOn: 1 });
    return weeks.map(ws => {
      const we = addDays(ws, 6);
      const wBlocks = data.focusBlocks.filter(fb => isWithinInterval(new Date(fb.startDateTime), { start: ws, end: we }));
      const planned = wBlocks.reduce((s, fb) => s + differenceInMinutes(new Date(fb.endDateTime), new Date(fb.startDateTime)), 0);
      const completed = wBlocks.filter(fb => fb.status === 'completed').reduce((s, fb) => s + differenceInMinutes(new Date(fb.endDateTime), new Date(fb.startDateTime)), 0);
      return { date: format(ws, 'MMM d'), planned, completed };
    });
  }, [data.focusBlocks, range]);

  // Most scheduled category
  const topCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    data.events.filter(e => new Date(e.startDateTime) >= rangeStart && new Date(e.startDateTime) <= rangeEnd)
      .forEach(e => { counts[e.category] = (counts[e.category] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || 'N/A';
  }, [data.events, rangeStart, rangeEnd]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <div className="flex rounded-md border border-border overflow-hidden">
          {(['week', 'month'] as const).map(r => (
            <button key={r} onClick={() => setRange(r)} className={`px-4 py-1.5 text-xs font-medium ${range === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
              This {r === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
      </div>

      {/* Task KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{totalCreated}</p><p className="text-xs text-muted-foreground">Tasks created</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{totalCompleted}</p><p className="text-xs text-muted-foreground">Tasks completed</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{completionRate}%</p><p className="text-xs text-muted-foreground">Completion rate</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{avgTime}</p><p className="text-xs text-muted-foreground">Avg completion time</p></CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Tasks Completed</CardTitle></CardHeader>
          <CardContent><ResponsiveContainer width="100%" height={200}><BarChart data={completionData}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip contentStyle={{ fontSize: 12 }} /><Bar dataKey="completed" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Overdue Trend</CardTitle></CardHeader>
          <CardContent><ResponsiveContainer width="100%" height={200}><BarChart data={overdueData}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip contentStyle={{ fontSize: 12 }} /><Bar dataKey="overdue" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></CardContent>
        </Card>

        {/* Focus Analytics */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4" /> Focus Analytics</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xl font-bold">{plannedMins}m</p>
                <p className="text-[10px] text-muted-foreground">Planned focus</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xl font-bold">{completedMins}m</p>
                <p className="text-[10px] text-muted-foreground">Completed focus</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xl font-bold">{focusRate}%</p>
                <p className="text-[10px] text-muted-foreground">Completion rate</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xl font-bold">{focusBlocksCompleted}</p>
                <p className="text-[10px] text-muted-foreground">Blocks completed</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={focusPerDay}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="planned" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} name="Planned (min)" />
                <Bar dataKey="completed" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name="Completed (min)" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 rounded-lg border border-border p-3 text-sm space-y-1">
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Insights</p>
              <p>You planned <strong>{plannedMins}</strong> minutes of focus and completed <strong>{completedMins}</strong> minutes.</p>
              <p>Your most scheduled event category is <strong className="capitalize">{topCategory}</strong>.</p>
            </div>
          </CardContent>
        </Card>

        {/* Goal Analytics */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" /> Goal Progress Distribution</CardTitle></CardHeader>
          <CardContent>
            {activeGoals.length === 0 ? <p className="text-sm text-muted-foreground">No active goals.</p> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={goalDistribution}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="label" tick={{ fontSize: 9 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip contentStyle={{ fontSize: 12 }} /><Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} /></BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Goal Status</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                <p className="text-xl font-bold text-green-700 dark:text-green-400">{goalStatusCounts.onTrack}</p>
                <p className="text-[10px] text-muted-foreground">On track</p>
              </div>
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <p className="text-xl font-bold text-destructive">{goalStatusCounts.behind}</p>
                <p className="text-[10px] text-muted-foreground">Behind</p>
              </div>
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <p className="text-xl font-bold text-destructive">{goalStatusCounts.overdue}</p>
                <p className="text-[10px] text-muted-foreground">Overdue</p>
              </div>
            </div>
            {(linkedGoals.length > 0 || manualGoals.length > 0) && (
              <div className="rounded-lg border border-border p-3 text-sm space-y-1">
                <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Insight</p>
                {linkedGoals.length > 0 && <p>Goals with linked tasks: avg <strong>{linkedAvg}%</strong> progress</p>}
                {manualGoals.length > 0 && <p>Manual-tracked goals: avg <strong>{manualAvg}%</strong> progress</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top tags */}
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Top Tags</CardTitle></CardHeader>
          <CardContent>
            {topTags.length === 0 && <p className="text-sm text-muted-foreground">No tags yet.</p>}
            <div className="space-y-2">
              {topTags.map(([tag, count]) => (
                <div key={tag} className="flex items-center justify-between">
                  <Badge variant="secondary">{tag}</Badge>
                  <div className="flex items-center gap-2 flex-1 ml-3">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${(count / (topTags[0]?.[1] || 1)) * 100}%` }} /></div>
                    <span className="text-xs text-muted-foreground w-6 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Habit adherence */}
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Habit Adherence</CardTitle></CardHeader>
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
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(adherence, 100)}%` }} /></div>
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
