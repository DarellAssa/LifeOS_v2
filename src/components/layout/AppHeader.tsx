import { Search, Moon, Sun, Bell, Sparkles, User, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/hooks/useTheme';
import { useAppContext } from '@/store/AppContext';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { SyncIndicator } from '@/components/SyncIndicator';
import { useSyncStatus } from '@/hooks/useSyncStatus';

interface AppHeaderProps {
  onOpenSearch: () => void;
  onOpenCommandPalette: () => void;
  onOpenCopilot: () => void;
}

export function AppHeader({ onOpenSearch, onOpenCommandPalette, onOpenCopilot }: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { data, markNotificationRead, getUnreadNotificationCount } = useAppContext();
  const { profile, signOut, isModuleEnabled } = useAuth();
  const navigate = useNavigate();
  const [bellOpen, setBellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const { failedOps, retryOp, retryAll, dismissOp, dismissAll } = useSyncStatus();

  const unreadCount = getUnreadNotificationCount();

  const recentNotifs = [...data.notifications]
    .filter(n => !n.dismissedAt && (!n.snoozedUntil || n.snoozedUntil <= new Date().toISOString()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    if (bellOpen || profileOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [bellOpen, profileOpen]);

  const handleSignOut = async () => {
    setProfileOpen(false);
    await signOut();
    navigate('/auth');
  };

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-background px-4">
      <SidebarTrigger className="shrink-0" />
      <div className="flex flex-1 items-center gap-2">
         <button
          data-tour="quick-capture"
          onClick={onOpenSearch}
          className="flex h-9 w-full max-w-sm items-center gap-2 rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
        >
          <Search className="h-4 w-4" />
          <span>Search…</span>
          <kbd className="ml-auto hidden rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Notification Bell */}
      <div className="relative" ref={bellRef}>
        <Button variant="ghost" size="icon" onClick={() => setBellOpen(!bellOpen)} className="shrink-0 relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>

        {bellOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-border bg-background shadow-lg z-50">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <span className="text-sm font-semibold">Notifications</span>
              <button onClick={() => { setBellOpen(false); navigate('/notifications'); }} className="text-xs text-primary hover:underline">View all</button>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {recentNotifs.length === 0 && (
                <p className="p-4 text-center text-xs text-muted-foreground">All clear!</p>
              )}
              {recentNotifs.map(n => (
                <button key={n.id} onClick={() => {
                  if (!n.readAt) markNotificationRead(n.id);
                  if (n.action?.route) navigate(n.action.route);
                  setBellOpen(false);
                }} className={`w-full text-left p-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${!n.readAt ? 'bg-primary/5' : ''}`}>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${n.severity === 'critical' ? 'bg-destructive' : n.severity === 'warning' ? 'bg-warning' : 'bg-primary/50'}`} />
                    <p className="text-xs font-medium truncate flex-1">{n.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate ml-4">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 ml-4">{format(new Date(n.createdAt), 'h:mm a')}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <SyncIndicator
        failedOps={failedOps}
        onRetry={retryOp}
        onRetryAll={retryAll}
        onDismiss={dismissOp}
        onDismissAll={dismissAll}
      />

      {isModuleEnabled('copilot') && (
        <Button variant="ghost" size="icon" onClick={onOpenCopilot} className="shrink-0" title="Open Copilot (Ctrl+J)">
          <Sparkles className="h-4 w-4" />
        </Button>
      )}

      <Button variant="ghost" size="icon" onClick={toggleTheme} className="shrink-0">
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      {/* Profile Menu */}
      <div className="relative" ref={profileRef}>
        <Button variant="ghost" size="icon" onClick={() => setProfileOpen(!profileOpen)} className="shrink-0">
          <User className="h-4 w-4" />
        </Button>
        {profileOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border bg-background shadow-lg z-50">
            <div className="p-3 border-b border-border">
              <p className="text-sm font-medium truncate">{profile?.first_name || 'User'}</p>
              <p className="text-[11px] text-muted-foreground truncate">{profile?.email}</p>
            </div>
            <div className="p-1">
              <button onClick={() => { setProfileOpen(false); navigate('/settings'); }}
                className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm hover:bg-muted/50 transition-colors">
                <SettingsIcon className="h-4 w-4" /> Settings
              </button>
              <button onClick={handleSignOut}
                className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
