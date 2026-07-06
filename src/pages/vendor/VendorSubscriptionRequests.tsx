import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Package, 
  MapPin,
  Phone,
  Check,
  X,
  Calendar,
  IndianRupee,
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card';
import { VendorLayout } from '@/components/layouts/VendorLayout';
import { useAuth } from '@shared/contexts/AuthContext';
import { useToast } from '@shared/hooks/use-toast';
import {
  subscribeToSubscriptionsByVendor,
  updateSubscriptionDocument,
  getSubscriptionsByVendor,
  Subscription,
} from '@shared/lib/firebase/firestore';
import {
  formatDeliveryDays,
  getNextDeliveryDateFromDays,
  isPendingSubscriptionRequest,
} from '@shared/utils/subscriptionSchedule';

export default function VendorSubscriptionRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeToSubscriptionsByVendor(
      user.id,
      (list) => {
        setSubscriptions(list);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        toast({
          title: 'Error',
          description: err.message || 'Failed to load subscription requests.',
          variant: 'destructive',
        });
      }
    );
    return () => unsubscribe();
  }, [user?.id, toast]);

  const handleAcceptSubscription = async (subscriptionId: string) => {
    if (!subscriptionId || !user?.id) return;

    try {
      const subscription = subscriptions.find(sub => sub.id === subscriptionId);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const firstDeliveryDate = subscription?.deliveryDaysOfWeek?.length
        ? getNextDeliveryDateFromDays(subscription.deliveryDaysOfWeek, today)
        : (() => {
            const d = new Date(today);
            if (subscription) {
              switch (subscription.frequency) {
                case 'daily': d.setDate(today.getDate() + 1); break;
                case 'alternate': d.setDate(today.getDate() + 2); break;
                case 'weekly': d.setDate(today.getDate() + 7); break;
                case 'biweekly': d.setDate(today.getDate() + 14); break;
                case 'monthly': d.setMonth(today.getMonth() + 1); break;
              }
            }
            return d.toISOString().split('T')[0];
          })();
      
      await updateSubscriptionDocument(subscriptionId, { 
        isActive: true,
        isPaused: false,
        vendorApprovalStatus: 'approved',
        startDate: today.toISOString().split('T')[0],
        nextDeliveryDate: firstDeliveryDate,
      });
      
      const updatedSubscriptions = await getSubscriptionsByVendor(user.id);
      setSubscriptions(updatedSubscriptions);
      
      toast({
        title: 'Subscription approved',
        description: `Requirements accepted — ${subscription?.customerName ?? 'Customer'} is now on Active Subscriptions. No jars are delivered until you use "Deliver Jars". First scheduled date: ${new Date(firstDeliveryDate).toLocaleDateString()}.`,
      });
    } catch (error: any) {
      console.error('Error accepting subscription:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to accept subscription. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleRejectSubscription = async (subscriptionId: string) => {
    if (!subscriptionId || !user?.id) return;

    try {
      await updateSubscriptionDocument(subscriptionId, { 
        isActive: false,
        isPaused: true,
        vendorApprovalStatus: 'rejected',
      });
      
      const updatedSubscriptions = await getSubscriptionsByVendor(user.id);
      setSubscriptions(updatedSubscriptions);
      
      toast({
        title: 'Subscription Rejected',
        description: 'Subscription has been rejected.',
      });
    } catch (error: any) {
      console.error('Error rejecting subscription:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject subscription. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Get current month key for comparison
  const getMonthKey = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };
  const currentMonthKey = getMonthKey(new Date());

  // Filter for pending subscription requests:
  // - isActive === false (not yet accepted)
  // - NOT already paid for current month (billingPaid with billingMonth matching current month means it's a closed subscription, not a new request)
  const pendingSubscriptions = subscriptions.filter(isPendingSubscriptionRequest);

  return (
    <VendorLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Subscription Requests</h1>
          <p className="text-muted-foreground mt-1">
            Review and accept subscription requests from customers
          </p>
        </div>

        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-warning" />
              Pending Subscription Requests ({pendingSubscriptions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-center text-muted-foreground py-4">Loading subscription requests...</p>
            ) : pendingSubscriptions.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground font-medium mb-2">No new subscription requests</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  When customers subscribe to your shop, their requests will appear here for you to accept or reject.
                </p>
                <Button asChild variant="outline" className="mt-6">
                  <Link to="/subscriptions">View active subscriptions</Link>
                </Button>
              </div>
            ) : (
              pendingSubscriptions.map((subscription) => (
                <Card
                  key={subscription.id}
                  className="border-2 border-warning/50 bg-warning/5"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-4">
                        {/* Customer Info */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <h3 className="font-semibold text-lg">{subscription.customerName}</h3>
                            <span className="text-xs px-2 py-1 rounded-full bg-warning/20 text-warning">
                              Pending Approval
                            </span>
                          </div>
                          <div className="grid sm:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground flex items-center gap-1 mb-1">
                                <Phone className="h-4 w-4" />
                                Phone:
                              </p>
                              <p className="font-medium">{subscription.customerPhone}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground flex items-center gap-1 mb-1">
                                <MapPin className="h-4 w-4" />
                                Delivery Address:
                              </p>
                              <p className="font-medium">{subscription.customerAddress}</p>
                              {subscription.customerPincode && (
                                <p className="text-xs text-muted-foreground mt-1">Pincode: {subscription.customerPincode}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Subscription Details */}
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-warning/20">
                          <div className="p-3 rounded-lg bg-background">
                            <p className="text-xs text-muted-foreground mb-1">Jar Type & Quantity</p>
                            <p className="font-semibold">
                              {subscription.quantity}x {subscription.jarType === 'jar20L' ? '20L Jar' : subscription.jarType === 'jar10L' ? '10L Jar' : 'Bottles'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              <IndianRupee className="h-3 w-3 inline" />
                              {subscription.pricePerUnit} per unit
                            </p>
                          </div>
                          <div className="p-3 rounded-lg bg-background">
                            <p className="text-xs text-muted-foreground mb-1">Delivery schedule</p>
                            <p className="font-semibold">
                              {subscription.deliveriesPerWeek
                                ? `${subscription.deliveriesPerWeek}× per week`
                                : 'Weekly plan'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {subscription.deliveryDaysOfWeek?.length
                                ? formatDeliveryDays(subscription.deliveryDaysOfWeek)
                                : subscription.frequency}
                            </p>
                            {subscription.preferredDeliveryTime && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Calendar className="h-3 w-3" />
                                Preferred: {subscription.preferredDeliveryTime}
                              </p>
                            )}
                          </div>
                          <div className="p-3 rounded-lg bg-background">
                            <p className="text-xs text-muted-foreground mb-1">Frequency (plan)</p>
                            <p className="font-semibold capitalize">{subscription.frequency}</p>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Recurring subscription
                            </p>
                          </div>
                          <div className="p-3 rounded-lg bg-background">
                            <p className="text-xs text-muted-foreground mb-1">Monthly Amount</p>
                            <p className="font-semibold text-primary">
                              <IndianRupee className="h-3 w-3 inline" />
                              {subscription.monthlyAmount}
                            </p>
                            {subscription.savings && subscription.savings > 0 && (
                              <p className="text-xs text-success mt-1">
                                Savings: <IndianRupee className="h-3 w-3 inline" />
                                {subscription.savings}
                              </p>
                            )}
                          </div>
                          <div className="p-3 rounded-lg bg-background">
                            <p className="text-xs text-muted-foreground mb-1">Requested On</p>
                            <p className="font-semibold text-sm">
                              {subscription.createdAt 
                                ? new Date(subscription.createdAt.toMillis()).toLocaleDateString()
                                : 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          className="bg-success hover:bg-success/90 gap-2"
                          onClick={() => subscription.id && handleAcceptSubscription(subscription.id)}
                        >
                          <Check className="h-4 w-4" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground gap-2"
                          onClick={() => subscription.id && handleRejectSubscription(subscription.id)}
                        >
                          <X className="h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </VendorLayout>
  );
}
