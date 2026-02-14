import { useState, useCallback, useRef } from 'react';
import { toast } from '@/hooks/use-toast';

export interface FailedOp {
  id: string;
  ts: number;
  name: string;
  argsPreview: string;
  retryFn: () => Promise<void>;
}

export function useSyncStatus() {
  const [failedOps, setFailedOps] = useState<FailedOp[]>([]);
  const lastToastRef = useRef<Record<string, number>>({});

  const addFailedOp = useCallback((op: FailedOp) => {
    setFailedOps(prev => [op, ...prev].slice(0, 10));

    // Dedupe toast: don't show for same op name within 5s
    const now = Date.now();
    const lastShown = lastToastRef.current[op.name] || 0;
    if (now - lastShown > 5000) {
      lastToastRef.current[op.name] = now;
      toast({
        title: "Couldn't save changes",
        description: `${op.name} failed. You can retry from the sync indicator.`,
        variant: 'destructive',
      });
    }
  }, []);

  const retryOp = useCallback(async (id: string) => {
    const op = failedOps.find(o => o.id === id);
    if (!op) return;
    try {
      await op.retryFn();
      setFailedOps(prev => prev.filter(o => o.id !== id));
      toast({ title: 'Saved successfully' });
    } catch {
      toast({ title: 'Retry failed', variant: 'destructive' });
    }
  }, [failedOps]);

  const retryAll = useCallback(async () => {
    const ops = [...failedOps];
    const remaining: FailedOp[] = [];
    for (const op of ops) {
      try {
        await op.retryFn();
      } catch {
        remaining.push(op);
      }
    }
    setFailedOps(remaining);
    if (remaining.length === 0) {
      toast({ title: 'All changes saved' });
    } else {
      toast({ title: `${remaining.length} still failing`, variant: 'destructive' });
    }
  }, [failedOps]);

  const dismissOp = useCallback((id: string) => {
    setFailedOps(prev => prev.filter(o => o.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setFailedOps([]);
  }, []);

  return { failedOps, addFailedOp, retryOp, retryAll, dismissOp, dismissAll };
}
