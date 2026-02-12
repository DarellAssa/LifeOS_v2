import { useState, useMemo } from 'react';
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
import { Plus, Trash2, Flame, Check, Archive } from 'lucide-react';
import { Habit, HabitFrequency, HabitCategory } from '@/types';
import { getHabitStreak, getHabitBestStreak, getHabitWeeklyAdherence, getHabitAdherenceForRange } from '@/lib/stats';
import { format, subDays } from 'date-fns';

const TEMPLATES = [
  { title: 'Workout', description: '4x per week workout', frequency: 'weekly' as const, target: 4, category: 'health' as const },
  { title: 'Read', description: 'Daily reading habit', frequency: 'daily' as const, target: 7, category: 'study' as const },
  { title: 'Study deep work', description: '5x per week deep focus', frequency: 'weekly' as const, target: 5, category: 'career' as const },
];

const categoryColors: Record<HabitCategory, string> = {
  health: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
  study: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  career: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  finance: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  personal: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
  custom: 'bg-muted text-muted-foreground border-border',
};

export default function Habits() {
  const { data, addHabit, updateHabit, deleteHabit, archiveHabit, logHabit } = useAppContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | undefined>();
  const [detailHabit, setDetailHabit] = useState<Habit | undefined>();
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterFrequency, setFilterFrequency] = useState<string>('all');
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const activeHabits = data.habits.filter(h => (h as any).status !== 'archived');
  const archivedHabits = data.habits.filter(h => (h as any).status === 'archived');

  const filteredActive = useMemo(() => {
    let result = activeHabits;
    if (filterCategory !== 'all') result = result.filter(h => (h as any).category === filterCategory);
    if (filterFrequency !== 'all') result = result.filter(h => h.frequency === filterFrequency);
    return result;
  }, [activeHabits, filterCategory, filterFrequency]);

  const handleAdd = (habit: Omit<Habit, 'id' | 'logs' | 'createdAt' | 'updatedAt'>) => {
    addHabit({ ...habit, id: crypto.randomUUID(), logs: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    setDialogOpen(false);
    setEditingHabit(undefined);
  };

  const handleUpdate = (habit: Omit<Habit, 'id' | 'logs' | 'createdAt' | 'updatedAt'>) => {
    if (!editingHabit) return;
    updateHabit(editingHabit.id, habit);
    setDialogOpen(false);
    setEditingHabit(undefined);
  };

  const last7 = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd'));
  const last30 = Array.from({ length: 30 }, (_, i) => format(subDays(new Date(), 29 - i), 'yyyy-MM-dd'));

  // Sync detailHabit with latest data
  const currentDetailHabit = detailHabit ? data.habits.find(h => h.id === detailHabit.id) : undefined;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Habits</h1>
        <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) setEditingHabit(undefined); }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Habit</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingHabit ? 'Edit Habit' : 'New Habit'}</DialogTitle></DialogHeader>
            <HabitForm onSave={editingHabit ? handleUpdate : handleAdd} onClose={() => { setDialogOpen(false); setEditingHabit(undefined); }} initial={editingHabit} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        <TabsList><TabsTrigger value="active">Active ({activeHabits.length})</TabsTrigger><TabsTrigger value="archived">Archived ({archivedHabits.length})</TabsTrigger></TabsList>

        <TabsContent value="active" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {(['health', 'study', 'career', 'finance', 'personal', 'custom'] as const).map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterFrequency} onValueChange={setFilterFrequency}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Frequency" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredActive.length === 0 && activeHabits.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center space-y-4">
                <p className="text-muted-foreground">No habits yet. Start building consistency!</p>
                <p className="text-sm text-muted-foreground">Try one of these templates:</p>
                <div className="flex gap-2 justify-center flex-wrap">
                  {TEMPLATES.map(t => (
                    <Button key={t.title} variant="outline" size="sm" className="text-xs" onClick={() => {
                      setEditingHabit(undefined);
                      // Prefill form won't work directly; open dialog with template
                      addHabit({
                        id: crypto.randomUUID(), title: t.title, description: t.description,
                        frequency: t.frequency, targetCountPerPeriod: t.target, category: t.category,
                        logs: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'active',
                      });
                    }}>{t.title} ({t.frequency === 'daily' ? 'daily' : `${t.target}x/wk`})</Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {filteredActive.map(habit => {
              const streak = getHabitStreak(habit);
              const bestStreak = getHabitBestStreak(habit);
              const adherence = getHabitWeeklyAdherence(habit);
              const loggedToday = habit.logs.includes(todayStr);
              const cat = (habit as any).category as HabitCategory || 'personal';
              return (
                <Card key={habit.id} className="group cursor-pointer" onClick={() => setDetailHabit(habit)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">{habit.title}</h3>
                        <Badge className={`text-[10px] border ${categoryColors[cat]}`}>{cat}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{habit.frequency}</Badge>
                      </div>
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground" title={`Best: ${bestStreak}d`}>
                          <Flame className="h-3.5 w-3.5 text-orange-500" />{streak}d
                        </div>
                        <Badge variant="secondary" className="text-[10px]">{adherence}%</Badge>
                        <Button size="sm" variant={loggedToday ? 'secondary' : 'default'} disabled={loggedToday}
                          onClick={() => logHabit(habit.id, todayStr)} className="h-7 text-xs">
                          {loggedToday ? <><Check className="h-3 w-3 mr-1" /> Done</> : 'Log today'}
                        </Button>
                        <button onClick={() => archiveHabit(habit.id)} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" title="Archive"><Archive className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {last7.map(day => {
                        const logged = habit.logs.includes(day);
                        return (
                          <div key={day} className="flex-1 flex flex-col items-center gap-1">
                            <div className={`h-8 w-full rounded ${logged ? 'bg-primary' : 'bg-muted'}`} />
                            <span className="text-[10px] text-muted-foreground">{format(new Date(day + 'T12:00:00'), 'EEE').charAt(0)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="archived" className="space-y-3 mt-4">
          {archivedHabits.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No archived habits.</p>}
          {archivedHabits.map(h => (
            <Card key={h.id} className="opacity-60">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{h.title}</span>
                  <Badge variant="secondary" className="text-[10px]">{h.frequency}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => updateHabit(h.id, { status: 'active' } as any)}>Restore</Button>
                  <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive" onClick={() => deleteHabit(h.id)}>Delete</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Detail Modal */}
      <Dialog open={!!currentDetailHabit} onOpenChange={() => setDetailHabit(undefined)}>
        <DialogContent className="max-w-md">
          {currentDetailHabit && (() => {
            const h = currentDetailHabit;
            const streak = getHabitStreak(h);
            const bestStreak = getHabitBestStreak(h);
            const adh7 = getHabitAdherenceForRange(h, 7);
            const adh30 = getHabitAdherenceForRange(h, 30);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">{h.title}
                    <Badge className={`text-[10px] border ${categoryColors[(h as any).category || 'personal']}`}>{(h as any).category || 'personal'}</Badge>
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {(h as any).description && <p className="text-sm text-muted-foreground">{(h as any).description}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border p-3 text-center">
                      <div className="flex items-center justify-center gap-1"><Flame className="h-4 w-4 text-orange-500" /><span className="text-lg font-bold">{streak}</span></div>
                      <p className="text-[10px] text-muted-foreground">Current streak</p>
                    </div>
                    <div className="rounded-lg border border-border p-3 text-center">
                      <p className="text-lg font-bold">{bestStreak}</p>
                      <p className="text-[10px] text-muted-foreground">Best streak</p>
                    </div>
                    <div className="rounded-lg border border-border p-3 text-center">
                      <p className="text-lg font-bold">{adh7}%</p>
                      <p className="text-[10px] text-muted-foreground">7-day adherence</p>
                    </div>
                    <div className="rounded-lg border border-border p-3 text-center">
                      <p className="text-lg font-bold">{adh30}%</p>
                      <p className="text-[10px] text-muted-foreground">30-day adherence</p>
                    </div>
                  </div>

                  {/* Last 30 days calendar strip */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Last 30 days</p>
                    <div className="flex gap-0.5 flex-wrap">
                      {last30.map(day => {
                        const logged = h.logs.includes(day);
                        return (
                          <div key={day} className={`h-4 w-4 rounded-sm ${logged ? 'bg-primary' : 'bg-muted'}`}
                            title={`${day}: ${logged ? 'Done' : 'Missed'}`} />
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => { setDetailHabit(undefined); setEditingHabit(h); setDialogOpen(true); }}>Edit</Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => { archiveHabit(h.id); setDetailHabit(undefined); }}>Archive</Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HabitForm({ onSave, onClose, initial }: {
  onSave: (habit: Omit<Habit, 'id' | 'logs' | 'createdAt' | 'updatedAt'>) => void;
  onClose: () => void;
  initial?: Habit;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState((initial as any)?.description ?? '');
  const [frequency, setFrequency] = useState<HabitFrequency>(initial?.frequency ?? 'daily');
  const [target, setTarget] = useState(initial?.targetCountPerPeriod ?? 7);
  const [category, setCategory] = useState<HabitCategory>((initial as any)?.category ?? 'personal');

  return (
    <form onSubmit={e => {
      e.preventDefault();
      if (title.trim()) onSave({ title: title.trim(), description: description.trim() || undefined, frequency, targetCountPerPeriod: target, category, status: 'active' });
    }} className="space-y-4">
      <div><Label>Habit name</Label><Input value={title} onChange={e => setTitle(e.target.value)} autoFocus /></div>
      <div><Label>Description (optional)</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Category</Label>
          <Select value={category} onValueChange={v => setCategory(v as HabitCategory)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{(['health', 'study', 'career', 'finance', 'personal', 'custom'] as const).map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Frequency</Label>
          <Select value={frequency} onValueChange={v => setFrequency(v as HabitFrequency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Target per period</Label><Input type="number" min={1} value={target} onChange={e => setTarget(Number(e.target.value))} /></div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit">{initial ? 'Update' : 'Save'}</Button>
      </div>
    </form>
  );
}
