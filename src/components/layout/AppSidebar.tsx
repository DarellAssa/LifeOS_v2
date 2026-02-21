import {
  Sun, ClipboardList, Inbox, Calendar, MoreHorizontal, Leaf,
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
  { title: 'Calendar', url: '/calendar', icon: Calendar },
  { title: 'Capture', url: '/capture', icon: Inbox },
  { title: 'More', url: '/more', icon: MoreHorizontal },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { data } = useAppContext();
  const inboxCount = data.inboxItems.filter(i => i.status === 'unprocessed').length;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/50 bg-card" data-tour="sidebar">
      <div className="flex h-14 items-center px-4 border-b border-sidebar-border/50 gap-2">
        {!collapsed && (
          <span className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-primary" />
            <span className="text-base font-semibold tracking-tight text-foreground">
              Life<span className="text-primary">OS</span>
            </span>
          </span>
        )}
        {collapsed && <Leaf className="h-5 w-5 text-primary mx-auto" />}
      </div>
      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5 px-2">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground transition-all duration-150 hover:bg-accent hover:text-accent-foreground group relative"
                      activeClassName="bg-accent text-accent-foreground font-medium before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-full before:bg-primary"
                      data-tour={
                        item.title === 'Capture' ? 'nav-inbox' :
                        item.title === 'Plan' ? 'nav-tasks' :
                        undefined
                      }
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0 stroke-[1.5]" />
                      {!collapsed && (
                        <span className="flex items-center gap-2 flex-1">
                          {item.title}
                          {item.title === 'Capture' && inboxCount > 0 && (
                            <Badge variant="default" className="text-[10px] h-5 px-1.5 ml-auto font-normal border-0">
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