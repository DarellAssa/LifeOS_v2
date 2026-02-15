import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppProvider } from "@/store/AppContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import TodayPage from "@/pages/TodayPage";
import PlanPage from "@/pages/PlanPage";
import CapturePage from "@/pages/CapturePage";
import ProgressPage from "@/pages/ProgressPage";
import MorePage from "@/pages/MorePage";
import Tasks from "@/pages/Tasks";
import Goals from "@/pages/Goals";
import CalendarPage from "@/pages/CalendarPage";
import Habits from "@/pages/Habits";
import Analytics from "@/pages/Analytics";
import Planning from "@/pages/Planning";
import Notifications from "@/pages/Notifications";
import InboxPage from "@/pages/InboxPage";
import SettingsPage from "@/pages/SettingsPage";
import TemplatesPage from "@/pages/TemplatesPage";
import AutomationsPage from "@/pages/AutomationsPage";
import ActivityLogPage from "@/pages/ActivityLogPage";
import AuthPage from "@/pages/AuthPage";
import OnboardingPage from "@/pages/OnboardingPage";
import NotFound from "@/pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (profile && !profile.onboarding_completed) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}

function OnboardingRoute() {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (profile?.onboarding_completed) return <Navigate to="/" replace />;
  return <OnboardingPage />;
}

function AuthRoute() {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (user && profile?.onboarding_completed) return <Navigate to="/" replace />;
  if (user && !profile?.onboarding_completed) return <Navigate to="/onboarding" replace />;
  return <AuthPage />;
}

const App = () => (
  <GlobalErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<AuthRoute />} />
              <Route path="/onboarding" element={<OnboardingRoute />} />
              <Route element={
                <ProtectedRoute>
                  <AppProvider>
                    <AppLayout />
                  </AppProvider>
                </ProtectedRoute>
              }>
                {/* Primary nav */}
                <Route path="/" element={<TodayPage />} />
                <Route path="/plan" element={<PlanPage />} />
                <Route path="/capture" element={<CapturePage />} />
                <Route path="/progress" element={<ProgressPage />} />
                <Route path="/more" element={<MorePage />} />
                {/* All existing routes accessible via More */}
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/goals" element={<Goals />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/habits" element={<Habits />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/planning" element={<Planning />} />
                <Route path="/inbox" element={<InboxPage />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/templates" element={<TemplatesPage />} />
                <Route path="/automations" element={<AutomationsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/activity" element={<ActivityLogPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </GlobalErrorBoundary>
);

export default App;
