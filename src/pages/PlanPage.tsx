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
    high: 'bg-[hsl(var(--attention))]',
    med: 'bg-primary/40',
    low: 'bg-muted-foreground/25',
  };

  const segmentLabel: Record<Segment, string> = {
    today: "Today's tasks",
    upcoming: 'Upcoming tasks',
    all: 'All tasks',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Plan</h1>
          <p className="text-xs text-muted-foreground">Tasks & schedule in one place</p>
        </div>
        <Button size="sm" onClick={() => document.getElementById('plan-quick-add')?.focus()} className="gap-2">
          <Plus className="h-4 w-4" /> Add Task
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left: Tasks card */}
        <div className="lg:col-span-2 space-y-4">
          {/* Segmented control */}
          <div className="flex gap-0.5 rounded-xl bg-muted p-1">
            {(['today', 'upcoming', 'all'] as Segment[]).map(s => (
              <button
                key={s}
                onClick={() => setSegment(s)}
                className={`flex-1 px-3 py-1.5 text-sm rounded-[10px] capitalize transition-all duration-150 ${
                  segment === s
                    ? 'bg-card text-foreground font-medium shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Task list card */}
          <div className="surface-1 overflow-hidden">
            {/* Card header with quick add */}
            <div className="px-4 pt-4 pb-3 border-b border-border/40">
              <p className="section-label mb-3">{segmentLabel[segment]}</p>
              <form onSubmit={e => { e.preventDefault(); handleQuickAdd(); }} className="flex gap-2">
                <Input
                  id="plan-quick-add"
                  value={quickTitle}
                  onChange={e => setQuickTitle(e.target.value)}
                  placeholder="Add a task…"
                  className="flex-1 h-9 text-sm"
                />
                <Button type="submit" size="sm" disabled={!quickTitle.trim()} className="h-9">Add</Button>
              </form>
            </div>

            {/* Task rows */}
            {filteredTasks.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                {segment === 'today' ? 'Nothing due today. Enjoy!' : 'No tasks found.'}
              </div>
            ) : (
              <div>
                {filteredTasks.map((task, i) => (
                  <div key={task.id} className={`flex items-center gap-3 px-4 py-2.5 group row-hover ${i > 0 ? 'border-t border-border/30' : ''}`}>
                    <button
                      onClick={() => toggleTaskDone(task.id)}
                      className="h-[16px] w-[16px] rounded border border-border shrink-0 flex items-center justify-center hover:border-primary transition-colors"
                    >
                      {task.status === 'done' && <div className="h-2 w-2 rounded-sm bg-primary" />}
                    </button>
                    <span className={`text-sm flex-1 truncate ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                      {task.title}
                    </span>
                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${priorityDot[task.priority] || 'bg-muted-foreground/25'}`} />
                    {task.dueDate && (
                      <span className={`text-[11px] shrink-0 tabular-nums ${task.dueDate < todayStr ? 'text-[hsl(var(--attention))] font-medium' : 'text-muted-foreground'}`}>
                        {task.dueDate === todayStr ? 'Today' : format(parseISO(task.dueDate), 'MMM d')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            {data.tasks.filter(t => t.status !== 'done').length > 12 && (
              <div className="px-4 py-3 border-t border-border/40">
                <button onClick={() => navigate('/tasks')} className="text-xs text-primary hover:underline flex items-center gap-1">
                  View all tasks <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Schedule rail */}
        <div className="hidden lg:block space-y-4">
          <div className="surface-1 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
              <p className="section-label">Today's Schedule</p>
              <button onClick={() => navigate('/calendar')} className="text-[11px] text-primary hover:underline">Calendar</button>
            </div>

            {todayAgenda.length === 0 ? (
              <div className="py-10 text-center space-y-2.5 px-4">
                <Calendar className="h-5 w-5 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">Nothing scheduled</p>
                <Button size="sm" variant="ghost" onClick={() => navigate('/calendar')} className="text-xs">
                  Open calendar
                </Button>
              </div>
            ) : (
              <div>
                {todayAgenda.slice(0, 6).map((item, i) => (
                  <div key={item.id} className={`flex items-center gap-2.5 px-4 py-2.5 row-hover ${i > 0 ? 'border-t border-border/30' : ''}`}>
                    <div className="h-1.5 w-1.5 rounded-full bg-primary/40 shrink-0" />
                    <span className="text-sm flex-1 truncate">{item.title}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      {format(new Date(item.startDateTime), 'h:mm a')}
                    </span>
                  </div>
                ))}
                {todayAgenda.length > 6 && (
                  <div className="px-4 py-2.5 border-t border-border/30">
                    <button onClick={() => navigate('/calendar')} className="text-xs text-primary hover:underline flex items-center gap-1">
                      +{todayAgenda.length - 6} more <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
