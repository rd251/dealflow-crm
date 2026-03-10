import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CrmProvider } from "@/hooks/use-crm-store";
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
import NotFound from "./pages/NotFound";
import CompanyProfile from "./pages/CompanyProfile";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
              <Route path="/partnere" element={<Partnere />} />
              <Route path="/partnere/:id" element={<PartnerProfile />} />
              <Route path="/partner-pipeline" element={<PartnerPipeline />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </CrmProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
