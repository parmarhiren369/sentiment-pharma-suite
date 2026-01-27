import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/hooks/use-theme";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import RawInventory from "./pages/RawInventory";
import ProcessedInventory from "./pages/ProcessedInventory";
import Accounting from "./pages/Accounting";
import Doctors from "./pages/Doctors";
import LossCalculation from "./pages/LossCalculation";
import SupplierList from "./pages/SupplierList";
import CustomerList from "./pages/CustomerList";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Processing from "./pages/Processing";
import DoctorLogin from "./pages/DoctorLogin";
import DoctorDashboard from "./pages/DoctorDashboard";
import Items from "./pages/Items";
import { Suspense } from "react";

console.log("App.tsx loaded");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const App = () => {
  console.log("App rendering...");
  
  return (
    <Suspense fallback={<LoadingFallback />}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/doctor-login" element={<DoctorLogin />} />
                <Route path="/doctor-dashboard" element={<DoctorDashboard />} />
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Index />} />
                  <Route path="/items" element={<Items />} />
                  <Route path="/raw-inventory" element={<RawInventory />} />
                  <Route path="/processed-inventory" element={<ProcessedInventory />} />
                  <Route path="/processing" element={<Processing />} />
                  <Route path="/accounting" element={<Accounting />} />
                  <Route path="/doctors" element={<Doctors />} />
                  <Route path="/loss-calculation" element={<LossCalculation />} />
                  <Route path="/suppliers" element={<SupplierList />} />
                  <Route path="/customers" element={<CustomerList />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </Suspense>
  );
};

export default App;
