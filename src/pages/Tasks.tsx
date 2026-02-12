import { useState, useMemo } from 'react';
import { useAppContext } from '@/store/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, List, Columns, Calendar, AlertCircle, Trash2, Star } from 'lucide-react';
import { Task, TaskStatus, TaskPriority } from '@/types';
import { format, isBefore, startOfDay, startOfWeek, endOfWeek, addDays, isWithinInterval } from 'date-fns';

type ViewMode = 'list' | 'kanban' | 'week' | 'overdue';

const priorityOrder: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

function smartSort(tasks: Task[]): Task[] {
  const now = startOfDay(new Date());
  return [...tasks].sort((a, b) => {
    const aOverdue = a.dueDate && isBefore(new Date(a.dueDate), now) ? 0 : 1;
    const bOverdue = b.dueDate && isBefore(new Date(b.dueDate), now) ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    if (a.dueDate && b.dueDate) {
      const diff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (diff !== 0) return diff;
    }
    if (!a.dueDate && b.dueDate) return 1;
    if (a.dueDate && !b.dueDate) return -1;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

function TaskForm({ onSave, onClose, initial }: { onSave: (t: Omit<Task, 'id' | 'createdAt' | 'completedAt'>) => void; onClose: () => void; initial?: Task }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 'medium');
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? 'todo');
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '');
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '');
  const [project, setProject] = useState(initial?.project ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(), description, priority, status, dueDate: dueDate || null,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean), project,
      estimatedMinutes: null, recurring: null, goalId: null,
      subtasks: initial?.subtasks ?? [], isTodayFocus: initial?.isTodayFocus ?? false,
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title" autoFocus /></div>
      <div><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" rows={2} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Priority</Label>
          <Select value={priority} onValueChange={v => setPriority(v as TaskPriority)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label>Status</Label>
          <Select value={status} onValueChange={v => setStatus(v as TaskStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todo">To Do</SelectItem><SelectItem value="doing">Doing</SelectItem><SelectItem value="done">Done</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Due Date</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
        <div><Label>Project</Label><Input value={project} onChange={e => setProject(e.target.value)} placeholder="Optional" /></div>
      </div>
      <div><Label>Tags (comma separated)</Label><Input value={tags} onChange={e => setTags(e.target.value)} placeholder="work, urgent" /></div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}

export default function Tasks() {
  const { data, addTask, updateTask, deleteTask } = useAppContext();
  const [view, setView] = useState<ViewMode>('list');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();

  const now = startOfDay(new Date());
  const filtered = useMemo(() => {
    let t = data.tasks;
    if (filterStatus !== 'all') t = t.filter(x => x.status === filterStatus);
    if (filterPriority !== 'all') t = t.filter(x => x.priority === filterPriority);
    if (view === 'overdue') t = t.filter(x => x.status !== 'done' && x.dueDate && isBefore(new Date(x.dueDate), now));
    return smartSort(t);
  }, [data.tasks, filterStatus, filterPriority, view]);

  const handleSave = (taskData: Omit<Task, 'id' | 'createdAt' | 'completedAt'>) => {
    if (editingTask) {
      const completedAt = taskData.status === 'done' && editingTask.status !== 'done' ? new Date().toISOString() : editingTask.completedAt;
      updateTask(editingTask.id, { ...taskData, completedAt });
    } else {
      addTask({ ...taskData, id: crypto.randomUUID(), createdAt: new Date().toISOString(), completedAt: null });
    }
    setEditingTask(undefined);
  };

  const toggleDone = (task: Task) => {
    if (task.status === 'done') {
      updateTask(task.id, { status: 'todo', completedAt: null });
    } else {
      updateTask(task.id, { status: 'done', completedAt: new Date().toISOString() });
    }
  };

  const kanbanStatuses: TaskStatus[] = ['todo', 'doing', 'done'];

  // Week view helpers
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border">
            {([['list', List], ['kanban', Columns], ['week', Calendar], ['overdue', AlertCircle]] as const).map(([v, Icon]) => (
              <button key={v} onClick={() => setView(v)} className={`p-2 text-sm ${view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'} ${v === 'list' ? 'rounded-l-md' : v === 'overdue' ? 'rounded-r-md' : ''}`}>
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingTask(undefined); }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Task</Button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>{editingTask ? 'Edit Task' : 'New Task'}</DialogTitle></DialogHeader>
              <TaskForm initial={editingTask} onSave={handleSave} onClose={() => { setDialogOpen(false); setEditingTask(undefined); }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {view !== 'kanban' && view !== 'week' && (
        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="todo">To Do</SelectItem><SelectItem value="doing">Doing</SelectItem><SelectItem value="done">Done</SelectItem></SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Priority</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent>
          </Select>
        </div>
      )}

      {/* List / Overdue View */}
      {(view === 'list' || view === 'overdue') && (
        <div className="space-y-1">
          {filtered.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">{view === 'overdue' ? 'No overdue tasks 🎉' : 'No tasks yet. Add your first task!'}</p>}
          {filtered.map(task => (
            <div key={task.id} className="flex items-center gap-3 rounded-md border border-border p-3 hover:bg-muted/30 transition-colors group">
              <button onClick={() => toggleDone(task)} className={`h-4 w-4 rounded border shrink-0 transition-colors ${task.status === 'done' ? 'bg-primary border-primary' : 'border-muted-foreground hover:border-primary'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {task.dueDate && <span className={`text-xs ${task.dueDate && isBefore(new Date(task.dueDate), now) && task.status !== 'done' ? 'text-destructive' : 'text-muted-foreground'}`}>{task.dueDate}</span>}
                  {task.project && <span className="text-xs text-muted-foreground">· {task.project}</span>}
                  {task.tags.map(tag => <Badge key={tag} variant="secondary" className="text-[10px] h-4">{tag}</Badge>)}
                </div>
              </div>
              <Badge variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'} className="text-[10px] shrink-0">{task.priority}</Badge>
              <button onClick={() => updateTask(task.id, { isTodayFocus: !task.isTodayFocus })} className={`shrink-0 ${task.isTodayFocus ? 'text-primary' : 'text-muted-foreground opacity-0 group-hover:opacity-100'} transition-opacity`}><Star className="h-3.5 w-3.5" /></button>
              <button onClick={() => { setEditingTask(task); setDialogOpen(true); }} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity text-xs">Edit</button>
              <button onClick={() => deleteTask(task.id)} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      {/* Kanban View */}
      {view === 'kanban' && (
        <div className="grid grid-cols-3 gap-4">
          {kanbanStatuses.map(status => {
            const statusTasks = smartSort(data.tasks.filter(t => t.status === status));
            return (
              <div key={status} className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold capitalize">{status === 'todo' ? 'To Do' : status === 'doing' ? 'In Progress' : 'Done'}</h3>
                  <Badge variant="secondary" className="text-xs">{statusTasks.length}</Badge>
                </div>
                {statusTasks.map(task => (
                  <Card key={task.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setEditingTask(task); setDialogOpen(true); }}>
                    <CardContent className="p-3">
                      <p className="text-sm font-medium">{task.title}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={task.priority === 'high' ? 'destructive' : 'secondary'} className="text-[10px]">{task.priority}</Badge>
                        {task.dueDate && <span className="text-xs text-muted-foreground">{task.dueDate}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Week View */}
      {view === 'week' && (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayTasks = data.tasks.filter(t => t.dueDate === dayStr);
            const isToday = format(new Date(), 'yyyy-MM-dd') === dayStr;
            return (
              <div key={dayStr} className={`rounded-lg border p-3 min-h-[200px] ${isToday ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
                <p className={`text-xs font-medium mb-2 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>{format(day, 'EEE d')}</p>
                <div className="space-y-1">
                  {dayTasks.map(task => (
                    <div key={task.id} className={`text-xs p-1.5 rounded ${task.status === 'done' ? 'line-through text-muted-foreground' : ''} bg-muted/50`}>
                      {task.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
