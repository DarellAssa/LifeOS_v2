import { useState } from 'react';
import { useAppContext } from '@/store/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Upload, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { data, updateProfile, exportData, importData, resetData } = useAppContext();
  const [name, setName] = useState(data.profile.name);
  const [confirmReset, setConfirmReset] = useState(false);

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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <Tabs defaultValue="profile">
        <TabsList><TabsTrigger value="profile">Profile</TabsTrigger><TabsTrigger value="data">Data</TabsTrigger><TabsTrigger value="help">Help</TabsTrigger></TabsList>

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

        <TabsContent value="help" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-6 space-y-4 text-sm">
              <h3 className="font-semibold text-base">How to use LifeOS</h3>
              <div className="space-y-3">
                <div><p className="font-medium">📋 Tasks</p><p className="text-muted-foreground">Create tasks with priorities and due dates. Use List, Kanban (drag & drop), Week, and Overdue views. Pin tasks as "Today's Focus" from the Dashboard.</p></div>
                <div><p className="font-medium">🎯 Goals</p><p className="text-muted-foreground">Set long-term goals with target dates and track progress. Link tasks to goals.</p></div>
                <div><p className="font-medium">📅 Calendar</p><p className="text-muted-foreground">Add events and view in Day, Week, or Month mode.</p></div>
                <div><p className="font-medium">🔁 Habits</p><p className="text-muted-foreground">Create daily/weekly habits. Log completions and build streaks.</p></div>
                <div><p className="font-medium">📊 Analytics</p><p className="text-muted-foreground">View task completion trends, overdue trends, and top tags — all from your real data.</p></div>
                <div><p className="font-medium">📝 Weekly Planning</p><p className="text-muted-foreground">Commit up to 10 tasks per week. View scoreboard and carry over overdue tasks.</p></div>
                <div><p className="font-medium">⌘K Command Palette</p><p className="text-muted-foreground">Press ⌘K (or Ctrl+K) to quickly navigate or create tasks/events/goals.</p></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
