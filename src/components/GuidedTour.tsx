import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

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

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TooltipPos {
  top: number;
  left: number;
}

function computeTooltipPosition(
  rect: SpotlightRect,
  placement: 'top' | 'bottom' | 'left' | 'right',
  tooltipW: number,
  tooltipH: number,
  gap: number = 12
): TooltipPos {
  let top = 0;
  let left = 0;

  switch (placement) {
    case 'bottom':
      top = rect.top + rect.height + gap;
      left = rect.left + rect.width / 2 - tooltipW / 2;
      break;
    case 'top':
      top = rect.top - tooltipH - gap;
      left = rect.left + rect.width / 2 - tooltipW / 2;
      break;
    case 'right':
      top = rect.top + rect.height / 2 - tooltipH / 2;
      left = rect.left + rect.width + gap;
      break;
    case 'left':
      top = rect.top + rect.height / 2 - tooltipH / 2;
      left = rect.left - tooltipW - gap;
      break;
  }

  // Clamp to viewport
  left = Math.max(12, Math.min(left, window.innerWidth - tooltipW - 12));
  top = Math.max(12, Math.min(top, window.innerHeight - tooltipH - 12));

  return { top, left };
}

export function GuidedTour({ steps }: { steps: TourStep[] }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPos>({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const TOOLTIP_W = 320;
  const TOOLTIP_H = 180;
  const PAD = 8;

  useEffect(() => {
    if (!user || !profile) return;
    const showTour = profile.preferences?.showTutorial !== false;
    if (showTour && !isTourCompleted(user.id) && steps.length > 0) {
      const timer = setTimeout(() => setVisible(true), 900);
      return () => clearTimeout(timer);
    }
  }, [user, profile, steps.length]);

  const updateSpotlight = useCallback(() => {
    if (!visible || showEndScreen || currentStep >= steps.length) {
      setSpotlight(null);
      return;
    }
    const step = steps[currentStep];
    const el = document.querySelector(step.targetSelector);
    if (!el) {
      setSpotlight(null);
      // Center tooltip
      setTooltipPos({
        top: window.innerHeight / 2 - TOOLTIP_H / 2,
        left: window.innerWidth / 2 - TOOLTIP_W / 2,
      });
      return;
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Small delay after scroll
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const sr: SpotlightRect = {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      };
      setSpotlight(sr);
      setTooltipPos(computeTooltipPosition(sr, step.placement, TOOLTIP_W, TOOLTIP_H));
    });
  }, [visible, showEndScreen, currentStep, steps]);

  // Navigate to route if needed
  useEffect(() => {
    if (!visible || showEndScreen || currentStep >= steps.length) return;
    const step = steps[currentStep];
    if (step.route && location.pathname !== step.route) {
      navigate(step.route);
      // Delay spotlight after navigation
      const timer = setTimeout(updateSpotlight, 500);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(updateSpotlight, 100);
      return () => clearTimeout(timer);
    }
  }, [visible, showEndScreen, currentStep, steps, location.pathname, navigate, updateSpotlight]);

  useEffect(() => {
    if (!visible) return;
    window.addEventListener('resize', updateSpotlight);
    return () => window.removeEventListener('resize', updateSpotlight);
  }, [visible, updateSpotlight]);

  const handleClose = () => {
    setVisible(false);
    setShowEndScreen(false);
    if (user) markTourCompleted(user.id);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setShowEndScreen(true);
      setSpotlight(null);
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

  // SVG overlay with spotlight cutout
  const renderOverlay = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!spotlight || showEndScreen) {
      return (
        <div
          className="fixed inset-0 z-[9998] bg-background/60 backdrop-blur-[2px]"
          onClick={handleClose}
        />
      );
    }

    const { top, left, width, height } = spotlight;
    const r = 8;

    return (
      <svg
        className="fixed inset-0 z-[9998]"
        width={vw}
        height={vh}
        style={{ pointerEvents: 'auto' }}
        onClick={handleClose}
      >
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width={vw} height={vh} fill="white" />
            <rect
              x={left}
              y={top}
              width={width}
              height={height}
              rx={r}
              ry={r}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width={vw}
          height={vh}
          fill="hsl(var(--background) / 0.65)"
          mask="url(#spotlight-mask)"
        />
        {/* Spotlight border glow */}
        <rect
          x={left}
          y={top}
          width={width}
          height={height}
          rx={r}
          ry={r}
          fill="none"
          stroke="hsl(var(--primary) / 0.4)"
          strokeWidth="2"
          style={{ pointerEvents: 'none' }}
        />
      </svg>
    );
  };

  // End screen
  if (showEndScreen) {
    return (
      <>
        {renderOverlay()}
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={e => e.stopPropagation()}>
          <Card className="w-full max-w-sm border-primary/20 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
            <CardContent className="p-6 space-y-5">
              <div className="text-center space-y-3">
                <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-lg font-semibold">Start small.</h2>
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <p>Capture one thing.</p>
                  <p>Create one task.</p>
                  <p>Schedule one focus block.</p>
                </div>
              </div>
              <Button className="w-full" onClick={handleFinish}>
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      {renderOverlay()}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        className="fixed z-[9999] animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
          width: TOOLTIP_W,
        }}
        onClick={e => e.stopPropagation()}
      >
        <Card className="border-primary/20 shadow-2xl">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1.5 flex-1">
                <p className="text-sm font-semibold leading-tight">{step.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.body}</p>
              </div>
              <button
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-muted-foreground font-medium">
                Step {currentStep + 1} of {steps.length}
              </span>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" onClick={handleClose} className="text-xs h-7 px-2">
                  Skip tour
                </Button>
                {currentStep > 0 && (
                  <Button size="sm" variant="outline" onClick={handleBack} className="text-xs h-7 px-2">
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                )}
                <Button size="sm" onClick={handleNext} className="text-xs h-7 px-3">
                  {isLast ? 'Finish' : 'Next'}
                  {!isLast && <ChevronRight className="h-3 w-3 ml-0.5" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
