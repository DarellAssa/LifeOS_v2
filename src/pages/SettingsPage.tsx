import { useState } from 'react';
import { useAppContext } from '@/store/AppContext';
import { useAuth, DEFAULT_MODULES } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Download, Upload, Trash2, CalendarDays, ExternalLink, Bell, ChevronDown, RotateCcw, Eye, Sparkles, Search, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { NotificationType } from '@/types';
import { resetTourForUser, isTourDebugEnabled, setTourDebugEnabled } from '@/components/GuidedTour';
import { dbDeleteDemoData } from '@/lib/db';
import { useNavigate } from 'react-router-dom';
import TrashSection from '@/components/TrashSection';
import { supabase } from '@/integrations/supabase/client';

const NOTIF_TYPE_LABELS: Record<NotificationType, string> = {
  task_overdue: 'Overdue tasks',
  task_due_soon: 'Tasks due soon',
  goal_behind: 'Goals behind',
  goal_overdue: 'Goals overdue',
  event_upcoming: 'Upcoming events',
  focus_missed: 'Missed focus blocks',
  habit_missed: 'Missed habits',
  checkin_missing: 'Missing daily check-in',
  weekly_review_missing: 'Missing weekly review',
  inbox_unprocessed: 'Unprocessed inbox items',
};

const MODULE_INFO: Record<string, { label: string; desc: string; advanced?: boolean }> = {
  tasks: { label: 'Tasks', desc: 'Create, prioritize, and track tasks' },
  goals: { label: 'Goals', desc: 'Long-term objectives with milestones' },
  calendar: { label: 'Calendar', desc: 'Events and time-based views' },
  focus: { label: 'Focus Blocks', desc: 'Time-blocked deep work sessions' },
  habits: { label: 'Habits', desc: 'Daily/weekly habits with streaks' },
  checkin: { label: 'Check-in', desc: 'Daily mood, energy, focus reflection' },
  lifeScore: { label: 'Life Score', desc: 'Composite score from all activity' },
  inbox: { label: 'Inbox', desc: 'Quick capture for thoughts and links' },
  notes: { label: 'Notes', desc: 'Freeform notes with tags' },
  analytics: { label: 'Analytics', desc: 'Charts and trends for your data' },
  planning: { label: 'Weekly Planning', desc: 'Commit tasks per week' },
  notifications: { label: 'Notifications', desc: 'In-app alerts and reminders' },
  templates: { label: 'Templates', desc: 'Reusable task/event templates', advanced: true },
  automations: { label: 'Automations', desc: 'Rules that run automatically', advanced: true },
  copilot: { label: 'AI Copilot', desc: 'AI assistant for your workspace', advanced: true },
};

export default function SettingsPage() {
  const { data, updateProfile, exportData, importData, resetData, updateNotificationSettings, addNotification } = useAppContext();
  const { profile, updateProfile: updateAuthProfile, user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.first_name || data.profile.name);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDeleteDemo, setConfirmDeleteDemo] = useState(false);
  const [integrationModal, setIntegrationModal] = useState<string | null>(null);
  const [advancedModulesOpen, setAdvancedModulesOpen] = useState(false);
  const [tourDebug, setTourDebug] = useState(isTourDebugEnabled());
  const [indexing, setIndexing] = useState(false);
  const [indexResult, setIndexResult] = useState<{ totalIndexed: number; progress: Record<string, number> } | null>(null);
  const settings = data.notificationSettings;

  const modules = profile?.modules || DEFAULT_MODULES;

  const handleModuleToggle = async (key: string, enabled: boolean) => {
    const updated = { ...modules, [key]: enabled };
    await updateAuthProfile({ modules: updated });
  };

  const handleNameSave = async () => {
    updateProfile({ name });
    await updateAuthProfile({ first_name: name || null });
    toast({ title: 'Profile updated' });
  };

  const handleWeekStartChange = async (v: string) => {
    updateProfile({ weekStartDay: v as 'monday' | 'sunday' });
    await updateAuthProfile({ week_start: v === 'monday' ? 'mon' : 'sun' });
  };

  const handleReRunOnboarding = async () => {
    await updateAuthProfile({ onboarding_completed: false });
    navigate('/onboarding');
  };

  const handleResetTour = () => {
    if (user) {
      resetTourForUser(user.id);
      toast({ title: 'Tour reset', description: 'The guided tour will appear on your next dashboard visit.' });
    }
  };

  const handleDeleteDemoData = async () => {
    if (!user) return;
    await dbDeleteDemoData(user.id);
    await updateAuthProfile({ demo_mode: false });
    setConfirmDeleteDemo(false);
    toast({ title: 'Demo data deleted', description: 'Refresh to see changes.' });
    window.location.reload();
  };

  const handleExport = () => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'lifeos-backup.json'; a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Data exported successfully' });
  };

  const handleImport = (mode: 'replace' | 'merge') => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => { importData(ev.target?.result as string, mode); };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleTestNotification = () => {
    addNotification({
      id: crypto.randomUUID(),
      type: 'task_due_soon',
      title: 'Test notification',
      message: 'This is a test notification to verify the system works.',
      severity: 'info',
      createdAt: new Date().toISOString(),
    });
    toast({ title: 'Test notification created' });
  };

  const handleRebuildSearchIndex = async () => {
    setIndexing(true);
    setIndexResult(null);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('search-index', { body: {} });
      if (fnError) throw fnError;
      setIndexResult({ totalIndexed: fnData.totalIndexed, progress: fnData.progress });
      toast({ title: 'Search index rebuilt', description: `${fnData.totalIndexed} items indexed.` });
    } catch (err: any) {
      toast({ title: 'Indexing failed', description: err.message, variant: 'destructive' });
    } finally {
      setIndexing(false);
    }
  };

  const coreModules = Object.entries(MODULE_INFO).filter(([, info]) => !info.advanced);
  const advancedModules = Object.entries(MODULE_INFO).filter(([, info]) => info.advanced);

  return (
    <div className="max-w-2xl mx-auto space-y-6" data-tour="settings-root">
      <div className="min-h-[56px] flex items-center" data-tour="settings-header">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
          <TabsTrigger value="trash" className="flex items-center gap-1">
            <Trash2 className="h-3 w-3" /> Trash
          </TabsTrigger>
          <TabsTrigger value="help">Help</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div><Label>Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)}
                  onBlur={handleNameSave} />
              </div>
              <div><Label>Week starts on</Label>
                <Select value={data.profile.weekStartDay} onValueChange={handleWeekStartChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="monday">Monday</SelectItem><SelectItem value="sunday">Sunday</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Timezone</Label>
                <Input value={data.profile.timezone} disabled className="text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          {/* Getting Started */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Getting Started</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" onClick={handleReRunOnboarding}>
                <RotateCcw className="h-4 w-4 mr-2" /> Re-run onboarding
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={handleResetTour}>
                <Eye className="h-4 w-4 mr-2" /> Reset guided tour
              </Button>
              <div className="flex items-center justify-between px-1">
                <div>
                  <Label className="text-sm">Tour debug mode</Label>
                  <p className="text-[11px] text-muted-foreground">Show diagnostic panel during tour</p>
                </div>
                <Switch
                  checked={tourDebug}
                  onCheckedChange={v => { setTourDebug(v); setTourDebugEnabled(v); }}
                />
              </div>
              {profile?.demo_mode && (
                <>
                  {!confirmDeleteDemo ? (
                    <Button variant="outline" className="w-full justify-start text-destructive" onClick={() => setConfirmDeleteDemo(true)}>
                      <Trash2 className="h-4 w-4 mr-2" /> Delete demo data
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-destructive">This will remove all demo data. Your own data is safe.</p>
                      <div className="flex gap-2">
                        <Button variant="destructive" size="sm" onClick={handleDeleteDemoData}>Delete demo data</Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteDemo(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modules" className="space-y-4 mt-4" data-tour="modules-section">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Modules</CardTitle>
              <p className="text-xs text-muted-foreground">Show or hide features. Your data is never deleted.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {coreModules.map(([key, info]) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">{info.label}</Label>
                    <p className="text-[11px] text-muted-foreground">{info.desc}</p>
                  </div>
                  <Switch
                    checked={modules[key] !== false}
                    onCheckedChange={v => handleModuleToggle(key, v)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Collapsible open={advancedModulesOpen} onOpenChange={setAdvancedModulesOpen}>
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="cursor-pointer">
                  <CardTitle className="text-base flex items-center gap-2">
                    Advanced
                    <ChevronDown className={`h-4 w-4 transition-transform ${advancedModulesOpen ? 'rotate-180' : ''}`} />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-3 pt-0">
                  {advancedModules.map(([key, info]) => (
                    <div key={key} className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm">{info.label}</Label>
                        <p className="text-[11px] text-muted-foreground">{info.desc}</p>
                      </div>
                      <Switch
                        checked={modules[key] !== false}
                        onCheckedChange={v => handleModuleToggle(key, v)}
                      />
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Alert Types</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(Object.entries(NOTIF_TYPE_LABELS) as [NotificationType, string][]).map(([type, label]) => (
                <div key={type} className="flex items-center justify-between">
                  <Label className="text-sm">{label}</Label>
                  <Switch checked={settings.enabledTypes[type]} onCheckedChange={v => updateNotificationSettings({ enabledTypes: { ...settings.enabledTypes, [type]: v } })} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Quiet Hours</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Enable quiet hours</Label>
                <Switch checked={settings.quietHoursEnabled} onCheckedChange={v => updateNotificationSettings({ quietHoursEnabled: v })} />
              </div>
              {settings.quietHoursEnabled && (
                <div className="flex items-center gap-3">
                  <div><Label className="text-xs text-muted-foreground">Start</Label>
                    <Input type="time" value={settings.quietHoursStart} onChange={e => updateNotificationSettings({ quietHoursStart: e.target.value })} className="w-28" /></div>
                  <div><Label className="text-xs text-muted-foreground">End</Label>
                    <Input type="time" value={settings.quietHoursEnd} onChange={e => updateNotificationSettings({ quietHoursEnd: e.target.value })} className="w-28" /></div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Thresholds</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Due soon (days ahead)</Label>
                <Select value={String(settings.dueSoonDays)} onValueChange={v => updateNotificationSettings({ dueSoonDays: Number(v) })}>
                  <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>{[1, 2, 3, 5, 7].map(d => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Event upcoming (minutes)</Label>
                <Select value={String(settings.eventUpcomingMinutes)} onValueChange={v => updateNotificationSettings({ eventUpcomingMinutes: Number(v) })}>
                  <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>{[15, 30, 60, 120].map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Max notifications/day</Label>
                <Input type="number" min={1} max={50} value={settings.maxNotificationsPerDay} onChange={e => updateNotificationSettings({ maxNotificationsPerDay: Number(e.target.value) })} className="w-20" />
              </div>
            </CardContent>
          </Card>

          <Button variant="outline" onClick={handleTestNotification} className="w-full">
            <Bell className="h-4 w-4 mr-2" /> Send test notification
          </Button>
        </TabsContent>

        <TabsContent value="data" className="space-y-4 mt-4">
          {/* Search Index */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Search className="h-4 w-4" /> Search Index</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">The search index updates automatically when you create or edit items. Use this button to backfill existing data or rebuild from scratch.</p>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleRebuildSearchIndex}
                disabled={indexing}
              >
                {indexing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                {indexing ? 'Indexing...' : 'Rebuild search index'}
              </Button>
              {indexResult && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p className="font-medium text-foreground">{indexResult.totalIndexed} items indexed</p>
                  {Object.entries(indexResult.progress).map(([type, count]) => (
                    <p key={type}>• {type}: {count}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Export & Import</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" /> Export all data (JSON)
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => handleImport('merge')}>
                <Upload className="h-4 w-4 mr-2" /> Import & merge data
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => handleImport('replace')}>
                <Upload className="h-4 w-4 mr-2" /> Import & replace data
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base text-destructive">Danger Zone</CardTitle></CardHeader>
            <CardContent>
              {!confirmReset ? (
                <Button variant="destructive" onClick={() => setConfirmReset(true)}>
                  <Trash2 className="h-4 w-4 mr-2" /> Reset all data
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-destructive">This will delete all your data and restore defaults. Are you sure?</p>
                  <div className="flex gap-2">
                    <Button variant="destructive" onClick={() => { resetData(); setConfirmReset(false); }}>Yes, reset everything</Button>
                    <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trash" className="mt-4">
          <TrashSection />
        </TabsContent>

        <TabsContent value="help" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-6 space-y-4 text-sm">
              <h3 className="font-semibold text-base">How to use LifeOS</h3>
              <div className="space-y-3">
                <div><p className="font-medium">📋 Tasks</p><p className="text-muted-foreground">Create tasks with priorities and due dates. Use List, Kanban, Week, and Overdue views.</p></div>
                <div><p className="font-medium">🎯 Goals</p><p className="text-muted-foreground">Set long-term goals with target dates and track progress.</p></div>
                <div><p className="font-medium">📅 Calendar</p><p className="text-muted-foreground">Manage events and focus blocks with multiple views.</p></div>
                <div><p className="font-medium">🔁 Habits</p><p className="text-muted-foreground">Create daily/weekly habits and build streaks.</p></div>
                <div><p className="font-medium">🔔 Notifications</p><p className="text-muted-foreground">In-app alerts for overdue tasks, behind goals, and more.</p></div>
                <div><p className="font-medium">📊 Analytics</p><p className="text-muted-foreground">View trends and patterns across all your data.</p></div>
                <div><p className="font-medium">⌘K Command Palette</p><p className="text-muted-foreground">Press ⌘K to quickly navigate or create items.</p></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!integrationModal} onOpenChange={() => setIntegrationModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Integration Coming Soon</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p><strong>{integrationModal}</strong> integration is not yet available.</p>
            <Button variant="outline" className="w-full" onClick={() => setIntegrationModal(null)}>Got it</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
