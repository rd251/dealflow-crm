// CRM App
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CrmProvider } from "@/hooks/use-crm-store";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import AppSidebar from "@/components/AppSidebar";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Salgsmuligheter from "./pages/Salgsmuligheter";
import Prosjekter from "./pages/Prosjekter";
import Companies from "./pages/Companies";
import Contacts from "./pages/Contacts";
import Tasks from "./pages/Tasks";
import Partnere from "./pages/Partnere";
import PartnerProfile from "./pages/PartnerProfile";
import PartnerPipeline from "./pages/PartnerPipeline";
import CompanyProfile from "./pages/CompanyProfile";
import Admin from "./pages/Admin";
import Aktiviteter from "./pages/Aktiviteter";
import Rapporter from "./pages/Rapporter";
import Kalender from "./pages/Kalender";
import Innstillinger from "./pages/Innstillinger";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <CrmProvider>
              <AppSidebar />
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/leads" element={<Leads />} />
                <Route path="/salgsmuligheter" element={<Salgsmuligheter />} />
                <Route path="/prosjekter" element={<Prosjekter />} />
                <Route path="/selskaper" element={<Companies />} />
                <Route path="/selskaper/:id" element={<CompanyProfile />} />
                <Route path="/kontakter" element={<Contacts />} />
                <Route path="/oppgaver" element={<Tasks />} />
                <Route path="/kalender" element={<Kalender />} />
                <Route path="/partnere" element={<Partnere />} />
                <Route path="/partnere/:id" element={<PartnerProfile />} />
                <Route path="/partner-pipeline" element={<PartnerPipeline />} />
                <Route path="/aktiviteter" element={<Aktiviteter />} />
                <Route path="/rapporter" element={<Rapporter />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/innstillinger" element={<Innstillinger />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </CrmProvider>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
