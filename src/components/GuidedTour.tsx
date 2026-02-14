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

export interface TourStep {
  id: string;
  targetSelector: string;
  title: string;
  body: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
  route?: string;
  requiredModule?: string;
}

const TOUR_COMPLETED_KEY = 'lifeos-tour-completed';

function isTourCompleted(userId: string): boolean {
  try {
    const val = localStorage.getItem(TOUR_COMPLETED_KEY);
    if (!val) return false;
    const parsed = JSON.parse(val);
    return parsed[userId] === true;
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

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

type ResolvedPlacement = 'top' | 'bottom' | 'left' | 'right';

const TOOLTIP_MAX_W = 360;
const GAP = 14;
const SPOT_PAD = 6;

function resolvePlacement(
  rect: Rect,
  preferred: ResolvedPlacement,
  tw: number,
  th: number,
): ResolvedPlacement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const fits = (p: ResolvedPlacement) => {
    switch (p) {
      case 'right': return rect.left + rect.width + GAP + tw < vw - 12;
      case 'bottom': return rect.top + rect.height + GAP + th < vh - 12;
      case 'left': return rect.left - GAP - tw > 12;
      case 'top': return rect.top - GAP - th > 12;
    }
  };
  if (fits(preferred)) return preferred;
  const fallbacks: ResolvedPlacement[] = ['right', 'bottom', 'left', 'top'];
  return fallbacks.find(fits) ?? 'bottom';
}

function computePos(
  rect: Rect,
  placement: ResolvedPlacement,
  tw: number,
  th: number,
): { top: number; left: number; arrowSide: ResolvedPlacement; arrowOffset: number } {
  let top = 0;
  let left = 0;

  switch (placement) {
    case 'right':
      top = rect.top + rect.height / 2 - th / 2;
      left = rect.left + rect.width + GAP;
      break;
    case 'left':
      top = rect.top + rect.height / 2 - th / 2;
      left = rect.left - tw - GAP;
      break;
    case 'bottom':
      top = rect.top + rect.height + GAP;
      left = rect.left + rect.width / 2 - tw / 2;
      break;
    case 'top':
      top = rect.top - th - GAP;
      left = rect.left + rect.width / 2 - tw / 2;
      break;
  }

  // Clamp
  left = Math.max(12, Math.min(left, window.innerWidth - tw - 12));
  top = Math.max(12, Math.min(top, window.innerHeight - th - 12));

  // Arrow points back toward target center
  const arrowSide: ResolvedPlacement =
    placement === 'right' ? 'left' :
    placement === 'left' ? 'right' :
    placement === 'bottom' ? 'top' : 'bottom';

  // Arrow offset along the edge (in px from top/left of tooltip)
  let arrowOffset: number;
  if (placement === 'right' || placement === 'left') {
    arrowOffset = Math.max(16, Math.min(rect.top + rect.height / 2 - top, th - 16));
  } else {
    arrowOffset = Math.max(16, Math.min(rect.left + rect.width / 2 - left, tw - 16));
  }

  return { top, left, arrowSide, arrowOffset };
}

export function GuidedTour({ steps }: { steps: TourStep[] }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [spotlight, setSpotlight] = useState<Rect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<{
    top: number; left: number; arrowSide: ResolvedPlacement; arrowOffset: number;
  } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<number>(0);

  // Start tour
  useEffect(() => {
    if (!user || !profile) return;
    const showTour = profile.preferences?.showTutorial !== false;
    if (showTour && !isTourCompleted(user.id) && steps.length > 0) {
      const timer = setTimeout(() => setVisible(true), 900);
      return () => clearTimeout(timer);
    }
  }, [user, profile, steps.length]);

  const positionTooltip = useCallback(() => {
    if (!visible || showEndScreen || currentStep >= steps.length) {
      setSpotlight(null);
      setTooltipStyle(null);
      return;
    }
    const step = steps[currentStep];
    const el = document.querySelector(step.targetSelector);
    if (!el) {
      // If route needed, navigate
      if (step.route && location.pathname !== step.route && retryRef.current < 2) {
        retryRef.current++;
        navigate(step.route);
        return;
      }
      // Skip this step
      if (currentStep < steps.length - 1) {
        setCurrentStep(prev => prev + 1);
      } else {
        setShowEndScreen(true);
      }
      return;
    }

    retryRef.current = 0;
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
      setTooltipStyle(computePos(sr, placement, tw, th));
    });
  }, [visible, showEndScreen, currentStep, steps, location.pathname, navigate]);

  // Reposition on step/route changes
  useEffect(() => {
    if (!visible || showEndScreen) return;
    const timer = setTimeout(positionTooltip, 200);
    return () => clearTimeout(timer);
  }, [visible, showEndScreen, currentStep, location.pathname, positionTooltip]);

  useEffect(() => {
    if (!visible) return;
    window.addEventListener('resize', positionTooltip);
    return () => window.removeEventListener('resize', positionTooltip);
  }, [visible, positionTooltip]);

  // Escape key
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSkipConfirm(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible]);

  const handleClose = () => {
    setVisible(false);
    setShowEndScreen(false);
    setShowSkipConfirm(false);
    if (user) markTourCompleted(user.id);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setShowEndScreen(true);
      setSpotlight(null);
      setTooltipStyle(null);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  const handleFinish = () => {
    handleClose();
    navigate('/');
  };

  if (!visible || steps.length === 0) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Arrow component
  const Arrow = ({ side, offset }: { side: ResolvedPlacement; offset: number }) => {
    const size = 8;
    const style: React.CSSProperties = { position: 'absolute' };
    let points = '';

    if (side === 'left') {
      style.left = -size;
      style.top = offset - size;
      points = `${size},0 ${size},${size * 2} 0,${size}`;
    } else if (side === 'right') {
      style.right = -size;
      style.top = offset - size;
      points = `0,0 0,${size * 2} ${size},${size}`;
    } else if (side === 'top') {
      style.top = -size;
      style.left = offset - size;
      points = `0,${size} ${size},0 ${size * 2},${size}`;
    } else {
      style.bottom = -size;
      style.left = offset - size;
      points = `0,0 ${size * 2},0 ${size},${size}`;
    }

    return (
      <svg
        style={{ ...style, pointerEvents: 'none' }}
        width={side === 'left' || side === 'right' ? size : size * 2}
        height={side === 'left' || side === 'right' ? size * 2 : size}
      >
        <polygon points={points} className="fill-popover" />
      </svg>
    );
  };

  // End screen
  if (showEndScreen) {
    return (
      <>
        <div className="fixed inset-0 z-[9998] bg-black/70" />
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-popover p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Start small.</h2>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Capture one thing.</p>
                <p>Create one task.</p>
                <p>Schedule one focus block.</p>
              </div>
              <Button className="w-full mt-2" onClick={handleFinish}>
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Overlay with spotlight cutout */}
      <svg
        className="fixed inset-0 z-[9998]"
        width={vw}
        height={vh}
        style={{ pointerEvents: 'none' }}
      >
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width={vw} height={vh} fill="white" />
            {spotlight && (
              <rect
                x={spotlight.left}
                y={spotlight.top}
                width={spotlight.width}
                height={spotlight.height}
                rx={8}
                ry={8}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0" width={vw} height={vh}
          fill="rgba(0,0,0,0.7)"
          mask="url(#tour-mask)"
          style={{ pointerEvents: 'auto' }}
        />
        {/* Subtle pulse ring around spotlight */}
        {spotlight && (
          <rect
            x={spotlight.left - 2}
            y={spotlight.top - 2}
            width={spotlight.width + 4}
            height={spotlight.height + 4}
            rx={10}
            ry={10}
            fill="none"
            stroke="hsl(var(--primary) / 0.35)"
            strokeWidth="1.5"
            style={{ pointerEvents: 'none' }}
          >
            <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="2" />
          </rect>
        )}
      </svg>

      {/* Tooltip */}
      {tooltipStyle && (
        <div
          ref={tooltipRef}
          className="fixed z-[9999] animate-in fade-in-0 duration-150"
          style={{
            top: tooltipStyle.top,
            left: tooltipStyle.left,
            width: Math.min(TOOLTIP_MAX_W, vw - 24),
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="relative rounded-lg border border-border bg-popover p-4 shadow-lg">
            <Arrow side={tooltipStyle.arrowSide} offset={tooltipStyle.arrowOffset} />

            <h3 className="text-[15px] font-semibold text-foreground leading-snug">
              {step.title}
            </h3>
            <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">
              {step.body}
            </p>

            <div className="flex items-center justify-between mt-4">
              <span className="text-[11px] text-muted-foreground">
                {currentStep + 1} of {steps.length}
              </span>
              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleBack}
                    className="text-xs h-7 px-3"
                  >
                    Back
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleNext}
                  className="text-xs h-7 px-4"
                >
                  {isLast ? 'Finish' : 'Next'}
                </Button>
              </div>
            </div>

            <div className="mt-2 text-right">
              <button
                onClick={() => setShowSkipConfirm(true)}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip tour
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skip confirmation dialog */}
      <AlertDialog open={showSkipConfirm} onOpenChange={setShowSkipConfirm}>
        <AlertDialogContent className="z-[10000]">
          <AlertDialogHeader>
            <AlertDialogTitle>Skip the tour?</AlertDialogTitle>
            <AlertDialogDescription>
              You can restart it anytime from Settings → Getting Started.
            </AlertDialogDescription>
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
