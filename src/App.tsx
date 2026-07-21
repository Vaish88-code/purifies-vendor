import { Toaster } from "@shared/components/ui/toaster";
import { Toaster as Sonner } from "@shared/components/ui/sonner";
import { TooltipProvider } from "@shared/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@shared/contexts/AuthContext";
import { FirebaseStatus } from "@shared/components/FirebaseStatus";
import { RequireVendorAuth } from "@/components/auth/RequireVendorAuth";
import { GuestOnly } from "@/components/auth/GuestOnly";

// Pages
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";

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
            {/* Entry: login first, dashboard after auth */}
            <Route path="/" element={<LandingPage />} />

            {/* Public auth */}
            <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
            <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />

            {/* Protected vendor routes */}
            <Route path="/dashboard" element={<RequireVendorAuth><VendorDashboard /></RequireVendorAuth>} />
            <Route path="/orders" element={<RequireVendorAuth><VendorOrders /></RequireVendorAuth>} />
            <Route path="/subscription-requests" element={<RequireVendorAuth><VendorSubscriptionRequests /></RequireVendorAuth>} />
            <Route path="/subscriptions" element={<RequireVendorAuth><VendorSubscriptions /></RequireVendorAuth>} />
            <Route path="/subscription-customers" element={<RequireVendorAuth><VendorSubscriptionCustomers /></RequireVendorAuth>} />
            <Route path="/settings" element={<RequireVendorAuth><VendorShopSettings /></RequireVendorAuth>} />
            <Route path="/inventory" element={<RequireVendorAuth><VendorInventory /></RequireVendorAuth>} />
            <Route path="/earnings" element={<RequireVendorAuth><VendorEarnings /></RequireVendorAuth>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
