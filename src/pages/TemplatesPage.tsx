import { useState, useMemo } from 'react';
import { useAppContext } from '@/store/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutTemplate, Play, Copy, Plus, Pencil, Trash2, CheckSquare, CalendarDays, Zap, Repeat, Target, Inbox, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { TemplateItem, TemplateCategory, Template } from '@/types/templates';

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  daily: 'Daily', weekly: 'Weekly', project: 'Project', study: 'Study', health: 'Health', custom: 'Custom',
};

const KIND_ICONS: Record<string, typeof CheckSquare> = {
  task: CheckSquare, event: CalendarDays, focusBlock: Zap, habit: Repeat, goal: Target, inbox: Inbox, note: FileText,
};

const KIND_LABELS: Record<string, string> = {
  task: 'Task', event: 'Event', focusBlock: 'Focus Block', habit: 'Habit', goal: 'Goal', inbox: 'Inbox Item', note: 'Note',
};

export default function TemplatesPage() {
  const { data, createTemplate, updateTemplate, deleteTemplate, duplicateTemplate, runTemplate } = useAppContext();
  const allTemplates = data.templates;
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [tab, setTab] = useState('gallery');
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [runResult, setRunResult] = useState<{ summary: Record<string, number> } | null>(null);

  // Builder state
  const [bName, setBName] = useState('');
  const [bDesc, setBDesc] = useState('');
  const [bCat, setBCat] = useState<TemplateCategory>('custom');
  const [bItems, setBItems] = useState<TemplateItem[]>([]);
  const [addItemKind, setAddItemKind] = useState<string>('task');

  // Item builder state
  const [itemTitle, setItemTitle] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemPriority, setItemPriority] = useState('med');
  const [itemDueOffset, setItemDueOffset] = useState('0');
  const [itemStartTime, setItemStartTime] = useState('09:00');
  const [itemDuration, setItemDuration] = useState('60');
  const [itemFrequency, setItemFrequency] = useState('daily');
  const [itemTarget, setItemTarget] = useState('7');
  const [itemCategory, setItemCategory] = useState('personal');
  const [itemTargetOffset, setItemTargetOffset] = useState('30');

  const filtered = useMemo(() => {
    return allTemplates.filter(t => {
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (catFilter !== 'all' && t.category !== catFilter) return false;
      return true;
    });
  }, [allTemplates, search, catFilter]);

  const builtIn = filtered.filter(t => t.isBuiltIn);
  const userTemplates = filtered.filter(t => !t.isBuiltIn);

  const handleRun = (tpl: Template) => {
    const result = runTemplate(tpl.id, format(new Date(), 'yyyy-MM-dd'));
    if (result) setRunResult({ summary: result.summary });
  };

  const openBuilder = (tpl?: Template) => {
    if (tpl) {
      setEditTemplate(tpl);
      setBName(tpl.name);
      setBDesc(tpl.description || '');
      setBCat(tpl.category);
      setBItems([...tpl.items]);
    } else {
      setEditTemplate(null);
      setBName(''); setBDesc(''); setBCat('custom'); setBItems([]);
    }
    setShowBuilder(true);
  };

  const addItem = () => {
    if (!itemTitle.trim() && addItemKind !== 'inbox') return;
    let item: TemplateItem;
    switch (addItemKind) {
      case 'task': item = { kind: 'task', title: itemTitle, description: itemDesc || undefined, priority: itemPriority as any, dueOffsetDays: Number(itemDueOffset) || 0 }; break;
      case 'event': item = { kind: 'event', title: itemTitle, startTime: itemStartTime, durationMinutes: Number(itemDuration), dayOffsetDays: 0 }; break;
      case 'focusBlock': item = { kind: 'focusBlock', title: itemTitle, startTime: itemStartTime, durationMinutes: Number(itemDuration), dayOffsetDays: 0 }; break;
      case 'habit': item = { kind: 'habit', title: itemTitle, frequency: itemFrequency as any, targetCountPerPeriod: Number(itemTarget), category: itemCategory as any }; break;
      case 'goal': item = { kind: 'goal', title: itemTitle, description: itemDesc || undefined, category: itemCategory as any, targetOffsetDays: Number(itemTargetOffset) }; break;
      case 'inbox': item = { kind: 'inbox', content: itemTitle || itemDesc }; break;
      case 'note': item = { kind: 'note', title: itemTitle, content: itemDesc }; break;
      default: return;
    }
    setBItems(prev => [...prev, item]);
    setItemTitle(''); setItemDesc('');
  };

  const saveTemplate = () => {
    if (!bName.trim()) { toast({ title: 'Template name required', variant: 'destructive' }); return; }
    if (bItems.length === 0) { toast({ title: 'Add at least one item', variant: 'destructive' }); return; }
    const now = new Date().toISOString();
    if (editTemplate && !editTemplate.isBuiltIn) {
      updateTemplate(editTemplate.id, { name: bName, description: bDesc, category: bCat, items: bItems, updatedAt: now });
    } else {
      createTemplate({
        id: crypto.randomUUID(), name: bName, description: bDesc, category: bCat,
        createdAt: now, updatedAt: now, isBuiltIn: false, items: bItems,
      });
    }
    setShowBuilder(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
        <Button onClick={() => openBuilder()} size="sm"><Plus className="h-4 w-4 mr-1" /> New Template</Button>
      </div>

      <div className="flex items-center gap-3">
        <Input placeholder="Search templates…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs h-9" />
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
          <TabsTrigger value="my">My Templates ({userTemplates.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="gallery" className="mt-4">
          {builtIn.length === 0 && <p className="text-sm text-muted-foreground">No built-in templates match your filter.</p>}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {builtIn.map(tpl => <TemplateCard key={tpl.id} tpl={tpl} onRun={handleRun} onDuplicate={() => duplicateTemplate(tpl.id)} onEdit={() => openBuilder(tpl)} />)}
          </div>
        </TabsContent>

        <TabsContent value="my" className="mt-4">
          {userTemplates.length === 0 && (
            <div className="text-center py-12">
              <LayoutTemplate className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-3">No custom templates yet.</p>
              <Button size="sm" onClick={() => openBuilder()}><Plus className="h-4 w-4 mr-1" /> Create Template</Button>
            </div>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {userTemplates.map(tpl => (
              <TemplateCard key={tpl.id} tpl={tpl} onRun={handleRun}
                onDuplicate={() => duplicateTemplate(tpl.id)}
                onEdit={() => openBuilder(tpl)}
                onDelete={() => deleteTemplate(tpl.id)} />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Run Result Dialog */}
      <Dialog open={!!runResult} onOpenChange={() => setRunResult(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Template Applied</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {runResult && Object.entries(runResult.summary).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-sm">
                <span className="capitalize">{k}</span>
                <Badge variant="secondary">{v} created</Badge>
              </div>
            ))}
            <Button className="w-full mt-3" onClick={() => setRunResult(null)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Builder */}
      <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editTemplate ? 'Edit Template' : 'New Template'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={bName} onChange={e => setBName(e.target.value)} /></div>
            <div><Label>Description</Label><Textarea value={bDesc} onChange={e => setBDesc(e.target.value)} rows={2} /></div>
            <div><Label>Category</Label>
              <Select value={bCat} onValueChange={v => setBCat(v as TemplateCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="border-t border-border pt-3">
              <Label className="text-sm font-semibold">Items ({bItems.length})</Label>
              <div className="space-y-2 mt-2">
                {bItems.map((item, i) => {
                  const Icon = KIND_ICONS[item.kind] || CheckSquare;
                  return (
                    <div key={i} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{'title' in item ? item.title : 'content' in item ? (item as any).content?.slice(0, 40) : 'Item'}</span>
                      <Badge variant="outline" className="text-[8px]">{KIND_LABELS[item.kind]}</Badge>
                      <button onClick={() => setBItems(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 rounded-lg border border-dashed border-border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Select value={addItemKind} onValueChange={setAddItemKind}>
                    <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(KIND_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <Input placeholder="Title" value={itemTitle} onChange={e => setItemTitle(e.target.value)} className="h-8 text-sm" />

                {(addItemKind === 'task' || addItemKind === 'goal' || addItemKind === 'note' || addItemKind === 'inbox') && (
                  <Textarea placeholder="Description / content" value={itemDesc} onChange={e => setItemDesc(e.target.value)} rows={2} className="text-sm" />
                )}

                {addItemKind === 'task' && (
                  <div className="flex gap-2">
                    <Select value={itemPriority} onValueChange={setItemPriority}>
                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="med">Med</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
                    </Select>
                    <div className="flex items-center gap-1 flex-1"><Label className="text-[10px] shrink-0">Due +</Label><Input type="number" value={itemDueOffset} onChange={e => setItemDueOffset(e.target.value)} className="h-8 text-xs" /><span className="text-[10px] text-muted-foreground">days</span></div>
                  </div>
                )}

                {(addItemKind === 'event' || addItemKind === 'focusBlock') && (
                  <div className="flex gap-2">
                    <div className="flex-1"><Label className="text-[10px]">Start</Label><Input type="time" value={itemStartTime} onChange={e => setItemStartTime(e.target.value)} className="h-8 text-xs" /></div>
                    <div className="flex-1"><Label className="text-[10px]">Duration (min)</Label><Input type="number" value={itemDuration} onChange={e => setItemDuration(e.target.value)} className="h-8 text-xs" /></div>
                  </div>
                )}

                {addItemKind === 'habit' && (
                  <div className="flex gap-2">
                    <Select value={itemFrequency} onValueChange={setItemFrequency}>
                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem></SelectContent>
                    </Select>
                    <div className="flex items-center gap-1 flex-1"><Label className="text-[10px] shrink-0">Target</Label><Input type="number" value={itemTarget} onChange={e => setItemTarget(e.target.value)} className="h-8 text-xs" /></div>
                  </div>
                )}

                {addItemKind === 'goal' && (
                  <div className="flex items-center gap-1"><Label className="text-[10px] shrink-0">Target +</Label><Input type="number" value={itemTargetOffset} onChange={e => setItemTargetOffset(e.target.value)} className="h-8 text-xs w-20" /><span className="text-[10px] text-muted-foreground">days</span></div>
                )}

                <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Add Item</Button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="ghost" className="flex-1" onClick={() => setShowBuilder(false)}>Cancel</Button>
              <Button className="flex-1" onClick={saveTemplate}>Save Template</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateCard({ tpl, onRun, onDuplicate, onEdit, onDelete }: {
  tpl: Template; onRun: (t: Template) => void; onDuplicate: () => void; onEdit: () => void; onDelete?: () => void;
}) {
  const itemCounts = tpl.items.reduce((acc, it) => { acc[it.kind] = (acc[it.kind] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-sm">{tpl.name}</h3>
            {tpl.description && <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>}
          </div>
          <Badge variant="secondary" className="text-[8px] shrink-0">{CATEGORY_LABELS[tpl.category]}</Badge>
        </div>

        <div className="flex flex-wrap gap-1">
          {Object.entries(itemCounts).map(([kind, count]) => (
            <Badge key={kind} variant="outline" className="text-[8px]">{count} {KIND_LABELS[kind] || kind}{count > 1 ? 's' : ''}</Badge>
          ))}
        </div>

        {tpl.defaultSchedule && tpl.defaultSchedule.type !== 'none' && (
          <p className="text-[10px] text-muted-foreground">Schedule: {tpl.defaultSchedule.type}{tpl.defaultSchedule.time ? ` at ${tpl.defaultSchedule.time}` : ''}</p>
        )}

        <div className="flex gap-1.5">
          <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => onRun(tpl)}><Play className="h-3 w-3 mr-1" /> Run Now</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={onDuplicate}><Copy className="h-3 w-3" /></Button>
          {!tpl.isBuiltIn && <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={onEdit}><Pencil className="h-3 w-3" /></Button>}
          {onDelete && !tpl.isBuiltIn && <Button size="sm" variant="outline" className="h-7 text-xs px-2 hover:text-destructive" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>}
        </div>
      </CardContent>
    </Card>
  );
}
