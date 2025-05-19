
import React, { useEffect, useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { registerServiceWorker, requestPushPermission, subscribeUserToPush } from "@/utils/push";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginForm from "./components/auth/LoginForm";
import RegisterForm from "./components/auth/RegisterForm";
import Messages from "./pages/Messages";
import AIMatch from "./pages/AIMatch";
import Marketplace from "./pages/Marketplace";
import Calendar from "./pages/Calendar";
import Teams from "./pages/Teams";
import PaymentSuccess from "./pages/PaymentSuccess";
import Files from "./pages/Files";
import Help from "./pages/Help";
import Settings from "./pages/Settings";
import Profile from '@/pages/Profile';
import EditProduct from './pages/EditProduct';
import Pricing from './pages/Pricing';

// Create the query client outside of the component
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("React component error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Algo deu errado</h2>
          <p className="mb-4 text-gray-300">
            {this.state.error?.message || "Ocorreu um erro na aplicação"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-app-purple text-white rounded hover:bg-app-purple/80"
          >
            Recarregar página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  
  // Set auth checked after a brief delay to prevent flashing
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setAuthChecked(true), 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);
  
  // Show loading indicator while checking authentication
  if (loading || !authChecked) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-app-purple"></div>
      </div>
    );
  }
  
  // Redirect to login if not authenticated
  if (!user) {
    console.log("User not authenticated, redirecting to login");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return <>{children}</>;
};

// Wrapper for routes that should only be accessible when logged out
const PublicOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  
  // Set auth checked after a brief delay
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setAuthChecked(true), 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);
  
  useEffect(() => {
    // If user is logged in and authentication check is complete, redirect to home page
    if (authChecked && user) {
      navigate('/', { replace: true });
    }
  }, [user, authChecked, navigate]);
  
  // Show loading indicator while checking authentication
  if (loading || !authChecked) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-app-purple"></div>
      </div>
    );
  }
  
  // If user is logged in, show nothing temporarily (will redirect via useEffect)
  if (user) {
    return null;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public only routes (login/register) */}
      <Route path="/login" element={
        <PublicOnlyRoute>
          <LoginForm />
        </PublicOnlyRoute>
      } />
      <Route path="/register" element={
        <PublicOnlyRoute>
          <RegisterForm />
        </PublicOnlyRoute>
      } />
      
      {/* Protected routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <Index />
        </ProtectedRoute>
      } />
      <Route path="/messages" element={
        <ProtectedRoute>
          <Messages />
        </ProtectedRoute>
      } />
      <Route path="/ai-match" element={
        <ProtectedRoute>
          <AIMatch />
        </ProtectedRoute>
      } />
      <Route path="/marketplace" element={
        <ProtectedRoute>
          <Marketplace />
        </ProtectedRoute>
      } />
      <Route path="/marketplace/:id/edit" element={
        <ProtectedRoute>
          <EditProduct />
        </ProtectedRoute>
      } />
      <Route path="/calendar" element={
        <ProtectedRoute>
          <Calendar />
        </ProtectedRoute>
      } />
      <Route path="/teams" element={
        <ProtectedRoute>
          <Teams />
        </ProtectedRoute>
      } />
      <Route path="/files" element={
        <ProtectedRoute>
          <Files />
        </ProtectedRoute>
      } />
      <Route path="/help" element={
        <ProtectedRoute>
          <Help />
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      } />
      <Route path="/security" element={<Navigate to="/settings?tab=security" replace />} />
      <Route path="/payment-success" element={
        <ProtectedRoute>
          <PaymentSuccess />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      } />
      <Route path="/pricing" element={
        <ProtectedRoute>
          <Pricing />
        </ProtectedRoute>
      } />
      
      {/* Catch-all route for 404s */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

// Component that uses useAuth after provider is available
const PushNotificationSetup = () => {
  const { user } = useAuth();
  
  useEffect(() => {
    if (user) {
      // Start the registration chain, but handle all outcomes including failures
      registerServiceWorker()
        .then(registration => {
          // Only continue if we successfully registered
          if (registration) {
            return requestPushPermission().then(permissionGranted => {
              // Only continue if permission was granted
              if (permissionGranted) {
                return subscribeUserToPush(user.id);
              }
              return null;
            });
          }
          return null;
        })
        .catch(err => {
          // Log the error but don't disrupt the application
          console.warn("Push setup não foi possível:", err.message);
        });
    }
  }, [user]);
  
  return null; // This component doesn't render anything
};

const AppContent = () => {
  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PushNotificationSetup />
      <AppRoutes />
    </TooltipProvider>
  );
};

const App = () => {
  return (
    <React.StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
};

export default App;
