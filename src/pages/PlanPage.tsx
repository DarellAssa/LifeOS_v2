import { useState, useMemo } from 'react';
import { useAppContext } from '@/store/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Calendar, ChevronRight, Clock } from 'lucide-react';
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
    high: 'bg-[hsl(var(--attention))]',
    med: 'bg-primary/50',
    low: 'bg-muted-foreground/30',
  };

  return (
    <div className="space-y-6 py-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Plan</h1>
          <p className="text-sm text-muted-foreground">Tasks & schedule in one place</p>
        </div>
        <Button onClick={() => document.getElementById('plan-quick-add')?.focus()} className="gap-2">
          <Plus className="h-4 w-4" /> Add Task
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left: Tasks */}
        <div className="lg:col-span-2 space-y-4">
          {/* Segmented control */}
          <div className="flex gap-1 rounded-xl bg-muted p-1">
            {(['today', 'upcoming', 'all'] as Segment[]).map(s => (
              <button
                key={s}
                onClick={() => setSegment(s)}
                className={`flex-1 px-3 py-1.5 text-sm rounded-lg capitalize transition-all duration-150 ${
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
              className="flex-1 rounded-xl"
            />
            <Button type="submit" size="sm" disabled={!quickTitle.trim()}>Add</Button>
          </form>

          {/* Task list */}
          <div className="surface-1 overflow-hidden">
            {filteredTasks.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground">
                {segment === 'today' ? 'Nothing due today. Enjoy!' : 'No tasks found.'}
              </div>
            )}
            {filteredTasks.map((task, i) => (
              <div key={task.id} className={`flex items-center gap-3 px-4 py-3 group row-hover ${i > 0 ? 'border-t border-border/30' : ''}`}>
                <button
                  onClick={() => toggleTaskDone(task.id)}
                  className="h-[18px] w-[18px] rounded-md border border-border/80 shrink-0 flex items-center justify-center hover:border-primary transition-colors"
                >
                  {task.status === 'done' && <div className="h-2.5 w-2.5 rounded-sm bg-primary" />}
                </button>
                <span className={`text-sm flex-1 ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                  {task.title}
                </span>
                <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${priorityDot[task.priority] || 'bg-muted-foreground/30'}`} />
                {task.dueDate && (
                  <span className={`text-xs shrink-0 tabular-nums ${task.dueDate < todayStr ? 'text-[hsl(var(--attention))]' : 'text-muted-foreground'}`}>
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

        {/* Right: Schedule rail */}
        <div className="hidden lg:block space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="section-label">Today's Schedule</h2>
              <button onClick={() => navigate('/calendar')} className="text-[11px] text-primary hover:underline">Calendar</button>
            </div>

            {todayAgenda.length === 0 ? (
              <div className="surface-2 rounded-[18px] py-10 text-center space-y-3">
                <Calendar className="h-5 w-5 text-muted-foreground/60 mx-auto" />
                <p className="text-sm text-muted-foreground">Nothing scheduled today</p>
                <Button size="sm" variant="outline" onClick={() => navigate('/calendar')} className="text-xs">
                  Open calendar
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {todayAgenda.slice(0, 5).map(item => (
                  <div key={item.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 row-hover">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{item.title}</p>
                    </div>
                    <span className="pill-chip !py-0.5 !px-2 text-[10px] tabular-nums">
                      {format(new Date(item.startDateTime), 'h:mm a')}
                    </span>
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
    </div>
  );
}
