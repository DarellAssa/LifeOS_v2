import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, DEFAULT_MODULES } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { seedDemoData } from '@/lib/db';
import { supabase } from '@/integrations/supabase/client';
import {
  Loader2, Sparkles, Rocket, BarChart3, Zap, Brain, Heart, DollarSign,
  GraduationCap, Briefcase, User, Compass, ChevronDown, ChevronRight,
  Target, Repeat, CheckSquare, ArrowRight, Check,
} from 'lucide-react';

const FOCUS_AREAS = [
  { id: 'productivity', label: 'Productivity', hint: 'Tasks, planning, focus blocks', icon: Zap },
  { id: 'health', label: 'Health', hint: 'Habits, routines, streaks', icon: Heart },
  { id: 'study', label: 'Study', hint: 'Goals, deep work, progress', icon: GraduationCap },
  { id: 'career', label: 'Career', hint: 'Projects, outcomes, accountability', icon: Briefcase },
  { id: 'finance', label: 'Finance', hint: 'Track money tasks and routines', icon: DollarSign },
  { id: 'personal', label: 'Personal Growth', hint: 'Reflect, build consistency', icon: User },
  { id: 'mindfulness', label: 'Mindfulness', hint: 'Check-ins, calm routines', icon: Brain },
  { id: 'custom', label: 'Custom', hint: 'Build your own setup', icon: Compass },
];

const VISIBLE_FOCUS_COUNT = 6;

const STYLES = [
  { id: 'structured', label: 'Structured', desc: 'Weekly planning + scheduled focus', detail: 'Emphasizes weekly planning view, committed tasks, and time-blocking.' },
  { id: 'flexible', label: 'Flexible', desc: 'Today-first workflow + quick capture', detail: 'Focuses on today\'s tasks, inbox capture, and flexible priorities.' },
  { id: 'tracking', label: 'Tracking', desc: 'Analytics + progress visibility', detail: 'Highlights analytics dashboards, life score, and habit streaks.' },
  { id: 'automation', label: 'Automation', desc: 'Templates + smart rules', detail: 'Enables automation rules and template-based workflows.' },
];

const STEP_LABELS = [
  { label: 'Identity', shortLabel: 'Name' },
  { label: 'Focus', shortLabel: 'Focus' },
  { label: 'Style', shortLabel: 'Style' },
  { label: 'Start', shortLabel: 'Start' },
  { label: 'Finish', shortLabel: 'Done' },
];

const DRAFT_KEY = 'lifeos-onboarding-draft';

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveDraft(draft: any) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

export default function OnboardingPage() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();

  const draft = loadDraft();
  const [step, setStep] = useState<number>(draft?.step ?? 0);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [firstName, setFirstName] = useState(draft?.firstName ?? '');
  const [timezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [weekStart, setWeekStart] = useState<'mon' | 'sun'>(draft?.weekStart ?? 'mon');

  // Step 2
  const [focusAreas, setFocusAreas] = useState<string[]>(draft?.focusAreas ?? []);
  const [notSureOpen, setNotSureOpen] = useState(false);
  const [showAllFocus, setShowAllFocus] = useState(false);

  // Step 3
  const [operatingStyle, setOperatingStyle] = useState(draft?.operatingStyle ?? 'flexible');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Step 4
  const [startOption, setStartOption] = useState<'clean' | 'guided' | 'demo'>(draft?.startOption ?? 'clean');

  // Step 4B — guided
  const [guidedStep, setGuidedStep] = useState(0);
  const [sampleGoal, setSampleGoal] = useState(draft?.sampleGoal ?? '');
  const [sampleGoalDate, setSampleGoalDate] = useState('');
  const [sampleHabit, setSampleHabit] = useState(draft?.sampleHabit ?? '');
  const [sampleHabitFreq, setSampleHabitFreq] = useState<'daily' | 'weekly'>('daily');
  const [sampleTask, setSampleTask] = useState(draft?.sampleTask ?? '');
  const [sampleTaskDue, setSampleTaskDue] = useState<'today' | 'tomorrow' | 'week' | 'none'>('today');

  // Step 5
  const [showTutorial, setShowTutorial] = useState(true);

  // Persist draft on change
  useEffect(() => {
    saveDraft({ step, firstName, weekStart, focusAreas, operatingStyle, startOption, sampleGoal, sampleHabit, sampleTask });
  }, [step, firstName, weekStart, focusAreas, operatingStyle, startOption, sampleGoal, sampleHabit, sampleTask]);

  const toggleFocus = (id: string) => {
    setFocusAreas(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const computeModules = (): Record<string, boolean> => {
    const m: Record<string, boolean> = {};
    Object.keys(DEFAULT_MODULES).forEach(k => { m[k] = false; });
    m.tasks = true; m.inbox = true; m.notes = true; m.notifications = true;
    m.copilot = true;
    if (focusAreas.includes('productivity')) { m.planning = true; m.calendar = true; m.focus = true; }
    if (focusAreas.includes('health') || focusAreas.includes('mindfulness')) { m.habits = true; m.checkin = true; m.lifeScore = true; }
    if (focusAreas.includes('career') || focusAreas.includes('study')) { m.goals = true; m.analytics = true; }
    if (focusAreas.includes('finance')) { m.goals = true; m.analytics = true; }
    if (focusAreas.includes('personal')) { m.habits = true; m.checkin = true; }
    if (focusAreas.includes('custom')) {
      Object.keys(m).forEach(k => { m[k] = true; });
    }
    if (operatingStyle === 'automation') { m.templates = true; m.automations = true; }
    return m;
  };

  const handleDemoSkip = async () => {
    if (!user) return;
    setSaving(true);
    const modules = { ...DEFAULT_MODULES };
    Object.keys(modules).forEach(k => { modules[k] = true; });
    await seedDemoData(user.id);
    await updateProfile({
      first_name: 'Explorer',
      timezone,
      week_start: 'mon',
      onboarding_completed: true,
      focus_areas: [],
      operating_style: 'flexible',
      modules,
      preferences: { showTutorial: true, startMode: 'demo' },
      demo_mode: true,
    });
    clearDraft();
    setSaving(false);
    toast({ title: 'Demo loaded. Explore freely.' });
    navigate('/');
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    const modules = computeModules();

    if (startOption === 'guided') {
      const { format: fmtDate, addDays } = await import('date-fns');
      const todayStr = fmtDate(new Date(), 'yyyy-MM-dd');

      if (sampleGoal.trim()) {
        await supabase.from('goals').insert({
          user_id: user.id, title: sampleGoal.trim(), category: 'personal', status: 'active',
          start_date: todayStr,
          target_date: sampleGoalDate || fmtDate(addDays(new Date(), 30), 'yyyy-MM-dd'),
          progress_type: 'manual', progress_value: 0, linked_task_ids: [], milestones: [],
        });
      }
      if (sampleHabit.trim()) {
        await supabase.from('habits').insert({
          user_id: user.id, title: sampleHabit.trim(), frequency: sampleHabitFreq,
          target_count_per_period: 1, category: 'personal', logs: [], status: 'active',
        });
      }
      if (sampleTask.trim()) {
        const { format: fmtDate, addDays } = await import('date-fns');
        const todayStr = fmtDate(new Date(), 'yyyy-MM-dd');
        const dueMap: Record<string, string | undefined> = {
          today: todayStr,
          tomorrow: fmtDate(addDays(new Date(), 1), 'yyyy-MM-dd'),
          week: fmtDate(addDays(new Date(), 7), 'yyyy-MM-dd'),
          none: undefined,
        };
        await supabase.from('tasks').insert({
          user_id: user.id, title: sampleTask.trim(), status: 'todo', priority: 'med',
          due_date: dueMap[sampleTaskDue], tags: [], subtasks: [],
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
      preferences: { showTutorial, startMode: startOption },
      demo_mode: startOption === 'demo',
    });

    clearDraft();
    setSaving(false);
    toast({ title: 'Welcome to LifeOS.' });
    navigate('/');
  };

  const totalSteps = 5;
  const displayStep = Math.min(step, totalSteps);
  const progressPercent = step === 0 ? 0 : (displayStep / totalSteps) * 100;

  const canContinue = () => {
    if (step === 1) return firstName.trim().length > 0 && firstName.trim().length <= 32;
    if (step === 2) return focusAreas.length > 0;
    return true;
  };

  const visibleFocusAreas = showAllFocus ? FOCUS_AREAS : FOCUS_AREAS.slice(0, VISIBLE_FOCUS_COUNT);

  // Step 4B guided sub-flow
  if (step === 4 && startOption === 'guided' && guidedStep > 0) {
    return (
      <div className="min-h-screen flex bg-background">
        {/* Left rail */}
        <div className="hidden md:flex w-72 flex-col justify-center border-r border-border px-8">
          <div className="space-y-1 mb-8">
            <h1 className="text-xl font-bold tracking-tight">Life<span className="text-primary">OS</span></h1>
            <p className="text-xs text-muted-foreground">Guided setup</p>
          </div>
          <div className="space-y-3">
            {['Goal', 'Habit', 'Task'].map((label, i) => (
              <div key={label} className="flex items-center gap-3">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  guidedStep > i + 1 ? 'bg-primary text-primary-foreground' :
                  guidedStep === i + 1 ? 'border-2 border-primary text-primary' :
                  'border border-border text-muted-foreground'
                }`}>
                  {guidedStep > i + 1 ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <span className={`text-sm ${guidedStep === i + 1 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                  Add a {label.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <Card className="shadow-lg">
              <CardContent className="p-6">
                {guidedStep === 1 && (
                  <div className="space-y-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold">Add your first goal</h2>
                      </div>
                      <p className="text-sm text-muted-foreground">What do you want to achieve?</p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Goal title</Label>
                        <Input value={sampleGoal} onChange={e => setSampleGoal(e.target.value)} placeholder="e.g., Get fitter by summer" autoFocus />
                      </div>
                      <div>
                        <Label className="text-xs">Target date <span className="text-muted-foreground">(optional)</span></Label>
                        <Input type="date" value={sampleGoalDate} onChange={e => setSampleGoalDate(e.target.value)} />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Leave blank to skip.</p>
                    <div className="flex gap-2">
                      <Button variant="ghost" className="flex-1" onClick={() => setGuidedStep(0)}>Back</Button>
                      <Button className="flex-1" onClick={() => setGuidedStep(2)}>Next</Button>
                    </div>
                  </div>
                )}

                {guidedStep === 2 && (
                  <div className="space-y-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 mb-3">
                        <Repeat className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold">Add one habit</h2>
                      </div>
                      <p className="text-sm text-muted-foreground">What do you want to do consistently?</p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Habit title</Label>
                        <Input value={sampleHabit} onChange={e => setSampleHabit(e.target.value)} placeholder="e.g., Walk 20 minutes" autoFocus />
                      </div>
                      <div>
                        <Label className="text-xs">Frequency</Label>
                        <div className="flex gap-2 mt-1">
                          {(['daily', 'weekly'] as const).map(f => (
                            <button key={f} onClick={() => setSampleHabitFreq(f)}
                              className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${sampleHabitFreq === f ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50'}`}>
                              {f === 'daily' ? 'Daily' : 'Weekly'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Leave blank to skip.</p>
                    <div className="flex gap-2">
                      <Button variant="ghost" className="flex-1" onClick={() => setGuidedStep(1)}>Back</Button>
                      <Button className="flex-1" onClick={() => setGuidedStep(3)}>Next</Button>
                    </div>
                  </div>
                )}

                {guidedStep === 3 && (
                  <div className="space-y-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckSquare className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold">Add one task</h2>
                      </div>
                      <p className="text-sm text-muted-foreground">What's one thing you need to do?</p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Task title</Label>
                        <Input value={sampleTask} onChange={e => setSampleTask(e.target.value)} placeholder="e.g., Book gym membership" autoFocus />
                      </div>
                      <div>
                        <Label className="text-xs">Due</Label>
                        <div className="flex gap-2 mt-1">
                          {([{ k: 'today', l: 'Today' }, { k: 'tomorrow', l: 'Tomorrow' }, { k: 'week', l: '+7 days' }, { k: 'none', l: 'None' }] as const).map(({ k, l }) => (
                            <button key={k} onClick={() => setSampleTaskDue(k as any)}
                              className={`flex-1 py-2 rounded-md border text-xs font-medium transition-colors ${sampleTaskDue === k ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50'}`}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {/* Summary */}
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
                      <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Summary</p>
                      {sampleGoal.trim() && <p className="text-xs">Goal: {sampleGoal.trim()}</p>}
                      {sampleHabit.trim() && <p className="text-xs">Habit: {sampleHabit.trim()} ({sampleHabitFreq})</p>}
                      {sampleTask.trim() && <p className="text-xs">Task: {sampleTask.trim()}</p>}
                      {!sampleGoal.trim() && !sampleHabit.trim() && !sampleTask.trim() && (
                        <p className="text-xs text-muted-foreground">Nothing added yet — that's okay.</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" className="flex-1" onClick={() => setGuidedStep(2)}>Back</Button>
                      <Button className="flex-1" onClick={() => { setGuidedStep(0); setStep(5); }}>
                        Create & continue <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left rail — step indicator (hidden on step 0) */}
      {step > 0 && (
        <div className="hidden md:flex w-72 flex-col justify-center border-r border-border px-8">
          <div className="space-y-1 mb-8">
            <h1 className="text-xl font-bold tracking-tight">Life<span className="text-primary">OS</span></h1>
            <p className="text-xs text-muted-foreground">Setup — {Math.round(progressPercent)}% complete</p>
          </div>
          <div className="space-y-3">
            {STEP_LABELS.map((sl, i) => {
              const stepNum = i + 1;
              const isDone = displayStep > stepNum;
              const isCurrent = displayStep === stepNum;
              return (
                <div key={sl.label} className="flex items-center gap-3">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    isDone ? 'bg-primary text-primary-foreground' :
                    isCurrent ? 'border-2 border-primary text-primary' :
                    'border border-border text-muted-foreground'
                  }`}>
                    {isDone ? <Check className="h-3 w-3" /> : stepNum}
                  </div>
                  <span className={`text-sm ${isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                    {sl.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">

          {/* Mobile progress (shown on step > 0) */}
          {step > 0 && (
            <div className="md:hidden mb-6 text-center space-y-2">
              <h1 className="text-lg font-bold tracking-tight">Life<span className="text-primary">OS</span></h1>
              <div className="flex items-center gap-2 justify-center">
                {STEP_LABELS.map((sl, i) => {
                  const stepNum = i + 1;
                  const isDone = displayStep > stepNum;
                  const isCurrent = displayStep === stepNum;
                  return (
                    <div key={sl.label} className={`h-1.5 flex-1 rounded-full ${isDone ? 'bg-primary' : isCurrent ? 'bg-primary/50' : 'bg-border'}`} />
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">Step {displayStep} of {totalSteps}</p>
            </div>
          )}

          <Card className={step === 0 ? 'border-0 shadow-none bg-transparent' : 'shadow-lg'}>
            <CardContent className={step === 0 ? 'p-0' : 'p-6'}>

              {/* STEP 0 — Welcome */}
              {step === 0 && (
                <div className="text-center space-y-8 py-16">
                  <div className="space-y-3">
                    <h1 className="text-4xl font-bold tracking-tight">
                      Welcome to Life<span className="text-primary">OS</span>
                    </h1>
                    <p className="text-muted-foreground text-lg max-w-sm mx-auto">
                      Let's set up your workspace in under 2 minutes.
                    </p>
                  </div>
                  <div className="space-y-3 max-w-xs mx-auto">
                    <Button className="w-full h-12 text-base" onClick={() => setStep(1)}>
                      Start setup <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                    <Button variant="outline" className="w-full" onClick={handleDemoSkip} disabled={saving}>
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Explore demo
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    You can edit everything later in Settings.
                  </p>
                </div>
              )}

              {/* STEP 1 — Identity */}
              {step === 1 && (
                <div className="space-y-5">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold">What should we call you?</h2>
                    <p className="text-sm text-muted-foreground">We'll personalize your dashboard and planning.</p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs font-medium">First name</Label>
                      <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Your name" autoFocus maxLength={32} className="mt-1" />
                      {firstName.length > 0 && firstName.trim().length === 0 && (
                        <p className="text-xs text-destructive mt-1">Name cannot be only spaces.</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs font-medium">Timezone</Label>
                      <Input value={timezone} disabled className="text-muted-foreground mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs font-medium">Week starts on</Label>
                      <div className="flex gap-2 mt-1.5">
                        {(['mon', 'sun'] as const).map(d => (
                          <button key={d} onClick={() => setWeekStart(d)}
                            className={`flex-1 py-2.5 rounded-md border text-sm font-medium transition-colors ${weekStart === d ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50'}`}>
                            {d === 'mon' ? 'Monday' : 'Sunday'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">You can change this later.</p>
                  <Button className="w-full" onClick={() => setStep(2)} disabled={!canContinue()}>Continue</Button>
                </div>
              )}

              {/* STEP 2 — Focus areas */}
              {step === 2 && (
                <div className="space-y-5">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold">What do you want to improve?</h2>
                    <p className="text-sm text-muted-foreground">Pick up to 3. This only sets defaults.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {visibleFocusAreas.map(fa => (
                      <button key={fa.id} onClick={() => toggleFocus(fa.id)}
                        className={`flex flex-col gap-1 rounded-lg border p-3 text-left transition-all ${focusAreas.includes(fa.id) ? 'border-primary bg-primary/10 ring-1 ring-primary/20' : 'border-border hover:bg-muted/50'}`}>
                        <div className="flex items-center gap-2">
                          <fa.icon className="h-4 w-4 shrink-0" />
                          <span className="text-sm font-medium">{fa.label}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground leading-tight">{fa.hint}</span>
                      </button>
                    ))}
                  </div>
                  {!showAllFocus && FOCUS_AREAS.length > VISIBLE_FOCUS_COUNT && (
                    <button onClick={() => setShowAllFocus(true)} className="text-xs text-primary hover:underline w-full text-center">
                      Show more options…
                    </button>
                  )}
                  <button onClick={() => setNotSureOpen(true)} className="text-xs text-muted-foreground hover:text-foreground w-full text-center">Not sure?</button>
                  <p className="text-[11px] text-muted-foreground text-center">You can change this later.</p>
                  <div className="flex gap-2">
                    <Button variant="ghost" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                    <Button className="flex-1" onClick={() => setStep(3)} disabled={!canContinue()}>Continue</Button>
                  </div>

                  <Dialog open={notSureOpen} onOpenChange={setNotSureOpen}>
                    <DialogContent className="max-w-xs">
                      <div className="space-y-3 text-sm">
                        <p className="font-medium">Not sure what to pick?</p>
                        <p className="text-muted-foreground">Choose <strong>Productivity</strong> + one other area that interests you. You can always change this in Settings.</p>
                        <Button variant="outline" className="w-full" onClick={() => setNotSureOpen(false)}>Got it</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}

              {/* STEP 3 — Operating style */}
              {step === 3 && (
                <div className="space-y-5">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold">How do you prefer to operate?</h2>
                    <p className="text-sm text-muted-foreground">We'll tailor your dashboard. Nothing is permanent.</p>
                  </div>
                  <div className="space-y-2">
                    {STYLES.map(s => (
                      <button key={s.id} onClick={() => setOperatingStyle(s.id)}
                        className={`w-full flex items-center gap-3 rounded-lg border p-4 text-left transition-all ${operatingStyle === s.id ? 'border-primary bg-primary/10 ring-1 ring-primary/20' : 'border-border hover:bg-muted/50'}`}>
                        <div className={`h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center ${operatingStyle === s.id ? 'border-primary' : 'border-muted-foreground'}`}>
                          {operatingStyle === s.id && <div className="h-2 w-2 rounded-full bg-primary" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{s.label}</p>
                          <p className="text-xs text-muted-foreground">{s.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                    <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto">
                      {advancedOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      What does each style change?
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-1.5 text-xs text-muted-foreground rounded-lg border border-border p-3">
                      {STYLES.map(s => (
                        <p key={s.id}><strong>{s.label}:</strong> {s.detail}</p>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                  <p className="text-[11px] text-muted-foreground text-center">You can change this later.</p>
                  <div className="flex gap-2">
                    <Button variant="ghost" className="flex-1" onClick={() => setStep(2)}>Back</Button>
                    <Button className="flex-1" onClick={() => setStep(4)}>Continue</Button>
                  </div>
                </div>
              )}

              {/* STEP 4 — Choose start */}
              {step === 4 && (
                <div className="space-y-5">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold">Choose your starting point</h2>
                    <p className="text-sm text-muted-foreground">You can always add or reset data later.</p>
                  </div>
                  <div className="space-y-2">
                    {[
                      { id: 'clean' as const, label: 'Start clean', desc: 'Blank slate. Add what matters when you\'re ready.', icon: Rocket, rec: true },
                      { id: 'guided' as const, label: 'Guided minimal setup', desc: 'We\'ll help you add 1 goal, 1 habit, and 1 task.', icon: Sparkles, rec: false },
                      { id: 'demo' as const, label: 'Explore demo', desc: 'Pre-filled example data to click around.', icon: BarChart3, rec: false },
                    ].map(opt => (
                      <button key={opt.id} onClick={() => setStartOption(opt.id)}
                        className={`w-full flex items-center gap-3 rounded-lg border p-4 text-left transition-all ${startOption === opt.id ? 'border-primary bg-primary/10 ring-1 ring-primary/20' : 'border-border hover:bg-muted/50'}`}>
                        <opt.icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        </div>
                        {opt.rec && <Badge variant="secondary" className="text-[9px] shrink-0">Recommended</Badge>}
                      </button>
                    ))}
                  </div>
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto">
                      <ChevronRight className="h-3 w-3" /> Why this matters
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 text-xs text-muted-foreground rounded-lg border border-border p-3">
                      Starting clean builds trust — your dashboard reflects real progress. Demo helps you explore faster.
                    </CollapsibleContent>
                  </Collapsible>
                  <div className="flex gap-2">
                    <Button variant="ghost" className="flex-1" onClick={() => setStep(3)}>Back</Button>
                    <Button className="flex-1" onClick={() => {
                      if (startOption === 'guided') { setGuidedStep(1); }
                      else { setStep(5); }
                    }}>Continue</Button>
                  </div>
                </div>
              )}

              {/* STEP 5 — Finish */}
              {step === 5 && (
                <div className="space-y-5">
                  <div className="text-center space-y-2">
                    <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="text-lg font-semibold">You're ready.</h2>
                    <p className="text-sm text-muted-foreground">Your workspace is configured.</p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div>
                      <p className="text-sm font-medium">Show guided tour on first visit</p>
                      <p className="text-xs text-muted-foreground">Quick walkthrough of key features (~60s)</p>
                    </div>
                    <Switch checked={showTutorial} onCheckedChange={setShowTutorial} />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" className="flex-1" onClick={() => {
                      if (startOption === 'guided') { setGuidedStep(3); }
                      else { setStep(4); }
                    }}>Back</Button>
                    <Button className="flex-1" onClick={handleFinish} disabled={saving}>
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Enter LifeOS <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

            </CardContent>
          </Card>

          {/* Skip for now link (steps 2-4) */}
          {step >= 2 && step <= 4 && (
            <button onClick={() => setStep(5)} className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center mt-4">
              Skip for now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
