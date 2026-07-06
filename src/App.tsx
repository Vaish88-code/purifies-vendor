import { Toaster } from "@shared/components/ui/toaster";
import { Toaster as Sonner } from "@shared/components/ui/sonner";
import { TooltipProvider } from "@shared/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@shared/contexts/AuthContext";
import { FirebaseStatus } from "@shared/components/FirebaseStatus";
import { RequireVendorAuth } from "@/components/auth/RequireVendorAuth";

// Auth
import Login from "./pages/Login";

// Vendor Pages
import VendorDashboard from "./pages/vendor/VendorDashboard";
import VendorOrders from "./pages/vendor/VendorOrders";
import VendorInventory from "./pages/vendor/VendorInventory";
import VendorEarnings from "./pages/vendor/VendorEarnings";
import VendorShopSettings from "./pages/vendor/VendorShopSettings";
import VendorSubscriptionRequests from "./pages/vendor/VendorSubscriptionRequests";
import VendorSubscriptions from "./pages/vendor/VendorSubscriptions";
import VendorSubscriptionCustomers from "./pages/vendor/VendorSubscriptionCustomers";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <FirebaseStatus />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Login */}
            <Route path="/login" element={<Login />} />

            {/* Vendor Routes — all protected */}
            <Route path="/" element={<RequireVendorAuth><VendorDashboard /></RequireVendorAuth>} />
            <Route path="/orders" element={<RequireVendorAuth><VendorOrders /></RequireVendorAuth>} />
            <Route path="/subscription-requests" element={<RequireVendorAuth><VendorSubscriptionRequests /></RequireVendorAuth>} />
            <Route path="/subscriptions" element={<RequireVendorAuth><VendorSubscriptions /></RequireVendorAuth>} />
            <Route path="/subscription-customers" element={<RequireVendorAuth><VendorSubscriptionCustomers /></RequireVendorAuth>} />
            <Route path="/settings" element={<RequireVendorAuth><VendorShopSettings /></RequireVendorAuth>} />
            <Route path="/inventory" element={<RequireVendorAuth><VendorInventory /></RequireVendorAuth>} />
            <Route path="/earnings" element={<RequireVendorAuth><VendorEarnings /></RequireVendorAuth>} />

            {/* Catch-all */}
            <Route path="*" element={<RequireVendorAuth><VendorDashboard /></RequireVendorAuth>} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
