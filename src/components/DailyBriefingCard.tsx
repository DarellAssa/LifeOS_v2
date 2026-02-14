import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw, Clock, AlertTriangle, Inbox, CheckSquare, Target,
  Flame, Calendar, Sparkles, ArrowRight, Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface BriefingMetrics {
  tasks_due_today: number;
  tasks_overdue: number;
  events_today: number;
  focus_minutes_planned_today: number;
  inbox_unprocessed: number;
  habits_at_risk: number;
  goals_at_risk: number;
}

interface ScheduleItem {
  kind: string;
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  route: string;
}

interface PriorityItem {
  id: string;
  title: string;
  route: string;
  reason: string;
  priority: string;
  due_date: string | null;
}

interface RiskItem {
  type: string;
  id: string;
  title: string;
  route: string;
  reason: string;
  severity: string;
}

interface NextAction {
  title: string;
  why: string;
  cta: string;
  risk: string;
  plan_prompt: string;
}

interface BriefingContent {
  headline: string;
  metrics: BriefingMetrics;
  schedule: ScheduleItem[];
  top_priorities: PriorityItem[];
  risks: RiskItem[];
  inbox: { unprocessed_count: number; suggestion: string };
  next_actions: NextAction[];
}

interface DailyBriefingCardProps {
  onOpenCopilot: (message?: string) => void;
}

export function DailyBriefingCard({ onOpenCopilot }: DailyBriefingCardProps) {
  const [briefing, setBriefing] = useState<BriefingContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  const fetchBriefing = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-briefing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ force }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.ok && data.briefing) {
        setBriefing(data.briefing);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (e: any) {
      console.error('Briefing fetch error:', e);
      setError(e.message || 'Failed to load briefing');
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    if (!fetched) fetchBriefing(false);
  }, [fetched, fetchBriefing]);

  const severityDot = (s: string) => {
    if (s === 'high') return 'bg-destructive';
    if (s === 'med' || s === 'medium') return 'bg-amber-500';
    return 'bg-muted-foreground';
  };

  if (loading && !briefing) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating your briefing…
        </CardContent>
      </Card>
    );
  }

  if (error && !briefing) {
    return (
      <Card>
        <CardContent className="p-4 text-center space-y-2">
          <p className="text-sm text-muted-foreground">Could not load briefing.</p>
          <Button size="sm" variant="outline" onClick={() => fetchBriefing(true)} className="text-xs">
            <RefreshCw className="h-3 w-3 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!briefing) return null;

  const m = briefing.metrics;
  const metricChips = [
    { label: 'Due today', value: m.tasks_due_today, icon: CheckSquare, show: m.tasks_due_today > 0 },
    { label: 'Overdue', value: m.tasks_overdue, icon: AlertTriangle, show: m.tasks_overdue > 0, destructive: true },
    { label: 'Events', value: m.events_today, icon: Calendar, show: m.events_today > 0 },
    { label: 'Focus', value: `${m.focus_minutes_planned_today}m`, icon: Clock, show: m.focus_minutes_planned_today > 0 },
    { label: 'Inbox', value: m.inbox_unprocessed, icon: Inbox, show: m.inbox_unprocessed > 0 },
    { label: 'Habits', value: m.habits_at_risk, icon: Flame, show: m.habits_at_risk > 0 },
    { label: 'Goals', value: m.goals_at_risk, icon: Target, show: m.goals_at_risk > 0 },
  ].filter(c => c.show);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-semibold">Daily Briefing</span>
              <span className="text-xs text-muted-foreground">{format(new Date(), 'MMM d')}</span>
            </div>
            <p className="text-sm font-medium">{briefing.headline}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => fetchBriefing(true)} disabled={loading}>
              <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* Metrics chips */}
        {metricChips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {metricChips.map((chip, i) => (
              <div key={i} className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${chip.destructive ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-border'}`}>
                <chip.icon className="h-3 w-3" />
                <span className="font-medium">{chip.value}</span>
                <span className="text-muted-foreground">{chip.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Two column layout on desktop */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Left: Schedule + Priorities */}
          <div className="space-y-3">
            {/* Schedule */}
            {briefing.schedule.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Schedule</p>
                <div className="space-y-1">
                  {briefing.schedule.slice(0, 5).map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm rounded border border-border p-2">
                      <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${item.kind === 'focus' ? 'bg-primary' : 'bg-blue-500'}`} />
                      <span className="flex-1 truncate text-xs">{item.title}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatTime(item.start_at)} – {formatTime(item.end_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Priorities */}
            {briefing.top_priorities.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Top Priorities</p>
                <div className="space-y-1">
                  {briefing.top_priorities.slice(0, 3).map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm rounded border border-border p-2">
                      <div className={`h-1.5 w-1.5 rounded-full shrink-0 mt-1.5 ${severityDot(item.priority)}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.title}</p>
                        <p className="text-[10px] text-muted-foreground">{item.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Risks + Inbox + Next Actions */}
          <div className="space-y-3">
            {/* Risks */}
            {briefing.risks.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Risks</p>
                <div className="space-y-1">
                  {briefing.risks.slice(0, 3).map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm rounded border border-border p-2">
                      <div className={`h-1.5 w-1.5 rounded-full shrink-0 mt-1.5 ${severityDot(item.severity)}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.title}</p>
                        <p className="text-[10px] text-muted-foreground">{item.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inbox */}
            {briefing.inbox.unprocessed_count > 0 && (
              <div className="flex items-center gap-2 rounded border border-border p-2 text-xs">
                <Inbox className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="flex-1">{briefing.inbox.suggestion}</span>
                <Badge variant="secondary" className="text-[10px]">{briefing.inbox.unprocessed_count}</Badge>
              </div>
            )}

            {/* Next Actions */}
            {briefing.next_actions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Next Actions</p>
                <div className="space-y-1.5">
                  {briefing.next_actions.slice(0, 6).map((action, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border border-border p-2">
                      <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${severityDot(action.risk)}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{action.title}</p>
                        <p className="text-[10px] text-muted-foreground">{action.why}</p>
                      </div>
                      <Button
                        size="sm" variant="outline"
                        className="h-6 text-[10px] px-2 shrink-0 gap-1"
                        onClick={() => onOpenCopilot(action.plan_prompt)}
                      >
                        {action.cta} <ArrowRight className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatTime(iso: string): string {
  try {
    return format(new Date(iso), 'h:mm a');
  } catch { return iso.slice(11, 16); }
}
