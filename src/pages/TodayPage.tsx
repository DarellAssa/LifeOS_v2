import { useMemo, useCallback, useState } from 'react';
import { useAppContext } from '@/store/AppContext';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { CheckSquare, Inbox, ArrowRight, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
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

  // Status line
  const statusLine = useMemo(() => {
    if (hasNoData) return null;
    const remaining = todayTasks.filter(t => t.status !== 'done').length;
    const needsAttention = overdue.length + (inboxCount > 0 ? 1 : 0);
    if (needsAttention === 0 && remaining === 0) return "You're all set for today.";
    const parts: string[] = [];
    if (overdue.length > 0) parts.push(`${overdue.length} overdue`);
    if (remaining > 0) parts.push(`${remaining} tasks remaining`);
    if (inboxCount > 0) parts.push(`${inboxCount} in inbox`);
    return parts.join(' · ');
  }, [overdue, todayTasks, inboxCount, hasNoData]);

  // Next actions — max 3 most important items
  const nextActions = useMemo(() => {
    const items: { id: string; title: string; type: string; route: string; urgent?: boolean }[] = [];
    overdue.slice(0, 2).forEach(t => items.push({ id: t.id, title: t.title, type: 'task', route: '/plan', urgent: true }));
    todayTasks.filter(t => t.status !== 'done' && !overdue.find(o => o.id === t.id)).slice(0, 3 - items.length).forEach(t =>
      items.push({ id: t.id, title: t.title, type: 'task', route: '/plan' })
    );
    return items.slice(0, 3);
  }, [overdue, todayTasks]);

  const showBriefingToggle = mergePreferences(profile?.preferences).briefing.show_on_dashboard && !hasNoData;

  return (
    <div className="max-w-xl mx-auto space-y-8 py-2" data-tour="dashboard-header">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Good {greeting}{userName ? `, ${userName}` : ''}
        </h1>
        <p className="text-muted-foreground">{format(new Date(), 'EEEE, MMMM d')}</p>
      </div>

      {/* Empty state */}
      {hasNoData && (
        <div className="rounded-xl border border-dashed border-border py-14 px-8 text-center space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-medium">Welcome to LifeOS</h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Your system starts clean. Add something to get going.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => navigate('/capture')} className="gap-2">
              <Inbox className="h-4 w-4" /> Capture your first thing
            </Button>
            <Button variant="outline" onClick={() => navigate('/plan')} className="gap-2">
              <CheckSquare className="h-4 w-4" /> Add your first task
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Want to explore with sample data?{' '}
            <button onClick={() => navigate('/settings')} className="text-primary hover:underline">Try demo mode</button>
          </p>
        </div>
      )}

      {!hasNoData && (
        <>
          {/* Status line */}
          {statusLine && (
            <p className="text-sm text-muted-foreground -mt-4">{statusLine}</p>
          )}

          {/* Collapsible Daily Briefing */}
          {showBriefingToggle && (
            <div>
              <button
                onClick={() => setBriefingOpen(!briefingOpen)}
                className="flex items-center gap-2 w-full text-left rounded-lg px-4 py-3 transition-colors hover:bg-secondary"
              >
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium flex-1">Daily Briefing</span>
                {overdue.length > 0 && (
                  <span className="text-xs text-destructive font-medium">{overdue.length} overdue</span>
                )}
                {inboxCount > 0 && (
                  <span className="text-xs text-muted-foreground">{inboxCount} inbox</span>
                )}
                {briefingOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {briefingOpen && (
                <div className="mt-2">
                  <DailyBriefingCard onOpenCopilot={handleOpenCopilot} />
                </div>
              )}
            </div>
          )}

          {/* Next Actions */}
          {nextActions.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Next up</h2>
              <div className="space-y-1">
                {nextActions.map(item => (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.route)}
                    className="flex items-center gap-3 w-full rounded-lg px-4 py-3.5 text-left transition-colors hover:bg-secondary"
                  >
                    <div className={`h-2 w-2 rounded-full shrink-0 ${item.urgent ? 'bg-destructive' : 'bg-primary/40'}`} />
                    <span className="text-sm flex-1">{item.title}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Schedule */}
          {todayAgenda.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Schedule</h2>
                <button onClick={() => navigate('/calendar')} className="text-xs text-primary hover:underline">Open calendar</button>
              </div>
              <div className="space-y-1">
                {todayAgenda.slice(0, 5).map(item => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg px-4 py-2.5">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">
                      {format(new Date(item.startDateTime), 'h:mm a')}
                    </span>
                    <span className="text-sm flex-1">{item.title}</span>
                    <span className="text-xs text-muted-foreground capitalize">{item.type}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Inbox summary */}
          {inboxCount > 0 && (
            <section className="flex items-center justify-between rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <Inbox className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{inboxCount} unprocessed item{inboxCount !== 1 ? 's' : ''}</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate('/capture')}>
                Capture
              </Button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
