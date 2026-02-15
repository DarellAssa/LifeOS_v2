import { useState, useMemo } from 'react';
import { useAppContext } from '@/store/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Calendar, ChevronRight } from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';

type Segment = 'today' | 'upcoming' | 'all';

export default function PlanPage() {
  const { data, addTask, toggleTaskDone, getTodayTasks, getOverdueTasks, getAgendaForDay } = useAppContext();
  const navigate = useNavigate();
  const [segment, setSegment] = useState<Segment>('today');
  const [quickTitle, setQuickTitle] = useState('');
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayAgenda = useMemo(() => getAgendaForDay(todayStr), [getAgendaForDay, todayStr]);

  const todayTasks = getTodayTasks();
  const overdue = getOverdueTasks();

  const filteredTasks = useMemo(() => {
    const active = data.tasks.filter(t => t.status !== 'done');
    if (segment === 'today') {
      const combined = [...todayTasks, ...overdue.filter(t => !todayTasks.find(tt => tt.id === t.id))];
      return combined.filter(t => t.status !== 'done').slice(0, 12);
    }
    if (segment === 'upcoming') {
      const nextWeek = format(addDays(new Date(), 7), 'yyyy-MM-dd');
      return active.filter(t => t.dueDate && t.dueDate > todayStr && t.dueDate <= nextWeek).slice(0, 12);
    }
    return active.slice(0, 12);
  }, [segment, data.tasks, todayTasks, overdue, todayStr]);

  const handleQuickAdd = () => {
    if (!quickTitle.trim()) return;
    addTask({
      id: crypto.randomUUID(),
      title: quickTitle.trim(),
      status: 'todo',
      priority: 'med',
      dueDate: todayStr,
      createdAt: new Date().toISOString(),
      tags: [],
      subtasks: [],
    });
    setQuickTitle('');
  };

  const priorityDot: Record<string, string> = {
    high: 'bg-destructive',
    med: 'bg-warning',
    low: 'bg-muted-foreground/40',
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plan</h1>
          <p className="text-sm text-muted-foreground">Tasks & schedule in one place</p>
        </div>
        <Button onClick={() => document.getElementById('plan-quick-add')?.focus()} className="gap-2">
          <Plus className="h-4 w-4" /> Add Task
        </Button>
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Left: Tasks */}
        <div className="lg:col-span-3 space-y-4">
          {/* Segmented control */}
          <div className="flex gap-1 rounded-lg bg-secondary p-1">
            {(['today', 'upcoming', 'all'] as Segment[]).map(s => (
              <button
                key={s}
                onClick={() => setSegment(s)}
                className={`flex-1 px-3 py-1.5 text-sm rounded-md capitalize transition-colors ${
                  segment === s ? 'bg-card text-foreground font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Quick add */}
          <form onSubmit={e => { e.preventDefault(); handleQuickAdd(); }} className="flex gap-2">
            <Input
              id="plan-quick-add"
              value={quickTitle}
              onChange={e => setQuickTitle(e.target.value)}
              placeholder="Add a task…"
              className="flex-1"
            />
            <Button type="submit" size="sm" disabled={!quickTitle.trim()}>Add</Button>
          </form>

          {/* Task list */}
          <div className="divide-y divide-border">
            {filteredTasks.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground">
                {segment === 'today' ? 'Nothing due today. Enjoy!' : 'No tasks found.'}
              </div>
            )}
            {filteredTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 px-2 py-3 group">
                <button
                  onClick={() => toggleTaskDone(task.id)}
                  className="h-4 w-4 rounded border border-border shrink-0 flex items-center justify-center hover:border-primary transition-colors"
                >
                  {task.status === 'done' && <div className="h-2 w-2 rounded-sm bg-primary" />}
                </button>
                <span className={`text-sm flex-1 ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                  {task.title}
                </span>
                <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${priorityDot[task.priority] || 'bg-muted-foreground/40'}`} />
                {task.dueDate && (
                  <span className={`text-xs shrink-0 ${task.dueDate < todayStr ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {task.dueDate === todayStr ? 'Today' : format(parseISO(task.dueDate), 'MMM d')}
                  </span>
                )}
              </div>
            ))}
          </div>

          {data.tasks.filter(t => t.status !== 'done').length > 12 && (
            <button onClick={() => navigate('/tasks')} className="text-sm text-primary hover:underline flex items-center gap-1">
              View all tasks <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Right: Schedule */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Today's Schedule</h2>
            <button onClick={() => navigate('/calendar')} className="text-xs text-primary hover:underline">Open calendar</button>
          </div>

          {todayAgenda.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nothing scheduled today
            </div>
          ) : (
            <div className="divide-y divide-border">
              {todayAgenda.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center gap-3 py-2.5 px-1">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm">{item.title}</span>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(item.startDateTime), 'h:mm a')} – {format(new Date(item.endDateTime), 'h:mm a')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {todayAgenda.length > 5 && (
            <button onClick={() => navigate('/calendar')} className="text-sm text-primary hover:underline flex items-center gap-1">
              +{todayAgenda.length - 5} more <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
