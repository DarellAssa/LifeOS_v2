import { useState, useMemo } from 'react';
import { useAppContext } from '@/store/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Cog, Plus, Pencil, Trash2, Play, Undo2, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { AutomationRule, AutomationTrigger, AutomationCondition, AutomationAction, AutomationRunLog } from '@/types/templates';

const TRIGGER_LABELS: Record<string, string> = {
  time: 'Time-based', task_status_changed: 'Task status changed', goal_status_changed: 'Goal status changed',
  inbox_item_added: 'Inbox item added', focus_block_missed: 'Focus block missed', checkin_missing: 'Check-in missing',
};

const CONDITION_LABELS: Record<string, string> = {
  task_priority_is: 'Task priority is', task_has_tag: 'Task has tag', goal_category_is: 'Goal category is',
  inbox_contains_text: 'Inbox contains', time_is_after: 'Time is after', day_of_week_is: 'Day of week is',
  limit_unprocessed_inbox_gte: 'Unprocessed inbox ≥',
};

const ACTION_LABELS: Record<string, string> = {
  create_task: 'Create task', create_focus_block_next_free: 'Create focus block', create_notification: 'Send notification',
  add_inbox_item: 'Add to inbox', apply_template: 'Apply template', archive_inbox_item: 'Archive inbox item',
};

const STATUS_ICONS: Record<string, typeof CheckCircle> = {
  success: CheckCircle, skipped: XCircle, throttled: Clock, failed: AlertTriangle,
};

export default function AutomationsPage() {
  const { data, createAutomationRule, updateAutomationRule, deleteAutomationRule, toggleRuleEnabled, undoAutomationRun } = useAppContext();
  const rules = data.automationRules;
  const logs = data.automationLogs;
  const [tab, setTab] = useState('rules');
  const [showBuilder, setShowBuilder] = useState(false);
  const [editRule, setEditRule] = useState<AutomationRule | null>(null);

  // Builder state
  const [rName, setRName] = useState('');
  const [rTriggerType, setRTriggerType] = useState('task_status_changed');
  const [rScheduleType, setRScheduleType] = useState('daily');
  const [rScheduleTime, setRScheduleTime] = useState('09:00');
  const [rConditions, setRConditions] = useState<AutomationCondition[]>([]);
  const [rActions, setRActions] = useState<AutomationAction[]>([]);
  const [rMaxRuns, setRMaxRuns] = useState('3');
  const [rCooldown, setRCooldown] = useState('30');

  // Condition builder
  const [condType, setCondType] = useState('task_priority_is');
  const [condValue, setCondValue] = useState('high');

  // Action builder
  const [actType, setActType] = useState('create_task');
  const [actTitle, setActTitle] = useState('');
  const [actMessage, setActMessage] = useState('');
  const [actDuration, setActDuration] = useState('60');

  const recentLogs = useMemo(() => [...logs].sort((a, b) => b.ranAt.localeCompare(a.ranAt)).slice(0, 50), [logs]);

  const openBuilder = (rule?: AutomationRule) => {
    if (rule) {
      setEditRule(rule);
      setRName(rule.name);
      setRTriggerType(rule.trigger.type);
      if (rule.trigger.type === 'time') {
        setRScheduleType(rule.trigger.schedule.type);
        setRScheduleTime(rule.trigger.schedule.time);
      }
      setRConditions([...rule.conditions]);
      setRActions([...rule.actions]);
      setRMaxRuns(String(rule.throttle.maxRunsPerDay));
      setRCooldown(String(rule.throttle.cooldownMinutes));
    } else {
      setEditRule(null);
      setRName(''); setRTriggerType('task_status_changed'); setRConditions([]); setRActions([]);
      setRMaxRuns('3'); setRCooldown('30');
    }
    setShowBuilder(true);
  };

  const addCondition = () => {
    let cond: AutomationCondition;
    switch (condType) {
      case 'task_priority_is': cond = { type: 'task_priority_is', value: condValue as any }; break;
      case 'task_has_tag': cond = { type: 'task_has_tag', value: condValue }; break;
      case 'inbox_contains_text': cond = { type: 'inbox_contains_text', value: condValue }; break;
      case 'time_is_after': cond = { type: 'time_is_after', value: condValue }; break;
      case 'day_of_week_is': cond = { type: 'day_of_week_is', value: Number(condValue) }; break;
      case 'limit_unprocessed_inbox_gte': cond = { type: 'limit_unprocessed_inbox_gte', value: Number(condValue) }; break;
      default: cond = { type: 'goal_category_is', value: condValue as any }; break;
    }
    setRConditions(prev => [...prev, cond]);
  };

  const addAction = () => {
    let action: AutomationAction;
    switch (actType) {
      case 'create_task': action = { type: 'create_task', payload: { title: actTitle || 'Untitled task' } }; break;
      case 'create_focus_block_next_free': action = { type: 'create_focus_block_next_free', payload: { title: actTitle || 'Focus block', durationMinutes: Number(actDuration) } }; break;
      case 'create_notification': action = { type: 'create_notification', payload: { type: 'task_due_soon', title: actTitle || 'Alert', message: actMessage || 'Automation alert', severity: 'info' } }; break;
      case 'add_inbox_item': action = { type: 'add_inbox_item', payload: { content: actTitle || 'From automation' } }; break;
      case 'apply_template': action = { type: 'apply_template', payload: { templateId: condValue } }; break;
      default: return;
    }
    setRActions(prev => [...prev, action]);
    setActTitle(''); setActMessage('');
  };

  const saveRule = () => {
    if (!rName.trim()) { toast({ title: 'Rule name required', variant: 'destructive' }); return; }
    if (rActions.length === 0) { toast({ title: 'Add at least one action', variant: 'destructive' }); return; }
    const now = new Date().toISOString();
    const trigger: AutomationTrigger = rTriggerType === 'time'
      ? { type: 'time', schedule: { type: rScheduleType as any, time: rScheduleTime } }
      : { type: rTriggerType } as AutomationTrigger;

    if (editRule) {
      updateAutomationRule(editRule.id, {
        name: rName, trigger, conditions: rConditions, actions: rActions,
        throttle: { maxRunsPerDay: Number(rMaxRuns), cooldownMinutes: Number(rCooldown) },
        updatedAt: now,
      });
    } else {
      createAutomationRule({
        id: crypto.randomUUID(), name: rName, enabled: false,
        createdAt: now, updatedAt: now, trigger, conditions: rConditions, actions: rActions,
        throttle: { maxRunsPerDay: Number(rMaxRuns), cooldownMinutes: Number(rCooldown) },
      });
    }
    setShowBuilder(false);
  };

  const getRuleName = (ruleId: string) => rules.find(r => r.id === ruleId)?.name || 'Unknown rule';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Automations</h1>
        <Button onClick={() => openBuilder()} size="sm"><Plus className="h-4 w-4 mr-1" /> New Rule</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="rules">Rules ({rules.length})</TabsTrigger>
          <TabsTrigger value="logs">Logs ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-4 space-y-3">
          {rules.length === 0 && (
            <div className="text-center py-12">
              <Cog className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-3">No automation rules yet. Built-in rules are pre-configured but disabled.</p>
              <Button size="sm" onClick={() => openBuilder()}><Plus className="h-4 w-4 mr-1" /> Create Rule</Button>
            </div>
          )}
          {rules.map(rule => {
            const lastLog = logs.filter(l => l.ruleId === rule.id).sort((a, b) => b.ranAt.localeCompare(a.ranAt))[0];
            return (
              <Card key={rule.id} className={`transition-colors ${rule.enabled ? 'border-primary/20' : 'opacity-60'}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Switch checked={rule.enabled} onCheckedChange={() => toggleRuleEnabled(rule.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm truncate">{rule.name}</h3>
                        <Badge variant="outline" className="text-[8px]">{TRIGGER_LABELS[rule.trigger.type]}</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        {rule.conditions.length > 0 && <span>{rule.conditions.length} condition{rule.conditions.length > 1 ? 's' : ''}</span>}
                        <span>{rule.actions.length} action{rule.actions.length > 1 ? 's' : ''}</span>
                        {lastLog && <span>Last run: {format(new Date(lastLog.ranAt), 'MMM d, HH:mm')}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => openBuilder(rule)}><Pencil className="h-3 w-3" /></Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs px-2 hover:text-destructive" onClick={() => deleteAutomationRule(rule.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="logs" className="mt-4 space-y-2">
          {recentLogs.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No automation logs yet.</p>}
          {recentLogs.map(log => {
            const StatusIcon = STATUS_ICONS[log.status] || CheckCircle;
            return (
              <div key={log.id} className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
                <StatusIcon className={`h-4 w-4 shrink-0 ${log.status === 'success' ? 'text-green-500' : log.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{getRuleName(log.ruleId)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(log.ranAt), 'MMM d, HH:mm:ss')} · {log.status}
                    {log.reason && ` · ${log.reason}`}
                    {log.createdEntityRefs.length > 0 && ` · ${log.createdEntityRefs.length} entities created`}
                  </p>
                </div>
                {log.undoToken && log.undoToken.ids.length > 0 && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => undoAutomationRun(log.id)}>
                    <Undo2 className="h-3 w-3 mr-1" /> Undo
                  </Button>
                )}
              </div>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* Rule Builder */}
      <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editRule ? 'Edit Rule' : 'New Automation Rule'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={rName} onChange={e => setRName(e.target.value)} /></div>

            <div><Label>Trigger</Label>
              <Select value={rTriggerType} onValueChange={setRTriggerType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TRIGGER_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {rTriggerType === 'time' && (
              <div className="flex gap-2">
                <div className="flex-1"><Label className="text-xs">Schedule</Label>
                  <Select value={rScheduleType} onValueChange={setRScheduleType}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="flex-1"><Label className="text-xs">Time</Label><Input type="time" value={rScheduleTime} onChange={e => setRScheduleTime(e.target.value)} className="h-8 text-xs" /></div>
              </div>
            )}

            <div className="border-t border-border pt-3">
              <Label className="text-sm font-semibold">Conditions ({rConditions.length})</Label>
              <div className="space-y-1 mt-2">
                {rConditions.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs rounded border border-border p-2">
                    <span className="flex-1">{CONDITION_LABELS[c.type]}: <strong>{String(c.value)}</strong></span>
                    <button onClick={() => setRConditions(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Select value={condType} onValueChange={setCondType}>
                  <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CONDITION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
                <Input value={condValue} onChange={e => setCondValue(e.target.value)} className="h-8 text-xs flex-1" placeholder="Value" />
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={addCondition}><Plus className="h-3 w-3" /></Button>
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <Label className="text-sm font-semibold">Actions ({rActions.length})</Label>
              <div className="space-y-1 mt-2">
                {rActions.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs rounded border border-border p-2">
                    <span className="flex-1">{ACTION_LABELS[a.type]}: <strong>{'payload' in a && 'title' in a.payload ? a.payload.title : 'content' in (a as any).payload ? (a as any).payload.content?.slice(0, 30) : '…'}</strong></span>
                    <button onClick={() => setRActions(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
              <div className="space-y-2 mt-2">
                <Select value={actType} onValueChange={setActType}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(ACTION_LABELS).filter(([k]) => k !== 'archive_inbox_item').map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
                <Input value={actTitle} onChange={e => setActTitle(e.target.value)} className="h-8 text-xs" placeholder="Title / content" />
                {actType === 'create_notification' && <Input value={actMessage} onChange={e => setActMessage(e.target.value)} className="h-8 text-xs" placeholder="Message" />}
                {actType === 'create_focus_block_next_free' && <Input type="number" value={actDuration} onChange={e => setActDuration(e.target.value)} className="h-8 text-xs" placeholder="Duration (min)" />}
                <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={addAction}><Plus className="h-3 w-3 mr-1" /> Add Action</Button>
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <Label className="text-sm font-semibold">Throttle</Label>
              <div className="flex gap-3 mt-2">
                <div className="flex-1"><Label className="text-[10px]">Max runs/day</Label><Input type="number" value={rMaxRuns} onChange={e => setRMaxRuns(e.target.value)} className="h-8 text-xs" /></div>
                <div className="flex-1"><Label className="text-[10px]">Cooldown (min)</Label><Input type="number" value={rCooldown} onChange={e => setRCooldown(e.target.value)} className="h-8 text-xs" /></div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="ghost" className="flex-1" onClick={() => setShowBuilder(false)}>Cancel</Button>
              <Button className="flex-1" onClick={saveRule}>Save Rule</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
