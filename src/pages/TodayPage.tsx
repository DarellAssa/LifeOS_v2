import { useMemo, useCallback, useState } from 'react';
import { useAppContext } from '@/store/AppContext';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { CheckSquare, Inbox, ArrowRight, ChevronDown, ChevronUp, Sparkles, Leaf, Calendar, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { DailyBriefingCard } from '@/components/DailyBriefingCard';
import { mergePreferences } from '@/types/preferences';

export default function TodayPage() {
  const {
    data, toggleTaskDone, getTodayTasks, getOverdueTasks,
    getAgendaForDay, markNotificationRead,
  } = useAppContext();
  const { profile, isModuleEnabled } = useAuth();
  const navigate = useNavigate();
  const { tasks, goals, habits } = data;
  const [briefingOpen, setBriefingOpen] = useState(false);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayTasks = getTodayTasks();
  const overdue = getOverdueTasks();
  const todayAgenda = useMemo(() => getAgendaForDay(todayStr), [getAgendaForDay, todayStr]);
  const inboxCount = data.inboxItems.filter(i => i.status === 'unprocessed').length;

  const hasNoData = tasks.length === 0 && goals.length === 0 && habits.length === 0 && data.events.length === 0;

  const hour = new Date().getHours();
  const userName = profile?.first_name || '';
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  const handleOpenCopilot = useCallback((message?: string) => {
    window.dispatchEvent(new CustomEvent('open-copilot', { detail: { message } }));
  }, []);

  const statusLine = useMemo(() => {
    if (hasNoData) return null;
    const remaining = todayTasks.filter(t => t.status !== 'done').length;
    if (overdue.length === 0 && remaining === 0 && inboxCount === 0) return "You're all set for today. 🌿";
    const parts: string[] = [];
    if (overdue.length > 0) parts.push(`${overdue.length} overdue`);
    if (remaining > 0) parts.push(`${remaining} tasks remaining`);
    if (inboxCount > 0) parts.push(`${inboxCount} in inbox`);
    return parts.join(' · ');
  }, [overdue, todayTasks, inboxCount, hasNoData]);

  const nextActions = useMemo(() => {
    const items: { id: string; title: string; type: string; route: string; urgent?: boolean }[] = [];
    overdue.slice(0, 2).forEach(t => items.push({ id: t.id, title: t.title, type: 'task', route: '/plan', urgent: true }));
    todayTasks.filter(t => t.status !== 'done' && !overdue.find(o => o.id === t.id)).slice(0, 3 - items.length).forEach(t =>
      items.push({ id: t.id, title: t.title, type: 'task', route: '/plan' })
    );
    return items.slice(0, 5);
  }, [overdue, todayTasks]);

  const showBriefingToggle = mergePreferences(profile?.preferences).briefing.show_on_dashboard && !hasNoData;

  // Metrics for hero card
  const scheduledCount = todayAgenda.length;
  const remainingCount = todayTasks.filter(t => t.status !== 'done').length;

  // Primary recommendation
  const heroAction = useMemo(() => {
    if (overdue.length > 0) return { label: `Review ${overdue.length} overdue`, route: '/plan', variant: 'destructive' as const };
    if (inboxCount > 0) return { label: `Triage inbox (${inboxCount})`, route: '/capture', variant: 'default' as const };
    if (remainingCount > 0) return { label: 'Start next task', route: '/plan', variant: 'default' as const };
    return null;
  }, [overdue, inboxCount, remainingCount]);

  return (
    <div className="space-y-8" data-tour="dashboard-header">
      {/* Greeting */}
      <div className="space-y-1">
        <h1 className="page-title">
          Good {greeting}{userName ? `, ${userName}` : ''} ☀️
        </h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMMM d')}</p>
        {statusLine && !hasNoData && (
          <p className="text-sm text-muted-foreground mt-1">{statusLine}</p>
        )}
      </div>

      {/* Empty state */}
      {hasNoData && (
        <div className="surface-hero py-16 px-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Leaf className="h-7 w-7 text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-display font-medium">Welcome to LifeOS</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              A calm space to organize your life. Start by capturing a thought or adding your first task.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => navigate('/capture')} className="gap-2">
              <Inbox className="h-4 w-4" /> Capture something
            </Button>
            <Button variant="outline" onClick={() => navigate('/plan')} className="gap-2">
              <CheckSquare className="h-4 w-4" /> Add a task
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Want to explore with sample data?{' '}
            <button onClick={() => navigate('/settings')} className="text-primary hover:underline">Try demo mode</button>
          </p>
        </div>
      )}

      {!hasNoData && (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* LEFT: Hero Focus Card — spans 3 cols */}
          <div className="lg:col-span-3 space-y-6">
            <div className="surface-hero p-6 space-y-5">
              <div className="space-y-1">
                <p className="section-label">Today's Focus</p>
                <p className="text-sm text-foreground">
                  {overdue.length > 0
                    ? `You have ${overdue.length} overdue item${overdue.length > 1 ? 's' : ''} to clear.`
                    : remainingCount > 0
                    ? `${remainingCount} task${remainingCount > 1 ? 's' : ''} on your plate today.`
                    : "Nothing urgent — a good day to plan ahead."
                  }
                </p>
              </div>

              {/* Metric chips */}
              <div className="flex flex-wrap gap-2">
                {overdue.length > 0 && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-destructive/8 border border-destructive/15 px-3 py-1.5 text-xs text-destructive font-medium">
                    <AlertTriangle className="h-3 w-3" />
                    {overdue.length} overdue
                  </div>
                )}
                {inboxCount > 0 && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-muted border border-border px-3 py-1.5 text-xs text-muted-foreground">
                    <Inbox className="h-3 w-3" />
                    {inboxCount} inbox
                  </div>
                )}
                {scheduledCount > 0 && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-muted border border-border px-3 py-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {scheduledCount} scheduled
                  </div>
                )}
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap gap-3">
                {heroAction && (
                  <Button
                    onClick={() => navigate(heroAction.route)}
                    variant={heroAction.variant === 'destructive' ? 'destructive' : 'default'}
                    className="gap-2"
                  >
                    {heroAction.label}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="outline" onClick={() => navigate('/plan')} className="gap-2">
                  Open Plan
                </Button>
              </div>
            </div>

            {/* Schedule (inside left column, below hero) */}
            {todayAgenda.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="section-label">Schedule</h2>
                  <button onClick={() => navigate('/calendar')} className="text-xs text-primary hover:underline">Open calendar</button>
                </div>
                <div className="surface-1 divide-y divide-border overflow-hidden">
                  {todayAgenda.slice(0, 5).map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
                      <span className="text-xs text-muted-foreground w-16 shrink-0 tabular-nums">
                        {format(new Date(item.startDateTime), 'h:mm a')}
                      </span>
                      <span className="text-sm flex-1">{item.title}</span>
                      <span className="text-[10px] text-muted-foreground capitalize bg-muted px-2 py-0.5 rounded-md">{item.type}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* RIGHT: Next Up + Quick Capture — spans 2 cols */}
          <div className="lg:col-span-2 space-y-6">
            {/* Next Up */}
            {nextActions.length > 0 && (
              <section className="space-y-3">
                <h2 className="section-label">Next up</h2>
                <div className="surface-1 divide-y divide-border overflow-hidden">
                  {nextActions.map(item => (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.route)}
                      className="flex items-center gap-3 w-full px-4 py-3.5 text-left transition-all duration-150 hover:bg-accent/30 group"
                    >
                      <div className={`h-2 w-2 rounded-full shrink-0 ${item.urgent ? 'bg-destructive' : 'bg-primary/40'}`} />
                      <span className="text-sm flex-1 truncate">{item.title}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Quick Capture / Inbox */}
            <section className="space-y-3">
              <h2 className="section-label">Quick capture</h2>
              <div className="surface-1 p-4 space-y-3">
                <button
                  onClick={() => navigate('/capture')}
                  className="flex items-center gap-2 w-full rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-primary/30 hover:text-foreground transition-all duration-150"
                >
                  <Inbox className="h-4 w-4" />
                  <span>Capture something…</span>
                </button>
                {inboxCount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Inbox: {inboxCount} item{inboxCount !== 1 ? 's' : ''}</span>
                    <Button size="sm" variant="outline" onClick={() => navigate('/capture')} className="text-xs h-8">
                      Triage
                    </Button>
                  </div>
                )}
              </div>
            </section>

            {/* Daily Briefing — collapsible */}
            {showBriefingToggle && (
              <section className="space-y-3">
                <button
                  onClick={() => setBriefingOpen(!briefingOpen)}
                  className="flex items-center gap-2.5 w-full text-left rounded-xl px-4 py-3 transition-all duration-150 hover:bg-accent/50 surface-2"
                >
                  <Sparkles className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium flex-1">Daily Briefing</span>
                  {briefingOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {briefingOpen && (
                  <div className="mt-2">
                    <DailyBriefingCard onOpenCopilot={handleOpenCopilot} />
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}