import { useMemo, useCallback, useState } from 'react';
import { useAppContext } from '@/store/AppContext';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { CheckSquare, Inbox, ArrowRight, ChevronDown, ChevronUp, Sparkles, Leaf, Calendar, Clock } from 'lucide-react';
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

  const scheduledCount = todayAgenda.length;
  const remainingCount = todayTasks.filter(t => t.status !== 'done').length;

  const heroAction = useMemo(() => {
    if (overdue.length > 0) return { label: `Review ${overdue.length} overdue`, route: '/plan', isOverdue: true };
    if (inboxCount > 0) return { label: `Triage inbox (${inboxCount})`, route: '/capture', isOverdue: false };
    if (remainingCount > 0) return { label: 'Start next task', route: '/plan', isOverdue: false };
    return null;
  }, [overdue, inboxCount, remainingCount]);

  return (
    <div className="space-y-6" data-tour="dashboard-header">
      {/* Greeting */}
      <div className="space-y-1">
        <h1 className="page-title">
          Good {greeting}{userName ? `, ${userName}` : ''}
        </h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMMM d')}</p>
        {statusLine && !hasNoData && (
          <p className="text-xs text-muted-foreground mt-0.5">{statusLine}</p>
        )}
      </div>

      {/* Empty state */}
      {hasNoData && (
        <div className="surface-hero p-10 text-center space-y-5">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Leaf className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold">Welcome to LifeOS</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
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
        <div className="grid gap-5 lg:grid-cols-3">
          {/* MAIN COLUMN */}
          <div className="lg:col-span-2 space-y-5">
            {/* Hero Focus Card */}
            <div className="surface-hero p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="space-y-1 flex-1 min-w-0">
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
              </div>

              {/* Metric chips */}
              <div className="flex flex-wrap gap-2">
                {overdue.length > 0 && (
                  <span className="pill-chip !bg-[hsl(var(--attention-muted))] !text-[hsl(var(--attention-foreground))]">
                    <Clock className="h-3 w-3" /> {overdue.length} overdue
                  </span>
                )}
                {inboxCount > 0 && (
                  <span className="pill-chip"><Inbox className="h-3 w-3" /> {inboxCount} inbox</span>
                )}
                {scheduledCount > 0 && (
                  <span className="pill-chip"><Calendar className="h-3 w-3" /> {scheduledCount} scheduled</span>
                )}
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap gap-2.5">
                {heroAction && (
                  <Button
                    size="sm"
                    onClick={() => navigate(heroAction.route)}
                    className={`gap-2 ${heroAction.isOverdue ? 'bg-[hsl(var(--attention))] hover:bg-[hsl(var(--attention)/0.9)] text-white' : ''}`}
                  >
                    {heroAction.label} <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => navigate('/plan')} className="gap-2">
                  Open Plan
                </Button>
              </div>
            </div>

            {/* Next Up */}
            {nextActions.length > 0 && (
              <section className="space-y-2.5">
                <h2 className="section-label px-1">Next up</h2>
                <div className="surface-1 overflow-hidden">
                  {nextActions.map((item, i) => (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.route)}
                      className={`flex items-center gap-3 w-full px-4 py-3 text-left row-hover group ${i > 0 ? 'border-t border-border/40' : ''}`}
                    >
                      <div className={`h-2 w-2 rounded-full shrink-0 ${item.urgent ? 'bg-[hsl(var(--attention))]' : 'bg-primary/40'}`} />
                      <span className="text-sm flex-1 truncate">{item.title}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* RIGHT RAIL */}
          <div className="space-y-5">
            {/* Schedule */}
            {todayAgenda.length > 0 && (
              <section className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <h2 className="section-label">Schedule</h2>
                  <button onClick={() => navigate('/calendar')} className="text-[11px] text-primary hover:underline">Calendar</button>
                </div>
                <div className="surface-1 overflow-hidden">
                  {todayAgenda.slice(0, 4).map((item, i) => (
                    <div key={item.id} className={`flex items-center gap-2.5 px-3.5 py-2.5 row-hover ${i > 0 ? 'border-t border-border/40' : ''}`}>
                      <div className="h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
                      <span className="text-sm flex-1 truncate">{item.title}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                        {format(new Date(item.startDateTime), 'h:mm a')}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Capture */}
            <section className="space-y-2.5">
              <h2 className="section-label px-1">Capture</h2>
              <div className="surface-1 overflow-hidden p-3 space-y-2">
                <button
                  onClick={() => navigate('/capture')}
                  className="flex items-center gap-2 w-full rounded-xl bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Inbox className="h-4 w-4 shrink-0" />
                  <span>Capture something…</span>
                </button>
                {inboxCount > 0 && (
                  <div className="flex items-center justify-between px-1 py-1">
                    <span className="text-xs text-muted-foreground">Inbox: {inboxCount}</span>
                    <Button size="sm" variant="ghost" onClick={() => navigate('/capture')} className="text-xs h-7 px-2.5">
                      Triage
                    </Button>
                  </div>
                )}
              </div>
            </section>

            {/* Daily Briefing */}
            {showBriefingToggle && (
              <section className="space-y-2.5">
                <button
                  onClick={() => setBriefingOpen(!briefingOpen)}
                  className="flex items-center gap-2 w-full text-left surface-1 px-4 py-3 row-hover"
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-sm font-medium flex-1">Daily Briefing</span>
                  {briefingOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
                {briefingOpen && (
                  <div className="mt-1">
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
