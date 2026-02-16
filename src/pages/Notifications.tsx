import { useState, useMemo } from 'react';
import { useAppContext } from '@/store/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Bell, Check, Clock, Trash2, MoreHorizontal, BellOff, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { format, addHours, addDays, startOfDay } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { NotificationItem, NotificationSeverity } from '@/types';

const severityConfig: Record<NotificationSeverity, { icon: typeof AlertCircle; className: string }> = {
  critical: { icon: AlertCircle, className: 'text-destructive' },
  warning: { icon: AlertTriangle, className: 'text-[hsl(var(--attention))]' },
  info: { icon: Info, className: 'text-primary/60' },
};

export default function Notifications() {
  const { data, markNotificationRead, dismissNotification, snoozeNotification, markAllRead } = useAppContext();
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const now = new Date();
  const notifications = data.notifications;

  const filtered = useMemo(() => {
    let items = [...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (tab === 'unread') items = items.filter(n => !n.readAt && !n.dismissedAt);
    else if (tab === 'snoozed') items = items.filter(n => n.snoozedUntil && n.snoozedUntil > now.toISOString() && !n.dismissedAt);
    else if (tab === 'dismissed') items = items.filter(n => !!n.dismissedAt);
    else items = items.filter(n => !n.dismissedAt);
    if (severityFilter !== 'all') items = items.filter(n => n.severity === severityFilter);
    return items;
  }, [notifications, tab, severityFilter]);

  const unreadCount = notifications.filter(n => !n.readAt && !n.dismissedAt).length;

  const handleClick = (n: NotificationItem) => {
    if (!n.readAt) markNotificationRead(n.id);
    if (n.action?.route) navigate(n.action.route);
  };

  const handleSnooze = (id: string, until: string) => {
    snoozeNotification(id, until);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={markAllRead}>
            <Check className="h-3 w-3 mr-1" /> Mark all read
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center gap-3">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="snoozed">Snoozed</TabsTrigger>
            <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
          </TabsList>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severity</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {['all', 'unread', 'snoozed', 'dismissed'].map(t => (
          <TabsContent key={t} value={t} className="space-y-2 mt-4">
            {filtered.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <BellOff className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">{t === 'all' ? 'All clear! No notifications.' : `No ${t} notifications.`}</p>
                </CardContent>
              </Card>
            )}
            {filtered.map(n => {
              const SevIcon = severityConfig[n.severity].icon;
              const isSnoozed = n.snoozedUntil && n.snoozedUntil > now.toISOString();
              return (
                <Card key={n.id} className={`transition-colors cursor-pointer hover:bg-muted/30 ${!n.readAt && !n.dismissedAt ? 'border-primary/30 bg-primary/5' : ''}`}>
                  <CardContent className="p-3 flex items-start gap-3">
                    <SevIcon className={`h-4 w-4 mt-0.5 shrink-0 ${severityConfig[n.severity].className}`} />
                    <div className="flex-1 min-w-0" onClick={() => handleClick(n)}>
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium truncate ${n.readAt ? 'text-muted-foreground' : ''}`}>{n.title}</p>
                        <Badge variant="secondary" className="text-[8px] shrink-0">{n.type.replace(/_/g, ' ')}</Badge>
                        {isSnoozed && <Badge variant="outline" className="text-[8px] shrink-0"><Clock className="h-2 w-2 mr-0.5" />Snoozed</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(n.createdAt), 'MMM d, h:mm a')}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"><MoreHorizontal className="h-3 w-3" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!n.readAt && <DropdownMenuItem onClick={() => markNotificationRead(n.id)}>Mark read</DropdownMenuItem>}
                        {!n.dismissedAt && (
                          <>
                            <DropdownMenuItem onClick={() => handleSnooze(n.id, addHours(now, 1).toISOString())}>Snooze 1h</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSnooze(n.id, addHours(now, 3).toISOString())}>Snooze 3h</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSnooze(n.id, addDays(startOfDay(now), 1).toISOString().replace('T00:', 'T09:'))}>Snooze until tomorrow</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => dismissNotification(n.id)} className="text-destructive">Dismiss</DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
