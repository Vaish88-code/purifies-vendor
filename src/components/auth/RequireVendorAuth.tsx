import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@shared/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface RequireVendorAuthProps {
  children: ReactNode;
}

export function RequireVendorAuth({ children }: RequireVendorAuthProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // In the standalone vendor app, non-vendor users are redirected to login
  if (user.role !== 'vendor') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
