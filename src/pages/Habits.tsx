import { useState } from 'react';
import { useAppContext } from '@/store/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Flame, Check } from 'lucide-react';
import { Habit, HabitFrequency } from '@/types';
import { getHabitStreak, getHabitWeeklyAdherence } from '@/lib/stats';
import { format, subDays } from 'date-fns';

export default function Habits() {
  const { data, addHabit, updateHabit, deleteHabit, logHabit } = useAppContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const handleAdd = (title: string, frequency: HabitFrequency, target: number) => {
    addHabit({ id: crypto.randomUUID(), title, frequency, targetCountPerPeriod: target, logs: [] });
    setDialogOpen(false);
  };

  const last7 = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd'));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Habits</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Habit</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>New Habit</DialogTitle></DialogHeader>
            <HabitForm onSave={handleAdd} onClose={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {data.habits.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No habits yet. Start building consistency!</p>}

      <div className="space-y-3">
        {data.habits.map(habit => {
          const streak = getHabitStreak(habit);
          const adherence = getHabitWeeklyAdherence(habit);
          const loggedToday = habit.logs.includes(todayStr);
          return (
            <Card key={habit.id} className="group">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-sm">{habit.title}</h3>
                    <Badge variant="secondary" className="text-[10px]">{habit.frequency}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Flame className="h-3.5 w-3.5 text-orange-500" />{streak}d
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{adherence}%</Badge>
                    <Button size="sm" variant={loggedToday ? 'secondary' : 'default'} disabled={loggedToday}
                      onClick={() => logHabit(habit.id, todayStr)} className="h-7 text-xs">
                      {loggedToday ? <><Check className="h-3 w-3 mr-1" /> Done</> : 'Log today'}
                    </Button>
                    <button onClick={() => deleteHabit(habit.id)} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <div className="flex gap-1">
                  {last7.map(day => {
                    const logged = habit.logs.includes(day);
                    return (
                      <div key={day} className="flex-1 flex flex-col items-center gap-1">
                        <div className={`h-8 w-full rounded ${logged ? 'bg-primary' : 'bg-muted'}`} />
                        <span className="text-[10px] text-muted-foreground">{format(new Date(day), 'EEE').charAt(0)}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function HabitForm({ onSave, onClose }: { onSave: (title: string, freq: HabitFrequency, target: number) => void; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [target, setTarget] = useState(7);

  return (
    <form onSubmit={e => { e.preventDefault(); if (title.trim()) onSave(title.trim(), frequency, target); }} className="space-y-4">
      <div><Label>Habit name</Label><Input value={title} onChange={e => setTitle(e.target.value)} autoFocus /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Frequency</Label>
          <Select value={frequency} onValueChange={v => setFrequency(v as HabitFrequency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label>Target per period</Label><Input type="number" min={1} value={target} onChange={e => setTarget(Number(e.target.value))} /></div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}
