import { useMemo, useCallback, useState, useEffect } from 'react';
import { useAppContext } from '@/store/AppContext';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  CheckSquare, Inbox, ArrowRight, Sparkles, Leaf, Calendar,
  Clock, Target, MessageSquare, ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

/* ── Typing effect hook — makes Jarvis "speak" ── */
function useTypingEffect(text: string, speed = 18, startDelay = 600) {
  const [displayed, setDisplayed] = useState('');
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setIsDone(false);
    if (!text) return;
    let i = 0;
    let timeout: ReturnType<typeof setTimeout>;
    const startTyping = () => {
      const type = () => {
        if (i < text.length) {
          setDisplayed(text.slice(0, i + 1));
          i++;
          const char = text[i - 1];
          const delay = char === '.' || char === '—' ? 80 : char === ',' ? 50 : Math.random() * speed + 10;
          timeout = setTimeout(type, delay);
        } else {
          setIsDone(true);
        }
      };
      type();
    };
    timeout = setTimeout(startTyping, startDelay);
    return () => clearTimeout(timeout);
  }, [text, speed, startDelay]);

  return { displayed, isDone };
}

/* ── Generate briefing text from real data ── */
function generateBriefing(
  todayTasks: any[], overdue: any[], inboxCount: number,
  agendaCount: number, weekCompletion: number,
): string {
  const remaining = todayTasks.filter((t: any) => t.status !== 'done').length;
  const parts: string[] = [];
  if (remaining > 0 || overdue.length > 0) {
    parts.push(`You have ${remaining} task${remaining !== 1 ? 's' : ''} to focus on today.`);
  }
  if (overdue.length > 0) {
    parts.push(`"${overdue[0].title}" is overdue — I'd start there.`);
  }
  if (agendaCount > 0) {
    parts.push(`You have ${agendaCount} scheduled item${agendaCount !== 1 ? 's' : ''} on your calendar.`);
  }
  if (inboxCount > 0) {
    parts.push(`Your inbox has ${inboxCount} item${inboxCount !== 1 ? 's' : ''} waiting to be triaged.`);
  }
  if (weekCompletion > 0) {
    parts.push(`Your week is ${weekCompletion}% complete — ${weekCompletion >= 60 ? 'solid progress.' : 'keep pushing.'}`);
  }
  if (parts.length === 0) {
    parts.push("You're all clear today. A great time to plan ahead or capture new ideas.");
  }
  return parts.join(' ');
}

/* ── TODAY PAGE ── */
export default function TodayPage() {
  const {
    data, toggleTaskDone, getTodayTasks, getOverdueTasks,
    getAgendaForDay, completionRateThisWeek,
  } = useAppContext();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayTasks = getTodayTasks();
  const overdue = getOverdueTasks();
  const todayAgenda = useMemo(() => getAgendaForDay(todayStr), [getAgendaForDay, todayStr]);
  const inboxCount = data.inboxItems.filter(i => i.status === 'unprocessed').length;
  const weekCompletion = completionRateThisWeek();

  const hasNoData = data.tasks.length === 0 && data.goals.length === 0
    && data.habits.length === 0 && data.events.length === 0;

  const hour = new Date().getHours();
  const userName = profile?.first_name || '';
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  const briefingText = useMemo(
    () => generateBriefing(todayTasks, overdue, inboxCount, todayAgenda.length, weekCompletion),
    [todayTasks, overdue, inboxCount, todayAgenda.length, weekCompletion],
  );
  const { displayed: typedBriefing, isDone: briefingDone } = useTypingEffect(
    hasNoData ? '' : briefingText,
  );

  const focusItems = useMemo(() => {
    const items: { id: string; title: string; isOverdue: boolean; energy?: string; status: string }[] = [];
    overdue.slice(0, 2).forEach(t => items.push({
      id: t.id, title: t.title, isOverdue: true, energy: t.priority, status: t.status,
    }));
    todayTasks
      .filter(t => t.status !== 'done' && !overdue.find(o => o.id === t.id))
      .slice(0, 3 - items.length)
      .forEach(t => items.push({
        id: t.id, title: t.title, isOverdue: false, energy: t.priority, status: t.status,
      }));
    return items.slice(0, 3);
  }, [overdue, todayTasks]);

  const handleOpenCopilot = useCallback((message?: string) => {
    window.dispatchEvent(new CustomEvent('open-copilot', { detail: { message } }));
  }, []);

  const remainingCount = todayTasks.filter(t => t.status !== 'done').length;

  return (
    <div className="today-page space-y-8 pb-12">
      {/* Animated background orbs */}
      <div className="today-bg" aria-hidden="true">
        <div className="today-orb today-orb-1" />
        <div className="today-orb today-orb-2" />
        <div className="today-orb today-orb-3" />
      </div>

      {/* Greeting */}
      <div className="today-greeting animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="today-title">
          Good {greeting}{userName ? `, ${userName}` : ''} <span className="today-wave">👋</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
        {!hasNoData && (
          <div className="flex flex-wrap gap-2 mt-4">
            {remainingCount > 0 && (
              <span className="today-pill today-pill-accent">
                <span className="today-pill-dot today-pill-dot-accent" />
                {remainingCount} task{remainingCount !== 1 ? 's' : ''} today
              </span>
            )}
            {overdue.length > 0 && (
              <span className="today-pill today-pill-rose">
                <span className="today-pill-dot today-pill-dot-rose" />
                {overdue.length} overdue
              </span>
            )}
            {weekCompletion > 0 && (
              <span className="today-pill today-pill-green">
                <span className="today-pill-dot today-pill-dot-green" />
                Week {weekCompletion}% on track
              </span>
            )}
          </div>
        )}
      </div>

      {/* Empty state */}
      {hasNoData && (
        <div className="today-empty animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
          <div className="today-empty-icon">
            <Leaf className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold mt-4">Welcome to LifeOS</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-2">
            A calm space to organize your life. Start by capturing a thought or adding your first task.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-5">
            <Button onClick={() => navigate('/capture')} className="gap-2">
              <Inbox className="h-4 w-4" /> Capture something
            </Button>
            <Button variant="outline" onClick={() => navigate('/plan')} className="gap-2">
              <CheckSquare className="h-4 w-4" /> Add a task
            </Button>
          </div>
        </div>
      )}

      {!hasNoData && (
        <>
          {/* Jarvis Briefing */}
          <div className="today-briefing animate-in fade-in slide-in-from-bottom-4 duration-700 delay-75">
            <div className="today-briefing-shimmer" />
            <div className="today-briefing-inner">
              <div className="flex items-center gap-3 mb-4">
                <div className="today-jarvis-orb">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-bold tracking-tight">Jarvis</h2>
                  <p className="text-[11px] text-muted-foreground">Your morning briefing</p>
                </div>
                <span className="today-live-badge">
                  <span className="today-live-dot" />
                  Live
                </span>
              </div>
              <p className="text-[14px] leading-relaxed text-muted-foreground min-h-[48px]">
                {typedBriefing}
                {!briefingDone && typedBriefing.length > 0 && (
                  <span className="today-cursor" />
                )}
              </p>
            </div>
          </div>

          {/* Your Focus */}
          {focusItems.length > 0 && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
              <div className="flex items-center justify-between px-1">
                <h2 className="today-section-label">Your Focus</h2>
                <button onClick={() => navigate('/plan')}
                  className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                  See all in Plan →
                </button>
              </div>
              <div className="space-y-2.5">
                {focusItems.map((item) => (
                  <div key={item.id}
                    className={`today-focus-card group ${item.isOverdue ? 'today-focus-overdue' : ''}`}>
                    <button onClick={(e) => { e.stopPropagation(); toggleTaskDone(item.id); }}
                      className="today-check-ring" aria-label="Complete task" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {item.isOverdue && <span className="today-tag today-tag-rose">⚠ Overdue</span>}
                        {item.energy && (
                          <span className={`today-tag ${
                            item.energy === 'high' ? 'today-tag-rose' :
                            item.energy === 'med' ? 'today-tag-amber' : 'today-tag-green'
                          }`}>
                            {item.energy === 'high' ? 'High' : item.energy === 'med' ? 'Med' : 'Low'}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-60 transition-all transform group-hover:translate-x-0.5" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Today's Flow */}
          {todayAgenda.length > 0 && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              <div className="flex items-center justify-between px-1">
                <h2 className="today-section-label">Today's Flow</h2>
                <button onClick={() => navigate('/calendar')}
                  className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                  Full calendar →
                </button>
              </div>
              <div className="today-timeline">
                {todayAgenda.slice(0, 5).map((item) => (
                  <div key={item.id} className="today-tl-item">
                    <div className={`today-tl-dot ${item.type === 'event' ? 'today-tl-dot-event' : 'today-tl-dot-focus'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-muted-foreground tabular-nums">
                        {format(new Date(item.startDateTime), 'h:mm a')} – {format(new Date(item.endDateTime), 'h:mm a')}
                      </p>
                      <p className="text-[14px] font-semibold text-foreground truncate">{item.title}</p>
                      {item.location && <p className="text-[12px] text-muted-foreground mt-0.5">{item.location}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Copilot Bar */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <button onClick={() => handleOpenCopilot()} className="today-copilot-bar group">
              <div className="today-copilot-icon">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm text-muted-foreground">
                <strong className="text-foreground/70">Talk to Jarvis</strong>
                {' — "plan my week" · "what\'s next?"'}
              </span>
              <span className="text-[11px] text-muted-foreground bg-muted px-2.5 py-1 rounded-md font-mono ml-auto">
                ⌘K
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
