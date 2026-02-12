import { useState } from 'react';
import { useAppContext } from '@/store/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Upload, Trash2, CalendarDays, ExternalLink, Bell } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { NotificationType } from '@/types';

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
};

export default function SettingsPage() {
  const { data, updateProfile, exportData, importData, resetData, updateNotificationSettings, addNotification } = useAppContext();
  const [name, setName] = useState(data.profile.name);
  const [confirmReset, setConfirmReset] = useState(false);
  const [integrationModal, setIntegrationModal] = useState<string | null>(null);
  const settings = data.notificationSettings;

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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <Tabs defaultValue="profile">
        <TabsList><TabsTrigger value="profile">Profile</TabsTrigger><TabsTrigger value="notifications">Notifications</TabsTrigger><TabsTrigger value="data">Data</TabsTrigger><TabsTrigger value="integrations">Integrations</TabsTrigger><TabsTrigger value="help">Help</TabsTrigger></TabsList>

        <TabsContent value="profile" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div><Label>Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)}
                  onBlur={() => { updateProfile({ name }); toast({ title: 'Profile updated' }); }} />
              </div>
              <div><Label>Week starts on</Label>
                <Select value={data.profile.weekStartDay} onValueChange={v => updateProfile({ weekStartDay: v as 'monday' | 'sunday' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="monday">Monday</SelectItem><SelectItem value="sunday">Sunday</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Timezone</Label>
                <Input value={data.profile.timezone} disabled className="text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
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

        <TabsContent value="integrations" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Calendar Integrations</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Connect your external calendars to sync events automatically.</p>
              <Button variant="outline" className="w-full justify-start" onClick={() => setIntegrationModal('Google Calendar')}>
                <ExternalLink className="h-4 w-4 mr-2" /> Connect Google Calendar
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => setIntegrationModal('Outlook')}>
                <ExternalLink className="h-4 w-4 mr-2" /> Connect Outlook
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="help" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-6 space-y-4 text-sm">
              <h3 className="font-semibold text-base">How to use LifeOS</h3>
              <div className="space-y-3">
                <div><p className="font-medium">📋 Tasks</p><p className="text-muted-foreground">Create tasks with priorities and due dates. Use List, Kanban (drag & drop), Week, and Overdue views. Schedule tasks to create focus blocks.</p></div>
                <div><p className="font-medium">🎯 Goals</p><p className="text-muted-foreground">Set long-term goals with target dates and track progress. Link tasks to goals.</p></div>
                <div><p className="font-medium">📅 Calendar</p><p className="text-muted-foreground">Manage events and focus blocks. Day, Week, Month, and Agenda views with timeline rendering. Quick-schedule tasks directly from the agenda.</p></div>
                <div><p className="font-medium">⚡ Focus Blocks</p><p className="text-muted-foreground">Time-block work sessions linked to tasks and goals. Track planned vs completed focus minutes.</p></div>
                <div><p className="font-medium">🔁 Habits</p><p className="text-muted-foreground">Create daily/weekly habits. Log completions and build streaks.</p></div>
                <div><p className="font-medium">🔔 Notifications</p><p className="text-muted-foreground">In-app alerts for overdue tasks, behind goals, missed habits, and upcoming events. Configure quiet hours and alert preferences in Settings.</p></div>
                <div><p className="font-medium">📊 Analytics</p><p className="text-muted-foreground">View task completion trends, focus analytics, goal progress, and habit adherence.</p></div>
                <div><p className="font-medium">📝 Weekly Planning</p><p className="text-muted-foreground">Commit up to 10 tasks per week. View scoreboard and carry over overdue tasks.</p></div>
                <div><p className="font-medium">⌘K Command Palette</p><p className="text-muted-foreground">Press ⌘K (or Ctrl+K) to quickly navigate or create tasks/events/goals.</p></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Integration Coming Soon Modal */}
      <Dialog open={!!integrationModal} onOpenChange={() => setIntegrationModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Integration Coming Soon</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p><strong>{integrationModal}</strong> integration is not yet available.</p>
            <p className="text-muted-foreground">We're working on calendar sync with external providers. In the meantime, you can manually create events and focus blocks directly in LifeOS.</p>
            <Button variant="outline" className="w-full" onClick={() => setIntegrationModal(null)}>Got it</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
