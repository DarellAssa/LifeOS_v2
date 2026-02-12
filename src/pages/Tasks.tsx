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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Search, Edit2, Check, X, AlertCircle, Target, CalendarDays } from 'lucide-react';
import { Task, TaskStatus, TaskPriority, Subtask } from '@/types';
import { format, startOfWeek, addDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const priorityOrder: Record<TaskPriority, number> = { high: 0, med: 1, low: 2 };
const priorityLabel: Record<TaskPriority, string> = { high: 'High', med: 'Med', low: 'Low' };
const priorityColor: Record<TaskPriority, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  med: 'bg-primary/10 text-primary border-primary/20',
  low: 'bg-muted text-muted-foreground border-border',
};

function smartSort(tasks: Task[]): Task[] {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  return [...tasks].sort((a, b) => {
    const aOverdue = a.dueDate && a.dueDate < todayStr && a.status !== 'done' ? 0 : 1;
    const bOverdue = b.dueDate && b.dueDate < todayStr && b.status !== 'done' ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    if (a.dueDate && b.dueDate) { const diff = a.dueDate.localeCompare(b.dueDate); if (diff !== 0) return diff; }
    if (!a.dueDate && b.dueDate) return 1;
    if (a.dueDate && !b.dueDate) return -1;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

// ── Schedule Mini Modal ─────────────────────────────────────────────
function ScheduleModal({ taskId, taskTitle, onClose }: { taskId: string; taskTitle: string; onClose: () => void }) {
  const { createFocusBlockFromTask } = useAppContext();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [duration, setDuration] = useState('30');

  const handleSchedule = () => {
    createFocusBlockFromTask(taskId, new Date(date).toISOString(), parseInt(duration));
    onClose();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Schedule "<strong>{taskTitle}</strong>"</p>
      <div><Label>Date & Time</Label><Input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} /></div>
      <div><Label>Duration</Label>
        <Select value={duration} onValueChange={setDuration}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="15">15 minutes</SelectItem>
            <SelectItem value="30">30 minutes</SelectItem>
            <SelectItem value="60">1 hour</SelectItem>
            <SelectItem value="90">1.5 hours</SelectItem>
            <SelectItem value="120">2 hours</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSchedule}>Schedule</Button>
      </div>
    </div>
  );
}

// ── Task Form ───────────────────────────────────────────────────────
function TaskForm({ onSave, onClose, initial, goals }: {
  onSave: (t: Omit<Task, 'id' | 'createdAt' | 'completedAt'>) => void;
  onClose: () => void;
  initial?: Task;
  goals: { id: string; title: string }[];
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 'med');
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? 'todo');
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '');
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '');
  const [project, setProject] = useState(initial?.project ?? '');
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>(initial?.estimatedMinutes?.toString() ?? '');
  const [goalId, setGoalId] = useState(initial?.goalId ?? 'none');
  const [subtasks, setSubtasks] = useState<Subtask[]>(initial?.subtasks ?? []);
  const [newSubtask, setNewSubtask] = useState('');

  const addSubtask = () => { if (!newSubtask.trim()) return; setSubtasks(prev => [...prev, { id: crypto.randomUUID(), title: newSubtask.trim(), done: false }]); setNewSubtask(''); };
  const removeSubtask = (id: string) => setSubtasks(prev => prev.filter(s => s.id !== id));
  const toggleSubtask = (id: string) => setSubtasks(prev => prev.map(s => s.id === id ? { ...s, done: !s.done } : s));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(), description: description || undefined, priority, status,
      dueDate: dueDate || undefined, tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      project: project || undefined, estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : undefined,
      goalId: goalId !== 'none' ? goalId : undefined, subtasks, recurring: initial?.recurring,
      scheduledStart: initial?.scheduledStart, scheduledEnd: initial?.scheduledEnd,
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div><Label>Title *</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title" autoFocus /></div>
      <div><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Priority</Label>
          <Select value={priority} onValueChange={v => setPriority(v as TaskPriority)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="med">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label>Status</Label>
          <Select value={status} onValueChange={v => setStatus(v as TaskStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todo">To Do</SelectItem><SelectItem value="doing">In Progress</SelectItem><SelectItem value="done">Done</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Due Date</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
        <div><Label>Goal</Label>
          <Select value={goalId} onValueChange={setGoalId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No goal</SelectItem>
              {goals.map(g => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Project</Label><Input value={project} onChange={e => setProject(e.target.value)} placeholder="Optional" /></div>
        <div><Label>Tags (comma separated)</Label><Input value={tags} onChange={e => setTags(e.target.value)} placeholder="work, urgent" /></div>
      </div>
      <div><Label>Estimated Minutes</Label><Input type="number" min={0} value={estimatedMinutes} onChange={e => setEstimatedMinutes(e.target.value)} placeholder="e.g. 30" /></div>
      {/* Subtasks */}
      <div>
        <Label>Subtasks</Label>
        <div className="space-y-1 mt-1">
          {subtasks.map(st => (
            <div key={st.id} className="flex items-center gap-2 text-sm">
              <button type="button" onClick={() => toggleSubtask(st.id)}
                className={`h-4 w-4 rounded border shrink-0 flex items-center justify-center ${st.done ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground'}`}>
                {st.done && <Check className="h-3 w-3" />}
              </button>
              <span className={st.done ? 'line-through text-muted-foreground' : ''}>{st.title}</span>
              <button type="button" onClick={() => removeSubtask(st.id)} className="ml-auto text-destructive"><X className="h-3 w-3" /></button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Input value={newSubtask} onChange={e => setNewSubtask(e.target.value)} placeholder="Add subtask…"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }} className="h-8 text-sm" />
            <Button type="button" size="sm" variant="ghost" onClick={addSubtask} className="h-8 px-2"><Plus className="h-3 w-3" /></Button>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit">{initial ? 'Update' : 'Create'} Task</Button>
      </div>
    </form>
  );
}

// ── Main Tasks Page ─────────────────────────────────────────────────
export default function Tasks() {
  const { data, addTask, updateTask, deleteTask, toggleTaskDone, changeTaskStatus, getOverdueTasks, getOrCreateCurrentWeekPlan, addWeeklyPlan, updateWeeklyPlan, linkTaskToGoal, unlinkTaskFromGoal, getActiveGoals } = useAppContext();
  const navigate = useNavigate();
  const [tab, setTab] = useState('list');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterDue, setFilterDue] = useState<string>('all');
  const [filterGoal, setFilterGoal] = useState<string>('all');
  const [filterScheduled, setFilterScheduled] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [scheduleTaskId, setScheduleTaskId] = useState<string | null>(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEndStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

  const overdueTasks = getOverdueTasks();
  const currentPlan = getOrCreateCurrentWeekPlan();
  const activeGoals = getActiveGoals();

  const filtered = useMemo(() => {
    let t = data.tasks;
    if (search) { const q = search.toLowerCase(); t = t.filter(x => x.title.toLowerCase().includes(q) || x.tags.some(tag => tag.toLowerCase().includes(q)) || (x.project?.toLowerCase().includes(q))); }
    if (filterStatus !== 'all') t = t.filter(x => x.status === filterStatus);
    if (filterPriority !== 'all') t = t.filter(x => x.priority === filterPriority);
    if (filterGoal === 'none') t = t.filter(x => !x.goalId);
    else if (filterGoal !== 'all') t = t.filter(x => x.goalId === filterGoal);
    if (filterDue === 'today') t = t.filter(x => x.dueDate === todayStr);
    else if (filterDue === 'week') t = t.filter(x => x.dueDate && x.dueDate >= weekStartStr && x.dueDate <= weekEndStr);
    else if (filterDue === 'overdue') t = t.filter(x => x.status !== 'done' && x.dueDate && x.dueDate < todayStr);
    if (filterScheduled === 'scheduled') t = t.filter(x => !!x.scheduledStart);
    else if (filterScheduled === 'unscheduled') t = t.filter(x => !x.scheduledStart);
    return smartSort(t);
  }, [data.tasks, filterStatus, filterPriority, filterDue, filterGoal, filterScheduled, search, todayStr, weekStartStr, weekEndStr]);

  const handleSave = (taskData: Omit<Task, 'id' | 'createdAt' | 'completedAt'>) => {
    if (editingTask) {
      const completedAt = taskData.status === 'done' && editingTask.status !== 'done' ? new Date().toISOString() : editingTask.completedAt;
      updateTask(editingTask.id, { ...taskData, completedAt });
      if (taskData.goalId !== editingTask.goalId) {
        if (editingTask.goalId) unlinkTaskFromGoal(editingTask.id);
        if (taskData.goalId) linkTaskToGoal(editingTask.id, taskData.goalId);
      }
    } else {
      const newId = crypto.randomUUID();
      addTask({ ...taskData, id: newId, createdAt: new Date().toISOString(), completedAt: undefined });
      if (taskData.goalId) {
        setTimeout(() => linkTaskToGoal(newId, taskData.goalId!), 0);
      }
    }
    setEditingTask(undefined);
  };

  const handlePlanOverdue = () => {
    const ids = overdueTasks.map(t => t.id);
    const plan = getOrCreateCurrentWeekPlan();
    const merged = [...new Set([...plan.committedTaskIds, ...ids])];
    if (data.weeklyPlans.some(p => p.id === plan.id)) { updateWeeklyPlan(plan.id, { committedTaskIds: merged }); }
    else { addWeeklyPlan({ ...plan, committedTaskIds: merged }); }
    navigate('/planning');
  };

  const handleDragStart = (taskId: string) => setDraggedTaskId(taskId);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (status: TaskStatus) => { if (draggedTaskId) { changeTaskStatus(draggedTaskId, status); setDraggedTaskId(null); } };
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const kanbanStatuses: { key: TaskStatus; label: string }[] = [{ key: 'todo', label: 'To Do' }, { key: 'doing', label: 'In Progress' }, { key: 'done', label: 'Done' }];
  const openEdit = (task: Task) => { setEditingTask(task); setDialogOpen(true); };
  const goalTitles = useMemo(() => { const map: Record<string, string> = {}; data.goals.forEach(g => { map[g.id] = g.title; }); return map; }, [data.goals]);

  const scheduleTask = scheduleTaskId ? data.tasks.find(t => t.id === scheduleTaskId) : null;

  if (data.tasks.length === 0) {
    return (
      <div className="max-w-6xl mx-auto flex flex-col items-center justify-center py-24 space-y-4">
        <div className="rounded-full bg-muted p-6"><Plus className="h-8 w-8 text-muted-foreground" /></div>
        <h2 className="text-xl font-semibold">No tasks yet</h2>
        <p className="text-muted-foreground text-sm">Create your first task to get started.</p>
        <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) setEditingTask(undefined); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add your first task</Button></DialogTrigger>
          <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
            <TaskForm onSave={handleSave} onClose={() => { setDialogOpen(false); setEditingTask(undefined); }} goals={activeGoals.map(g => ({ id: g.id, title: g.title }))} />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) setEditingTask(undefined); }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Task</Button></DialogTrigger>
          <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{editingTask ? 'Edit Task' : 'New Task'}</DialogTitle></DialogHeader>
            <TaskForm initial={editingTask} onSave={handleSave} onClose={() => { setDialogOpen(false); setEditingTask(undefined); }} goals={activeGoals.map(g => ({ id: g.id, title: g.title }))} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="overdue" className="relative">
              Overdue{overdueTasks.length > 0 && <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">{overdueTasks.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
          </TabsList>
          {tab === 'list' && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…" className="pl-8 h-8 w-48 text-sm" />
            </div>
          )}
        </div>

        {tab === 'list' && (
          <div className="flex gap-2 mt-3 flex-wrap">
            <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="todo">To Do</SelectItem><SelectItem value="doing">Doing</SelectItem><SelectItem value="done">Done</SelectItem></SelectContent></Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}><SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Priority</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="med">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent></Select>
            <Select value={filterDue} onValueChange={setFilterDue}><SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Dates</SelectItem><SelectItem value="today">Today</SelectItem><SelectItem value="week">This Week</SelectItem><SelectItem value="overdue">Overdue</SelectItem></SelectContent></Select>
            <Select value={filterGoal} onValueChange={setFilterGoal}><SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Goals</SelectItem><SelectItem value="none">No Goal</SelectItem>{activeGoals.map(g => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}</SelectContent></Select>
            <Select value={filterScheduled} onValueChange={setFilterScheduled}><SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Schedule</SelectItem><SelectItem value="scheduled">Scheduled</SelectItem><SelectItem value="unscheduled">Not Scheduled</SelectItem></SelectContent></Select>
          </div>
        )}

        {/* LIST VIEW */}
        <TabsContent value="list" className="mt-3">
          <div className="space-y-1">
            {filtered.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No tasks match your filters.</p>}
            {filtered.map(task => (
              <TaskRow key={task.id} task={task} todayStr={todayStr} committedIds={currentPlan.committedTaskIds} goalTitle={task.goalId ? goalTitles[task.goalId] : undefined}
                onToggle={() => toggleTaskDone(task.id)} onEdit={() => openEdit(task)} onDelete={() => deleteTask(task.id)} onSchedule={() => setScheduleTaskId(task.id)} />
            ))}
          </div>
        </TabsContent>

        {/* KANBAN VIEW */}
        <TabsContent value="kanban" className="mt-3">
          <div className="grid grid-cols-3 gap-4">
            {kanbanStatuses.map(({ key, label }) => {
              const colTasks = smartSort(data.tasks.filter(t => t.status === key));
              return (
                <div key={key} className="space-y-2" onDragOver={handleDragOver} onDrop={() => handleDrop(key)}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold">{label}</h3>
                    <Badge variant="secondary" className="text-[10px]">{colTasks.length}</Badge>
                  </div>
                  <div className="space-y-2 min-h-[200px] rounded-lg border border-dashed border-border p-2">
                    {colTasks.map(task => (
                      <Card key={task.id} draggable onDragStart={() => handleDragStart(task.id)} className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium leading-tight">{task.title}</p>
                            <div className="flex gap-1 shrink-0">
                              {key !== 'done' && <button onClick={() => toggleTaskDone(task.id)} className="text-muted-foreground hover:text-primary"><Check className="h-3.5 w-3.5" /></button>}
                              <button onClick={() => openEdit(task)} className="text-muted-foreground hover:text-primary"><Edit2 className="h-3.5 w-3.5" /></button>
                              {key !== 'done' && <button onClick={() => setScheduleTaskId(task.id)} className="text-muted-foreground hover:text-primary"><CalendarDays className="h-3.5 w-3.5" /></button>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge className={`text-[10px] border ${priorityColor[task.priority]}`}>{priorityLabel[task.priority]}</Badge>
                            {task.dueDate && <span className={`text-[10px] ${task.dueDate < todayStr && task.status !== 'done' ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>{task.dueDate}</span>}
                            {task.goalId && goalTitles[task.goalId] && <Badge variant="secondary" className="text-[8px]"><Target className="h-2 w-2 mr-0.5" />{goalTitles[task.goalId]}</Badge>}
                            {task.scheduledStart && <Badge variant="secondary" className="text-[8px]"><CalendarDays className="h-2 w-2 mr-0.5" />Scheduled</Badge>}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* OVERDUE VIEW */}
        <TabsContent value="overdue" className="mt-3">
          {overdueTasks.length === 0 ? (
            <div className="text-center py-12">
              <div className="rounded-full bg-primary/10 p-4 inline-block mb-3"><Check className="h-6 w-6 text-primary" /></div>
              <h3 className="font-semibold">All caught up!</h3>
              <p className="text-sm text-muted-foreground mt-1">No overdue tasks.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{overdueTasks.length} overdue task{overdueTasks.length !== 1 ? 's' : ''}</p>
                <Button size="sm" variant="outline" onClick={handlePlanOverdue}><AlertCircle className="h-3.5 w-3.5 mr-1" /> Plan these for this week</Button>
              </div>
              {smartSort(overdueTasks).map(task => (
                <TaskRow key={task.id} task={task} todayStr={todayStr} committedIds={currentPlan.committedTaskIds} goalTitle={task.goalId ? goalTitles[task.goalId] : undefined}
                  onToggle={() => toggleTaskDone(task.id)} onEdit={() => openEdit(task)} onDelete={() => deleteTask(task.id)} onSchedule={() => setScheduleTaskId(task.id)} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* WEEK VIEW */}
        <TabsContent value="week" className="mt-3">
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map(day => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const dayTasks = data.tasks.filter(t => t.dueDate === dayStr);
              const isToday = dayStr === todayStr;
              return (
                <div key={dayStr} className={`rounded-lg border p-2.5 min-h-[200px] ${isToday ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
                  <p className={`text-xs font-medium mb-2 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>{format(day, 'EEE d')}</p>
                  <div className="space-y-1">
                    {dayTasks.map(task => (
                      <div key={task.id} className={`text-xs p-1.5 rounded cursor-pointer hover:bg-muted transition-colors ${task.status === 'done' ? 'line-through text-muted-foreground' : ''} bg-muted/50`} onClick={() => openEdit(task)}>
                        <span>{task.title}</span>
                        {currentPlan.committedTaskIds.includes(task.id) && <Badge variant="secondary" className="text-[8px] ml-1 h-3">committed</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Schedule dialog */}
      <Dialog open={!!scheduleTaskId} onOpenChange={o => { if (!o) setScheduleTaskId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Schedule Task</DialogTitle></DialogHeader>
          {scheduleTask && <ScheduleModal taskId={scheduleTask.id} taskTitle={scheduleTask.title} onClose={() => setScheduleTaskId(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Task Row ────────────────────────────────────────────────────────
function TaskRow({ task, todayStr, committedIds, goalTitle, onToggle, onEdit, onDelete, onSchedule }: {
  task: Task; todayStr: string; committedIds: string[]; goalTitle?: string;
  onToggle: () => void; onEdit: () => void; onDelete: () => void; onSchedule: () => void;
}) {
  const isOverdue = task.dueDate && task.dueDate < todayStr && task.status !== 'done';
  return (
    <div className="flex items-center gap-3 rounded-md border border-border p-3 hover:bg-muted/30 transition-colors group">
      <button onClick={onToggle}
        className={`h-4 w-4 rounded border shrink-0 flex items-center justify-center transition-colors ${task.status === 'done' ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground hover:border-primary'}`}>
        {task.status === 'done' && <Check className="h-3 w-3" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
          {committedIds.includes(task.id) && <Badge variant="secondary" className="text-[8px] h-3.5">committed</Badge>}
          {goalTitle && <Badge variant="secondary" className="text-[8px] h-3.5"><Target className="h-2 w-2 mr-0.5 inline" />{goalTitle}</Badge>}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {task.dueDate && <span className={`text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>{isOverdue ? '⚠ ' : ''}{task.dueDate}</span>}
          {task.scheduledStart && <span className="text-xs text-muted-foreground">📅 {format(new Date(task.scheduledStart), 'h:mm a')}</span>}
          {task.project && <span className="text-xs text-muted-foreground">· {task.project}</span>}
          {task.tags.map(tag => <Badge key={tag} variant="secondary" className="text-[10px] h-4">{tag}</Badge>)}
          {task.subtasks.length > 0 && <span className="text-[10px] text-muted-foreground">{task.subtasks.filter(s => s.done).length}/{task.subtasks.length} subtasks</span>}
        </div>
      </div>
      <Badge className={`text-[10px] shrink-0 border ${priorityColor[task.priority]}`}>{priorityLabel[task.priority]}</Badge>
      <Badge variant="secondary" className="text-[10px] shrink-0 capitalize">{task.status === 'doing' ? 'in progress' : task.status}</Badge>
      {task.status !== 'done' && <button onClick={onSchedule} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" title="Schedule"><CalendarDays className="h-3.5 w-3.5" /></button>}
      <button onClick={onEdit} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 className="h-3.5 w-3.5" /></button>
      <button onClick={onDelete} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  );
}
