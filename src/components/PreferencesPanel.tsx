import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Clock, Inbox, Bot, Sun } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { UserPreferences, mergePreferences } from '@/types/preferences';
import { toast } from '@/hooks/use-toast';

const DAYS = [
  { value: 'MO', label: 'Mon' },
  { value: 'TU', label: 'Tue' },
  { value: 'WE', label: 'Wed' },
  { value: 'TH', label: 'Thu' },
  { value: 'FR', label: 'Fri' },
  { value: 'SA', label: 'Sat' },
  { value: 'SU', label: 'Sun' },
];

export default function PreferencesPanel() {
  const { profile, updateProfile } = useAuth();
  const [prefs, setPrefs] = useState<UserPreferences>(() => mergePreferences(profile?.preferences));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from profile on load
  useEffect(() => {
    setPrefs(mergePreferences(profile?.preferences));
  }, [profile?.preferences]);

  const save = useCallback((updated: UserPreferences) => {
    setPrefs(updated);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateProfile({ preferences: updated as any });
      toast({ title: 'Preferences saved' });
    }, 800);
  }, [updateProfile]);

  const updateSchedule = (patch: Partial<UserPreferences['schedule']>) => {
    save({ ...prefs, schedule: { ...prefs.schedule, ...patch } });
  };
  const updateTriage = (patch: Partial<UserPreferences['triage']>) => {
    save({ ...prefs, triage: { ...prefs.triage, ...patch } });
  };
  const updateCopilot = (patch: Partial<UserPreferences['copilot']>) => {
    save({ ...prefs, copilot: { ...prefs.copilot, ...patch } });
  };
  const updateBriefing = (patch: Partial<UserPreferences['briefing']>) => {
    save({ ...prefs, briefing: { ...prefs.briefing, ...patch } });
  };

  const toggleDay = (day: string) => {
    const days = prefs.schedule.work_days.includes(day)
      ? prefs.schedule.work_days.filter(d => d !== day)
      : [...prefs.schedule.work_days, day];
    updateSchedule({ work_days: days });
  };

  return (
    <div className="space-y-4">
      {/* 1) Work & Scheduling */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> Work & Scheduling
          </CardTitle>
          <p className="text-xs text-muted-foreground">Controls when Copilot schedules focus blocks and events.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Start</Label>
              <Input
                type="time"
                value={prefs.schedule.work_hours.start}
                onChange={e => updateSchedule({ work_hours: { ...prefs.schedule.work_hours, start: e.target.value } })}
                className="w-28"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">End</Label>
              <Input
                type="time"
                value={prefs.schedule.work_hours.end}
                onChange={e => updateSchedule({ work_hours: { ...prefs.schedule.work_hours, end: e.target.value } })}
                className="w-28"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm">Work days</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {DAYS.map(d => (
                <Badge
                  key={d.value}
                  variant={prefs.schedule.work_days.includes(d.value) ? 'default' : 'outline'}
                  className="cursor-pointer select-none"
                  onClick={() => toggleDay(d.value)}
                >
                  {d.label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Default focus duration</Label>
              <p className="text-[11px] text-muted-foreground">Used when you don't specify a duration</p>
            </div>
            <Select value={String(prefs.schedule.default_focus_minutes)} onValueChange={v => updateSchedule({ default_focus_minutes: Number(v) })}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 min</SelectItem>
                <SelectItem value="50">50 min</SelectItem>
                <SelectItem value="90">90 min</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Preferred window</Label>
              <p className="text-[11px] text-muted-foreground">When to schedule if time is flexible</p>
            </div>
            <Select value={prefs.schedule.preferred_window} onValueChange={(v: any) => updateSchedule({ preferred_window: v })}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">Morning</SelectItem>
                <SelectItem value="afternoon">Afternoon</SelectItem>
                <SelectItem value="balanced">Balanced</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Avoid evenings</Label>
              <p className="text-[11px] text-muted-foreground">Don't schedule after work hours</p>
            </div>
            <Switch checked={prefs.schedule.avoid_evenings} onCheckedChange={v => updateSchedule({ avoid_evenings: v })} />
          </div>
        </CardContent>
      </Card>

      {/* 2) Inbox Triage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Inbox className="h-4 w-4" /> Inbox Triage
          </CardTitle>
          <p className="text-xs text-muted-foreground">Defaults for AI-powered inbox triage.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Default batch size</Label>
            <Select value={String(prefs.triage.default_batch_size)} onValueChange={v => updateTriage({ default_batch_size: Number(v) })}>
              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Confidence default</Label>
              <p className="text-[11px] text-muted-foreground">Which items are pre-selected</p>
            </div>
            <Select value={prefs.triage.default_confidence} onValueChange={(v: any) => updateTriage({ default_confidence: v })}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high_only">High only</SelectItem>
                <SelectItem value="high_med">High + Medium</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Archive after convert</Label>
              <p className="text-[11px] text-muted-foreground">Archive inbox items after converting</p>
            </div>
            <Switch checked={prefs.triage.archive_after_convert} onCheckedChange={v => updateTriage({ archive_after_convert: v })} />
          </div>
        </CardContent>
      </Card>

      {/* 3) Copilot */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4" /> Copilot
          </CardTitle>
          <p className="text-xs text-muted-foreground">AI assistant behavior defaults.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Default mode</Label>
            <Select value={prefs.copilot.default_mode} onValueChange={(v: any) => updateCopilot({ default_mode: v })}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="chat">Chat</SelectItem>
                <SelectItem value="plan_do">Plan & Do</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Confirm level</Label>
              <p className="text-[11px] text-muted-foreground">
                {prefs.copilot.confirm_level === 'strict' ? 'Expanded preview by default' : 'Compact preview, expandable'}
              </p>
            </div>
            <Select value={prefs.copilot.confirm_level} onValueChange={(v: any) => updateCopilot({ confirm_level: v })}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="strict">Strict</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Show tool details</Label>
              <p className="text-[11px] text-muted-foreground">Open tools accordion by default</p>
            </div>
            <Switch checked={prefs.copilot.show_tool_details} onCheckedChange={v => updateCopilot({ show_tool_details: v })} />
          </div>
        </CardContent>
      </Card>

      {/* 4) Briefing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sun className="h-4 w-4" /> Daily Briefing
          </CardTitle>
          <p className="text-xs text-muted-foreground">Morning briefing and next best actions.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Auto-generate daily</Label>
              <p className="text-[11px] text-muted-foreground">Create briefing each morning</p>
            </div>
            <Switch checked={prefs.briefing.auto_generate_daily} onCheckedChange={v => updateBriefing({ auto_generate_daily: v })} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Show on dashboard</Label>
              <p className="text-[11px] text-muted-foreground">Display briefing card on home page</p>
            </div>
            <Switch checked={prefs.briefing.show_on_dashboard} onCheckedChange={v => updateBriefing({ show_on_dashboard: v })} />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm">Next Best Actions count</Label>
            <Select value={String(prefs.briefing.nba_count)} onValueChange={v => updateBriefing({ nba_count: Number(v) })}>
              <SelectTrigger className="w-16"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="6">6</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
