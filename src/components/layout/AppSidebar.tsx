import {
  LayoutDashboard, CheckSquare, Target, CalendarDays,
  Repeat, BarChart3, ClipboardList, Settings, Bell, Inbox, LayoutTemplate, Cog,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from '@/components/ui/sidebar';
import { useAppContext } from '@/store/AppContext';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Tasks', url: '/tasks', icon: CheckSquare },
  { title: 'Goals', url: '/goals', icon: Target },
  { title: 'Calendar', url: '/calendar', icon: CalendarDays },
  { title: 'Habits', url: '/habits', icon: Repeat },
  { title: 'Inbox', url: '/inbox', icon: Inbox },
  { title: 'Templates', url: '/templates', icon: LayoutTemplate },
  { title: 'Automations', url: '/automations', icon: Cog },
  { title: 'Analytics', url: '/analytics', icon: BarChart3 },
  { title: 'Planning', url: '/planning', icon: ClipboardList },
  { title: 'Notifications', url: '/notifications', icon: Bell },
  { title: 'Settings', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { data } = useAppContext();
  const inboxCount = data.inboxItems.filter(i => i.status === 'unprocessed').length;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <div className="flex h-14 items-center px-4 border-b border-sidebar-border">
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight text-sidebar-foreground">
            Life<span className="text-primary">OS</span>
          </span>
        )}
        {collapsed && <span className="text-lg font-bold text-primary mx-auto">L</span>}
      </div>
      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <span className="flex items-center gap-2 flex-1">
                          {item.title}
                          {item.title === 'Inbox' && inboxCount > 0 && (
                            <Badge variant="destructive" className="text-[8px] h-4 px-1 ml-auto">{inboxCount}</Badge>
                          )}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
