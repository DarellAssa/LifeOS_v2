import { useState, useEffect, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { CommandPalette } from '@/components/CommandPalette';
import { CopilotDrawer } from '@/components/CopilotDrawer';
import { GuidedTour, TourStep } from '@/components/GuidedTour';
import { useAuth } from '@/hooks/useAuth';

export function AppLayout() {
  const [commandOpen, setCommandOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotInitialMsg, setCopilotInitialMsg] = useState<string | undefined>();
  const { isModuleEnabled } = useAuth();
  const location = useLocation();

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

  // Build tour steps conditionally based on enabled modules
  const tourSteps = useMemo<TourStep[]>(() => {
    const steps: TourStep[] = [
      {
        targetSelector: '[data-tour="greeting"]',
        title: 'This is your command center',
        text: 'LifeOS shows what matters today and what\'s slipping. You can customize it anytime.',
      },
      {
        targetSelector: '[data-tour="search"]',
        title: 'Capture anything, instantly',
        text: 'Dump thoughts, links, and to-dos here. Sort them later without losing anything.',
        cta: 'Try it: press ⌘K and type "capture".',
      },
    ];

    if (isModuleEnabled('tasks')) {
      steps.push({
        targetSelector: '[data-tour="sidebar"] a[href="/tasks"]',
        title: 'Tasks are your execution layer',
        text: 'Create tasks, set priorities, and keep your week under control.',
      });
    }

    if (isModuleEnabled('calendar') || isModuleEnabled('focus')) {
      steps.push({
        targetSelector: '[data-tour="sidebar"] a[href="/calendar"]',
        title: 'Schedule focus, not just tasks',
        text: 'Time-block deep work so your plan becomes real.',
      });
    }

    if (isModuleEnabled('goals')) {
      steps.push({
        targetSelector: '[data-tour="sidebar"] a[href="/goals"]',
        title: 'Goals keep you pointed forward',
        text: 'Link tasks to goals and see what\'s on track or falling behind.',
      });
    }

    if (isModuleEnabled('habits') || isModuleEnabled('checkin')) {
      steps.push({
        targetSelector: '[data-tour="sidebar"] a[href="/habits"]',
        title: 'Consistency beats motivation',
        text: 'Small habits and quick check-ins build your Life Score over time.',
      });
    }

    steps.push({
      targetSelector: '[data-tour="sidebar"] a[href="/settings"]',
      title: 'You\'re never locked in',
      text: 'Turn modules on/off, change your setup, or re-run onboarding anytime.',
    });

    return steps;
  }, [isModuleEnabled]);

  // Only show tour on dashboard
  const showTour = location.pathname === '/';

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
      {showTour && <GuidedTour steps={tourSteps} />}
    </SidebarProvider>
  );
}
