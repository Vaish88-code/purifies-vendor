import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Phone,
  MapPin,
  Calendar,
  IndianRupee,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  Package,
  History,
} from 'lucide-react';
import { Input } from '@shared/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Badge } from '@shared/components/ui/badge';
import { Button } from '@shared/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@shared/components/ui/sheet';
import { VendorLayout } from '@/components/layouts/VendorLayout';
import { useAuth } from '@shared/contexts/AuthContext';
import { useToast } from '@shared/hooks/use-toast';
import {
  Order,
  Subscription,
  SubscriptionPayment,
  subscribeToOrdersByVendor,
  subscribeToSubscriptionsByVendor,
  subscribeToSubscriptionPaymentsByVendor,
} from '@shared/lib/firebase/firestore';
import {
  formatDeliveryDays,
  isPendingSubscriptionRequest,
} from '@shared/utils/subscriptionSchedule';
import {
  SubscriptionCustomerGroup,
  getCustomerSubscriptionOrders,
  getSubscriptionRecordStatus,
  groupSubscriptionsByCustomer,
} from '@shared/utils/subscriptionCustomerGroups';
import { Tabs, TabsList, TabsTrigger } from '@shared/components/ui/tabs';

function jarLabel(jarType: Subscription['jarType']): string {
  if (jarType === 'jar20L') return '20L Jar';
  if (jarType === 'jar10L') return '10L Jar';
  return 'Bottle Pack';
}

function formatOrderItems(order: Order): string {
  return order.items
    .map((item) => {
      const name =
        item.jarType === '20L' ? '20L Jar' : item.jarType === '10L' ? '10L Jar' : 'Bottles';
      return `${item.quantity}× ${name}`;
    })
    .join(', ');
}

function getEndDateLabel(sub: Subscription): string {
  const status = getSubscriptionRecordStatus(sub);
  if (status === 'active') {
    return sub.nextDeliveryDate
      ? `Next delivery: ${new Date(sub.nextDeliveryDate).toLocaleDateString()}`
      : 'Currently active';
  }
  if (sub.updatedAt) {
    return sub.updatedAt.toDate().toLocaleDateString();
  }
  return 'Ended';
}

function statusBadgeClass(status: SubscriptionCustomerGroup['overallStatus']): string {
  if (status === 'active') return 'bg-success/15 text-success border-success/30';
  if (status === 'rejected') return 'bg-destructive/15 text-destructive border-destructive/30';
  return 'bg-muted text-muted-foreground border-border';
}

function orderStatusClass(status: Order['status']): string {
  if (status === 'delivered') return 'bg-success/15 text-success border-success/30';
  if (status === 'pending') return 'bg-warning/15 text-warning border-warning/30';
  if (status === 'rejected' || status === 'cancelled') {
    return 'bg-destructive/15 text-destructive border-destructive/30';
  }
  return 'bg-primary/15 text-primary border-primary/30';
}

export default function VendorSubscriptionCustomers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState<SubscriptionCustomerGroup | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubSubs = subscribeToSubscriptionsByVendor(
      user.id,
      (list) => {
        setSubscriptions(list.filter((s) => !isPendingSubscriptionRequest(s)));
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        toast({
          title: 'Error',
          description: err.message || 'Failed to load subscription records.',
          variant: 'destructive',
        });
      }
    );
    const unsubPay = subscribeToSubscriptionPaymentsByVendor(user.id, setPayments);
    const unsubOrders = subscribeToOrdersByVendor(user.id, setOrders);
    return () => {
      unsubSubs();
      unsubPay();
      unsubOrders();
    };
  }, [user?.id, toast]);

  const paidBySubscription = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of payments) {
      if (p.status !== 'PAID' && p.status !== 'SUCCESS') continue;
      if (!p.subscriptionId) continue;
      map[p.subscriptionId] = (map[p.subscriptionId] || 0) + (p.amount || 0);
    }
    return map;
  }, [payments]);

  const customerGroups = useMemo(
    () => groupSubscriptionsByCustomer(subscriptions, paidBySubscription),
    [subscriptions, paidBySubscription]
  );

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customerGroups
      .filter((group) => {
        if (tab === 'active') return group.overallStatus === 'active';
        if (tab === 'ended') return group.overallStatus === 'ended';
        if (tab === 'rejected') return group.overallStatus === 'rejected';
        return true;
      })
      .filter((group) => {
        if (!q) return true;
        return (
          group.customerName?.toLowerCase().includes(q) ||
          group.customerPhone?.includes(search.trim()) ||
          group.customerAddress?.toLowerCase().includes(q)
        );
      });
  }, [customerGroups, tab, search]);

  const stats = useMemo(
    () => ({
      total: customerGroups.length,
      active: customerGroups.filter((g) => g.overallStatus === 'active').length,
      ended: customerGroups.filter((g) => g.overallStatus === 'ended').length,
    }),
    [customerGroups]
  );

  const selectedOrders = useMemo(
    () => (selectedCustomer ? getCustomerSubscriptionOrders(orders, selectedCustomer) : []),
    [orders, selectedCustomer]
  );

  if (loading) {
    return (
      <VendorLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading subscription customer records...</p>
        </div>
      </VendorLayout>
    );
  }

  return (
    <VendorLayout>
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-6 sm:p-8">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-xl water-gradient">
                <Users className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Subscription Customers</h1>
                <p className="text-muted-foreground mt-1">
                  One profile per customer — tap to view all past subscriptions and delivery orders
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-6 max-w-md">
              <div className="rounded-xl bg-background/80 backdrop-blur p-3 text-center border">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Unique customers</p>
              </div>
              <div className="rounded-xl bg-background/80 backdrop-blur p-3 text-center border border-success/30">
                <p className="text-2xl font-bold text-success">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
              <div className="rounded-xl bg-background/80 backdrop-blur p-3 text-center border">
                <p className="text-2xl font-bold">{stats.ended}</p>
                <p className="text-xs text-muted-foreground">Ended</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <Tabs value={tab} onValueChange={setTab} className="w-full sm:w-auto">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="ended">Ended</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, phone, address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {filteredGroups.length === 0 ? (
          <Card className="card-shadow border-dashed">
            <CardContent className="p-12 text-center">
              <Users className="h-14 w-14 text-muted-foreground mx-auto mb-4 opacity-40" />
              <p className="font-semibold text-lg">No subscription customer records</p>
              <p className="text-sm text-muted-foreground mt-2">
                Records appear here after you approve requests from Subscription Requests.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredGroups.map((group) => (
              <Card
                key={group.key}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedCustomer(group)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedCustomer(group);
                  }
                }}
                className={`card-shadow overflow-hidden transition-all hover:shadow-lg cursor-pointer hover:border-primary/40 ${
                  group.overallStatus === 'active' ? 'border-l-4 border-l-success' : ''
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-11 w-11 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                        <span className="font-bold text-primary">
                          {group.customerName?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-lg truncate">{group.customerName}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {group.subscriptionCount} subscription
                          {group.subscriptionCount !== 1 ? 's' : ''}
                          {group.activeCount > 0 && (
                            <span className="text-success"> · {group.activeCount} active</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={statusBadgeClass(group.overallStatus)}>
                      {group.overallStatus === 'active'
                        ? 'Active'
                        : group.overallStatus === 'rejected'
                        ? 'Rejected'
                        : 'Ended'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4 shrink-0" />
                      <span className="text-foreground">{group.customerPhone}</span>
                    </div>
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                      <span className="text-foreground line-clamp-2">
                        {group.customerAddress}
                        {group.customerPincode && (
                          <span className="block text-xs mt-0.5">Pin: {group.customerPincode}</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Lifetime paid</p>
                      <p className="font-bold flex items-center gap-1 text-success">
                        {group.totalPaid > 0 ? (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            ₹{group.totalPaid.toLocaleString()}
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">₹0</span>
                          </>
                        )}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="gap-1 text-primary shrink-0">
                      View history
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Sheet open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {selectedCustomer && (
            <>
              <SheetHeader className="text-left pr-8">
                <SheetTitle className="text-xl">{selectedCustomer.customerName}</SheetTitle>
                <SheetDescription>Full subscription history and delivery orders</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="rounded-xl border bg-muted/30 p-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${selectedCustomer.customerPhone}`} className="hover:underline">
                      {selectedCustomer.customerPhone}
                    </a>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span>
                      {selectedCustomer.customerAddress}
                      {selectedCustomer.customerPincode && (
                        <span className="block text-xs text-muted-foreground mt-0.5">
                          Pin: {selectedCustomer.customerPincode}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t">
                    <IndianRupee className="h-4 w-4 text-success" />
                    <span className="font-semibold text-success">
                      ₹{selectedCustomer.totalPaid.toLocaleString()} total paid
                    </span>
                    <span className="text-muted-foreground">
                      · {selectedCustomer.subscriptionCount} subscription
                      {selectedCustomer.subscriptionCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold flex items-center gap-2 mb-3">
                    <History className="h-4 w-4" />
                    Subscription history
                  </h3>
                  <div className="space-y-3">
                    {selectedCustomer.subscriptions.map((sub) => {
                      const status = getSubscriptionRecordStatus(sub);
                      const paid = sub.id ? paidBySubscription[sub.id] || 0 : 0;
                      return (
                        <div key={sub.id} className="rounded-xl border p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-mono text-xs text-muted-foreground">{sub.subscriptionId}</p>
                              <p className="font-semibold mt-0.5">
                                {sub.quantity}× {jarLabel(sub.jarType)} @ ₹{sub.pricePerUnit}
                              </p>
                            </div>
                            <Badge variant="outline" className={statusBadgeClass(status)}>
                              {status === 'active' ? 'Active' : status === 'rejected' ? 'Rejected' : 'Ended'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {sub.deliveryDaysOfWeek?.length
                              ? `${sub.deliveriesPerWeek}×/week · ${formatDeliveryDays(sub.deliveryDaysOfWeek)}`
                              : sub.frequency}
                            {sub.preferredDeliveryTime && (
                              <span className="flex items-center gap-1 mt-1">
                                <Clock className="h-3 w-3" />
                                Preferred {sub.preferredDeliveryTime}
                              </span>
                            )}
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-lg bg-muted/50 p-2">
                              <p className="text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Started
                              </p>
                              <p className="font-medium mt-0.5">
                                {sub.startDate
                                  ? new Date(sub.startDate).toLocaleDateString()
                                  : sub.createdAt?.toDate().toLocaleDateString() ?? '—'}
                              </p>
                            </div>
                            <div className="rounded-lg bg-muted/50 p-2">
                              <p className="text-muted-foreground">End / next</p>
                              <p className="font-medium mt-0.5">{getEndDateLabel(sub)}</p>
                            </div>
                          </div>
                          <div className="flex justify-between text-sm pt-1 border-t">
                            <span className="text-muted-foreground">
                              ₹{sub.monthlyAmount?.toLocaleString()}/mo
                            </span>
                            <span className="font-medium text-success">Paid: ₹{paid.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold flex items-center gap-2 mb-3">
                    <Package className="h-4 w-4" />
                    Delivery orders ({selectedOrders.length})
                  </h3>
                  {selectedOrders.length === 0 ? (
                    <p className="text-sm text-muted-foreground rounded-xl border border-dashed p-6 text-center">
                      No subscription delivery orders yet for this customer.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedOrders.map((order) => (
                        <div key={order.id} className="rounded-xl border p-3 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-mono text-xs text-muted-foreground">{order.orderId}</p>
                              <p className="font-medium mt-0.5">{formatOrderItems(order)}</p>
                            </div>
                            <Badge variant="outline" className={orderStatusClass(order.status)}>
                              {order.status.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                            <span>
                              {order.createdAt?.toDate().toLocaleDateString()}{' '}
                              {order.createdAt?.toDate().toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span className="font-semibold text-foreground">₹{order.total}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </VendorLayout>
  );
}
