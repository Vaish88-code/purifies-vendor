import { useState, useEffect } from 'react';
import {
  Package,
  IndianRupee,
  MapPin,
  Phone,
  Store,
  Truck,
  Calendar,
  User as UserIcon,
  CheckCircle,
  Trash2,
  Navigation,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Checkbox } from '@shared/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/components/ui/table';
import { VendorLayout } from '@/components/layouts/VendorLayout';
import { useAuth } from '@shared/contexts/AuthContext';
import { useToast } from '@shared/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@shared/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@shared/components/ui/alert-dialog';
import {
  getVendorByUid,
  getOrdersByVendor,
  getSubscriptionsByVendor,
  subscribeToSubscriptionsByVendor,
  updateSubscriptionDocument,
  updateSubscriptionPaymentDocument,
  createOrderDocument,
  updateVendorDocument,
  subscribeToDeliveryPersonsForVendorArea,
  subscribeToOrdersByVendor,
  subscribeToSubscriptionPaymentsByVendor,
  requestDeliveryFromAdmin,
  Subscription,
  SubscriptionPayment,
  Vendor,
  Order,
  FirestoreUser,
} from '@shared/lib/firebase/firestore';
import {
  cityKeyForMatching,
  deriveCityTokenFromAddress,
  distanceMetersShopToPerson,
  formatKmNumber,
} from '@shared/utils/geo';
import {
  advanceNextDeliveryDate,
  formatDeliveryDays,
  getDeliveriesPerMonth,
  getSubscriptionJarStats,
  isActiveApprovedSubscription,
} from '@shared/utils/subscriptionSchedule';

export default function VendorSubscriptions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveryPersons, setDeliveryPersons] = useState<FirestoreUser[]>([]);
  const [loadingDeliveryPersons, setLoadingDeliveryPersons] = useState(false);
  const [subscriptionToDeliver, setSubscriptionToDeliver] = useState<Subscription | null>(null);
  const [subscriptionsToDeliver, setSubscriptionsToDeliver] = useState<Subscription[]>([]);
  const [showSubscriptionDeliveryDialog, setShowSubscriptionDeliveryDialog] = useState(false);
  const [deliveringSubscriptionId, setDeliveringSubscriptionId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [selectedSubscriptionIds, setSelectedSubscriptionIds] = useState<Set<string>>(new Set());
  const [isBulkDelivery, setIsBulkDelivery] = useState(false);
  const [subscriptionPayments, setSubscriptionPayments] = useState<SubscriptionPayment[]>([]);
  const [removingSubscriptionId, setRemovingSubscriptionId] = useState<string | null>(null);
  const [subscriptionToRemove, setSubscriptionToRemove] = useState<Subscription | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const applyActiveSubscriptions = (allSubs: Subscription[]) => {
    setSubscriptions(allSubs.filter(isActiveApprovedSubscription));
  };

  // Real-time listener for subscription payments (Bill column + Mark Paid)
  useEffect(() => {
    if (!user?.id) {
      setSubscriptionPayments([]);
      return;
    }
    const unsubscribe = subscribeToSubscriptionPaymentsByVendor(
      user.id,
      setSubscriptionPayments,
      (err) => {
        console.warn('Subscription payments listener error:', err.message);
        setSubscriptionPayments([]);
      }
    );
    return () => unsubscribe();
  }, [user?.id]);

  // Load subscriptions: fetch first for fast paint, then keep in sync via listener
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      setSubscriptions([]);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    const finishLoading = () => {
      if (!cancelled) setLoading(false);
    };

    getSubscriptionsByVendor(user.id)
      .then((subs) => {
        if (!cancelled) {
          applyActiveSubscriptions(subs);
          setLoadError(null);
        }
      })
      .catch((err: Error) => {
        console.error('Initial subscription fetch failed:', err);
        if (!cancelled) {
          setLoadError(err.message || 'Could not load subscriptions.');
        }
      })
      .finally(finishLoading);

    const loadingTimeout = window.setTimeout(finishLoading, 8000);

    const unsubscribe = subscribeToSubscriptionsByVendor(
      user.id,
      (allSubs) => {
        if (cancelled) return;
        applyActiveSubscriptions(allSubs);
        setLoadError(null);
        finishLoading();
      },
      (err) => {
        if (cancelled) return;
        console.error('Error in subscriptions listener:', err);
        setLoadError(err.message || 'Live updates unavailable.');
        finishLoading();
      }
    );

    return () => {
      cancelled = true;
      window.clearTimeout(loadingTimeout);
      unsubscribe();
    };
  }, [user?.id]);

  // Initial vendor profile load
  useEffect(() => {
    if (!user?.id) return;
    getVendorByUid(user.id).then(setVendor).catch(console.error);
  }, [user?.id]);

  // Real-time listener for vendor orders - updates "Jars Delivered" column automatically
  useEffect(() => {
    if (!user?.id || vendor?.status !== 'approved') {
      setOrders([]);
      return;
    }

    try {
      console.log('🔴 Setting up real-time listener for vendor orders in VendorSubscriptions:', user.id);
      
      // Set up real-time listener for orders
      const unsubscribe = subscribeToOrdersByVendor(
        user.id,
        (vendorOrders) => {
          console.log('🟢 Real-time orders update received in VendorSubscriptions:', {
            count: vendorOrders.length,
            deliveredOrders: vendorOrders.filter(o => o.status === 'delivered').length,
          });
          
          // Sort orders by createdAt (newest first)
          const sortedOrders = vendorOrders.sort((a, b) => {
            const aTime = a.createdAt?.toMillis() || 0;
            const bTime = b.createdAt?.toMillis() || 0;
            return bTime - aTime;
          });
          
          setOrders(sortedOrders);
          console.log('✅ Vendor orders updated in real-time - "Jars Delivered" column will update automatically');
        },
        (error) => {
          console.error('❌ Error in vendor orders listener:', error);
          toast({
            title: 'Error',
            description: error.message || 'Failed to load orders. Please try again.',
            variant: 'destructive',
          });
        }
      );

      // Cleanup: Unsubscribe when component unmounts or dependencies change
      return () => {
        console.log('🔴 Unsubscribing from vendor orders listener in VendorSubscriptions');
        unsubscribe();
        setOrders([]); // Clear state on cleanup
      };
    } catch (error: any) {
      console.error('❌ Error setting up vendor orders listener:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to set up orders listener. Please refresh the page.',
        variant: 'destructive',
      });
    }
  }, [user?.id, vendor?.status]);


  useEffect(() => {
    const hasArea =
      vendor?.status === 'approved' &&
      (!!cityKeyForMatching(vendor.city, vendor.address) || !!(vendor.pincode || '').toString().trim());

    if (!hasArea || !vendor) {
      setDeliveryPersons([]);
      setLoadingDeliveryPersons(false);
      return;
    }

    setLoadingDeliveryPersons(true);
    const unsubscribe = subscribeToDeliveryPersonsForVendorArea(
      {
        pincode: vendor.pincode,
        city: vendor.city,
        state: vendor.state,
        address: vendor.address,
        latitude: vendor.latitude,
        longitude: vendor.longitude,
      },
      (persons) => {
        setDeliveryPersons(persons);
        setLoadingDeliveryPersons(false);
      },
      false
    );

    return () => {
      unsubscribe();
    };
  }, [
    vendor?.pincode,
    vendor?.city,
    vendor?.state,
    vendor?.address,
    vendor?.latitude,
    vendor?.longitude,
    vendor?.status,
  ]);

  const handleDeliverSubscription = (subscription: Subscription) => {
    setSubscriptionToDeliver(subscription);
    setSubscriptionsToDeliver([subscription]);
    setIsBulkDelivery(false);
    setShowSubscriptionDeliveryDialog(true);
  };

  const handleBulkDeliver = () => {
    if (selectedSubscriptionIds.size === 0) {
      toast({
        title: 'No Selection',
        description: 'Please select at least one subscription to deliver.',
        variant: 'destructive',
      });
      return;
    }

    const selectedSubs = activeSubscriptions.filter(sub => 
      sub.id && selectedSubscriptionIds.has(sub.id)
    );

    // Filter out completed subscriptions
    const deliverableSubs = selectedSubs.filter(sub => {
      const stats = getSubscriptionDeliveryStats(sub);
      return !(stats.expectedJars > 0 && stats.deliveredJars >= stats.expectedJars);
    });

    if (deliverableSubs.length === 0) {
      toast({
        title: 'No Deliverable Subscriptions',
        description: 'Selected subscriptions are already completed. Please select active subscriptions.',
        variant: 'destructive',
      });
      return;
    }

    setSubscriptionsToDeliver(deliverableSubs);
    setSubscriptionToDeliver(null);
    setIsBulkDelivery(true);
    setShowSubscriptionDeliveryDialog(true);
  };

  const handleRequestAdminDelivery = async () => {
    if (!user?.id || !vendor) return;

    const subscriptionsToProcess = isBulkDelivery ? subscriptionsToDeliver :
      (subscriptionToDeliver ? [subscriptionToDeliver] : []);

    if (subscriptionsToProcess.length === 0) return;

    // Check stock availability
    let totalRequired20L = 0;
    let totalRequired10L = 0;
    for (const subscription of subscriptionsToProcess) {
      if (subscription.jarType === 'jar20L') totalRequired20L += subscription.quantity;
      else if (subscription.jarType === 'jar10L') totalRequired10L += subscription.quantity;
    }

    const currentStock20L = vendor.stock?.jar20L || 0;
    const currentStock10L = vendor.stock?.jar10L || 0;

    if (totalRequired20L > 0 && currentStock20L < totalRequired20L) {
      toast({
        title: 'Insufficient Stock',
        description: `Only ${currentStock20L} 20L jar(s) in stock, but ${totalRequired20L} required.`,
        variant: 'destructive',
      });
      return;
    }
    if (totalRequired10L > 0 && currentStock10L < totalRequired10L) {
      toast({
        title: 'Insufficient Stock',
        description: `Only ${currentStock10L} 10L jar(s) in stock, but ${totalRequired10L} required.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      if (isBulkDelivery) {
        setDeliveringSubscriptionId('bulk');
      } else if (subscriptionToDeliver?.id) {
        setDeliveringSubscriptionId(subscriptionToDeliver.id);
      }

      const shopName = vendor?.shopName || 'Shop';
      const shopAddress = vendor?.address || '';
      const shopPhone = vendor?.phone || '';

      const createdOrders: string[] = [];
      let updatedStock20L = currentStock20L;
      let updatedStock10L = currentStock10L;

      for (const subscription of subscriptionsToProcess) {
        if (!subscription.id) continue;

        const jarTypeForOrder = subscription.jarType === 'jar20L' ? '20L' :
          subscription.jarType === 'jar10L' ? '10L' : 'bottles';

        const orderData: Omit<Order, 'id' | 'orderId' | 'createdAt' | 'updatedAt'> = {
          customerUid: subscription.customerUid,
          customerName: subscription.customerName,
          customerPhone: subscription.customerPhone,
          customerAddress: subscription.customerAddress,
          customerPincode: subscription.customerPincode,
          vendorUid: subscription.vendorUid || user.id,
          vendorShopName: shopName,
          vendorAddress: shopAddress,
          vendorPhone: shopPhone,
          vendorLatitude: vendor.latitude,
          vendorLongitude: vendor.longitude,
          items: [{
            jarType: jarTypeForOrder as '20L' | '10L' | 'bottles',
            quantity: subscription.quantity,
            pricePerUnit: subscription.pricePerUnit,
          }],
          subtotal: subscription.quantity * subscription.pricePerUnit,
          deliveryFee: 0,
          total: subscription.quantity * subscription.pricePerUnit,
          deliveryType: 'subscription',
          subscriptionId: subscription.id,
          status: 'accepted',
          assignmentStatus: 'awaiting_admin',
          autoAssignDriver: false,
        };

        const { docId } = await createOrderDocument(orderData);

        // Notify admin via requestDeliveryFromAdmin
        await requestDeliveryFromAdmin(
          docId,
          {
            address: shopAddress,
            phone: shopPhone,
            latitude: vendor.latitude,
            longitude: vendor.longitude,
          },
          subscription.quantity
        );

        createdOrders.push(subscription.customerName);

        // Deduct stock
        if (subscription.jarType === 'jar20L') {
          updatedStock20L = Math.max(0, updatedStock20L - subscription.quantity);
        } else if (subscription.jarType === 'jar10L') {
          updatedStock10L = Math.max(0, updatedStock10L - subscription.quantity);
        }

        // Advance next delivery date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        await updateSubscriptionDocument(subscription.id, {
          nextDeliveryDate: advanceNextDeliveryDate(subscription, today),
        });
      }

      // Update stock
      if (totalRequired20L > 0 || totalRequired10L > 0) {
        await updateVendorDocument(user.id, {
          stock: {
            ...vendor.stock,
            jar20L: updatedStock20L,
            jar10L: updatedStock10L,
          },
        });
      }

      const updatedSubscriptions = await getSubscriptionsByVendor(user.id);
      setSubscriptions(updatedSubscriptions);

      setSelectedSubscriptionIds(new Set());
      setShowSubscriptionDeliveryDialog(false);
      setSubscriptionToDeliver(null);
      setSubscriptionsToDeliver([]);
      setIsBulkDelivery(false);

      toast({
        title: isBulkDelivery ? 'Delivery Requested' : 'Delivery Requested',
        description: isBulkDelivery
          ? `${createdOrders.length} subscription order(s) sent to admin for driver assignment.`
          : `Subscription order sent to admin. Driver will be assigned shortly.`,
      });
    } catch (error: any) {
      console.error('Error requesting admin delivery for subscription:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to request delivery. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeliveringSubscriptionId(null);
    }
  };

  // Real-time accurate jar counting — shared util (delivered only, by subscriptionId)
  const getSubscriptionDeliveryStats = (subscription: Subscription) =>
    getSubscriptionJarStats(subscription, orders);

  const getMonthKey = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const currentMonthKey = getMonthKey(new Date());

  const getMonthlyBillTotal = (subscription: Subscription, expectedJars: number): number => {
    return Math.max(0, expectedJars) * (subscription.pricePerUnit || 0);
  };

  const getLatestPaymentForSubscription = (subscription: Subscription): SubscriptionPayment | null => {
    const list = subscriptionPayments
      .filter((p) => p.subscriptionId === subscription.id && p.month === currentMonthKey)
      .sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
    return list[0] ?? null;
  };

  const isBillPaidForCurrentMonth = (subscription: Subscription): boolean => {
    if (subscription.billingPaid === true && subscription.billingMonth === currentMonthKey) return true;
    const payment = getLatestPaymentForSubscription(subscription);
    return payment?.status === 'PAID';
  };

  const hasCustomerPaid = (subscription: Subscription): boolean => {
    const payment = getLatestPaymentForSubscription(subscription);
    return payment?.status === 'PAYMENT_REQUESTED' || payment?.status === 'SUCCESS';
  };

  const handleMarkBillPaid = async (subscription: Subscription) => {
    if (!subscription.id || !user?.id) return;
    const payment = getLatestPaymentForSubscription(subscription);
    if (!payment?.id) {
      toast({
        title: 'No payment record',
        description: 'Customer has not paid yet. Bill column will show Paid when customer pays.',
        variant: 'destructive',
      });
      return;
    }
    if (payment.status === 'PAID') {
      toast({ title: 'Already confirmed', description: 'This payment was already marked as received.' });
      return;
    }
    try {
      setMarkingPaidId(subscription.id);
      await updateSubscriptionPaymentDocument(payment.id, { status: 'PAID' });
      await updateSubscriptionDocument(subscription.id, {
        billingMonth: currentMonthKey,
        billingPaid: true,
      });

      toast({
        title: 'Payment confirmed',
        description: 'Customer will see confirmation and can now order jars.',
      });
    } catch (error: any) {
      console.error('Error marking bill paid:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to mark bill as paid. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setMarkingPaidId(null);
    }
  };

  const handleRemoveSubscription = async (subscription: Subscription) => {
    if (!subscription.id || !user?.id) return;
    try {
      setRemovingSubscriptionId(subscription.id);
      await updateSubscriptionDocument(subscription.id, {
        isActive: false,
        isPaused: true,
      });
      setSubscriptions((prev) => prev.filter((s) => s.id !== subscription.id));
      setSubscriptionToRemove(null);
      toast({
        title: 'Removed',
        description: 'Subscription removed. No future deliveries will be scheduled.',
      });
    } catch (error: any) {
      console.error('Error removing subscription:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove subscription. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRemovingSubscriptionId(null);
    }
  };

  // Get formatted next delivery date
  const getNextDeliveryDateDisplay = (subscription: Subscription): string => {
    if (!subscription.nextDeliveryDate) {
      return 'Not scheduled';
    }

    const nextDate = new Date(subscription.nextDeliveryDate);
    nextDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (nextDate <= today) {
      return 'Due now';
    }

    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return nextDate.toLocaleDateString('en-US', options);
  };

  // Get frequency display text
  const getFrequencyDisplay = (frequency: string): string => {
    const frequencyMap: Record<string, string> = {
      daily: 'Daily',
      alternate: 'Alternate Days',
      weekly: 'Weekly',
      biweekly: 'Bi-weekly',
      monthly: 'Monthly',
    };
    return frequencyMap[frequency] || frequency;
  };

  const activeSubscriptions = subscriptions.filter(isActiveApprovedSubscription);

  // Handle checkbox selection
  const handleSelectSubscription = (subscriptionId: string, checked: boolean) => {
    const newSelected = new Set(selectedSubscriptionIds);
    if (checked) {
      newSelected.add(subscriptionId);
    } else {
      newSelected.delete(subscriptionId);
    }
    setSelectedSubscriptionIds(newSelected);
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = activeSubscriptions
        .filter(sub => {
          const stats = getSubscriptionDeliveryStats(sub);
          return !(stats.expectedJars > 0 && stats.deliveredJars >= stats.expectedJars);
        })
        .map(sub => sub.id)
        .filter((id): id is string => !!id);
      setSelectedSubscriptionIds(new Set(allIds));
    } else {
      setSelectedSubscriptionIds(new Set());
    }
  };

  const isAllSelected = activeSubscriptions.length > 0 && 
    activeSubscriptions.filter(sub => {
      const stats = getSubscriptionDeliveryStats(sub);
      return !(stats.expectedJars > 0 && stats.deliveredJars >= stats.expectedJars);
    }).every(sub => sub.id && selectedSubscriptionIds.has(sub.id));

  const unpaidCount = activeSubscriptions.filter(
    (sub) => !isBillPaidForCurrentMonth(sub)
  ).length;

  if (loading) {
    return (
      <VendorLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading subscriptions...</p>
        </div>
      </VendorLayout>
    );
  }

  return (
    <VendorLayout>
      <div className="space-y-6">
        {loadError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {loadError} — Check your internet connection and Firestore rules, then refresh.
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Active Subscriptions</h1>
            <p className="text-muted-foreground mt-1">
              Manage your active subscription customers and deliveries
            </p>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <RefreshCw className="h-3 w-3" />
              Live updates · {activeSubscriptions.length} active subscriber{activeSubscriptions.length !== 1 ? 's' : ''}
            </p>
          </div>
          {unpaidCount > 0 && (
            <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-warning/15 text-warning border border-warning/40 text-sm font-semibold shrink-0">
              {unpaidCount} unpaid bill{unpaidCount !== 1 ? 's' : ''} this month
            </span>
          )}
        </div>

        <Card className="card-shadow">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Active Subscriptions ({activeSubscriptions.length})
            </CardTitle>
            {selectedSubscriptionIds.size > 0 && (
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 gap-2 shrink-0"
                onClick={handleBulkDeliver}
                disabled={!!deliveringSubscriptionId}
              >
                <Package className="h-4 w-4" />
                Bulk deliver ({selectedSubscriptionIds.size})
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {activeSubscriptions.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground font-medium mb-2">No active subscriptions</p>
                <p className="text-sm text-muted-foreground">
                  Active subscriptions will appear here once you accept subscription requests.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 sticky left-0 z-10 bg-card">
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="min-w-[160px] sticky left-12 z-10 bg-card shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">Customer</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Quantity per Delivery</TableHead>
                      <TableHead>Next Delivery Date</TableHead>
                      <TableHead>Jars Delivered</TableHead>
                      <TableHead>Bill</TableHead>
                      <TableHead className="text-center">Deliver Jars</TableHead>
                      <TableHead className="text-center">Mark Paid</TableHead>
                      <TableHead className="text-center">Remove</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeSubscriptions.map((subscription) => {
                      const stats = getSubscriptionDeliveryStats(subscription);
                      const nextDeliveryDateDisplay = getNextDeliveryDateDisplay(subscription);
                      const monthlyBill = getMonthlyBillTotal(subscription, stats.expectedJars);
                      const completed = stats.expectedJars > 0 && stats.deliveredJars >= stats.expectedJars;
                      const paid = isBillPaidForCurrentMonth(subscription);
                      const isSelected = subscription.id ? selectedSubscriptionIds.has(subscription.id) : false;
                      
                      return (
                        <TableRow key={subscription.id} className="even:bg-muted/30">
                          <TableCell className="sticky left-0 z-10 bg-card even:bg-muted/30">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => 
                                subscription.id && handleSelectSubscription(subscription.id, checked as boolean)
                              }
                              disabled={completed}
                            />
                          </TableCell>
                          <TableCell className="sticky left-12 z-10 bg-card even:bg-muted/30 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]">
                            <div className="space-y-1">
                              <p className="font-semibold">{subscription.customerName}</p>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span>{subscription.customerPhone}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-start gap-1 text-sm">
                              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{subscription.customerAddress}</p>
                                {subscription.customerPincode && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Pincode: {subscription.customerPincode}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{getFrequencyDisplay(subscription.frequency)}</span>
                            {subscription.deliveryDaysOfWeek?.length ? (
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDeliveryDays(subscription.deliveryDaysOfWeek)}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-semibold">
                                {subscription.quantity}x {subscription.jarType === 'jar20L' ? '20L' : subscription.jarType === 'jar10L' ? '10L' : 'Bottles'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                per delivery
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className={nextDeliveryDateDisplay === 'Due now' ? 'font-semibold text-primary' : ''}>
                                {nextDeliveryDateDisplay}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {completed ? (
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-5 w-5 text-success" />
                                  <div>
                                    <p className="font-semibold text-success">
                                      Completed
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {stats.deliveredJars} / {stats.expectedJars} jars delivered
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <p className="font-semibold text-xl tabular-nums">
                                    {stats.deliveredJars} / {stats.expectedJars}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Delivered this month (approve does not count)
                                  </p>
                                  {stats.deliveredJars === 0 && (
                                    <p className="text-xs text-primary mt-0.5">
                                      Use Deliver Jars to schedule a delivery
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-semibold flex items-center gap-1">
                                <IndianRupee className="h-3 w-3" />
                                {monthlyBill}
                              </p>
                              <p className={`text-xs font-medium ${paid ? 'text-success' : hasCustomerPaid(subscription) ? 'text-amber-600 dark:text-amber-400' : 'text-warning'}`}>
                                {paid ? 'Paid (confirmed)' : hasCustomerPaid(subscription) ? 'Paid (verify & confirm)' : 'Unpaid'}
                              </p>
                              {completed && !paid && !hasCustomerPaid(subscription) && (
                                <p className="text-xs text-muted-foreground">
                                  Deliveries complete — awaiting payment
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {!completed ? (
                              <Button
                                size="sm"
                                className="bg-primary hover:bg-primary/90 gap-2"
                                onClick={() => handleDeliverSubscription(subscription)}
                                disabled={!!deliveringSubscriptionId}
                              >
                                <Package className="h-4 w-4" />
                                Deliver Jars
                              </Button>
                            ) : (
                              <span className="text-sm text-muted-foreground">Completed</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {hasCustomerPaid(subscription) && !paid ? (
                              <Button
                                size="sm"
                                className="bg-success hover:bg-success/90 gap-2"
                                onClick={() => handleMarkBillPaid(subscription)}
                                disabled={!!markingPaidId || !!deliveringSubscriptionId}
                              >
                                <CheckCircle className="h-4 w-4" />
                                {markingPaidId === subscription.id ? 'Marking...' : 'Mark Paid'}
                              </Button>
                            ) : paid ? (
                              <span className="text-sm text-success font-medium flex items-center justify-center gap-1">
                                <CheckCircle className="h-4 w-4" />
                                Confirmed
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              onClick={() => setSubscriptionToRemove(subscription)}
                              disabled={!!removingSubscriptionId}
                            >
                              <Trash2 className="h-4 w-4" />
                              {removingSubscriptionId === subscription.id ? 'Removing...' : 'Remove'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={!!subscriptionToRemove} onOpenChange={(open) => !open && setSubscriptionToRemove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove subscription?</AlertDialogTitle>
              <AlertDialogDescription>
                This will deactivate the subscription for{' '}
                <strong>{subscriptionToRemove?.customerName}</strong>. No future deliveries will be
                scheduled. This action cannot be undone from the vendor portal.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => subscriptionToRemove && handleRemoveSubscription(subscriptionToRemove)}
              >
                Remove subscription
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Subscription Delivery Dialog */}
        <Dialog open={showSubscriptionDeliveryDialog} onOpenChange={setShowSubscriptionDeliveryDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {isBulkDelivery ? `Request Delivery for ${subscriptionsToDeliver.length} Subscriptions` : 'Request Subscription Delivery'}
              </DialogTitle>
              <DialogDescription>
                This will send the delivery request to the admin, who will assign an available driver — same as a quick order.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 mt-2">
              {/* Shop info */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <p className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Store className="h-4 w-4 text-primary" />
                    Pickup From: {vendor?.shopName}
                  </p>
                  <p className="text-sm text-muted-foreground">{vendor?.address}</p>
                </CardContent>
              </Card>

              {/* Customers */}
              <Card className="bg-emerald-500/5 border-emerald-500/20">
                <CardContent className="p-4">
                  <p className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-emerald-600" />
                    Deliver To ({isBulkDelivery ? `${subscriptionsToDeliver.length} Customers` : '1 Customer'}):
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(isBulkDelivery ? subscriptionsToDeliver : subscriptionToDeliver ? [subscriptionToDeliver] : []).map((sub, i) => (
                      <div key={sub.id || i} className="text-sm p-2 rounded bg-background border">
                        <p className="font-medium">{sub.customerName}</p>
                        <p className="text-muted-foreground text-xs">{sub.customerAddress}</p>
                        <p className="text-xs mt-0.5">{sub.quantity}x {sub.jarType === 'jar20L' ? '20L Jar' : sub.jarType === 'jar10L' ? '10L Jar' : 'Bottles'}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded p-3">
                <strong>📦 Subscription Order</strong> — Admin will see this tagged as a Subscription in their delivery requests panel and assign a driver.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSubscriptionDeliveryDialog(false);
                  setSubscriptionToDeliver(null);
                  setSubscriptionsToDeliver([]);
                  setIsBulkDelivery(false);
                }}
                disabled={!!deliveringSubscriptionId}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRequestAdminDelivery}
                disabled={!!deliveringSubscriptionId}
              >
                {deliveringSubscriptionId ? 'Requesting...' : 'Request Delivery'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </VendorLayout>
  );
}
