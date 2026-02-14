import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/* ─── Types ─── */

export interface TourStep {
  id: string;
  targetSelector: string;
  title: string;
  body: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
  route?: string;
  requiredModule?: string;
}

type TourStatus = 'idle' | 'navigating' | 'waiting_target' | 'showing' | 'completed';

/* ─── Persistence ─── */

const TOUR_COMPLETED_KEY = 'lifeos-tour-completed';

function isTourCompleted(userId: string): boolean {
  try {
    const val = localStorage.getItem(TOUR_COMPLETED_KEY);
    if (!val) return false;
    return JSON.parse(val)[userId] === true;
  } catch { return false; }
}

function markTourCompleted(userId: string) {
  try {
    const val = localStorage.getItem(TOUR_COMPLETED_KEY);
    const parsed = val ? JSON.parse(val) : {};
    parsed[userId] = true;
    localStorage.setItem(TOUR_COMPLETED_KEY, JSON.stringify(parsed));
  } catch {}
}

export function resetTourForUser(userId: string) {
  try {
    const val = localStorage.getItem(TOUR_COMPLETED_KEY);
    const parsed = val ? JSON.parse(val) : {};
    delete parsed[userId];
    localStorage.setItem(TOUR_COMPLETED_KEY, JSON.stringify(parsed));
  } catch {}
}

/* ─── Element readiness check ─── */

function isElementReady(selector: string): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return null;
  return el;
}

/* ─── Geometry ─── */

interface Rect { top: number; left: number; width: number; height: number; }
type Placement = 'top' | 'bottom' | 'left' | 'right';

const TOOLTIP_MAX_W = 360;
const GAP = 14;
const SPOT_PAD = 6;

function resolvePlacement(rect: Rect, preferred: Placement, tw: number, th: number): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const fits = (p: Placement) => {
    switch (p) {
      case 'right': return rect.left + rect.width + GAP + tw < vw - 12;
      case 'bottom': return rect.top + rect.height + GAP + th < vh - 12;
      case 'left': return rect.left - GAP - tw > 12;
      case 'top': return rect.top - GAP - th > 12;
    }
  };
  if (fits(preferred)) return preferred;
  return ['right', 'bottom', 'left', 'top'].find(p => fits(p as Placement)) as Placement ?? 'bottom';
}

function computePos(rect: Rect, placement: Placement, tw: number, th: number) {
  let top = 0, left = 0;
  switch (placement) {
    case 'right': top = rect.top + rect.height / 2 - th / 2; left = rect.left + rect.width + GAP; break;
    case 'left': top = rect.top + rect.height / 2 - th / 2; left = rect.left - tw - GAP; break;
    case 'bottom': top = rect.top + rect.height + GAP; left = rect.left + rect.width / 2 - tw / 2; break;
    case 'top': top = rect.top - th - GAP; left = rect.left + rect.width / 2 - tw / 2; break;
  }
  left = Math.max(12, Math.min(left, window.innerWidth - tw - 12));
  top = Math.max(12, Math.min(top, window.innerHeight - th - 12));

  const arrowSide: Placement = placement === 'right' ? 'left' : placement === 'left' ? 'right' : placement === 'bottom' ? 'top' : 'bottom';
  let arrowOffset: number;
  if (placement === 'right' || placement === 'left') {
    arrowOffset = Math.max(16, Math.min(rect.top + rect.height / 2 - top, th - 16));
  } else {
    arrowOffset = Math.max(16, Math.min(rect.left + rect.width / 2 - left, tw - 16));
  }
  return { top, left, arrowSide, arrowOffset };
}

/* ─── Arrow ─── */

function Arrow({ side, offset }: { side: Placement; offset: number }) {
  const s = 8;
  const style: React.CSSProperties = { position: 'absolute', pointerEvents: 'none' };
  let points = '';
  if (side === 'left') { style.left = -s; style.top = offset - s; points = `${s},0 ${s},${s*2} 0,${s}`; }
  else if (side === 'right') { style.right = -s; style.top = offset - s; points = `0,0 0,${s*2} ${s},${s}`; }
  else if (side === 'top') { style.top = -s; style.left = offset - s; points = `0,${s} ${s},0 ${s*2},${s}`; }
  else { style.bottom = -s; style.left = offset - s; points = `0,0 ${s*2},0 ${s},${s}`; }
  return (
    <svg style={style}
      width={side === 'left' || side === 'right' ? s : s * 2}
      height={side === 'left' || side === 'right' ? s * 2 : s}>
      <polygon points={points} className="fill-popover" />
    </svg>
  );
}

/* ─── Retry schedule ─── */
const RETRY_DELAYS = [100, 200, 400, 800, 1200];

/* ─── Main Component ─── */

export function GuidedTour({ steps }: { steps: TourStep[] }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isActive, setIsActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<TourStatus>('idle');
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  const [spotlight, setSpotlight] = useState<Rect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; arrowSide: Placement; arrowOffset: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Debounce guard
  const lastActionRef = useRef(0);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Prevent StrictMode double-init
  const initRef = useRef(false);

  /* ── Start tour ── */
  useEffect(() => {
    if (!user || !profile || steps.length === 0) return;
    if (initRef.current) return;
    const showTour = profile.preferences?.showTutorial !== false;
    if (showTour && !isTourCompleted(user.id)) {
      initRef.current = true;
      const timer = setTimeout(() => {
        setIsActive(true);
        setCurrentIndex(0);
        setStatus('waiting_target');
      }, 900);
      return () => { clearTimeout(timer); initRef.current = false; };
    }
  }, [user, profile, steps.length]);

  /* ── Cleanup retry timers ── */
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  /* ── Core: attempt to show current step ── */
  const attemptShow = useCallback(() => {
    if (!isActive || showEndScreen || currentIndex >= steps.length) return;
    const step = steps[currentIndex];

    // Check route first
    if (step.route && location.pathname !== step.route) {
      setStatus('navigating');
      setSpotlight(null);
      setTooltipPos(null);
      navigate(step.route);
      return; // Will re-trigger via location.pathname change
    }

    // Check element readiness
    const el = isElementReady(step.targetSelector);
    if (!el) {
      // Retry with backoff
      if (retryCountRef.current < RETRY_DELAYS.length) {
        setStatus('waiting_target');
        const delay = RETRY_DELAYS[retryCountRef.current];
        retryCountRef.current++;
        retryTimerRef.current = setTimeout(attemptShow, delay);
      } else {
        // Show fallback
        setShowFallback(true);
        setStatus('waiting_target');
      }
      return;
    }

    // Element found — show it
    retryCountRef.current = 0;
    setShowFallback(false);
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const sr: Rect = {
        top: r.top - SPOT_PAD,
        left: r.left - SPOT_PAD,
        width: r.width + SPOT_PAD * 2,
        height: r.height + SPOT_PAD * 2,
      };
      setSpotlight(sr);
      const tw = Math.min(TOOLTIP_MAX_W, window.innerWidth - 24);
      const th = tooltipRef.current?.offsetHeight ?? 160;
      const placement = resolvePlacement(sr, step.placement, tw, th);
      setTooltipPos(computePos(sr, placement, tw, th));
      setStatus('showing');
    });
  }, [isActive, showEndScreen, currentIndex, steps, location.pathname, navigate]);

  /* ── Trigger attemptShow when index or route changes ── */
  useEffect(() => {
    if (!isActive || showEndScreen) return;
    if (status === 'idle' || status === 'completed') return;

    // Clear previous retry chain
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryCountRef.current = 0;
    setShowFallback(false);

    // Small delay to let DOM settle after route change
    const timer = setTimeout(attemptShow, 150);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, currentIndex, location.pathname]);

  /* ── Resize handler ── */
  useEffect(() => {
    if (!isActive || status !== 'showing') return;
    const handler = () => attemptShow();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [isActive, status, attemptShow]);

  /* ── Escape key ── */
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSkipConfirm(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isActive]);

  /* ── Actions (debounced) ── */
  const guardedAction = (fn: () => void) => {
    const now = Date.now();
    if (now - lastActionRef.current < 400) return;
    lastActionRef.current = now;
    fn();
  };

  const handleNext = () => guardedAction(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (currentIndex < steps.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setStatus('waiting_target');
      setSpotlight(null);
      setTooltipPos(null);
    } else {
      setShowEndScreen(true);
      setSpotlight(null);
      setTooltipPos(null);
      setStatus('completed');
    }
  });

  const handleBack = () => guardedAction(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setStatus('waiting_target');
      setSpotlight(null);
      setTooltipPos(null);
    }
  });

  const handleClose = () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    setIsActive(false);
    setShowEndScreen(false);
    setShowSkipConfirm(false);
    setShowFallback(false);
    setStatus('completed');
    if (user) markTourCompleted(user.id);
  };

  const handleFinish = () => {
    handleClose();
    navigate('/');
  };

  const handleRetry = () => {
    retryCountRef.current = 0;
    setShowFallback(false);
    attemptShow();
  };

  const handleSkipStep = () => guardedAction(() => {
    setShowFallback(false);
    if (currentIndex < steps.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setStatus('waiting_target');
    } else {
      setShowEndScreen(true);
      setStatus('completed');
    }
  });

  /* ── Render guards ── */
  if (!isActive || steps.length === 0) return null;

  const step = steps[currentIndex];
  const isLast = currentIndex === steps.length - 1;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isShowing = status === 'showing' && spotlight && tooltipPos;
  const isWaiting = status === 'waiting_target' || status === 'navigating';

  return (
    <>
      {/* Overlay */}
      <svg className="fixed inset-0 z-[9998]" width={vw} height={vh} style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width={vw} height={vh} fill="white" />
            {isShowing && spotlight && (
              <rect x={spotlight.left} y={spotlight.top} width={spotlight.width} height={spotlight.height} rx={8} ry={8} fill="black" />
            )}
          </mask>
        </defs>
        <rect x="0" y="0" width={vw} height={vh}
          fill="rgba(0,0,0,0.7)" mask="url(#tour-mask)"
          style={{ pointerEvents: 'auto' }} />
        {isShowing && spotlight && (
          <rect
            x={spotlight.left - 2} y={spotlight.top - 2}
            width={spotlight.width + 4} height={spotlight.height + 4}
            rx={10} ry={10} fill="none"
            stroke="hsl(var(--primary) / 0.35)" strokeWidth="1.5"
            style={{ pointerEvents: 'none' }}>
            <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="2" />
          </rect>
        )}
      </svg>

      {/* End screen */}
      {showEndScreen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="w-full max-w-sm rounded-xl border border-border bg-popover p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Start small.</h2>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Capture one thing.</p>
                <p>Create one task.</p>
                <p>Schedule one focus block.</p>
              </div>
              <Button className="w-full mt-2" onClick={handleFinish}>Go to Dashboard</Button>
            </div>
          </div>
        </div>
      )}

      {/* Waiting / loading state */}
      {isWaiting && !showEndScreen && !showFallback && (
        <div className="fixed z-[9999] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="rounded-lg border border-border bg-popover p-4 shadow-lg animate-in fade-in-0 duration-150"
            onClick={e => e.stopPropagation()}>
            <p className="text-sm text-muted-foreground">Loading step…</p>
          </div>
        </div>
      )}

      {/* Fallback: target not found after retries */}
      {showFallback && !showEndScreen && (
        <div className="fixed z-[9999] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="rounded-lg border border-border bg-popover p-5 shadow-lg max-w-xs space-y-3 animate-in fade-in-0 duration-150"
            onClick={e => e.stopPropagation()}>
            <p className="text-sm text-foreground font-medium">Couldn't find this step on the page.</p>
            <p className="text-xs text-muted-foreground">The element may not be visible right now.</p>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={handleRetry} className="text-xs h-7 px-3">Retry</Button>
              <Button size="sm" onClick={handleSkipStep} className="text-xs h-7 px-3">Skip step</Button>
            </div>
          </div>
        </div>
      )}

      {/* Tooltip — only when showing */}
      {isShowing && tooltipPos && !showEndScreen && (
        <div
          ref={tooltipRef}
          className="fixed z-[9999] animate-in fade-in-0 duration-150"
          style={{ top: tooltipPos.top, left: tooltipPos.left, width: Math.min(TOOLTIP_MAX_W, vw - 24) }}
          onClick={e => e.stopPropagation()}>
          <div className="relative rounded-lg border border-border bg-popover p-4 shadow-lg">
            <Arrow side={tooltipPos.arrowSide} offset={tooltipPos.arrowOffset} />

            <h3 className="text-[15px] font-semibold text-foreground leading-snug">{step.title}</h3>
            <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">{step.body}</p>

            <div className="flex items-center justify-between mt-4">
              <span className="text-[11px] text-muted-foreground">
                {currentIndex + 1} of {steps.length}
              </span>
              <div className="flex items-center gap-2">
                {currentIndex > 0 && (
                  <Button size="sm" variant="ghost" onClick={handleBack} className="text-xs h-7 px-3">Back</Button>
                )}
                <Button size="sm" onClick={handleNext} className="text-xs h-7 px-4">
                  {isLast ? 'Finish' : 'Next'}
                </Button>
              </div>
            </div>

            <div className="mt-2 text-right">
              <button onClick={() => setShowSkipConfirm(true)}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                Skip tour
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skip confirmation */}
      <AlertDialog open={showSkipConfirm} onOpenChange={setShowSkipConfirm}>
        <AlertDialogContent className="z-[10000]">
          <AlertDialogHeader>
            <AlertDialogTitle>Skip the tour?</AlertDialogTitle>
            <AlertDialogDescription>You can restart it anytime from Settings → Getting Started.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue tour</AlertDialogCancel>
            <AlertDialogAction onClick={handleClose}>Skip</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
