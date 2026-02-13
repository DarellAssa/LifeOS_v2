import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, DEFAULT_MODULES } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { seedDemoData } from '@/lib/db';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Sparkles, Rocket, BarChart3, Zap, Brain, Heart, DollarSign, GraduationCap, Briefcase, User, Compass } from 'lucide-react';

const FOCUS_AREAS = [
  { id: 'productivity', label: 'Productivity', icon: Zap },
  { id: 'health', label: 'Health', icon: Heart },
  { id: 'career', label: 'Career', icon: Briefcase },
  { id: 'study', label: 'Study', icon: GraduationCap },
  { id: 'finance', label: 'Finance', icon: DollarSign },
  { id: 'personal', label: 'Personal Growth', icon: User },
  { id: 'mindfulness', label: 'Mindfulness', icon: Brain },
  { id: 'custom', label: 'Custom', icon: Compass },
];

const STYLES = [
  { id: 'structured', label: 'Structured', desc: 'Weekly planning + committed tasks' },
  { id: 'flexible', label: 'Flexible', desc: 'Daily focus blocks + quick actions' },
  { id: 'tracking', label: 'Tracking only', desc: 'Analytics + habits + life score' },
  { id: 'automation', label: 'Automation-friendly', desc: 'Templates + automations + rules' },
];

export default function OnboardingPage() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [firstName, setFirstName] = useState('');
  const [timezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [weekStart, setWeekStart] = useState<'mon' | 'sun'>('mon');

  // Step 2
  const [focusAreas, setFocusAreas] = useState<string[]>([]);

  // Step 3
  const [operatingStyle, setOperatingStyle] = useState('flexible');

  // Step 4
  const [startOption, setStartOption] = useState<'clean' | 'guided' | 'demo'>('clean');
  const [sampleTask, setSampleTask] = useState('');
  const [sampleGoal, setSampleGoal] = useState('');
  const [sampleHabit, setSampleHabit] = useState('');

  // Step 5
  const [showTutorial, setShowTutorial] = useState(true);

  const toggleFocus = (id: string) => {
    setFocusAreas(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const computeModules = (): Record<string, boolean> => {
    const m = { ...DEFAULT_MODULES };
    // Always on
    m.tasks = true; m.inbox = true;
    // Focus-based
    if (focusAreas.includes('productivity')) { m.planning = true; m.calendar = true; m.focus = true; }
    if (focusAreas.includes('health') || focusAreas.includes('mindfulness')) { m.habits = true; m.checkin = true; m.lifeScore = true; }
    if (focusAreas.includes('career') || focusAreas.includes('study')) { m.goals = true; m.analytics = true; }
    if (operatingStyle === 'automation') { m.templates = true; m.automations = true; }
    return m;
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);

    const modules = computeModules();

    // Create guided items if needed
    if (startOption === 'guided') {
      const now = new Date().toISOString();
      if (sampleTask.trim()) {
        await supabase.from('tasks').insert({
          user_id: user.id, title: sampleTask.trim(), status: 'todo', priority: 'med',
          tags: [], subtasks: [],
        });
      }
      if (sampleGoal.trim()) {
        const { format, addDays } = await import('date-fns');
        await supabase.from('goals').insert({
          user_id: user.id, title: sampleGoal.trim(), category: 'personal', status: 'active',
          start_date: format(new Date(), 'yyyy-MM-dd'), target_date: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
          progress_type: 'manual', progress_value: 0, linked_task_ids: [], milestones: [],
        });
      }
      if (sampleHabit.trim()) {
        await supabase.from('habits').insert({
          user_id: user.id, title: sampleHabit.trim(), frequency: 'daily',
          target_count_per_period: 1, category: 'personal', logs: [], status: 'active',
        });
      }
    }

    if (startOption === 'demo') {
      await seedDemoData(user.id);
    }

    await updateProfile({
      first_name: firstName.trim() || null,
      timezone,
      week_start: weekStart,
      onboarding_completed: true,
      focus_areas: focusAreas,
      operating_style: operatingStyle,
      modules,
      preferences: { showTutorial },
      demo_mode: startOption === 'demo',
    });

    setSaving(false);
    toast({ title: 'Welcome to LifeOS! 🚀' });
    navigate('/');
  };

  const totalSteps = 5;
  const progressPercent = (step / totalSteps) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Life<span className="text-primary">OS</span>
          </h1>
          <p className="text-xs text-muted-foreground">Step {step} of {totalSteps}</p>
          <Progress value={progressPercent} className="h-1.5" />
        </div>

        <Card>
          <CardContent className="p-6">
            {step === 1 && (
              <div className="space-y-5">
                <div className="text-center space-y-1">
                  <h2 className="text-lg font-semibold">What should we call you?</h2>
                  <p className="text-sm text-muted-foreground">Let's personalize your experience.</p>
                </div>
                <div className="space-y-3">
                  <div><Label>First name</Label><Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Your name" autoFocus /></div>
                  <div><Label>Timezone</Label><Input value={timezone} disabled className="text-muted-foreground" /></div>
                  <div><Label>Week starts on</Label>
                    <div className="flex gap-2 mt-1">
                      {(['mon', 'sun'] as const).map(d => (
                        <button key={d} onClick={() => setWeekStart(d)}
                          className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${weekStart === d ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50'}`}>
                          {d === 'mon' ? 'Monday' : 'Sunday'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <Button className="w-full" onClick={() => setStep(2)} disabled={!firstName.trim()}>Continue</Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div className="text-center space-y-1">
                  <h2 className="text-lg font-semibold">What do you want to improve?</h2>
                  <p className="text-sm text-muted-foreground">Choose 1–3 areas. This helps us configure your modules.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {FOCUS_AREAS.map(fa => (
                    <button key={fa.id} onClick={() => toggleFocus(fa.id)}
                      className={`flex items-center gap-3 rounded-lg border p-3 text-sm text-left transition-colors ${focusAreas.includes(fa.id) ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'}`}>
                      <fa.icon className="h-4 w-4 shrink-0" />
                      <span className="font-medium">{fa.label}</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                  <Button className="flex-1" onClick={() => setStep(3)} disabled={focusAreas.length === 0}>Continue</Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div className="text-center space-y-1">
                  <h2 className="text-lg font-semibold">How do you like to operate?</h2>
                  <p className="text-sm text-muted-foreground">This affects which features are highlighted.</p>
                </div>
                <div className="space-y-2">
                  {STYLES.map(s => (
                    <button key={s.id} onClick={() => setOperatingStyle(s.id)}
                      className={`w-full flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${operatingStyle === s.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'}`}>
                      <div className={`h-3 w-3 rounded-full border-2 ${operatingStyle === s.id ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
                      <div>
                        <p className="text-sm font-medium">{s.label}</p>
                        <p className="text-xs text-muted-foreground">{s.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" className="flex-1" onClick={() => setStep(2)}>Back</Button>
                  <Button className="flex-1" onClick={() => setStep(4)}>Continue</Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <div className="text-center space-y-1">
                  <h2 className="text-lg font-semibold">Choose your start</h2>
                  <p className="text-sm text-muted-foreground">You can always add or reset data later.</p>
                </div>
                <div className="space-y-2">
                  {[
                    { id: 'clean', label: 'Start clean', desc: 'Empty slate — recommended', icon: Rocket },
                    { id: 'guided', label: 'Guided setup', desc: 'Create 1 task, 1 goal, 1 habit', icon: Sparkles },
                    { id: 'demo', label: 'Explore demo', desc: 'Pre-filled sample data', icon: BarChart3 },
                  ].map(opt => (
                    <button key={opt.id} onClick={() => setStartOption(opt.id as any)}
                      className={`w-full flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${startOption === opt.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'}`}>
                      <opt.icon className="h-5 w-5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                      {opt.id === 'clean' && <Badge variant="secondary" className="ml-auto text-[8px]">Recommended</Badge>}
                    </button>
                  ))}
                </div>
                {startOption === 'guided' && (
                  <div className="space-y-3 border-t border-border pt-3">
                    <div><Label className="text-xs">Your first task</Label><Input value={sampleTask} onChange={e => setSampleTask(e.target.value)} placeholder="e.g., Set up my workspace" /></div>
                    <div><Label className="text-xs">Your first goal</Label><Input value={sampleGoal} onChange={e => setSampleGoal(e.target.value)} placeholder="e.g., Learn a new skill" /></div>
                    <div><Label className="text-xs">Your first habit</Label><Input value={sampleHabit} onChange={e => setSampleHabit(e.target.value)} placeholder="e.g., Read 15 minutes" /></div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="ghost" className="flex-1" onClick={() => setStep(3)}>Back</Button>
                  <Button className="flex-1" onClick={() => setStep(5)}>Continue</Button>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-5">
                <div className="text-center space-y-1">
                  <h2 className="text-lg font-semibold">One last thing</h2>
                  <p className="text-sm text-muted-foreground">Would you like a guided tour on first login?</p>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <p className="text-sm font-medium">Guided tour</p>
                    <p className="text-xs text-muted-foreground">Quick walkthrough of key features</p>
                  </div>
                  <Switch checked={showTutorial} onCheckedChange={setShowTutorial} />
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" className="flex-1" onClick={() => setStep(4)}>Back</Button>
                  <Button className="flex-1" onClick={handleFinish} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Get started
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
