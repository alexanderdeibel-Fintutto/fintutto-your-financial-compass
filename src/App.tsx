import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Invoices from "./pages/Invoices";
import Receipts from "./pages/Receipts";
import Contacts from "./pages/Contacts";
import BankAccounts from "./pages/BankAccounts";
import BankConnect from "./pages/BankConnect";
import Elster from "./pages/Elster";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Companies from "./pages/Companies";
import Handover from "./pages/Handover";
import Calendar from "./pages/Calendar";
import EmailTemplates from "./pages/EmailTemplates";
import Notifications from "./pages/Notifications";
import HelpCenter from "./pages/HelpCenter";
import BankCallback from "./pages/BankCallback";
import NotFound from "./pages/NotFound";
import RecurringTransactions from "./pages/RecurringTransactions";
import Quotes from "./pages/Quotes";
import OrderConfirmations from "./pages/OrderConfirmations";
import Automation from "./pages/Automation";
import SepaPayments from "./pages/SepaPayments";
import TaxAdvisorPortal from "./pages/TaxAdvisorPortal";
import EcommerceIntegration from "./pages/EcommerceIntegration";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <CompanyProvider>
      <NotificationProvider>
        <AppLayout>{children}</AppLayout>
      </NotificationProvider>
    </CompanyProvider>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/buchungen" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
      <Route path="/wiederkehrend" element={<ProtectedRoute><RecurringTransactions /></ProtectedRoute>} />
      <Route path="/angebote" element={<ProtectedRoute><Quotes /></ProtectedRoute>} />
      <Route path="/auftraege" element={<ProtectedRoute><OrderConfirmations /></ProtectedRoute>} />
      <Route path="/rechnungen" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
      <Route path="/belege" element={<ProtectedRoute><Receipts /></ProtectedRoute>} />
      <Route path="/kontakte" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
      <Route path="/bankkonten" element={<ProtectedRoute><BankAccounts /></ProtectedRoute>} />
      <Route path="/bankverbindung" element={<ProtectedRoute><BankConnect /></ProtectedRoute>} />
      <Route path="/elster" element={<ProtectedRoute><Elster /></ProtectedRoute>} />
      <Route path="/berichte" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/automatisierung" element={<ProtectedRoute><Automation /></ProtectedRoute>} />
      <Route path="/sepa" element={<ProtectedRoute><SepaPayments /></ProtectedRoute>} />
      <Route path="/steuerberater" element={<ProtectedRoute><TaxAdvisorPortal /></ProtectedRoute>} />
      <Route path="/ecommerce" element={<ProtectedRoute><EcommerceIntegration /></ProtectedRoute>} />
      <Route path="/einstellungen" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/firmen" element={<ProtectedRoute><Companies /></ProtectedRoute>} />
      <Route path="/uebergabe" element={<ProtectedRoute><Handover /></ProtectedRoute>} />
      <Route path="/kalender" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
      <Route path="/vorlagen" element={<ProtectedRoute><EmailTemplates /></ProtectedRoute>} />
      <Route path="/benachrichtigungen" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      <Route path="/hilfe" element={<ProtectedRoute><HelpCenter /></ProtectedRoute>} />
      <Route path="/bank-callback" element={<BankCallback />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <ThemeProvider>
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
  </ThemeProvider>
);

export default App;
