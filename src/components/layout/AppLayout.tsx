import { useState, useEffect, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { CommandPalette } from '@/components/CommandPalette';
import { CopilotDrawer } from '@/components/CopilotDrawer';
import { CopilotErrorBoundary } from '@/components/CopilotErrorBoundary';
import { GuidedTour, TourStep } from '@/components/GuidedTour';
import { useAuth } from '@/hooks/useAuth';

export function AppLayout() {
  const [commandOpen, setCommandOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotInitialMsg, setCopilotInitialMsg] = useState<string | undefined>();
  const { isModuleEnabled } = useAuth();

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
        id: 'dashboard',
        targetSelector: '[data-tour="dashboard-header"]',
        title: 'This is Today',
        body: 'LifeOS surfaces what matters now: what\'s due, what\'s behind, and your next action.',
        placement: 'bottom',
        route: '/',
      },
      {
        id: 'quick-capture',
        targetSelector: '[data-tour="quick-capture"]',
        title: 'Capture anything in seconds',
        body: 'Drop thoughts, links, and to-dos into Inbox. Organize when you have time — nothing gets lost.',
        placement: 'bottom',
        route: '/',
      },
      {
        id: 'tasks',
        targetSelector: '[data-tour="add-task"]',
        title: 'Create your first task',
        body: 'Tasks are your execution layer. Keep them small and specific.',
        placement: 'bottom',
        route: '/tasks',
        requiredModule: 'tasks',
      },
    ];

    if (isModuleEnabled('calendar') || isModuleEnabled('focus')) {
      steps.push({
        id: 'calendar',
        targetSelector: '[data-tour="calendar-header"]',
        targetSelectorFallbacks: ['[data-tour="calendar-primary-action"]', '[data-tour="calendar-root"]'],
        title: 'Schedule focus, not just tasks',
        body: 'Time-block deep work so plans actually happen. Start with one 30–60 min block.',
        placement: 'bottom',
        route: '/calendar',
      });
    }

    if (isModuleEnabled('goals')) {
      steps.push({
        id: 'goals',
        targetSelector: '[data-tour="goals-header"]',
        targetSelectorFallbacks: ['[data-tour="goals-primary-action"]', '[data-tour="goals-root"]'],
        title: 'Goals keep you pointed forward',
        body: 'Link tasks to goals and see what\'s on track — without overthinking it.',
        placement: 'bottom',
        route: '/goals',
      });
    }

    steps.push({
      id: 'settings',
      targetSelector: '[data-tour="settings-header"]',
      targetSelectorFallbacks: ['[data-tour="modules-section"]', '[data-tour="settings-root"]'],
      title: 'You control the system',
      body: 'Enable or hide modules anytime. Nothing is permanent — LifeOS adapts to you.',
      placement: 'bottom',
      route: '/settings',
    });

    return steps;
  }, [isModuleEnabled]);

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
      <CopilotErrorBoundary>
        <CopilotDrawer open={copilotOpen} onOpenChange={setCopilotOpen} initialMessage={copilotInitialMsg} />
      </CopilotErrorBoundary>
      <GuidedTour steps={tourSteps} />
    </SidebarProvider>
  );
}
