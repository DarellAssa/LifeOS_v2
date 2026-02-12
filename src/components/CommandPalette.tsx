import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import {
  LayoutDashboard, CheckSquare, Target, CalendarDays,
  Repeat, BarChart3, ClipboardList, Settings, Plus, Search,
} from 'lucide-react';
import { useAppContext } from '@/store/AppContext';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { data } = useAppContext();

  const go = (path: string) => { navigate(path); onOpenChange(false); };

  const pages = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Tasks', icon: CheckSquare, path: '/tasks' },
    { name: 'Goals', icon: Target, path: '/goals' },
    { name: 'Calendar', icon: CalendarDays, path: '/calendar' },
    { name: 'Habits', icon: Repeat, path: '/habits' },
    { name: 'Analytics', icon: BarChart3, path: '/analytics' },
    { name: 'Planning', icon: ClipboardList, path: '/planning' },
    { name: 'Settings', icon: Settings, path: '/settings' },
  ];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {pages.map(p => (
            <CommandItem key={p.path} onSelect={() => go(p.path)}>
              <p.icon className="mr-2 h-4 w-4" />
              {p.name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => go('/tasks?action=new')}>
            <Plus className="mr-2 h-4 w-4" /> New Task
          </CommandItem>
          <CommandItem onSelect={() => go('/goals?action=new')}>
            <Plus className="mr-2 h-4 w-4" /> New Goal
          </CommandItem>
          <CommandItem onSelect={() => go('/calendar?action=new')}>
            <Plus className="mr-2 h-4 w-4" /> New Event
          </CommandItem>
        </CommandGroup>
        {data.tasks.length > 0 && (
          <CommandGroup heading="Tasks">
            {data.tasks.slice(0, 5).map(t => (
              <CommandItem key={t.id} onSelect={() => go('/tasks')}>
                <CheckSquare className="mr-2 h-4 w-4" />
                {t.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {data.goals.length > 0 && (
          <CommandGroup heading="Goals">
            {data.goals.slice(0, 5).map(g => (
              <CommandItem key={g.id} onSelect={() => go('/goals')}>
                <Target className="mr-2 h-4 w-4" />
                {g.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
