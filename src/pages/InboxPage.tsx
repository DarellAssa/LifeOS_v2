import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAppContext } from '@/store/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Inbox as InboxIcon, Plus, Pin, Archive, Trash2, Search, ExternalLink, CheckSquare, Target, CalendarDays, Repeat, Zap, FileText, ArrowRight, ChevronDown, StickyNote, Link2 } from 'lucide-react';
import { format, addDays, addMinutes } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { InboxItem, Note, ConversionKind } from '@/types';

const TYPE_ICONS: Record<string, typeof CheckSquare> = {
  task: CheckSquare, goal: Target, event: CalendarDays, habit: Repeat, focus: Zap, note: FileText,
};
const TYPE_LABELS: Record<string, string> = {
  task: 'Task', goal: 'Goal', event: 'Event', habit: 'Habit', focus: 'Focus Block', note: 'Note', focusBlock: 'Focus Block',
};

export default function InboxPage() {
  const {
    data, addInboxItem, updateInboxItem, deleteInboxItem, archiveInboxItem, pinInboxItem,
    convertInboxToTask, convertInboxToGoal, convertInboxToEvent, convertInboxToHabit, convertInboxToFocusBlock, convertInboxToNote,
    createNote, updateNote, deleteNote, pinNote, getActiveGoals,
  } = useAppContext();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'inbox' | 'notes'>('inbox');
  const [statusFilter, setStatusFilter] = useState<string>('unprocessed');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureText, setCaptureText] = useState('');
  const [captureTags, setCaptureTags] = useState('');

  // Conversion modal state
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertKind, setConvertKind] = useState<ConversionKind>('task');
  const [convertTitle, setConvertTitle] = useState('');
  const [convertDesc, setConvertDesc] = useState('');
  const [convertDueDate, setConvertDueDate] = useState('');
  const [convertCategory, setConvertCategory] = useState('personal');
  const [convertFrequency, setConvertFrequency] = useState<'daily' | 'weekly'>('daily');
  const [convertGoalId, setConvertGoalId] = useState('');
  const [convertStartDT, setConvertStartDT] = useState('');
  const [convertDuration, setConvertDuration] = useState(60);

  // Note editor
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteTags, setNoteTags] = useState('');
  const [noteSearch, setNoteSearch] = useState('');

  const inboxItems = useMemo(() => {
    let items = [...data.inboxItems];
    if (statusFilter !== 'all') items = items.filter(i => i.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i => (i.title || '').toLowerCase().includes(q) || i.content.toLowerCase().includes(q));
    }
    return items.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [data.inboxItems, statusFilter, searchQuery]);

  const selectedItem = data.inboxItems.find(i => i.id === selectedId);
  const unprocessedCount = data.inboxItems.filter(i => i.status === 'unprocessed').length;

  const handleCapture = () => {
    if (!captureText.trim()) return;
    const item = addInboxItem(captureText.trim());
    if (captureTags.trim()) {
      const tags = captureTags.split(',').map(t => t.trim()).filter(Boolean);
      updateInboxItem(item.id, { tags });
    }
    setCaptureText('');
    setCaptureTags('');
    setCaptureOpen(false);
  };

  const openConversion = (item: InboxItem, kind: ConversionKind) => {
    setConvertKind(kind);
    setConvertTitle(item.title || item.content.split('\n')[0].slice(0, 60));
    setConvertDesc(item.content);
    setConvertDueDate(item.detected.suggestedDateTime ? format(new Date(item.detected.suggestedDateTime), 'yyyy-MM-dd') : '');
    setConvertStartDT(item.detected.suggestedDateTime ? format(new Date(item.detected.suggestedDateTime), "yyyy-MM-dd'T'HH:mm") : '');
    setConvertCategory('personal');
    setConvertFrequency('daily');
    setConvertGoalId('');
    setConvertDuration(60);
    setConvertOpen(true);
  };

  const handleConvert = () => {
    if (!selectedItem) return;
    const id = selectedItem.id;
    switch (convertKind) {
      case 'task':
        convertInboxToTask(id, { title: convertTitle, description: convertDesc, dueDate: convertDueDate || undefined, goalId: convertGoalId || undefined, tags: selectedItem.tags });
        break;
      case 'goal':
        convertInboxToGoal(id, { title: convertTitle, description: convertDesc, category: convertCategory as any, targetDate: convertDueDate || format(addDays(new Date(), 30), 'yyyy-MM-dd') });
        break;
      case 'event':
        const startDT = convertStartDT ? new Date(convertStartDT).toISOString() : new Date().toISOString();
        convertInboxToEvent(id, { title: convertTitle, startDateTime: startDT, endDateTime: addMinutes(new Date(startDT), convertDuration).toISOString(), notes: convertDesc, category: convertCategory as any });
        break;
      case 'habit':
        convertInboxToHabit(id, { title: convertTitle, description: convertDesc, frequency: convertFrequency, targetCountPerPeriod: convertFrequency === 'daily' ? 1 : 5, category: convertCategory as any });
        break;
      case 'focusBlock':
        const fbStart = convertStartDT ? new Date(convertStartDT).toISOString() : new Date().toISOString();
        convertInboxToFocusBlock(id, { title: convertTitle, startDateTime: fbStart, endDateTime: addMinutes(new Date(fbStart), convertDuration).toISOString() });
        break;
      case 'note':
        convertInboxToNote(id, { title: convertTitle, content: convertDesc, tags: selectedItem.tags });
        break;
    }
    setConvertOpen(false);
    setSelectedId(null);
  };

  const activeGoals = getActiveGoals();

  // Notes
  const filteredNotes = useMemo(() => {
    let notes = [...data.notes];
    if (noteSearch) {
      const q = noteSearch.toLowerCase();
      notes = notes.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
    }
    return notes.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [data.notes, noteSearch]);

  const openNoteEditor = (note?: Note) => {
    if (note) {
      setEditingNoteId(note.id);
      setNoteTitle(note.title);
      setNoteContent(note.content);
      setNoteTags(note.tags.join(', '));
    } else {
      setEditingNoteId(null);
      setNoteTitle('');
      setNoteContent('');
      setNoteTags('');
    }
    setNoteEditorOpen(true);
  };

  const handleNoteSave = () => {
    const tags = noteTags.split(',').map(t => t.trim()).filter(Boolean);
    if (editingNoteId) {
      updateNote(editingNoteId, { title: noteTitle, content: noteContent, tags });
    } else {
      createNote({ id: crypto.randomUUID(), title: noteTitle, content: noteContent, tags, pinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    setNoteEditorOpen(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* DEV Debug Panel */}
      {import.meta.env.DEV && <InboxDebugPanel data={data} addInboxItem={addInboxItem} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
          {unprocessedCount > 0 && <p className="text-sm text-muted-foreground">{unprocessedCount} items to process</p>}
          {unprocessedCount === 0 && <p className="text-sm text-success">Inbox Zero ✨</p>}
        </div>
        <Button onClick={() => setCaptureOpen(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> Capture</Button>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="inbox">Inbox {unprocessedCount > 0 && <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 px-1">{unprocessedCount}</Badge>}</TabsTrigger>
          <TabsTrigger value="notes">Notes <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 px-1">{data.notes.length}</Badge></TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search inbox…" className="pl-9 h-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unprocessed">Unprocessed</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid md:grid-cols-5 gap-4">
            {/* List */}
            <div className="md:col-span-2 space-y-1.5 max-h-[70vh] overflow-y-auto">
              {inboxItems.length === 0 && (
                <Card><CardContent className="p-8 text-center">
                  <InboxIcon className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">{statusFilter === 'unprocessed' ? 'Inbox Zero! Nothing to process.' : 'No items found.'}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setCaptureOpen(true)}>Capture something</Button>
                </CardContent></Card>
              )}
              {inboxItems.map(item => {
                const SugIcon = item.detected.suggestedType ? TYPE_ICONS[item.detected.suggestedType] || FileText : FileText;
                return (
                  <button key={item.id} onClick={() => setSelectedId(item.id)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${selectedId === item.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'}`}>
                    <div className="flex items-center gap-2">
                      {item.pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                      <p className="text-sm font-medium truncate flex-1">{item.title || item.content.slice(0, 50)}</p>
                      <SugIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">{format(new Date(item.createdAt), 'MMM d, h:mm a')}</span>
                      {item.detected.urls.length > 0 && <Link2 className="h-2.5 w-2.5 text-ai" />}
                      <Badge variant={item.status === 'unprocessed' ? 'default' : 'secondary'} className="text-[8px] ml-auto h-4">
                        {item.status === 'converted' && item.conversion ? TYPE_LABELS[item.conversion.kind] : item.status}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Detail Panel */}
            <div className="md:col-span-3">
              {!selectedItem ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">Select an item to view details</CardContent></Card>
              ) : (
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Title</Label>
                      <Input value={selectedItem.title || ''} onChange={e => updateInboxItem(selectedItem.id, { title: e.target.value })} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Content</Label>
                      <Textarea value={selectedItem.content} onChange={e => updateInboxItem(selectedItem.id, { content: e.target.value })} rows={4} className="mt-1" />
                    </div>

                    {selectedItem.detected.urls.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Detected URLs</Label>
                        <div className="space-y-1 mt-1">
                          {selectedItem.detected.urls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline truncate">
                              <ExternalLink className="h-3 w-3 shrink-0" />{url}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      {selectedItem.detected.suggestedType && (
                        <Badge variant="outline" className="text-[10px]">
                          Suggested: {TYPE_LABELS[selectedItem.detected.suggestedType] || selectedItem.detected.suggestedType}
                        </Badge>
                      )}
                      {selectedItem.detected.suggestedDateTime && (
                        <Badge variant="outline" className="text-[10px]">
                          {format(new Date(selectedItem.detected.suggestedDateTime), 'MMM d, h:mm a')}
                        </Badge>
                      )}
                      {selectedItem.tags.map(tag => <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>)}
                    </div>

                    {selectedItem.conversion && (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                        <p className="text-xs text-muted-foreground mb-1">Converted to</p>
                        <button onClick={() => {
                          const routeMap: Record<string, string> = { task: '/tasks', goal: '/goals', event: '/calendar', habit: '/habits', focusBlock: '/calendar', note: '' };
                          const route = routeMap[selectedItem.conversion!.kind];
                          if (route) navigate(route);
                        }} className="flex items-center gap-2 text-primary hover:underline">
                          {TYPE_LABELS[selectedItem.conversion.kind]} <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      {selectedItem.status !== 'converted' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm"><ChevronDown className="h-3 w-3 mr-1" /> Convert to…</Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {(['task', 'goal', 'event', 'habit', 'focusBlock', 'note'] as ConversionKind[]).map(kind => {
                              const Icon = TYPE_ICONS[kind === 'focusBlock' ? 'focus' : kind] || FileText;
                              return (
                                <DropdownMenuItem key={kind} onClick={() => openConversion(selectedItem, kind)}>
                                  <Icon className="h-3.5 w-3.5 mr-2" /> {TYPE_LABELS[kind]}
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      <Button size="sm" variant="outline" onClick={() => pinInboxItem(selectedItem.id, !selectedItem.pinned)}>
                        <Pin className={`h-3 w-3 mr-1 ${selectedItem.pinned ? 'text-primary' : ''}`} /> {selectedItem.pinned ? 'Unpin' : 'Pin'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { archiveInboxItem(selectedItem.id); setSelectedId(null); }}>
                        <Archive className="h-3 w-3 mr-1" /> Archive
                      </Button>
                      {selectedItem.status === 'archived' && (
                        <Button size="sm" variant="outline" onClick={() => { updateInboxItem(selectedItem.id, { status: 'unprocessed' } as any); setSelectedId(null); }}>
                          <InboxIcon className="h-3 w-3 mr-1" /> Restore
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={noteSearch} onChange={e => setNoteSearch(e.target.value)} placeholder="Search notes…" className="pl-9 h-9" />
            </div>
            <Button size="sm" onClick={() => openNoteEditor()}><Plus className="h-4 w-4 mr-1" /> New Note</Button>
          </div>
          {filteredNotes.length === 0 && (
            <Card><CardContent className="p-8 text-center">
              <StickyNote className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No notes yet.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => openNoteEditor()}>Create a note</Button>
            </CardContent></Card>
          )}
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredNotes.map(note => (
              <Card key={note.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => openNoteEditor(note)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    {note.pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                    <p className="text-sm font-medium truncate">{note.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">{note.content}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-muted-foreground">{format(new Date(note.updatedAt), 'MMM d')}</span>
                    {note.tags.map(tag => <Badge key={tag} variant="secondary" className="text-[8px]">{tag}</Badge>)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Capture Modal */}
      <Dialog open={captureOpen} onOpenChange={setCaptureOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Quick Capture</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Textarea value={captureText} onChange={e => setCaptureText(e.target.value)} placeholder="Capture anything… ideas, tasks, links, notes" rows={4} autoFocus />
            <Input value={captureTags} onChange={e => setCaptureTags(e.target.value)} placeholder="Tags (comma separated)" />
            <Button className="w-full" onClick={handleCapture} disabled={!captureText.trim()}>Add to Inbox</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Conversion Modal */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Convert to {TYPE_LABELS[convertKind]}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={convertTitle} onChange={e => setConvertTitle(e.target.value)} /></div>

            {(convertKind === 'task' || convertKind === 'goal' || convertKind === 'habit' || convertKind === 'note') && (
              <div><Label>Description</Label><Textarea value={convertDesc} onChange={e => setConvertDesc(e.target.value)} rows={3} /></div>
            )}

            {convertKind === 'task' && (
              <>
                <div><Label>Due Date</Label><Input type="date" value={convertDueDate} onChange={e => setConvertDueDate(e.target.value)} /></div>
                {activeGoals.length > 0 && (
                  <div><Label>Link to Goal</Label>
                    <Select value={convertGoalId} onValueChange={setConvertGoalId}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {activeGoals.map(g => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            {convertKind === 'goal' && (
              <>
                <div><Label>Target Date</Label><Input type="date" value={convertDueDate} onChange={e => setConvertDueDate(e.target.value)} /></div>
                <div><Label>Category</Label>
                  <Select value={convertCategory} onValueChange={setConvertCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['health', 'career', 'finance', 'study', 'personal', 'custom'].map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {(convertKind === 'event' || convertKind === 'focusBlock') && (
              <>
                <div><Label>Start Date & Time</Label><Input type="datetime-local" value={convertStartDT} onChange={e => setConvertStartDT(e.target.value)} /></div>
                <div><Label>Duration (minutes)</Label>
                  <Select value={String(convertDuration)} onValueChange={v => setConvertDuration(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[15, 30, 45, 60, 90, 120].map(d => <SelectItem key={d} value={String(d)}>{d} min</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {convertKind === 'event' && (
              <div><Label>Category</Label>
                <Select value={convertCategory} onValueChange={setConvertCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['work', 'personal', 'study', 'health', 'custom'].map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {convertKind === 'habit' && (
              <>
                <div><Label>Frequency</Label>
                  <Select value={convertFrequency} onValueChange={v => setConvertFrequency(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Category</Label>
                  <Select value={convertCategory} onValueChange={setConvertCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['health', 'career', 'finance', 'study', 'personal', 'custom'].map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <Button className="w-full" onClick={handleConvert}>Convert</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Note Editor Modal */}
      <Dialog open={noteEditorOpen} onOpenChange={setNoteEditorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingNoteId ? 'Edit Note' : 'New Note'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} /></div>
            <div><Label>Content</Label><Textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} rows={5} /></div>
            <div><Label>Tags</Label><Input value={noteTags} onChange={e => setNoteTags(e.target.value)} placeholder="Comma separated" /></div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleNoteSave}>{editingNoteId ? 'Save' : 'Create'}</Button>
              {editingNoteId && (
                <>
                  <Button variant="outline" onClick={() => { pinNote(editingNoteId, !data.notes.find(n => n.id === editingNoteId)?.pinned); setNoteEditorOpen(false); }}>
                    <Pin className="h-3 w-3 mr-1" /> Pin
                  </Button>
                  <Button variant="destructive" onClick={() => { deleteNote(editingNoteId); setNoteEditorOpen(false); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// DEV-only debug panel
function InboxDebugPanel({ data, addInboxItem }: { data: any; addInboxItem: (content: string) => any }) {
  const [open, setOpen] = useState(false);
  const total = data.inboxItems.length;
  const unprocessed = data.inboxItems.filter((i: any) => i.status === 'unprocessed').length;
  const archived = data.inboxItems.filter((i: any) => i.status === 'archived').length;
  const converted = data.inboxItems.filter((i: any) => i.status === 'converted').length;
  const recent = [...data.inboxItems].sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  const createTestItems = () => {
    const samples = [
      'Buy groceries for the week',
      'Call dentist to reschedule appointment tomorrow at 3pm',
      'Goal: read 12 books by end of year',
      'Review quarterly report and send feedback',
      'Daily meditation habit - 10 min each morning',
    ];
    samples.forEach(s => addInboxItem(s));
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-[10px] text-muted-foreground hover:text-foreground border border-dashed border-border rounded px-2 py-1">
        🐛 Debug Panel
      </button>
    );
  }

  return (
    <div className="border border-dashed border-[hsl(var(--attention)/0.5)] rounded-lg p-3 bg-[hsl(var(--attention-muted))] text-xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono font-bold text-[hsl(var(--attention-foreground))]">🐛 Inbox Debug</span>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
      </div>
      <div className="flex gap-3 font-mono">
        <span>Total: <b>{total}</b></span>
        <span>Unprocessed: <b>{unprocessed}</b></span>
        <span>Archived: <b>{archived}</b></span>
        <span>Converted: <b>{converted}</b></span>
      </div>
      {recent.length > 0 && (
        <div className="space-y-1">
          <span className="font-mono text-muted-foreground">Last 5:</span>
          {recent.map((item: any) => (
            <div key={item.id} className="font-mono flex gap-2 text-[10px]">
              <span className="text-muted-foreground">{item.id.slice(0, 8)}</span>
              <span className="truncate max-w-[200px]">{item.title || item.content.slice(0, 40)}</span>
              <Badge variant={item.status === 'unprocessed' ? 'default' : 'secondary'} className="text-[8px] h-3.5">{item.status}</Badge>
              <span className="text-muted-foreground">{new Date(item.createdAt).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}
      <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={createTestItems}>
        + Create 5 test inbox items
      </Button>
    </div>
  );
}
