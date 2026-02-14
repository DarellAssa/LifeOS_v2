import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Download, ExternalLink, Sparkles, Cog, User, Cpu, ChevronDown } from 'lucide-react';
import { fetchActivityLog, formatAction, getEntityRoute, type ActivityLogEntry } from '@/lib/activityLog';
import { useNavigate } from 'react-router-dom';

const SOURCE_ICONS: Record<string, any> = {
  user: User,
  copilot: Sparkles,
  automation: Cog,
  system: Cpu,
};

const SOURCE_COLORS: Record<string, string> = {
  user: 'bg-primary/10 text-primary',
  copilot: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  automation: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  system: 'bg-muted text-muted-foreground',
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ActivityLogPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [daysFilter, setDaysFilter] = useState('7');
  const debugMode = typeof window !== 'undefined' && localStorage.getItem('lifeos-debug') === 'true';

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchActivityLog(user.id, {
      source: sourceFilter === 'all' ? undefined : sourceFilter,
      days: parseInt(daysFilter),
      limit: 200,
    }).then(data => {
      setEntries(data);
      setLoading(false);
    });
  }, [user, sourceFilter, daysFilter]);

  const handleExport = () => {
    const json = JSON.stringify(entries, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifeos-activity-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Group entries by date
  const grouped = useMemo(() => {
    const groups: Record<string, ActivityLogEntry[]> = {};
    for (const entry of entries) {
      const day = new Date(entry.ts).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      if (!groups[day]) groups[day] = [];
      groups[day].push(entry);
    }
    return groups;
  }, [entries]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={entries.length === 0}>
          <Download className="h-3.5 w-3.5 mr-1.5" /> Export
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={sourceFilter} onValueChange={setSourceFilter}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="user" className="gap-1"><User className="h-3 w-3" /> Manual</TabsTrigger>
            <TabsTrigger value="copilot" className="gap-1"><Sparkles className="h-3 w-3" /> Copilot</TabsTrigger>
            <TabsTrigger value="automation" className="gap-1"><Cog className="h-3 w-3" /> Automations</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={daysFilter} onValueChange={setDaysFilter}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Today</SelectItem>
            <SelectItem value="7">7 days</SelectItem>
            <SelectItem value="30">30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && entries.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <History className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No activity yet for this period.</p>
          </CardContent>
        </Card>
      )}

      {/* Entries grouped by date */}
      {!loading && Object.entries(grouped).map(([day, dayEntries]) => (
        <div key={day} className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 py-2">{day}</p>
          {dayEntries.map(entry => {
            const Icon = SOURCE_ICONS[entry.source] || Cpu;
            const route = getEntityRoute(entry.entity_type, entry.entity_id);

            return (
              <div
                key={entry.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors group"
              >
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${SOURCE_COLORS[entry.source] || ''}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{formatAction(entry.action, entry.entity_type)}</p>
                  {entry.title && (
                    <p className="text-xs text-muted-foreground truncate">{entry.title}</p>
                  )}
                  {debugMode && entry.metadata && Object.keys(entry.metadata).length > 0 && (
                    <details className="mt-1">
                      <summary className="text-[9px] text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
                        <ChevronDown className="h-2.5 w-2.5" /> metadata
                      </summary>
                      <pre className="text-[9px] bg-muted p-1.5 rounded mt-1 overflow-auto max-h-20">
                        {JSON.stringify(entry.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted-foreground" title={new Date(entry.ts).toLocaleString()}>
                    {timeAgo(entry.ts)}
                  </span>
                  {route && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => navigate(route)}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
