import { useState } from 'react';
import { useAppContext } from '@/store/AppContext';
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
import { Plus, Trash2, ChevronRight } from 'lucide-react';
import { Goal, GoalCategory, GoalStatus } from '@/types';
import { getGoalOnTrack } from '@/lib/stats';

const categoryColors: Record<GoalCategory, string> = {
  health: 'bg-green-500/10 text-green-600', career: 'bg-blue-500/10 text-blue-600',
  finance: 'bg-yellow-500/10 text-yellow-600', study: 'bg-purple-500/10 text-purple-600',
  personal: 'bg-pink-500/10 text-pink-600', custom: 'bg-muted text-muted-foreground',
};

function GoalForm({ onSave, onClose, initial }: { onSave: (g: Omit<Goal, 'id'>) => void; onClose: () => void; initial?: Goal }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState<GoalCategory>(initial?.category ?? 'personal');
  const [startDate, setStartDate] = useState(initial?.startDate ?? new Date().toISOString().split('T')[0]);
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? '');
  const [progressValue, setProgressValue] = useState(initial?.progressValue ?? 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetDate) return;
    onSave({
      title: title.trim(), description, category, status: initial?.status ?? 'active',
      startDate, targetDate, progressType: 'manual', progressValue,
      targetMetric: '', currentMetric: '', linkedTaskIds: initial?.linkedTaskIds ?? [],
      milestones: initial?.milestones ?? [],
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Goal title" autoFocus /></div>
      <div><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Category</Label>
          <Select value={category} onValueChange={v => setCategory(v as GoalCategory)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{(['health','career','finance','study','personal','custom'] as const).map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Progress (%)</Label><Input type="number" min={0} max={100} value={progressValue} onChange={e => setProgressValue(Number(e.target.value))} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Start Date</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        <div><Label>Target Date</Label><Input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} /></div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}

export default function Goals() {
  const { data, addGoal, updateGoal, deleteGoal } = useAppContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>();
  const [tab, setTab] = useState<GoalStatus>('active');

  const filtered = data.goals.filter(g => g.status === tab);

  const handleSave = (goalData: Omit<Goal, 'id'>) => {
    if (editingGoal) { updateGoal(editingGoal.id, goalData); }
    else { addGoal({ ...goalData, id: crypto.randomUUID() }); }
    setEditingGoal(undefined);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Goals</h1>
        <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) setEditingGoal(undefined); }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Goal</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>{editingGoal ? 'Edit Goal' : 'New Goal'}</DialogTitle></DialogHeader>
            <GoalForm initial={editingGoal} onSave={handleSave} onClose={() => { setDialogOpen(false); setEditingGoal(undefined); }} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as GoalStatus)}>
        <TabsList><TabsTrigger value="active">Active</TabsTrigger><TabsTrigger value="completed">Completed</TabsTrigger><TabsTrigger value="archived">Archived</TabsTrigger></TabsList>
      </Tabs>

      {filtered.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No {tab} goals. Add your first goal!</p>}

      <div className="grid sm:grid-cols-2 gap-4">
        {filtered.map(goal => {
          const onTrack = getGoalOnTrack(goal);
          return (
            <Card key={goal.id} className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => { setEditingGoal(goal); setDialogOpen(true); }}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{goal.title}</p>
                    <Badge className={`text-[10px] mt-1 ${categoryColors[goal.category]}`}>{goal.category}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={onTrack ? 'default' : 'destructive'} className="text-[10px]">{onTrack ? 'On track' : 'Behind'}</Badge>
                    <button onClick={e => { e.stopPropagation(); deleteGoal(goal.id); }} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{goal.progressValue}% complete</span>
                    <span>Due {goal.targetDate}</span>
                  </div>
                  <Progress value={goal.progressValue} className="h-1.5" />
                </div>
                {goal.milestones.length > 0 && (
                  <p className="text-xs text-muted-foreground">{goal.milestones.filter(m => m.completed).length}/{goal.milestones.length} milestones</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
