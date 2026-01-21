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
import NotFound from "./pages/NotFound";
import Processing from "./pages/Processing";
import "@/lib/firebase";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/raw-inventory" element={<RawInventory />} />
              <Route path="/processed-inventory" element={<ProcessedInventory />} />
              <Route path="/processing" element={<Processing />} />
              <Route path="/accounting" element={<Accounting />} />
              <Route path="/doctors" element={<Doctors />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
