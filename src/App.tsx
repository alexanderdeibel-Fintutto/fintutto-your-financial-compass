import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Invoices from "./pages/Invoices";
import Receipts from "./pages/Receipts";
import Contacts from "./pages/Contacts";
import BankAccounts from "./pages/BankAccounts";
import BankConnect from "./pages/BankConnect";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Companies from "./pages/Companies";
import NotFound from "./pages/NotFound";

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

  return <CompanyProvider><AppLayout>{children}</AppLayout></CompanyProvider>;
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
      <Route path="/rechnungen" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
      <Route path="/belege" element={<ProtectedRoute><Receipts /></ProtectedRoute>} />
      <Route path="/kontakte" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
      <Route path="/bankkonten" element={<ProtectedRoute><BankAccounts /></ProtectedRoute>} />
      <Route path="/bank-verbinden" element={<ProtectedRoute><BankConnect /></ProtectedRoute>} />
      <Route path="/berichte" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/einstellungen" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/firmen" element={<ProtectedRoute><Companies /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
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

export default App;
