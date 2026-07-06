import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Package, 
  MapPin,
  Phone,
  User,
  CreditCard,
  Calendar,
  UserPlus,
  Navigation,
  Search,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card';
import { VendorLayout } from '@/components/layouts/VendorLayout';
import { DriverAssignmentDialog } from '@/components/vendor/DriverAssignmentDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs';
import { useToast } from '@shared/hooks/use-toast';
import { isQuickOrder } from '@shared/utils/orderFilters';
import { useAuth } from '@shared/contexts/AuthContext';
import { subscribeToOrdersByVendor, updateOrderDocument, getVendorByUid, subscribeToDeliveryPersonsForVendorArea, updateVendorDocument, subscribeToPaymentsByVendor, updatePaymentDocument } from '@shared/lib/firebase/firestore';
import { Order, Vendor, FirestoreUser, Payment } from '@shared/lib/firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import {
  cityKeyForMatching,
  deriveCityTokenFromAddress,
  distanceMetersShopToPerson,
  formatKmNumber,
} from '@shared/utils/geo';
import { Truck } from 'lucide-react';
import { getOrderDisplayStatus } from '@shared/utils/orderStatus';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  accepted: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  preparing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  assigned_for_delivery: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  out_for_delivery: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
  delivered: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
  cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
};

export default function VendorOrders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') || 'all';
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [deliveryPersons, setDeliveryPersons] = useState<FirestoreUser[]>([]);
  const [loadingDeliveryPersons, setLoadingDeliveryPersons] = useState(false);
  const [showDeliveryPersonDialog, setShowDeliveryPersonDialog] = useState(false);
  const [orderToAccept, setOrderToAccept] = useState<Order | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null);

  useEffect(() => {
    const tab = searchParams.get('tab') || 'all';
    setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'all') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', tab);
    }
    setSearchParams(searchParams, { replace: true });
  };

  // Fetch vendor data
  useEffect(() => {
    const fetchVendor = async () => {
      if (user?.id) {
        try {
          const vendorData = await getVendorByUid(user.id);
          setVendor(vendorData);
        } catch (error) {
          console.error('Error fetching vendor data:', error);
        }
      }
    };
    fetchVendor();
  }, [user?.id]);

  // Real-time listener for vendor orders
  useEffect(() => {
    if (!user?.id || !vendor || vendor.status !== 'approved') {
      setLoading(false);
      setOrders([]);
      return;
    }

    try {
      setLoading(true);
      console.log('🔴 Setting up real-time listener for vendor orders in VendorOrders page:', user.id);

      const loadingTimeout = window.setTimeout(() => {
        console.warn('⚠️ Vendor orders listener timed out — showing page anyway');
        setLoading(false);
      }, 15000);
      
      const unsubscribe = subscribeToOrdersByVendor(
        user.id,
        (vendorOrders) => {
          window.clearTimeout(loadingTimeout);
          console.log('🟢 Real-time orders update received in VendorOrders:', {
            count: vendorOrders.length,
          });
          setOrders(vendorOrders);
          setLoading(false);
        },
        (error) => {
          window.clearTimeout(loadingTimeout);
          console.error('❌ Error in vendor orders listener:', error);
          setLoading(false);
          toast({
            title: 'Error',
            description: error.message || 'Failed to load orders. Please try again.',
            variant: 'destructive',
          });
        }
      );

      return () => {
        window.clearTimeout(loadingTimeout);
        console.log('🔴 Unsubscribing from vendor orders listener');
        unsubscribe();
        setOrders([]);
      };
    } catch (error: any) {
      console.error('❌ Error setting up vendor orders listener:', error);
      setLoading(false);
      toast({
        title: 'Error',
        description: error.message || 'Failed to set up orders listener. Please refresh the page.',
        variant: 'destructive',
      });
    }
  }, [user?.id, vendor, toast]);

  // Real-time listener for payments (to filter quick orders & show payment details)
  useEffect(() => {
    if (!user?.id || vendor?.status !== 'approved') {
      setPayments([]);
      return;
    }
    const unsubscribe = subscribeToPaymentsByVendor(user.id, (list) => setPayments(list));
    return () => unsubscribe();
  }, [user?.id, vendor?.status]);

  // Real-time listener: same city / area as shop (see subscribeToDeliveryPersonsForVendorArea)
  useEffect(() => {
    const hasArea =
      vendor?.status === 'approved' &&
      (!!cityKeyForMatching(vendor.city, vendor.address) || !!(vendor.pincode || '').toString().trim());

    if (!hasArea || !vendor) {
      setDeliveryPersons([]);
      setLoadingDeliveryPersons(false);
      return;
    }

    try {
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
        setDeliveryPersons([]);
      };
    } catch (error: any) {
      console.error('❌ Error setting up delivery persons listener:', error);
      setLoadingDeliveryPersons(false);
      setDeliveryPersons([]);
    }
  }, [
    vendor?.pincode,
    vendor?.city,
    vendor?.state,
    vendor?.address,
    vendor?.latitude,
    vendor?.longitude,
    vendor?.status,
  ]);

  const handleOpenAssignDialog = (order: Order) => {
    setOrderToAccept(order);
    setShowDeliveryPersonDialog(true);
  };

  const handleAssignDeliveryPerson = async (deliveryPerson: FirestoreUser) => {
    if (!orderToAccept?.id || !vendor) return;

    if (deliveryPerson.isAvailable === false) {
      toast({
        title: 'Cannot Assign',
        description: 'This delivery person is currently unavailable. Please select an available delivery person.',
        variant: 'destructive',
      });
      return;
    }

    // Check stock availability before assigning delivery
    if (orderToAccept.items && orderToAccept.items.length > 0) {
      for (const item of orderToAccept.items) {
        if (item.jarType === '20L') {
          const currentStock = vendor.stock?.jar20L || 0;
          if (currentStock === 0) {
            toast({
              title: 'Insufficient Stock',
              description: 'Cannot assign delivery. You have 0 20L jars in stock. Please add stock from Inventory section.',
              variant: 'destructive',
            });
            return;
          }
          if (currentStock < item.quantity) {
            toast({
              title: 'Insufficient Stock',
              description: `Cannot assign delivery. You have only ${currentStock} 20L jar(s) in stock, but ${item.quantity} are required. Please add more stock.`,
              variant: 'destructive',
            });
            return;
          }
        } else if (item.jarType === '10L') {
          const currentStock = vendor.stock?.jar10L || 0;
          if (currentStock === 0) {
            toast({
              title: 'Insufficient Stock',
              description: 'Cannot assign delivery. You have 0 10L jars in stock. Please add stock from Inventory section.',
              variant: 'destructive',
            });
            return;
          }
          if (currentStock < item.quantity) {
            toast({
              title: 'Insufficient Stock',
              description: `Cannot assign delivery. You have only ${currentStock} 10L jar(s) in stock, but ${item.quantity} are required. Please add more stock.`,
              variant: 'destructive',
            });
            return;
          }
        }
      }
    }

    try {
      setUpdatingOrderId(orderToAccept.id);
      
      const updateData = {
        status: 'accepted' as const,
        deliveryPersonUid: deliveryPerson.uid,
        deliveryPersonName: deliveryPerson.name,
        deliveryPersonPhone: deliveryPerson.phone,
      };
      
      if (!orderToAccept.vendorAddress && vendor.address) {
        (updateData as any).vendorAddress = vendor.address;
      }
      if (!orderToAccept.vendorPhone && vendor.phone) {
        (updateData as any).vendorPhone = vendor.phone;
      }
      
      await updateOrderDocument(orderToAccept.id, updateData);
      
      // Deduct stock immediately when order is accepted and assigned
      if (orderToAccept.items && orderToAccept.items.length > 0 && vendor.stock) {
        let stockUpdateNeeded = false;
        const currentStock20L = vendor.stock.jar20L || 0;
        const currentStock10L = vendor.stock.jar10L || 0;
        let updatedStock20L = currentStock20L;
        let updatedStock10L = currentStock10L;

        for (const item of orderToAccept.items) {
          if (item.jarType === '20L') {
            updatedStock20L = Math.max(0, updatedStock20L - item.quantity);
            stockUpdateNeeded = true;
          } else if (item.jarType === '10L') {
            updatedStock10L = Math.max(0, updatedStock10L - item.quantity);
            stockUpdateNeeded = true;
          }
        }

        if (stockUpdateNeeded) {
          // Update stock in Firestore immediately
          await updateVendorDocument(user.id, {
            stock: {
              jar20L: updatedStock20L,
              jar10L: updatedStock10L,
            },
          });

          console.log('✅ Stock deducted immediately after order acceptance:', {
            orderId: orderToAccept.orderId,
            items: orderToAccept.items,
            previousStock: { jar20L: currentStock20L, jar10L: currentStock10L },
            newStock: { jar20L: updatedStock20L, jar10L: updatedStock10L },
          });
        }
      }
      
      setShowDeliveryPersonDialog(false);
      setOrderToAccept(null);
      
      toast({
        title: 'Order Accepted',
        description: `Order assigned to ${deliveryPerson.name}. Stock has been deducted.`,
      });
    } catch (error: any) {
      console.error('Error accepting order:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to accept order. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Format order items
  const formatOrderItems = (order: Order): string => {
    return order.items.map(item => {
      const jarName = item.jarType === '20L' ? '20L Jar' : item.jarType === '10L' ? '10L Jar' : 'Bottles (Pack of 12)';
      return `${item.quantity}x ${jarName}`;
    }).join(', ');
  };

  const getDeliveryTypeDisplay = (order: Order): { label: string; detail?: string } => {
    if (order.deliveryType === 'today') {
      return { label: 'Today (Quick)', detail: order.deliveryFee > 0 ? 'Express delivery' : undefined };
    }
    if (order.deliveryType === 'schedule') {
      const parts = [order.scheduledDate, order.scheduledTime].filter(Boolean);
      return { label: 'Scheduled', detail: parts.length ? parts.join(' • ') : 'Date/time not set' };
    }
    return { label: 'Subscription' };
  };

  // Get order type label and color
  const getOrderTypeInfo = (order: Order) => {
    const isSubscription = order.deliveryType === 'subscription';
    const isQuickOrder = order.deliveryType === 'today';
    
    if (isSubscription) {
      return {
        label: 'Subscription',
        color: 'bg-blue-500/10 text-blue-600 border-blue-500/30'
      };
    } else if (isQuickOrder) {
      return {
        label: 'Quick Order',
        color: 'bg-orange-500/10 text-orange-600 border-orange-500/30'
      };
    } else {
      return {
        label: 'Scheduled Order',
        color: 'bg-gray-500/10 text-gray-600 border-gray-500/30'
      };
    }
  };

  // Payment map: order doc id -> payment
  const paymentByOrderId = Object.fromEntries(payments.map((p) => [p.orderId, p]));

  const handlePaymentAction = async (
    order: Order,
    payment: Payment,
    action: 'PAID' | 'FAILED'
  ) => {
    if (!payment.id || !order.id) return;
    setUpdatingPaymentId(payment.id);
    try {
      await updatePaymentDocument(payment.id, { status: action });
      const orderUpdate: Partial<Order> = {};
      if (action === 'PAID') {
        orderUpdate.status = 'accepted';
      } else {
        orderUpdate.status = 'cancelled';
      }
      if (Object.keys(orderUpdate).length) {
        await updateOrderDocument(order.id, orderUpdate);
      }
      toast({
        title: action === 'PAID' ? 'Payment approved' : 'Payment rejected',
        description:
          action === 'PAID'
            ? `Order ${order.orderId} marked as confirmed. You can assign a delivery person now.`
            : `Order ${order.orderId} has been cancelled for payment issues.`,
      });
    } catch (error: any) {
      toast({
        title: 'Payment update failed',
        description: error.message || 'Could not update payment status. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingPaymentId(null);
    }
  };

  // Quick orders only — exclude subscription fulfillment runs
  const isQuickOrderVisible = (order: Order): boolean => {
    if (!isQuickOrder(order)) return false;
    if (order.deliveryType !== 'today') return true;
    const payment = paymentByOrderId[order.id!];
    if (!payment) return true;
    return payment.status === 'PAID' || payment.status === 'PAYMENT_REQUESTED';
  };

  const visibleOrders = orders.filter(isQuickOrderVisible);

  const tabCounts = useMemo(() => ({
    all: visibleOrders.length,
    pending: visibleOrders.filter((o) => o.status === 'pending').length,
    accepted: visibleOrders.filter((o) => o.status === 'accepted').length,
    out_for_delivery: visibleOrders.filter((o) => o.status === 'out_for_delivery').length,
    delivered: visibleOrders.filter((o) => o.status === 'delivered').length,
  }), [visibleOrders]);

  const searchLower = searchQuery.trim().toLowerCase();

  // Filter orders by status
  const filteredOrders = (activeTab === 'all'
    ? visibleOrders
    : visibleOrders.filter((o) => o.status === activeTab)
  ).filter((order) => {
    if (!searchLower) return true;
    return (
      order.orderId?.toLowerCase().includes(searchLower) ||
      order.customerName?.toLowerCase().includes(searchLower) ||
      order.customerPhone?.includes(searchQuery.trim())
    );
  });

  if (!vendor || vendor.status !== 'approved') {
    return (
      <VendorLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading vendor data...</p>
        </div>
      </VendorLayout>
    );
  }

  return (
    <VendorLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              Quick Orders
              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                Live
              </span>
            </h1>
            <p className="text-muted-foreground mt-1">
              One-time and scheduled orders only. Subscription deliveries are managed under Active Subscriptions.
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by order ID, customer name, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto gap-1">
            <TabsTrigger value="all">All ({tabCounts.all})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({tabCounts.pending})</TabsTrigger>
            <TabsTrigger value="accepted">Accepted ({tabCounts.accepted})</TabsTrigger>
            <TabsTrigger value="out_for_delivery">Out for Delivery ({tabCounts.out_for_delivery})</TabsTrigger>
            <TabsTrigger value="delivered">Delivered ({tabCounts.delivered})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {loading ? (
              <Card className="card-shadow">
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">Loading orders...</p>
                </CardContent>
              </Card>
            ) : filteredOrders.length === 0 ? (
              <Card className="card-shadow">
                <CardContent className="p-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-semibold">No orders found</p>
                  <p className="text-muted-foreground">
                    {activeTab === 'all' 
                      ? 'No orders yet. Orders will appear here when customers place them.'
                      : `No orders with status "${activeTab}".`
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => {
                  const orderTypeInfo = getOrderTypeInfo(order);
                  const displayStatus = getOrderDisplayStatus(order);
                  const statusColor = statusColors[displayStatus] || statusColors[order.status] || 'bg-muted text-muted-foreground border-border';
                  const deliveryType = getDeliveryTypeDisplay(order);
                  const statusLabel = displayStatus === 'assigned_for_delivery' 
                    ? 'Assigned for Delivery' 
                    : displayStatus === 'out_for_delivery' 
                    ? 'Out for Delivery' 
                    : displayStatus === 'delivered' 
                    ? 'Delivered' 
                    : order.status.replace('_', ' ').toUpperCase();
                  
                  const orderPayment = order.id ? paymentByOrderId[order.id] : null;
                  
                  return (
                    <Card key={order.id} className={`card-shadow border-2 ${statusColor}`}>
                      <CardContent className="p-6">
                        {/* Header: Order ID, Type, Status */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-lg">{order.orderId}</span>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium border ${orderTypeInfo.color}`}>
                              {orderTypeInfo.label}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium border ${statusColor}`}>
                              {statusLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-2xl font-bold">₹{order.total}</p>
                            {(order.status === 'pending' || order.status === 'accepted') && !order.deliveryPersonUid && (
                              <Button 
                                size="sm" 
                                className="gap-1"
                                onClick={() => handleOpenAssignDialog(order)}
                                disabled={updatingOrderId === order.id || !!updatingOrderId}
                              >
                                <UserPlus className="h-4 w-4" />
                                Assign
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                          {/* Order Details */}
                          <div className="space-y-3">
                            <h4 className="font-semibold flex items-center gap-2 text-primary">
                              <Package className="h-4 w-4" />
                              Order Details
                            </h4>
                            <p className="text-muted-foreground">{formatOrderItems(order)}</p>
                            <p className="text-sm">
                              <strong>Subtotal:</strong> ₹{order.subtotal}
                              {order.deliveryFee > 0 && (
                                <span className="ml-2 text-muted-foreground">+ Delivery ₹{order.deliveryFee}</span>
                              )}
                            </p>
                          </div>

                          {/* Customer Details */}
                          <div className="space-y-3">
                            <h4 className="font-semibold flex items-center gap-2 text-primary">
                              <User className="h-4 w-4" />
                              Customer Details
                            </h4>
                            <p className="font-medium">{order.customerName}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Phone className="h-4 w-4 shrink-0" />
                              {order.customerPhone}
                            </p>
                            <p className="text-sm text-muted-foreground flex items-start gap-1">
                              <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                              <span>
                                {order.customerAddress}
                                {order.customerPincode && ` - ${order.customerPincode}`}
                              </span>
                            </p>
                          </div>

                          {/* Delivery Time / Frequency */}
                          <div className="space-y-3 sm:col-span-2">
                            <h4 className="font-semibold flex items-center gap-2 text-primary">
                              <Calendar className="h-4 w-4" />
                              Delivery Time & Frequency
                            </h4>
                            <p className="text-sm">
                              <strong>{deliveryType.label}:</strong>{' '}
                              {deliveryType.detail || (order.deliveryType === 'today' ? 'Today (Quick delivery)' : 'As scheduled')}
                            </p>
                            {order.scheduledDate && (
                              <p className="text-sm text-muted-foreground">
                                Scheduled: {order.scheduledDate}
                                {order.scheduledTime && ` at ${order.scheduledTime}`}
                              </p>
                            )}
                            {order.createdAt && (
                              <p className="text-xs text-muted-foreground">
                                Order placed {formatDistanceToNow(order.createdAt.toDate(), { addSuffix: true })}
                              </p>
                            )}
                          </div>

                          {/* Payment Details */}
                          <div className="space-y-3 sm:col-span-2">
                            <h4 className="font-semibold flex items-center gap-2 text-primary">
                              <CreditCard className="h-4 w-4" />
                              Payment Details
                            </h4>
                            {orderPayment ? (
                              <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-4">
                                  <span className="font-medium">₹{orderPayment.amount}</span>
                                  <span className={`text-xs px-2 py-1 rounded-full font-medium inline-flex items-center gap-1 ${
                                    orderPayment.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-600' :
                                    orderPayment.status === 'FAILED' ? 'bg-red-500/10 text-red-600' :
                                    orderPayment.status === 'PAYMENT_REQUESTED' ? 'bg-primary/10 text-primary' :
                                    'bg-muted text-muted-foreground'
                                  }`}>
                                    {orderPayment.status === 'PAID' && (
                                      <>
                                        <CheckCircle className="h-3 w-3" />
                                        Paid
                                      </>
                                    )}
                                    {orderPayment.status === 'FAILED' && 'Failed'}
                                    {orderPayment.status === 'PAYMENT_REQUESTED' && 'Awaiting approval'}
                                    {orderPayment.status === 'INITIATED' && 'Awaiting customer confirmation'}
                                  </span>
                                  {orderPayment.updatedAt && (
                                    <span className="text-xs text-muted-foreground">
                                      Updated {formatDistanceToNow(orderPayment.updatedAt.toDate(), { addSuffix: true })}
                                    </span>
                                  )}
                                </div>
                                {orderPayment.status === 'PAYMENT_REQUESTED' && order.status === 'pending' && (
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-destructive border-destructive"
                                      disabled={updatingPaymentId === orderPayment.id}
                                      onClick={() => handlePaymentAction(order, orderPayment, 'FAILED')}
                                    >
                                      Reject Payment
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="bg-emerald-600 hover:bg-emerald-500"
                                      disabled={updatingPaymentId === orderPayment.id}
                                      onClick={() => handlePaymentAction(order, orderPayment, 'PAID')}
                                    >
                                      Approve Payment
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">Pay on delivery</p>
                            )}
                          </div>

                          {/* Delivery Person (when assigned) */}
                          {order.deliveryPersonName && (
                            <div className="space-y-2 sm:col-span-2 flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                              <Truck className="h-4 w-4 text-primary" />
                              <div>
                                <p className="text-sm font-medium">Delivery Person: {order.deliveryPersonName}</p>
                                <p className="text-xs text-muted-foreground">{order.deliveryPersonPhone}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <DriverAssignmentDialog
        open={showDeliveryPersonDialog}
        onOpenChange={(open) => {
          setShowDeliveryPersonDialog(open);
          if (!open) setOrderToAccept(null);
        }}
        title="Select Delivery Person for Order"
        vendor={vendor}
        deliveryPersons={deliveryPersons}
        loading={loadingDeliveryPersons}
        assigning={!!updatingOrderId}
        showEta
        summary={
          orderToAccept ? (
            <div className="space-y-1 text-sm">
              <p className="font-semibold mb-2">Order Summary</p>
              <p><span className="font-medium">Order ID:</span> {orderToAccept.orderId}</p>
              <p><span className="font-medium">Customer:</span> {orderToAccept.customerName}</p>
              <p><span className="font-medium">Items:</span> {formatOrderItems(orderToAccept)}</p>
              <p><span className="font-medium">Total:</span> ₹{orderToAccept.total}</p>
            </div>
          ) : null
        }
        onAssign={handleAssignDeliveryPerson}
      />
    </VendorLayout>
  );
}
