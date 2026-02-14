import { useState, useRef, useEffect } from 'react';
import { Cloud, CloudOff, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { FailedOp } from '@/hooks/useSyncStatus';

interface SyncIndicatorProps {
  failedOps: FailedOp[];
  onRetry: (id: string) => void;
  onRetryAll: () => void;
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
}

export function SyncIndicator({ failedOps, onRetry, onRetryAll, onDismiss, onDismissAll }: SyncIndicatorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const hasIssues = failedOps.length > 0;

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(!open)}
        className="shrink-0 relative"
        title={hasIssues ? `${failedOps.length} unsaved change(s)` : 'All changes saved'}
      >
        {hasIssues ? (
          <>
            <CloudOff className="h-4 w-4 text-destructive" />
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
              {failedOps.length}
            </span>
          </>
        ) : (
          <Cloud className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-border bg-background shadow-lg z-50">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <span className="text-sm font-semibold">
              {hasIssues ? 'Unsaved Changes' : 'Sync Status'}
            </span>
            {hasIssues && (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={onRetryAll}>
                  <RotateCcw className="h-3 w-3 mr-1" /> Retry all
                </Button>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={onDismissAll}>
                  Dismiss all
                </Button>
              </div>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {!hasIssues && (
              <div className="p-4 text-center">
                <Cloud className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">All changes saved</p>
              </div>
            )}
            {failedOps.map(op => (
              <div key={op.id} className="flex items-center gap-2 p-3 border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{op.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{op.argsPreview}</p>
                  <p className="text-[9px] text-muted-foreground">
                    {new Date(op.ts).toLocaleTimeString()}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 shrink-0" onClick={() => onRetry(op.id)}>
                  <RotateCcw className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1 shrink-0" onClick={() => onDismiss(op.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
