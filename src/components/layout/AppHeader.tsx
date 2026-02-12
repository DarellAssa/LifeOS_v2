import { Search, Moon, Sun, Command } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/hooks/useTheme';
import { useState } from 'react';

interface AppHeaderProps {
  onOpenSearch: () => void;
  onOpenCommandPalette: () => void;
}

export function AppHeader({ onOpenSearch, onOpenCommandPalette }: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-background px-4">
      <SidebarTrigger className="shrink-0" />
      <div className="flex flex-1 items-center gap-2">
        <button
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
      <Button variant="ghost" size="icon" onClick={toggleTheme} className="shrink-0">
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </header>
  );
}
