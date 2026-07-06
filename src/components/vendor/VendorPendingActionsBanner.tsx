import { Link } from 'react-router-dom';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@shared/components/ui/alert';
import { Button } from '@shared/components/ui/button';
import { VendorPendingCounts } from '@shared/hooks/useVendorPendingCounts';

interface VendorPendingActionsBannerProps {
  counts: VendorPendingCounts;
}

export function VendorPendingActionsBanner({ counts }: VendorPendingActionsBannerProps) {
  const total =
    counts.pendingOrders + counts.paymentsAwaitingApproval + counts.subscriptionRequests;

  if (total === 0) return null;

  return (
    <Alert className="border-2 border-warning/60 bg-warning/10">
      <AlertCircle className="h-5 w-5 text-warning" />
      <AlertTitle className="text-warning font-semibold">
        {total} action{total !== 1 ? 's' : ''} need your attention
      </AlertTitle>
      <AlertDescription className="mt-2">
        <ul className="space-y-1 text-sm">
          {counts.pendingOrders > 0 && (
            <li>
              <Link to="/orders?tab=pending" className="font-medium underline underline-offset-2">
                {counts.pendingOrders} pending order{counts.pendingOrders !== 1 ? 's' : ''}
              </Link>
            </li>
          )}
          {counts.paymentsAwaitingApproval > 0 && (
            <li>
              <Link to="/orders" className="font-medium underline underline-offset-2">
                {counts.paymentsAwaitingApproval} payment{counts.paymentsAwaitingApproval !== 1 ? 's' : ''} awaiting approval
              </Link>
            </li>
          )}
          {counts.subscriptionRequests > 0 && (
            <li>
              <Link
                to="/subscription-requests"
                className="font-medium underline underline-offset-2"
              >
                {counts.subscriptionRequests} subscription request{counts.subscriptionRequests !== 1 ? 's' : ''}
              </Link>
            </li>
          )}
        </ul>
        <Button asChild size="sm" className="mt-3 gap-1">
          <Link to="/orders">
            Review orders
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
