import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export interface TourStep {
  targetSelector: string;
  title: string;
  text: string;
  cta?: string;
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

export function GuidedTour({ steps }: { steps: TourStep[] }) {
  const { user, profile } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, arrowSide: 'bottom' as 'top' | 'bottom' });
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !profile) return;
    const showTour = profile.preferences?.showTutorial !== false;
    if (showTour && !isTourCompleted(user.id) && steps.length > 0) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [user, profile, steps.length]);

  const updatePosition = useCallback(() => {
    if (!visible || currentStep >= steps.length) return;
    const el = document.querySelector(steps[currentStep].targetSelector);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const tooltipH = 180;
    const isAbove = rect.bottom + tooltipH + 20 > window.innerHeight;

    setPosition({
      top: isAbove ? rect.top - tooltipH - 12 : rect.bottom + 12,
      left: Math.max(16, Math.min(rect.left, window.innerWidth - 340)),
      width: Math.min(320, window.innerWidth - 32),
      arrowSide: isAbove ? 'bottom' : 'top',
    });

    // Highlight element
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [visible, currentStep, steps]);

  useEffect(() => {
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [updatePosition]);

  const handleClose = () => {
    setVisible(false);
    if (user) markTourCompleted(user.id);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  if (!visible || steps.length === 0) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-background/40 backdrop-blur-[2px] z-[9998]" onClick={handleClose} />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-[9999] animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
        style={{ top: position.top, left: position.left, width: position.width }}
      >
        <Card className="border-primary/30 shadow-xl">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.text}</p>
              </div>
              <button onClick={handleClose} className="text-muted-foreground hover:text-foreground shrink-0 ml-2">
                <X className="h-4 w-4" />
              </button>
            </div>

            {step.cta && (
              <p className="text-[11px] text-primary font-medium">{step.cta}</p>
            )}

            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{currentStep + 1} / {steps.length}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={handleClose} className="text-xs h-7">Skip tour</Button>
                {currentStep > 0 && (
                  <Button size="sm" variant="outline" onClick={handleBack} className="text-xs h-7">
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                )}
                <Button size="sm" onClick={handleNext} className="text-xs h-7">
                  {isLast ? 'Finish' : 'Next'} {!isLast && <ChevronRight className="h-3 w-3 ml-1" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
