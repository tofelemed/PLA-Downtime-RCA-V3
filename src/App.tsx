import { Suspense, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Layout } from "./components/Layout";
import { LoginForm } from "./components/LoginForm";
import { PlantSelectionProvider } from "./contexts/PlantSelectionContext";
import { createAppQueryClient } from "./app/query-client";
import * as Pages from "./app/lazy-pages";
import { V2SessionBridge } from "./features/v2-foundation/v2-session-bridge";
import { RealtimeBridge } from "./features/v2-foundation/realtime-bridge";

const queryClient = createAppQueryClient();

const PageFallback = () => (
  <div className="min-h-[40vh] flex items-center justify-center" role="status" aria-label="Loading page">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

const ProtectedRoute: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return <LoginForm />;
  }

  return (
    <Layout>
      <Suspense fallback={<PageFallback />}>{children}</Suspense>
    </Layout>
  );
};

const SettingsPlaceholder = () => (
  <div className="text-center py-12">
    <h2 className="text-2xl font-bold mb-2">Settings</h2>
    <p className="text-gray-500">System configuration coming soon</p>
  </div>
);

/** Protected routes; each page is a lazily loaded chunk (plan 3.1 step 6). */
const PROTECTED_ROUTES: Array<[path: string, element: ReactNode]> = [
  ["/dashboard", <Pages.Dashboard />],
  ["/users", <Pages.UserManagement />],
  ["/admin", <Pages.AdminPanel />],
  ["/permissions", <Pages.PermissionsManagement />],
  ["/master-data", <Pages.MasterData />],
  ["/events", <Pages.EventHub />],
  ["/rca", <Pages.RCAModule />],
  ["/rca-knowledge-base", <Pages.RCAKnowledgeBase />],
  ["/test-rca-tools", <Pages.TestRCAAnalysisTools />],
  ["/connectivity", <Pages.Connectivity />],
  ["/enhanced-historian", <Pages.EnhancedHistorian />],
  ["/pla-analytics", <Pages.PLADashboard />],
  ["/reports", <Pages.Reports />],
  ["/audit", <Pages.AuditLogs />],
  ["/tasks", <Pages.Tasks />],
  ["/settings", <SettingsPlaceholder />],
  ["/production-plans", <Pages.ProductionPlans />],
];

/** Development builds only: legacy demo seeding (A4) and the UX kit playground. */
const DEV_ROUTES: Array<[path: string, element: ReactNode]> = Pages.DEV_PAGES.map(([path, Page]) => [path, <Page />]);

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      {[...PROTECTED_ROUTES, ...DEV_ROUTES].map(([path, element]) => (
        <Route key={path} path={path} element={<ProtectedRoute>{element}</ProtectedRoute>} />
      ))}
      <Route
        path="*"
        element={
          <Suspense fallback={<PageFallback />}>
            <Pages.NotFound />
          </Suspense>
        }
      />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <PlantSelectionProvider>
          <V2SessionBridge />
          <RealtimeBridge />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </PlantSelectionProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
