import {
  Sun, ClipboardList, Inbox, TrendingUp, MoreHorizontal,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from '@/components/ui/sidebar';
import { useAppContext } from '@/store/AppContext';
import { Badge } from '@/components/ui/badge';

type NavItem = { title: string; url: string; icon: any };

const navItems: NavItem[] = [
  { title: 'Today', url: '/', icon: Sun },
  { title: 'Plan', url: '/plan', icon: ClipboardList },
  { title: 'Capture', url: '/capture', icon: Inbox },
  { title: 'Progress', url: '/progress', icon: TrendingUp },
  { title: 'More', url: '/more', icon: MoreHorizontal },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { data } = useAppContext();
  const inboxCount = data.inboxItems.filter(i => i.status === 'unprocessed').length;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border" data-tour="sidebar">
      <div className="flex h-14 items-center px-4 border-b border-sidebar-border">
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight text-sidebar-foreground">
            Life<span className="text-primary">OS</span>
          </span>
        )}
        {collapsed && <span className="text-lg font-bold text-primary mx-auto">L</span>}
      </div>
      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      data-tour={
                        item.title === 'Capture' ? 'nav-inbox' :
                        item.title === 'Plan' ? 'nav-tasks' :
                        undefined
                      }
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && (
                        <span className="flex items-center gap-2 flex-1">
                          {item.title}
                          {item.title === 'Capture' && inboxCount > 0 && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 ml-auto font-normal">
                              {inboxCount}
                            </Badge>
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
