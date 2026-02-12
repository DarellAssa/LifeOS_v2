import { useState, useMemo } from 'react';
import { useAppContext } from '@/store/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { CalendarEvent, EventCategory } from '@/types';
import { format, addDays, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isSameMonth, addWeeks, subWeeks, subDays } from 'date-fns';

type CalendarView = 'day' | 'week' | 'month';

function EventForm({ onSave, onClose, initial }: { onSave: (e: Omit<CalendarEvent, 'id'>) => void; onClose: () => void; initial?: CalendarEvent }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [startDate, setStartDate] = useState(initial ? format(new Date(initial.startDateTime), "yyyy-MM-dd'T'HH:mm") : '');
  const [endDate, setEndDate] = useState(initial ? format(new Date(initial.endDateTime), "yyyy-MM-dd'T'HH:mm") : '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [category, setCategory] = useState<EventCategory>(initial?.category ?? 'personal');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate) return;
    onSave({ title: title.trim(), startDateTime: new Date(startDate).toISOString(), endDateTime: new Date(endDate).toISOString(), location, notes, category, recurring: null });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} autoFocus /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Start</Label><Input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        <div><Label>End</Label><Input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Location</Label><Input value={location} onChange={e => setLocation(e.target.value)} /></div>
        <div><Label>Category</Label>
          <Select value={category} onValueChange={v => setCategory(v as EventCategory)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{(['work','personal','study','health','custom'] as const).map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}

const categoryEventColors: Record<EventCategory, string> = {
  work: 'bg-blue-500/20 border-blue-500/30 text-blue-700 dark:text-blue-300',
  personal: 'bg-purple-500/20 border-purple-500/30 text-purple-700 dark:text-purple-300',
  study: 'bg-amber-500/20 border-amber-500/30 text-amber-700 dark:text-amber-300',
  health: 'bg-green-500/20 border-green-500/30 text-green-700 dark:text-green-300',
  custom: 'bg-muted border-border text-foreground',
};

export default function CalendarPage() {
  const { data, addEvent, updateEvent, deleteEvent } = useAppContext();
  const [view, setView] = useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>();

  const handleSave = (eventData: Omit<CalendarEvent, 'id'>) => {
    if (editingEvent) { updateEvent(editingEvent.id, eventData); }
    else { addEvent({ ...eventData, id: crypto.randomUUID() }); }
    setEditingEvent(undefined);
  };

  const navigate = (dir: number) => {
    if (view === 'month') setCurrentDate(d => dir > 0 ? addMonths(d, 1) : subMonths(d, 1));
    else if (view === 'week') setCurrentDate(d => dir > 0 ? addWeeks(d, 1) : subWeeks(d, 1));
    else setCurrentDate(d => dir > 0 ? addDays(d, 1) : subDays(d, 1));
  };

  // Month view
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Week view
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getEventsForDay = (day: Date) => data.events.filter(e => isSameDay(new Date(e.startDateTime), day));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border">
            {(['day', 'week', 'month'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 text-xs font-medium capitalize ${view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'} ${v === 'day' ? 'rounded-l-md' : v === 'month' ? 'rounded-r-md' : ''}`}>
                {v}
              </button>
            ))}
          </div>
          <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) setEditingEvent(undefined); }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Event</Button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>{editingEvent ? 'Edit Event' : 'New Event'}</DialogTitle></DialogHeader>
              <EventForm initial={editingEvent} onSave={handleSave} onClose={() => { setDialogOpen(false); setEditingEvent(undefined); }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <h2 className="text-lg font-semibold">
          {view === 'month' && format(currentDate, 'MMMM yyyy')}
          {view === 'week' && `${format(weekStart, 'MMM d')} — ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`}
          {view === 'day' && format(currentDate, 'EEEE, MMMM d, yyyy')}
        </h2>
        <Button variant="ghost" size="icon" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {/* Month View */}
      {view === 'month' && (
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
            <div key={d} className="bg-muted/50 p-2 text-xs font-medium text-center text-muted-foreground">{d}</div>
          ))}
          {calendarDays.map(day => {
            const dayEvents = getEventsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());
            return (
              <div key={day.toISOString()} className={`bg-background p-2 min-h-[100px] ${!isCurrentMonth ? 'opacity-40' : ''}`}>
                <p className={`text-xs mb-1 ${isToday ? 'bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center font-bold' : 'text-muted-foreground'}`}>
                  {format(day, 'd')}
                </p>
                {dayEvents.slice(0, 3).map(ev => (
                  <button key={ev.id} onClick={() => { setEditingEvent(ev); setDialogOpen(true); }}
                    className={`w-full text-left text-[10px] rounded px-1 py-0.5 mb-0.5 truncate border ${categoryEventColors[ev.category]}`}>
                    {format(new Date(ev.startDateTime), 'HH:mm')} {ev.title}
                  </button>
                ))}
                {dayEvents.length > 3 && <p className="text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Week View */}
      {view === 'week' && (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map(day => {
            const dayEvents = getEventsForDay(day);
            const isToday = isSameDay(day, new Date());
            return (
              <div key={day.toISOString()} className={`rounded-lg border p-3 min-h-[300px] ${isToday ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
                <p className={`text-xs font-medium mb-2 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>{format(day, 'EEE d')}</p>
                <div className="space-y-1">
                  {dayEvents.map(ev => (
                    <button key={ev.id} onClick={() => { setEditingEvent(ev); setDialogOpen(true); }}
                      className={`w-full text-left text-xs rounded p-2 border ${categoryEventColors[ev.category]}`}>
                      <p className="font-medium truncate">{ev.title}</p>
                      <p className="text-[10px] opacity-70">{format(new Date(ev.startDateTime), 'h:mm a')}</p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Day View */}
      {view === 'day' && (
        <div className="space-y-2">
          {getEventsForDay(currentDate).length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No events today.</p>}
          {getEventsForDay(currentDate).map(ev => (
            <Card key={ev.id} className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => { setEditingEvent(ev); setDialogOpen(true); }}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{ev.title}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(ev.startDateTime), 'h:mm a')} — {format(new Date(ev.endDateTime), 'h:mm a')}{ev.location && ` · ${ev.location}`}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`text-[10px] ${categoryEventColors[ev.category]}`}>{ev.category}</Badge>
                  <button onClick={e => { e.stopPropagation(); deleteEvent(ev.id); }} className="text-destructive opacity-0 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
