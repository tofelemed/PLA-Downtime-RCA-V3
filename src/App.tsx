import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Layout } from "./components/Layout";
import { LoginForm } from "./components/LoginForm";
import Dashboard from "./pages/Dashboard";
import { UserManagement } from "./pages/UserManagement";
import MasterData from "./pages/MasterData";
import ProductionPlans from "./pages/ProductionPlans";
import { EventHub } from "./pages/EventHub";
import { RCAModule } from "./pages/RCAModule";
import { Connectivity } from "./pages/Connectivity";
import { EnhancedHistorian } from "./pages/EnhancedHistorian";
import NotFound from "./pages/NotFound";
import { AdminPanel } from "./pages/AdminPanel";
import { PermissionsManagement } from "./pages/PermissionsManagement";
import { PlantSelectionProvider } from "./contexts/PlantSelectionContext";
import PLADashboard from "./pages/PLADashboard";

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  return <Layout>{children}</Layout>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/users" element={
        <ProtectedRoute>
          <UserManagement />
        </ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute>
          <AdminPanel />
        </ProtectedRoute>
      } />
      <Route path="/permissions" element={
        <ProtectedRoute>
          <PermissionsManagement />
        </ProtectedRoute>
      } />
      <Route path="/master-data" element={
        <ProtectedRoute>
          <MasterData />
        </ProtectedRoute>
      } />
      <Route path="/events" element={
        <ProtectedRoute>
          <EventHub />
        </ProtectedRoute>
      } />
      <Route path="/rca" element={
        <ProtectedRoute>
          <RCAModule />
        </ProtectedRoute>
      } />
      <Route path="/connectivity" element={
        <ProtectedRoute>
          <Connectivity />
        </ProtectedRoute>
      } />
      <Route path="/enhanced-historian" element={
        <ProtectedRoute>
          <EnhancedHistorian />
        </ProtectedRoute>
      } />
      <Route path="/pla-analytics" element={
        <ProtectedRoute>
          <PLADashboard />
        </ProtectedRoute>
      } />
      <Route path="/audit" element={
        <ProtectedRoute>
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-2">Audit Logs</h2>
            <p className="text-gray-500">Comprehensive audit trail coming soon</p>
          </div>
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-2">Settings</h2>
            <p className="text-gray-500">System configuration coming soon</p>
          </div>
        </ProtectedRoute>
      } />
      <Route path="/production-plans" element={
        <ProtectedRoute>
          <ProductionPlans />
        </ProtectedRoute>
      } />
      <Route path="*" element={<NotFound />} />
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
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </PlantSelectionProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
