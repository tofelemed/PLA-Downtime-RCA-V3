import { lazy, Suspense, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Layout } from "./components/Layout";
import { LoginForm } from "./components/LoginForm";
import { PlantSelectionProvider } from "./contexts/PlantSelectionContext";
import { DisplayCurrencyProvider } from "@/features/display-currency/display-currency-provider";
import { CalendarPreferenceProvider } from "@/features/settings/calendar-preference-provider";
import { createAppQueryClient } from "./app/query-client";
import { PROTECTED_ROUTES } from "./app/routes";
import { V2SessionBridge } from "./features/v2-foundation/v2-session-bridge";
import { RealtimeBridge } from "./features/v2-foundation/realtime-bridge";
import { SessionRecovery } from "./features/auth/session-recovery";
import { PeriodDraftBoundary } from "./features/plan-dashboard/period-draft-boundary";
import { RcaDraftBoundary } from "./features/rca/rca-draft-boundary";

const queryClient = createAppQueryClient();
const NotFound = lazy(() => import("@/pages/NotFound"));

const PageFallback = () => (
  <div className="min-h-[40vh] flex items-center justify-center" role="status" aria-label="Loading page">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { session, isLoading, startupError } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Signing in">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (startupError) return <SessionRecovery />;

  if (!session) {
    return <LoginForm />;
  }

  return (
    <Layout>
      <Suspense fallback={<PageFallback />}>{children}</Suspense>
    </Layout>
  );
};

/** Routes come from the per-area modules in `src/app/routes/` (one file per area, owned by its track). */
const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    {PROTECTED_ROUTES.map((route) => (
      <Route key={route.path} path={route.path} element={<ProtectedRoute>{route.element}</ProtectedRoute>} />
    ))}
    <Route
      path="*"
      element={
        <Suspense fallback={<PageFallback />}>
          <NotFound />
        </Suspense>
      }
    />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <PlantSelectionProvider>
          <DisplayCurrencyProvider>
            <CalendarPreferenceProvider>
              <V2SessionBridge />
              <PeriodDraftBoundary />
              <RcaDraftBoundary />
              <RealtimeBridge />
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </CalendarPreferenceProvider>
          </DisplayCurrencyProvider>
        </PlantSelectionProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
