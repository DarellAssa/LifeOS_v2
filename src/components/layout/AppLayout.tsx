import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { CommandPalette } from '@/components/CommandPalette';
import { CopilotDrawer } from '@/components/CopilotDrawer';

export function AppLayout() {
  const [commandOpen, setCommandOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotInitialMsg, setCopilotInitialMsg] = useState<string | undefined>();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setCopilotInitialMsg(undefined);
        setCopilotOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const openCopilotWith = (msg?: string) => {
    setCopilotInitialMsg(msg);
    setCopilotOpen(true);
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <AppHeader
            onOpenSearch={() => setCommandOpen(true)}
            onOpenCommandPalette={() => setCommandOpen(true)}
            onOpenCopilot={() => openCopilotWith()}
          />
          <main className="flex-1 overflow-auto p-6 scrollbar-thin">
            <Outlet />
          </main>
        </div>
      </div>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} onOpenCopilot={openCopilotWith} />
      <CopilotDrawer open={copilotOpen} onOpenChange={setCopilotOpen} initialMessage={copilotInitialMsg} />
    </SidebarProvider>
  );
}
