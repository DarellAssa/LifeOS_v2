import { useState, useMemo } from 'react';
import { useAppContext } from '@/store/AppContext';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Plus, Trash2, Target, ArrowLeft, Edit2, Check, X, Link2, Unlink, AlertTriangle, Clock, CheckSquare } from 'lucide-react';
import { Goal, GoalCategory, GoalStatus, GoalDisplayStatus, Milestone, Task, ProgressType } from '@/types';
import { computeGoalProgress, getGoalDisplayStatus } from '@/lib/stats';
import { differenceInDays, format } from 'date-fns';

const categoryColors: Record<GoalCategory, string> = {
  health: 'bg-success/10 text-success border-success/20',
  career: 'bg-ai-muted text-ai border-ai/20',
  finance: 'bg-[hsl(var(--attention-muted))] text-[hsl(var(--attention-foreground))] border-[hsl(var(--attention)/0.2)]',
  study: 'bg-primary/10 text-primary border-primary/20',
  personal: 'bg-accent text-accent-foreground border-accent-foreground/20',
  custom: 'bg-muted text-muted-foreground border-border',
};

const statusColors: Record<GoalDisplayStatus, string> = {
  'On track': 'bg-success/10 text-success border-success/20',
  'Behind': 'bg-destructive/10 text-destructive border-destructive/20',
  'Overdue': 'bg-destructive/10 text-destructive border-destructive/20',
  'Not started': 'bg-muted text-muted-foreground border-border',
  'Completed': 'bg-primary/10 text-primary border-primary/20',
};

// ── Goal Form ───────────────────────────────────────────────────────
function GoalForm({ onSave, onClose, initial }: { onSave: (g: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>) => void; onClose: () => void; initial?: Goal }) {
  const { data, addTask, linkTaskToGoal } = useAppContext();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState<GoalCategory>(initial?.category ?? 'personal');
  const [startDate, setStartDate] = useState(initial?.startDate ?? format(new Date(), 'yyyy-MM-dd'));
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? '');
  const [progressType, setProgressType] = useState<ProgressType>(initial?.progressType ?? 'manual');
  const [progressValue, setProgressValue] = useState(initial?.progressValue ?? 0);
  const [milestones, setMilestones] = useState<Milestone[]>(initial?.milestones ?? []);
  const [newMilestone, setNewMilestone] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');

  const addMilestone = () => {
    if (!newMilestone.trim()) return;
    setMilestones(prev => [...prev, { id: crypto.randomUUID(), title: newMilestone.trim(), date: newMilestoneDate || undefined, done: false }]);
    setNewMilestone('');
    setNewMilestoneDate('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetDate) return;
    onSave({
      title: title.trim(), description: description || undefined, category,
      status: initial?.status ?? 'active', startDate, targetDate, progressType, progressValue,
      linkedTaskIds: initial?.linkedTaskIds ?? [], milestones,
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div><Label>Title *</Label><Input value={title} onChange={e => setTitle(e.target.value)} autoFocus /></div>
      <div><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Category</Label>
          <Select value={category} onValueChange={v => setCategory(v as GoalCategory)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{(['health','career','finance','study','personal','custom'] as const).map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Progress Type</Label>
          <Select value={progressType} onValueChange={v => setProgressType(v as ProgressType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="manual">Manual</SelectItem><SelectItem value="linked">Linked Tasks</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Start Date</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        <div><Label>Target Date *</Label><Input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} /></div>
      </div>
      {progressType === 'manual' && (
        <div>
          <Label>Progress ({progressValue}%)</Label>
          <Slider value={[progressValue]} onValueChange={v => setProgressValue(v[0])} max={100} step={1} className="mt-2" />
        </div>
      )}
      {/* Milestones */}
      <div>
        <Label>Milestones</Label>
        <div className="space-y-1 mt-1">
          {milestones.map(ms => (
            <div key={ms.id} className="flex items-center gap-2 text-sm">
              <button type="button" onClick={() => setMilestones(prev => prev.map(m => m.id === ms.id ? { ...m, done: !m.done } : m))}
                className={`h-4 w-4 rounded border shrink-0 flex items-center justify-center ${ms.done ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground'}`}>
                {ms.done && <Check className="h-3 w-3" />}
              </button>
              <span className={`flex-1 ${ms.done ? 'line-through text-muted-foreground' : ''}`}>{ms.title}</span>
              {ms.date && <span className="text-[10px] text-muted-foreground">{ms.date}</span>}
              <button type="button" onClick={() => setMilestones(prev => prev.filter(m => m.id !== ms.id))} className="text-destructive"><X className="h-3 w-3" /></button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Input value={newMilestone} onChange={e => setNewMilestone(e.target.value)} placeholder="Add milestone…"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMilestone(); } }} className="h-8 text-sm" />
            <Input type="date" value={newMilestoneDate} onChange={e => setNewMilestoneDate(e.target.value)} className="h-8 text-sm w-36" />
            <Button type="button" size="sm" variant="ghost" onClick={addMilestone} className="h-8 px-2"><Plus className="h-3 w-3" /></Button>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit">{initial ? 'Update' : 'Create'} Goal</Button>
      </div>
    </form>
  );
}

// ── Goal Detail View ────────────────────────────────────────────────
function GoalDetail({ goalId, onBack }: { goalId: string; onBack: () => void }) {
  const { data, updateGoal, deleteGoal, archiveGoal, completeGoal, linkTaskToGoal, unlinkTaskFromGoal, addTask, getGoalProgress, getGoalStatus } = useAppContext();
  const goal = data.goals.find(g => g.id === goalId);
  const [editOpen, setEditOpen] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!goal) return <div className="text-center py-12"><p className="text-muted-foreground">Goal not found.</p><Button variant="ghost" onClick={onBack}>Back</Button></div>;

  const progress = getGoalProgress(goalId);
  const displayStatus = getGoalStatus(goalId);
  const linkedTasks = data.tasks.filter(t => goal.linkedTaskIds.includes(t.id));
  const linkedDone = linkedTasks.filter(t => t.status === 'done').length;
  const unlinkableTasks = data.tasks.filter(t => !goal.linkedTaskIds.includes(t.id) && t.status !== 'done');

  // Time elapsed
  const now = new Date();
  const start = new Date(goal.startDate);
  const end = new Date(goal.targetDate);
  const totalDays = Math.max(1, differenceInDays(end, start));
  const elapsed = Math.max(0, differenceInDays(now, start));
  const timeElapsedPct = Math.min(100, Math.round((elapsed / totalDays) * 100));
  const daysLeft = Math.max(0, differenceInDays(end, now));

  const handleCreateLinkedTask = () => {
    if (!newTaskTitle.trim()) return;
    const task: Task = {
      id: crypto.randomUUID(), title: newTaskTitle.trim(), status: 'todo', priority: 'med',
      createdAt: new Date().toISOString(), tags: [], subtasks: [], goalId,
    };
    addTask(task);
    linkTaskToGoal(task.id, goalId);
    setNewTaskTitle('');
  };

  const handleSave = (goalData: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>) => {
    updateGoal(goalId, goalData);
    setEditOpen(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{goal.title}</h1>
            <Badge className={`text-[10px] border ${categoryColors[goal.category]}`}>{goal.category}</Badge>
            <Badge className={`text-[10px] border ${statusColors[displayStatus]}`}>{displayStatus}</Badge>
          </div>
          {goal.description && <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Edit2 className="h-3.5 w-3.5 mr-1" /> Edit</Button>
          {goal.status === 'active' && progress >= 100 && (
            <Button size="sm" onClick={() => completeGoal(goalId)}>Mark Complete</Button>
          )}
        </div>
      </div>

      {/* Progress & Timing */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-2xl font-bold text-primary">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="grid grid-cols-3 gap-4 text-center pt-2">
            <div><p className="text-lg font-bold">{timeElapsedPct}%</p><p className="text-[10px] text-muted-foreground">Time elapsed</p></div>
            <div><p className="text-lg font-bold">{daysLeft}</p><p className="text-[10px] text-muted-foreground">Days left</p></div>
            <div><p className="text-lg font-bold">{linkedDone}/{linkedTasks.length}</p><p className="text-[10px] text-muted-foreground">Tasks done</p></div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            You're at {progress}% progress with {timeElapsedPct}% of time elapsed
          </p>
        </CardContent>
      </Card>

      {/* Manual progress slider */}
      {goal.progressType === 'manual' && goal.status === 'active' && (
        <Card>
          <CardContent className="p-5">
            <Label className="mb-2 block">Update Progress</Label>
            <Slider value={[goal.progressValue]} onValueChange={v => updateGoal(goalId, { progressValue: v[0] })} max={100} step={1} />
            <p className="text-xs text-muted-foreground mt-1">{goal.progressValue}%</p>
          </CardContent>
        </Card>
      )}

      {/* Linked task guidance for linked type with no tasks */}
      {goal.progressType === 'linked' && linkedTasks.length === 0 && (
        <Card className="border-dashed border-primary/30">
          <CardContent className="p-5 text-center">
            <Target className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium">No linked tasks yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add tasks to automatically track progress based on completion.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Milestones */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Milestones</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {goal.milestones.length === 0 && <p className="text-sm text-muted-foreground">No milestones added.</p>}
            {goal.milestones.map(ms => (
              <div key={ms.id} className="flex items-center gap-2 text-sm">
                <button onClick={() => {
                  const updated = goal.milestones.map(m => m.id === ms.id ? { ...m, done: !m.done } : m);
                  updateGoal(goalId, { milestones: updated });
                }}
                  className={`h-4 w-4 rounded border shrink-0 flex items-center justify-center ${ms.done ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground hover:border-primary'}`}>
                  {ms.done && <Check className="h-3 w-3" />}
                </button>
                <span className={`flex-1 ${ms.done ? 'line-through text-muted-foreground' : ''}`}>{ms.title}</span>
                {ms.date && <span className="text-[10px] text-muted-foreground">{ms.date}</span>}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Linked Tasks */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Linked Tasks</CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowLinkDialog(true)}>
                <Link2 className="h-3 w-3 mr-1" /> Link Task
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {linkedTasks.map(task => (
              <div key={task.id} className="flex items-center gap-2 text-sm rounded-md border border-border p-2 group">
                <div className={`h-2 w-2 rounded-full shrink-0 ${task.status === 'done' ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                <span className={`flex-1 ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</span>
                <Badge variant="secondary" className="text-[8px] capitalize">{task.status === 'doing' ? 'in progress' : task.status === 'blocked' ? 'blocked' : task.status}</Badge>
                <button onClick={() => unlinkTaskFromGoal(task.id)} className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"><Unlink className="h-3 w-3" /></button>
              </div>
            ))}
            {/* Inline create */}
            <div className="flex items-center gap-2 pt-1 border-t border-border mt-2">
              <Input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Create new linked task…"
                onKeyDown={e => { if (e.key === 'Enter') handleCreateLinkedTask(); }} className="h-8 text-sm" />
              <Button size="sm" variant="secondary" onClick={handleCreateLinkedTask} className="h-8 shrink-0 text-xs"><Plus className="h-3 w-3 mr-1" /> Add</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t border-border">
        {goal.status === 'active' && <Button variant="outline" size="sm" onClick={() => archiveGoal(goalId)}>Pause</Button>}
        {!confirmDelete ? (
          <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete</Button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-destructive">Confirm delete?</span>
            <Button variant="destructive" size="sm" onClick={() => { deleteGoal(goalId); onBack(); }}>Yes</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Edit Goal</DialogTitle></DialogHeader>
          <GoalForm initial={goal} onSave={handleSave} onClose={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Link existing task dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Link Existing Task</DialogTitle></DialogHeader>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {unlinkableTasks.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">All tasks are already linked or completed.</p>}
            {unlinkableTasks.map(task => (
              <button key={task.id} onClick={() => { linkTaskToGoal(task.id, goalId); setShowLinkDialog(false); }}
                className="w-full flex items-center gap-2 text-sm rounded-md border border-border p-2.5 hover:bg-muted/30 text-left">
                <CheckSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1">{task.title}</span>
                {task.dueDate && <span className="text-[10px] text-muted-foreground">{task.dueDate}</span>}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Goals List Page ─────────────────────────────────────────────────
export default function Goals() {
  const { data, addGoal, getGoalProgress, getGoalStatus, completeGoal } = useAppContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState<GoalStatus | string>('active');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let g = data.goals.filter(x => x.status === tab);
    if (filterCategory !== 'all') g = g.filter(x => x.category === filterCategory);
    if (filterStatus !== 'all') g = g.filter(x => getGoalStatus(x.id) === filterStatus);
    return g;
  }, [data.goals, tab, filterCategory, filterStatus, getGoalStatus]);

  // If viewing detail
  if (selectedGoalId) {
    return <GoalDetail goalId={selectedGoalId} onBack={() => setSelectedGoalId(null)} />;
  }

  const handleSave = (goalData: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>) => {
    addGoal({ ...goalData, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    setDialogOpen(false);
  };

  // Check for auto-complete prompts
  const goalsAtComplete = data.goals.filter(g => g.status === 'active' && getGoalProgress(g.id) >= 100);

  // Empty state
  if (data.goals.length === 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-4" data-tour="goals-root">
        <div className="flex items-center justify-between min-h-[56px]" data-tour="goals-header">
          <h1 className="text-2xl font-bold tracking-tight">Goals</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="rounded-full bg-primary/10 p-6"><Target className="h-8 w-8 text-primary" /></div>
          <h2 className="text-xl font-semibold">No goals yet</h2>
          <p className="text-muted-foreground text-sm">Set your first goal and start tracking progress.</p>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button data-tour="goals-primary-action"><Plus className="h-4 w-4 mr-1" /> Create your first goal</Button></DialogTrigger>
            <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>New Goal</DialogTitle></DialogHeader>
              <GoalForm onSave={handleSave} onClose={() => setDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4" data-tour="goals-root">
      {/* Auto-complete banner */}
      {goalsAtComplete.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            {goalsAtComplete.map(g => (
              <div key={g.id} className="flex items-center justify-between">
                <p className="text-sm">🎉 <strong>{g.title}</strong> has reached 100% — mark as completed?</p>
                <Button size="sm" onClick={() => completeGoal(g.id)}>Complete Goal</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between min-h-[56px]" data-tour="goals-header">
        <h1 className="text-2xl font-bold tracking-tight">Goals</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm" data-tour="goals-primary-action"><Plus className="h-4 w-4 mr-1" /> Add Goal</Button></DialogTrigger>
          <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>New Goal</DialogTitle></DialogHeader>
            <GoalForm onSave={handleSave} onClose={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as GoalStatus)}>
        <TabsList><TabsTrigger value="active">Active</TabsTrigger><TabsTrigger value="completed">Completed</TabsTrigger><TabsTrigger value="paused">Paused</TabsTrigger><TabsTrigger value="canceled">Canceled</TabsTrigger></TabsList>
      </Tabs>

      {tab === 'active' && (
        <div className="flex gap-2 flex-wrap">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Categories</SelectItem>{(['health','career','finance','study','personal','custom'] as const).map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="On track">On track</SelectItem><SelectItem value="Behind">Behind</SelectItem><SelectItem value="Overdue">Overdue</SelectItem><SelectItem value="Not started">Not started</SelectItem></SelectContent>
          </Select>
        </div>
      )}

      {filtered.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No {tab} goals{filterCategory !== 'all' || filterStatus !== 'all' ? ' matching filters' : ''}.</p>}

      <div className="grid sm:grid-cols-2 gap-4">
        {filtered.map(goal => {
          const progress = getGoalProgress(goal.id);
          const displayStatus = getGoalStatus(goal.id);
          const daysLeft = Math.max(0, differenceInDays(new Date(goal.targetDate), new Date()));
          const linkedTasks = data.tasks.filter(t => goal.linkedTaskIds.includes(t.id));
          const linkedDone = linkedTasks.filter(t => t.status === 'done').length;

          return (
            <Card key={goal.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedGoalId(goal.id)}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{goal.title}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge className={`text-[10px] border ${categoryColors[goal.category]}`}>{goal.category}</Badge>
                      <Badge className={`text-[10px] border ${statusColors[displayStatus]}`}>{displayStatus}</Badge>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{daysLeft}d left</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{progress}%</span>
                    <span>{linkedDone}/{linkedTasks.length} tasks</span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>
                {goal.milestones.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">{goal.milestones.filter(m => m.done).length}/{goal.milestones.length} milestones</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
