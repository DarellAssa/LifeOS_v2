import { useState, useMemo } from 'react';
import { useAppContext } from '@/store/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { format, startOfWeek, addDays } from 'date-fns';
import { Plus, AlertCircle, Trophy, Target, Check } from 'lucide-react';
import { Task } from '@/types';
import { toast } from '@/hooks/use-toast';

const priorityColor: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  med: 'bg-primary/10 text-primary border-primary/20',
  low: 'bg-muted text-muted-foreground border-border',
};

export default function Planning() {
  const { data, addTask, addWeeklyPlan, updateWeeklyPlan, getOrCreateCurrentWeekPlan, getOverdueTasks } = useAppContext();

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');
  const weekLabel = `${format(weekStart, 'MMM d')} — ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`;

  // Get or create current week plan
  const currentPlan = getOrCreateCurrentWeekPlan();
  const planExists = data.weeklyPlans.some(p => p.id === currentPlan.id);
  const committedIds = currentPlan.committedTaskIds;

  const overdueTasks = getOverdueTasks();
  const nonOverdueCarryover = overdueTasks.filter(t => !committedIds.includes(t.id));

  // Committed tasks
  const committedTasks = data.tasks.filter(t => committedIds.includes(t.id));
  const committedDone = committedTasks.filter(t => t.status === 'done').length;
  const committedTotal = committedTasks.length;
  const completionPct = committedTotal > 0 ? Math.round((committedDone / committedTotal) * 100) : 0;

  // Selectable tasks (not yet committed, not done)
  const selectableTasks = data.tasks.filter(t => t.status !== 'done' && !committedIds.includes(t.id));

  // Inline new task
  const [newTitle, setNewTitle] = useState('');

  const savePlan = (ids: string[]) => {
    if (planExists) {
      updateWeeklyPlan(currentPlan.id, { committedTaskIds: ids });
    } else {
      addWeeklyPlan({ ...currentPlan, committedTaskIds: ids });
    }
  };

  const commitTask = (taskId: string) => {
    if (committedIds.length >= 10) {
      toast({ title: 'Max 10 tasks', description: 'You can commit up to 10 tasks per week.', variant: 'destructive' });
      return;
    }
    savePlan([...committedIds, taskId]);
    toast({ title: 'Task committed to this week' });
  };

  const uncommitTask = (taskId: string) => {
    savePlan(committedIds.filter(id => id !== taskId));
  };

  const handleInlineAdd = () => {
    if (!newTitle.trim()) return;
    const task: Task = {
      id: crypto.randomUUID(), title: newTitle.trim(), status: 'todo', priority: 'med',
      dueDate: weekStartStr, createdAt: new Date().toISOString(), tags: [], subtasks: [],
    };
    addTask(task);
    const newIds = [...committedIds, task.id];
    savePlan(newIds);
    setNewTitle('');
  };

  const commitOverdue = (taskId: string) => commitTask(taskId);
  const commitAllOverdue = () => {
    const remaining = 10 - committedIds.length;
    const toAdd = nonOverdueCarryover.slice(0, remaining).map(t => t.id);
    savePlan([...committedIds, ...toAdd]);
    toast({ title: `${toAdd.length} overdue task${toAdd.length !== 1 ? 's' : ''} added` });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Weekly Planning</h1>
        <p className="text-sm text-muted-foreground mt-1">{weekLabel}</p>
      </div>

      {/* Scoreboard */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">{committedDone}/{committedTotal}</p>
            <p className="text-xs text-muted-foreground mt-1">Committed done</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">{completionPct}%</p>
            <p className="text-xs text-muted-foreground mt-1">Completion rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-destructive">{overdueTasks.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Overdue</p>
          </CardContent>
        </Card>
      </div>

      {/* Committed tasks */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Commit to this week
            </CardTitle>
            <Badge variant="secondary">{committedIds.length}/10</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {committedTasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks committed yet. Select tasks below or create one inline.</p>}
          {committedTasks.map(task => (
            <div key={task.id} className="flex items-center gap-3 rounded-md border border-border p-2.5">
              <div className={`h-2 w-2 rounded-full shrink-0 ${task.status === 'done' ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
              <span className={`text-sm flex-1 ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</span>
              <Badge className={`text-[10px] border ${priorityColor[task.priority]}`}>{task.priority}</Badge>
              {task.status === 'done' && <Check className="h-3.5 w-3.5 text-primary" />}
              <button onClick={() => uncommitTask(task.id)} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
            </div>
          ))}

          {/* Inline add */}
          <div className="flex items-center gap-2 pt-2 border-t border-border mt-2">
            <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Quick add task…"
              onKeyDown={e => { if (e.key === 'Enter') handleInlineAdd(); }}
              className="h-8 text-sm" />
            <Button size="sm" variant="secondary" onClick={handleInlineAdd} disabled={committedIds.length >= 10} className="h-8 shrink-0">
              <Plus className="h-3 w-3 mr-1" /> Add & Commit
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Select from existing */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select existing tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 max-h-[300px] overflow-y-auto">
          {selectableTasks.length === 0 && <p className="text-sm text-muted-foreground">All tasks are committed or completed!</p>}
          {selectableTasks.map(task => (
            <label key={task.id} className="flex items-center gap-3 rounded-md border border-border p-2.5 cursor-pointer hover:bg-muted/30 transition-colors">
              <Checkbox checked={false} onCheckedChange={() => commitTask(task.id)} disabled={committedIds.length >= 10} />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{task.title}</p>
                {task.dueDate && <p className="text-[10px] text-muted-foreground">{task.dueDate}</p>}
              </div>
              <Badge className={`text-[10px] border ${priorityColor[task.priority]}`}>{task.priority}</Badge>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Carryover / Overdue */}
      {nonOverdueCarryover.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" /> Carryover / Overdue
              </CardTitle>
              <Button size="sm" variant="outline" onClick={commitAllOverdue}>Add all to plan</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {nonOverdueCarryover.map(task => (
              <div key={task.id} className="flex items-center gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-2.5">
                <span className="text-sm flex-1">{task.title}</span>
                <span className="text-[10px] text-destructive">{task.dueDate}</span>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => commitOverdue(task.id)}>+ Commit</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
