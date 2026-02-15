import {
  CheckSquare, CalendarDays, Target, Repeat, Inbox, StickyNote,
  LayoutTemplate, Cog, Bell, BarChart3, ClipboardList, Settings, History,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

type MoreItem = { title: string; description: string; url: string; icon: any; module?: string };

const categories: { label: string; items: MoreItem[] }[] = [
  {
    label: 'Organize',
    items: [
      { title: 'Tasks', description: 'Full task list with filters and views', url: '/tasks', icon: CheckSquare, module: 'tasks' },
      { title: 'Calendar', description: 'Events, focus blocks & schedule', url: '/calendar', icon: CalendarDays, module: 'calendar' },
      { title: 'Goals', description: 'Track long-term goals & milestones', url: '/goals', icon: Target, module: 'goals' },
      { title: 'Habits', description: 'Daily & weekly habit tracking', url: '/habits', icon: Repeat, module: 'habits' },
      { title: 'Inbox', description: 'Unprocessed captures & items', url: '/inbox', icon: Inbox, module: 'inbox' },
      { title: 'Notes', description: 'Freeform notes & references', url: '/notes', icon: StickyNote },
    ],
  },
  {
    label: 'Automate',
    items: [
      { title: 'Templates', description: 'Reusable task & workflow templates', url: '/templates', icon: LayoutTemplate, module: 'templates' },
      { title: 'Automations', description: 'Rules, triggers & scheduled actions', url: '/automations', icon: Cog, module: 'automations' },
      { title: 'Notifications', description: 'Alerts, reminders & digests', url: '/notifications', icon: Bell, module: 'notifications' },
    ],
  },
  {
    label: 'Understand',
    items: [
      { title: 'Analytics', description: 'Charts, trends & insights', url: '/analytics', icon: BarChart3, module: 'analytics' },
      { title: 'Planning', description: 'Weekly plans & commitments', url: '/planning', icon: ClipboardList, module: 'planning' },
      { title: 'Activity', description: 'Full audit trail of actions', url: '/activity', icon: History },
    ],
  },
  {
    label: 'Account',
    items: [
      { title: 'Settings', description: 'Profile, modules & preferences', url: '/settings', icon: Settings },
    ],
  },
];

export default function MorePage() {
  const navigate = useNavigate();
  const { isModuleEnabled } = useAuth();

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">More</h1>
        <p className="text-sm text-muted-foreground">All your tools in one place</p>
      </div>

      {categories.map(cat => {
        const visibleItems = cat.items.filter(item => !item.module || isModuleEnabled(item.module));
        if (visibleItems.length === 0) return null;
        return (
          <section key={cat.label} className="space-y-2">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{cat.label}</h2>
            <div className="space-y-0.5">
              {visibleItems.map(item => (
                <button
                  key={item.url}
                  onClick={() => navigate(item.url)}
                  className="flex items-center gap-3 w-full rounded-lg px-4 py-3 text-left transition-colors hover:bg-card border border-transparent hover:border-border"
                >
                  <item.icon className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
