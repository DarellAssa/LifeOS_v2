import { useState, useMemo, useCallback } from 'react';
import { useAppContext, AgendaItem } from '@/store/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, ChevronLeft, ChevronRight, Trash2, Clock, Target, CheckSquare, Focus, Zap, Calendar as CalIcon } from 'lucide-react';
import { CalendarEvent, EventCategory, FocusBlock, FocusBlockStatus } from '@/types';
import { format, addDays, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isSameMonth, addWeeks, subWeeks, subDays, differenceInMinutes } from 'date-fns';

type CalendarView = 'day' | 'week' | 'month' | 'agenda';

const categoryEventColors: Record<EventCategory, string> = {
  work: 'bg-blue-500/20 border-blue-500/30 text-blue-700 dark:text-blue-300',
  personal: 'bg-purple-500/20 border-purple-500/30 text-purple-700 dark:text-purple-300',
  study: 'bg-amber-500/20 border-amber-500/30 text-amber-700 dark:text-amber-300',
  health: 'bg-green-500/20 border-green-500/30 text-green-700 dark:text-green-300',
  custom: 'bg-muted border-border text-foreground',
};

const focusStatusColors: Record<FocusBlockStatus, string> = {
  planned: 'bg-primary/15 border-primary/30 text-primary',
  completed: 'bg-green-500/15 border-green-500/30 text-green-700 dark:text-green-400',
  skipped: 'bg-muted border-border text-muted-foreground line-through',
};

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00–20:00

// ── Event Form ──────────────────────────────────────────────────────
function EventForm({ onSave, onClose, initial, defaultStart }: {
  onSave: (e: Omit<CalendarEvent, 'id'>) => void; onClose: () => void; initial?: CalendarEvent; defaultStart?: string;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [startDate, setStartDate] = useState(initial ? format(new Date(initial.startDateTime), "yyyy-MM-dd'T'HH:mm") : defaultStart || '');
  const [endDate, setEndDate] = useState(initial ? format(new Date(initial.endDateTime), "yyyy-MM-dd'T'HH:mm") : '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [category, setCategory] = useState<EventCategory>(initial?.category ?? 'personal');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate) return;
    if (new Date(endDate) <= new Date(startDate)) return;
    onSave({ title: title.trim(), startDateTime: new Date(startDate).toISOString(), endDateTime: new Date(endDate).toISOString(), location: location || undefined, notes: notes || undefined, category, recurring: null });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><Label>Title *</Label><Input value={title} onChange={e => setTitle(e.target.value)} autoFocus /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Start *</Label><Input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        <div><Label>End *</Label><Input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Location</Label><Input value={location} onChange={e => setLocation(e.target.value)} /></div>
        <div><Label>Category</Label>
          <Select value={category} onValueChange={v => setCategory(v as EventCategory)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{(['work', 'personal', 'study', 'health', 'custom'] as const).map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit">{initial ? 'Update' : 'Create'} Event</Button>
      </div>
    </form>
  );
}

// ── Focus Block Form ────────────────────────────────────────────────
function FocusBlockForm({ onSave, onClose, initial, defaultStart }: {
  onSave: (fb: Omit<FocusBlock, 'id' | 'createdAt' | 'updatedAt'>) => void; onClose: () => void; initial?: FocusBlock; defaultStart?: string;
}) {
  const { data, getActiveGoals } = useAppContext();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [startDate, setStartDate] = useState(initial ? format(new Date(initial.startDateTime), "yyyy-MM-dd'T'HH:mm") : defaultStart || '');
  const [endDate, setEndDate] = useState(initial ? format(new Date(initial.endDateTime), "yyyy-MM-dd'T'HH:mm") : '');
  const [status, setStatus] = useState<FocusBlockStatus>(initial?.status ?? 'planned');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [linkedTaskId, setLinkedTaskId] = useState(initial?.linkedTaskId ?? 'none');
  const [linkedGoalId, setLinkedGoalId] = useState(initial?.linkedGoalId ?? 'none');
  const activeGoals = getActiveGoals();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate) return;
    if (new Date(endDate) <= new Date(startDate)) return;
    onSave({
      title: title.trim(), startDateTime: new Date(startDate).toISOString(), endDateTime: new Date(endDate).toISOString(),
      status, notes: notes || undefined,
      linkedTaskId: linkedTaskId !== 'none' ? linkedTaskId : undefined,
      linkedGoalId: linkedGoalId !== 'none' ? linkedGoalId : undefined,
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><Label>Title *</Label><Input value={title} onChange={e => setTitle(e.target.value)} autoFocus /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Start *</Label><Input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        <div><Label>End *</Label><Input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Status</Label>
          <Select value={status} onValueChange={v => setStatus(v as FocusBlockStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="planned">Planned</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="skipped">Skipped</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label>Link to Task</Label>
          <Select value={linkedTaskId} onValueChange={setLinkedTaskId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {data.tasks.filter(t => t.status !== 'done').map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Link to Goal</Label>
        <Select value={linkedGoalId} onValueChange={setLinkedGoalId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {activeGoals.map(g => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit">{initial ? 'Update' : 'Create'} Focus Block</Button>
      </div>
    </form>
  );
}

// ── Main Calendar Page ──────────────────────────────────────────────
export default function CalendarPage() {
  const {
    data, addEvent, updateEvent, deleteEvent,
    addFocusBlock, updateFocusBlock, deleteFocusBlock, markFocusBlockCompleted, markFocusBlockSkipped,
    getEventsForDay, getBlocksForDay, getAgendaForDay,
    createFocusBlockFromTask, getTodayTasks, getOverdueTasks,
  } = useAppContext();
  const [view, setView] = useState<CalendarView>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'event' | 'focus'>('event');
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>();
  const [editingBlock, setEditingBlock] = useState<FocusBlock | undefined>();
  const [defaultStart, setDefaultStart] = useState<string>('');
  const [detailItem, setDetailItem] = useState<AgendaItem | null>(null);

  const currentDateStr = format(currentDate, 'yyyy-MM-dd');

  const openNewDialog = (type: 'event' | 'focus', startStr?: string) => {
    setDialogType(type);
    setEditingEvent(undefined);
    setEditingBlock(undefined);
    setDefaultStart(startStr || '');
    setDialogOpen(true);
  };

  const handleSaveEvent = (eventData: Omit<CalendarEvent, 'id'>) => {
    if (editingEvent) updateEvent(editingEvent.id, eventData);
    else addEvent({ ...eventData, id: crypto.randomUUID() });
    setEditingEvent(undefined);
  };

  const handleSaveBlock = (blockData: Omit<FocusBlock, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    if (editingBlock) updateFocusBlock(editingBlock.id, blockData);
    else addFocusBlock({ ...blockData, id: crypto.randomUUID(), createdAt: now, updatedAt: now });
    setEditingBlock(undefined);
  };

  const navigate = (dir: number) => {
    if (view === 'month') setCurrentDate(d => dir > 0 ? addMonths(d, 1) : subMonths(d, 1));
    else if (view === 'week') setCurrentDate(d => dir > 0 ? addWeeks(d, 1) : subWeeks(d, 1));
    else setCurrentDate(d => dir > 0 ? addDays(d, 1) : subDays(d, 1));
  };

  const goToday = () => setCurrentDate(new Date());

  // Month calendar helpers
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Week helpers
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Day view data
  const dayEvents = useMemo(() => getEventsForDay(currentDateStr), [getEventsForDay, currentDateStr]);
  const dayBlocks = useMemo(() => getBlocksForDay(currentDateStr), [getBlocksForDay, currentDateStr]);
  const agenda = useMemo(() => getAgendaForDay(currentDateStr), [getAgendaForDay, currentDateStr]);

  // Quick schedule helpers
  const schedulableTasks = useMemo(() => {
    const todayTasks = getTodayTasks();
    const overdue = getOverdueTasks();
    const all = [...todayTasks, ...overdue.filter(t => !todayTasks.some(tt => tt.id === t.id))];
    return all.filter(t => !t.scheduledStart).slice(0, 5);
  }, [getTodayTasks, getOverdueTasks]);

  const findNextFreeSlot = useCallback((): string => {
    const now = new Date();
    const baseDate = isSameDay(now, currentDate) ? now : new Date(currentDate);
    if (!isSameDay(now, currentDate)) baseDate.setHours(8, 0, 0, 0);
    // Round up to next 15-min
    const mins = baseDate.getMinutes();
    const roundUp = Math.ceil(mins / 15) * 15;
    baseDate.setMinutes(roundUp, 0, 0);
    if (baseDate.getHours() < 8) baseDate.setHours(8, 0, 0, 0);
    if (baseDate.getHours() >= 20) baseDate.setHours(8, 0, 0, 0); // next day would need handling
    return format(baseDate, "yyyy-MM-dd'T'HH:mm");
  }, [currentDate]);

  const handleQuickSchedule = (taskId: string, durationMin: number) => {
    const start = findNextFreeSlot();
    createFocusBlockFromTask(taskId, new Date(start).toISOString(), durationMin);
  };

  // Timeline click-to-create
  const handleTimelineClick = (hour: number) => {
    const d = new Date(currentDate);
    d.setHours(hour, 0, 0, 0);
    const startStr = format(d, "yyyy-MM-dd'T'HH:mm");
    openNewDialog('event', startStr);
  };

  const getBlockPosition = (startDT: string, endDT: string) => {
    const start = new Date(startDT);
    const end = new Date(endDT);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    const top = Math.max(0, (startHour - 8) * 60); // px, 1px per minute
    const height = Math.max(15, (endHour - startHour) * 60);
    return { top, height };
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border overflow-hidden">
            {(['day', 'week', 'month', 'agenda'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 text-xs font-medium capitalize ${view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                {v}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={goToday}>Today</Button>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => openNewDialog('event')}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => openNewDialog('focus')}>
              <Zap className="h-3 w-3 mr-1" /> Focus
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <h2 className="text-lg font-semibold">
          {view === 'month' && format(currentDate, 'MMMM yyyy')}
          {view === 'week' && `${format(weekStart, 'MMM d')} — ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`}
          {(view === 'day' || view === 'agenda') && format(currentDate, 'EEEE, MMMM d, yyyy')}
        </h2>
        <Button variant="ghost" size="icon" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {/* ── DAY VIEW (Timeline) ── */}
      {view === 'day' && (
        <div className="relative border border-border rounded-lg overflow-hidden">
          <div className="relative" style={{ height: `${12 * 60}px` }}>
            {HOURS.map(h => (
              <div key={h} className="absolute w-full border-t border-border cursor-pointer hover:bg-muted/20 transition-colors" style={{ top: `${(h - 8) * 60}px`, height: '60px' }}
                onClick={() => handleTimelineClick(h)}>
                <span className="absolute -top-2.5 left-2 text-[10px] text-muted-foreground bg-background px-1">{`${h.toString().padStart(2, '0')}:00`}</span>
              </div>
            ))}
            {/* Now indicator */}
            {isSameDay(currentDate, new Date()) && (() => {
              const now = new Date();
              const nowHour = now.getHours() + now.getMinutes() / 60;
              if (nowHour >= 8 && nowHour <= 20) {
                return <div className="absolute left-0 right-0 border-t-2 border-destructive z-20" style={{ top: `${(nowHour - 8) * 60}px` }}>
                  <div className="absolute -top-1.5 left-0 h-3 w-3 rounded-full bg-destructive" />
                </div>;
              }
              return null;
            })()}
            {/* Events */}
            {dayEvents.map(ev => {
              const pos = getBlockPosition(ev.startDateTime, ev.endDateTime);
              return (
                <button key={ev.id} onClick={() => { setEditingEvent(ev); setDialogType('event'); setDialogOpen(true); }}
                  className={`absolute left-16 right-2 rounded-md border px-2 py-1 text-left text-xs overflow-hidden z-10 ${categoryEventColors[ev.category]}`}
                  style={{ top: `${pos.top}px`, height: `${pos.height}px`, minHeight: '20px' }}>
                  <p className="font-medium truncate">{ev.title}</p>
                  <p className="text-[10px] opacity-70">{format(new Date(ev.startDateTime), 'h:mm a')} – {format(new Date(ev.endDateTime), 'h:mm a')}</p>
                </button>
              );
            })}
            {/* Focus blocks */}
            {dayBlocks.map(fb => {
              const pos = getBlockPosition(fb.startDateTime, fb.endDateTime);
              return (
                <button key={fb.id} onClick={() => { setEditingBlock(fb); setDialogType('focus'); setDialogOpen(true); }}
                  className={`absolute left-16 right-2 rounded-md border px-2 py-1 text-left text-xs overflow-hidden z-10 ${focusStatusColors[fb.status]}`}
                  style={{ top: `${pos.top}px`, height: `${pos.height}px`, minHeight: '20px' }}>
                  <div className="flex items-center gap-1">
                    <Zap className="h-3 w-3 shrink-0" />
                    <p className="font-medium truncate">{fb.title}</p>
                  </div>
                  <p className="text-[10px] opacity-70">{format(new Date(fb.startDateTime), 'h:mm a')} – {format(new Date(fb.endDateTime), 'h:mm a')}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── WEEK VIEW ── */}
      {view === 'week' && (
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const events = getEventsForDay(dayStr);
            const blocks = getBlocksForDay(dayStr);
            const isToday = isSameDay(day, new Date());
            return (
              <div key={dayStr} className={`rounded-lg border p-2 min-h-[280px] ${isToday ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
                <button onClick={() => { setCurrentDate(day); setView('day'); }} className={`text-xs font-medium mb-2 block ${isToday ? 'text-primary' : 'text-muted-foreground'} hover:underline`}>
                  {format(day, 'EEE d')}
                </button>
                <div className="space-y-1">
                  {events.map(ev => (
                    <button key={ev.id} onClick={() => { setEditingEvent(ev); setDialogType('event'); setDialogOpen(true); }}
                      className={`w-full text-left text-[10px] rounded px-1.5 py-1 border truncate ${categoryEventColors[ev.category]}`}>
                      {format(new Date(ev.startDateTime), 'HH:mm')} {ev.title}
                    </button>
                  ))}
                  {blocks.map(fb => (
                    <button key={fb.id} onClick={() => { setEditingBlock(fb); setDialogType('focus'); setDialogOpen(true); }}
                      className={`w-full text-left text-[10px] rounded px-1.5 py-1 border truncate ${focusStatusColors[fb.status]}`}>
                      <Zap className="h-2 w-2 inline mr-0.5" />{format(new Date(fb.startDateTime), 'HH:mm')} {fb.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MONTH VIEW ── */}
      {view === 'month' && (
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="bg-muted/50 p-2 text-xs font-medium text-center text-muted-foreground">{d}</div>
          ))}
          {calendarDays.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const events = getEventsForDay(dayStr);
            const blocks = getBlocksForDay(dayStr);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());
            const totalCount = events.length + blocks.length;
            return (
              <div key={day.toISOString()} className={`bg-background p-2 min-h-[90px] cursor-pointer hover:bg-muted/20 ${!isCurrentMonth ? 'opacity-40' : ''}`}
                onClick={() => { setCurrentDate(day); setView('day'); }}>
                <p className={`text-xs mb-1 ${isToday ? 'bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center font-bold' : 'text-muted-foreground'}`}>
                  {format(day, 'd')}
                </p>
                {events.slice(0, 2).map(ev => (
                  <div key={ev.id} className={`text-[9px] rounded px-1 py-0.5 mb-0.5 truncate border ${categoryEventColors[ev.category]}`}>
                    {ev.title}
                  </div>
                ))}
                {blocks.length > 0 && events.length < 2 && blocks.slice(0, 2 - events.length).map(fb => (
                  <div key={fb.id} className={`text-[9px] rounded px-1 py-0.5 mb-0.5 truncate border ${focusStatusColors[fb.status]}`}>
                    <Zap className="h-2 w-2 inline" /> {fb.title}
                  </div>
                ))}
                {totalCount > 2 && <p className="text-[9px] text-muted-foreground">+{totalCount - 2} more</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* ── AGENDA VIEW ── */}
      {view === 'agenda' && (
        <div className="space-y-4">
          {agenda.length === 0 && (
            <div className="text-center py-12">
              <CalIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No events or focus blocks today.</p>
              <div className="flex gap-2 justify-center mt-3">
                <Button size="sm" onClick={() => openNewDialog('event')}>Add Event</Button>
                <Button size="sm" variant="secondary" onClick={() => openNewDialog('focus')}><Zap className="h-3 w-3 mr-1" /> Add Focus Block</Button>
              </div>
            </div>
          )}
          {agenda.map(item => {
            const taskTitle = item.linkedTaskId ? data.tasks.find(t => t.id === item.linkedTaskId)?.title : undefined;
            const goalTitle = item.linkedGoalId ? data.goals.find(g => g.id === item.linkedGoalId)?.title : undefined;
            return (
              <Card key={item.id} className="hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => {
                  if (item.type === 'event') {
                    const ev = data.events.find(e => e.id === item.id);
                    if (ev) { setEditingEvent(ev); setDialogType('event'); setDialogOpen(true); }
                  } else {
                    const fb = data.focusBlocks.find(b => b.id === item.id);
                    if (fb) { setEditingBlock(fb); setDialogType('focus'); setDialogOpen(true); }
                  }
                }}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="text-right shrink-0 w-20">
                    <p className="text-sm font-medium">{format(new Date(item.startDateTime), 'h:mm a')}</p>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(item.endDateTime), 'h:mm a')}</p>
                  </div>
                  <div className={`h-10 w-1 rounded-full shrink-0 ${item.type === 'focus' ? 'bg-primary' : 'bg-blue-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {item.type === 'focus' && <Zap className="h-3 w-3 text-primary shrink-0" />}
                      <p className="text-sm font-medium truncate">{item.title}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge variant="secondary" className="text-[8px] capitalize">{item.type === 'focus' ? (item.status || 'planned') : (item.category || 'event')}</Badge>
                      {item.location && <span className="text-[10px] text-muted-foreground">📍 {item.location}</span>}
                      {taskTitle && <Badge variant="secondary" className="text-[8px]"><CheckSquare className="h-2 w-2 mr-0.5 inline" />{taskTitle}</Badge>}
                      {goalTitle && <Badge variant="secondary" className="text-[8px]"><Target className="h-2 w-2 mr-0.5 inline" />{goalTitle}</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {item.type === 'focus' && item.status === 'planned' && (
                      <>
                        <button onClick={e => { e.stopPropagation(); markFocusBlockCompleted(item.id); }} className="text-green-600 hover:text-green-700 p-1" title="Complete">
                          <CheckSquare className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); markFocusBlockSkipped(item.id); }} className="text-muted-foreground hover:text-foreground p-1" title="Skip">
                          ✕
                        </button>
                      </>
                    )}
                    <button onClick={e => {
                      e.stopPropagation();
                      if (item.type === 'event') deleteEvent(item.id);
                      else deleteFocusBlock(item.id);
                    }} className="text-destructive opacity-0 group-hover:opacity-100 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Quick Schedule Section */}
          {schedulableTasks.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Quick Schedule</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">Tasks that need scheduling:</p>
                {schedulableTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-2 text-sm rounded-md border border-border p-2.5">
                    <span className="flex-1 truncate">{task.title}</span>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => handleQuickSchedule(task.id, 30)}>30m</Button>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => handleQuickSchedule(task.id, 60)}>60m</Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Dialogs ── */}
      <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) { setEditingEvent(undefined); setEditingBlock(undefined); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogType === 'event' ? (editingEvent ? 'Edit Event' : 'New Event') : (editingBlock ? 'Edit Focus Block' : 'New Focus Block')}
            </DialogTitle>
          </DialogHeader>
          {dialogType === 'event' ? (
            <EventForm initial={editingEvent} defaultStart={defaultStart} onSave={handleSaveEvent} onClose={() => { setDialogOpen(false); setEditingEvent(undefined); }} />
          ) : (
            <FocusBlockForm initial={editingBlock} defaultStart={defaultStart} onSave={handleSaveBlock} onClose={() => { setDialogOpen(false); setEditingBlock(undefined); }} />
          )}
          {/* Delete / status actions for editing */}
          {(editingEvent || editingBlock) && (
            <div className="flex items-center gap-2 border-t border-border pt-3 mt-2">
              {editingBlock && editingBlock.status === 'planned' && (
                <>
                  <Button size="sm" variant="outline" onClick={() => { markFocusBlockCompleted(editingBlock.id); setDialogOpen(false); }}>Mark Completed</Button>
                  <Button size="sm" variant="ghost" onClick={() => { markFocusBlockSkipped(editingBlock.id); setDialogOpen(false); }}>Skip</Button>
                </>
              )}
              <Button size="sm" variant="destructive" className="ml-auto" onClick={() => {
                if (editingEvent) deleteEvent(editingEvent.id);
                if (editingBlock) deleteFocusBlock(editingBlock.id);
                setDialogOpen(false);
              }}><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
