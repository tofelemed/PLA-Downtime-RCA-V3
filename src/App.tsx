import { lazy, Suspense, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { UnsavedChangesDialogHost } from "@/features/ux-kit/unsaved-changes-dialog-host";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Layout } from "./components/Layout";
import { LoginForm } from "./components/LoginForm";
import { PlantSelectionProvider } from "./contexts/PlantSelectionContext";
import { DisplayCurrencyProvider } from "@/features/display-currency/display-currency-provider";
import { CalendarPreferenceProvider } from "@/features/settings/calendar-preference-provider";
import { createAppQueryClient } from "./app/query-client";
import { PROTECTED_ROUTES } from "./app/routes";
import { RouteCapabilityGate } from "./app/routes/route-capability-gate";
import { CrumbReachFromRoutes } from "./app/routes/crumb-reach-from-routes";
import { V2SessionBridge } from "./features/v2-foundation/v2-session-bridge";
import { RealtimeBridge } from "./features/v2-foundation/realtime-bridge";
import { SessionRecovery } from "./features/auth/session-recovery";
import { PeriodDraftBoundary } from "./features/plan-dashboard/period-draft-boundary";
import { RcaDraftBoundary } from "./features/rca/rca-draft-boundary";
import { RouteErrorBoundary } from "@/features/ux-kit/errors/route-error-boundary";
import { GlobalErrorListeners } from "@/features/ux-kit/errors/global-error-listeners";

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

/** Unknown address: inside the app shell for a signed-in user (menu still usable), standalone otherwise. */
const NotFoundRoute = () => {
  const { session, isLoading } = useAuth();
  if (isLoading || session) {
    return (
      <ProtectedRoute>
        <NotFound embedded />
      </ProtectedRoute>
    );
  }
  return (
    <Suspense fallback={<PageFallback />}>
      <NotFound />
    </Suspense>
  );
};

/**
 * Routes come from the per-area modules in `src/app/routes/` (one file per area, owned by its track); each
 * is guarded by the capability of its menu item (`RouteCapabilityGate`, UX audit B-7).
 */
const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    {PROTECTED_ROUTES.map((route) => (
      <Route
        key={route.path}
        path={route.path}
        element={
          <ProtectedRoute>
            <RouteCapabilityGate requires={route.requires} title={route.gateTitle}>{route.element}</RouteCapabilityGate>
          </ProtectedRoute>
        }
      />
    ))}
    <Route path="*" element={<NotFoundRoute />} />
  </Routes>
);

/**
 * Full-page error boundary around every route (also the login screen, the 404 page and the shell itself):
 * a crash outside a page's own boundary still shows "Something went wrong" with Refresh / Go to dashboard
 * (router link), resets on navigation, and a 401 ends the session instead.
 */
const AppRouteBoundary = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const { expireSession } = useAuth();
  return (
    <RouteErrorBoundary resetKey={pathname} onAuthFailure={expireSession} fullPage>
      {children}
    </RouteErrorBoundary>
  );
};

const App = () => (
  // outermost: a crash in the providers above the router (no router link possible there)
  <RouteErrorBoundary resetKey="app" fullPage navigation="document">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <UnsavedChangesDialogHost />
        <AuthProvider>
          <PlantSelectionProvider>
            <DisplayCurrencyProvider>
              <CalendarPreferenceProvider>
                <GlobalErrorListeners />
                <V2SessionBridge />
                <PeriodDraftBoundary />
                <RcaDraftBoundary />
                <RealtimeBridge />
                <BrowserRouter>
                  <AppRouteBoundary>
                    <CrumbReachFromRoutes routes={PROTECTED_ROUTES}>
                      <AppRoutes />
                    </CrumbReachFromRoutes>
                  </AppRouteBoundary>
                </BrowserRouter>
              </CalendarPreferenceProvider>
            </DisplayCurrencyProvider>
          </PlantSelectionProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </RouteErrorBoundary>
);

export default App;
