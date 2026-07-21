import { useEffect, useState } from 'react';
import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@shared/contexts/AuthContext';
import { getVendorByUid } from '@shared/lib/firebase/firestore';
import { Loader2, Clock, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Logo } from '@shared/components/Logo';

interface RequireVendorAuthProps {
  children: ReactNode;
}

function VendorPendingApproval() {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="p-4"><Logo /></header>
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Clock className="h-12 w-12 text-warning mx-auto mb-2" />
            <CardTitle>Account Pending Approval</CardTitle>
            <CardDescription>
              Your vendor registration is under review. An admin will approve your shop shortly.
              You will be able to access the dashboard once approved.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => logout()}>Log out</Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function VendorRejected() {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="p-4"><Logo /></header>
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Account Not Approved</CardTitle>
            <CardDescription>
              Your vendor application was not approved. Please contact Purifies support for assistance.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => logout()}>Log out</Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export function RequireVendorAuth({ children }: RequireVendorAuthProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();
  const [vendorStatus, setVendorStatus] = useState<'loading' | 'approved' | 'pending' | 'rejected' | 'missing'>('loading');

  useEffect(() => {
    if (!user?.id || user.role !== 'vendor') return;
    getVendorByUid(user.id)
      .then((v) => setVendorStatus(v?.status ?? 'missing'))
      .catch(() => setVendorStatus('missing'));
  }, [user?.id, user?.role]);

  if (loading || (isAuthenticated && user?.role === 'vendor' && vendorStatus === 'loading')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (user.role !== 'vendor') {
    return <Navigate to="/login" replace />;
  }

  if (vendorStatus === 'pending' || vendorStatus === 'missing') {
    return <VendorPendingApproval />;
  }

  if (vendorStatus === 'rejected') {
    return <VendorRejected />;
  }

  return <>{children}</>;
}
