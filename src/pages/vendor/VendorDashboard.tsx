import { useState, useEffect, useMemo } from 'react';
import {
  Package,
  IndianRupee,
  Clock,
  CheckCircle,
  AlertCircle,
  Edit,
  Save,
  X,
  Droplets,
  ChevronRight,
  Sparkles,
  Warehouse,
  Repeat,
  Users,
  BookUser,
  TrendingUp,
  Truck,
  MapPin,
  Phone,
  User,
  Navigation,
} from 'lucide-react';import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@shared/components/ui/alert';
import { VendorLayout } from '@/components/layouts/VendorLayout';
import { VendorPendingActionsBanner } from '@/components/vendor/VendorPendingActionsBanner';
import { useVendorPendingCounts } from '@shared/hooks/useVendorPendingCounts';
import { Link } from 'react-router-dom';
import { useAuth } from '@shared/contexts/AuthContext';
import { getVendorByUid, updateVendorDocument, subscribeToDeliveryPersonsForVendorArea, subscribeToOrdersByVendor, subscribeToVendors } from '@shared/lib/firebase/firestore';
import { Vendor, Order, FirestoreUser } from '@shared/lib/firebase/firestore';
import { useToast } from '@shared/hooks/use-toast';
import { filterQuickOrders } from '@shared/utils/orderFilters';
import {
  cityKeyForMatching,
  distanceMetersShopToPerson,
  formatKmNumber,
} from '@shared/utils/geo';

const quickActions = [
  {
    to: '/orders',
    icon: Package,
    title: 'Quick Orders',
    desc: 'Accept & assign deliveries',
    color: 'primary',
  },
  {
    to: '/subscription-requests',
    icon: Users,
    title: 'Subscription Requests',
    desc: 'Review new sign-ups',
    color: 'warning',
    badgeKey: 'subscriptionRequests' as const,
  },
  {
    to: '/subscriptions',
    icon: Repeat,
    title: 'Active Subscriptions',
    desc: 'Deliver recurring jars',
    color: 'secondary',
  },
  {
    to: '/subscription-customers',
    icon: BookUser,
    title: 'Subscription Customers',
    desc: 'Customer records & history',
    color: 'primary',
  },
  {
    to: '/inventory',
    icon: Warehouse,
    title: 'Stock & Inventory',
    desc: 'Manage jar levels',
    color: 'success',
  },
  {
    to: '/earnings',
    icon: TrendingUp,
    title: 'Earnings',
    desc: 'Track your revenue',
    color: 'success',
  },
] as const;

function actionColorClasses(color: string): { bg: string; icon: string; hover: string } {
  const map: Record<string, { bg: string; icon: string; hover: string }> = {
    primary: { bg: 'bg-primary/10', icon: 'text-primary', hover: 'group-hover:bg-primary/20' },
    secondary: { bg: 'bg-secondary/10', icon: 'text-secondary', hover: 'group-hover:bg-secondary/20' },
    success: { bg: 'bg-success/10', icon: 'text-success', hover: 'group-hover:bg-success/20' },
    warning: { bg: 'bg-warning/10', icon: 'text-warning', hover: 'group-hover:bg-warning/20' },
  };
  return map[color] ?? map.primary;
}
export default function VendorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const pendingCounts = useVendorPendingCounts();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingPrices, setIsEditingPrices] = useState(false);
  const [priceForm, setPriceForm] = useState({
    jar20L: '',
    jar10L: '',
    bottles: '',
  });
  const [savingPrices, setSavingPrices] = useState(false);
  const [deliveryPersons, setDeliveryPersons] = useState<FirestoreUser[]>([]);
  const [loadingDeliveryPersons, setLoadingDeliveryPersons] = useState(false);

  // Real-time listener for vendor data to sync stock updates from backend
  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = subscribeToVendors((vendors) => {
      const currentVendor = vendors.find(v => v.uid === user.id);
      if (currentVendor) {
        setVendor(currentVendor);
        if (currentVendor.prices) {
          setPriceForm({
            jar20L: currentVendor.prices.jar20L?.toString() || '',
            jar10L: currentVendor.prices.jar10L?.toString() || '',
            bottles: currentVendor.prices.bottles?.toString() || '',
          });
        }
        setLoading(false);
        console.log('🟢 Real-time vendor stock update:', {
          jar20L: currentVendor.stock?.jar20L,
          jar10L: currentVendor.stock?.jar10L,
        });
      }
    });

    return () => unsubscribe();
  }, [user?.id]);

  // Initial fetch for vendor data
  useEffect(() => {
    const fetchVendorData = async () => {
      if (user?.id) {
        try {
          const vendorData = await getVendorByUid(user.id);
          setVendor(vendorData);
          if (vendorData?.prices) {
            setPriceForm({
              jar20L: vendorData.prices.jar20L?.toString() || '',
              jar10L: vendorData.prices.jar10L?.toString() || '',
              bottles: vendorData.prices.bottles?.toString() || '',
            });
          }
          console.log('✅ Vendor data loaded:', {
            shopName: vendorData.shopName,
            hasShopImage: !!vendorData.shopImage,
            stock: vendorData.stock,
          });
        } catch (error) {
          console.error('Error fetching vendor data:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchVendorData();
  }, [user?.id]);

  // Real-time listener for vendor orders
  useEffect(() => {
    if (!user?.id || vendor?.status !== 'approved') {
      setOrders([]);
      return;
    }

    try {
      const unsubscribe = subscribeToOrdersByVendor(
        user.id,
        (vendorOrders) => {
          setOrders(filterQuickOrders(vendorOrders));
        },
        (error) => {
          toast({
            title: 'Error',
            description: error.message || 'Failed to load orders. Please try again.',
            variant: 'destructive',
          });
        }
      );

      return () => {
        unsubscribe();
        setOrders([]);
      };
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to set up orders listener. Please refresh the page.',
        variant: 'destructive',
      });
    }
  }, [user?.id, vendor?.status, toast]);

  // Stock is deducted directly in handleAssignDeliveryPerson function
  // No need for separate useEffect to avoid double-processing and conflicts

  // Real-time listener: same city as shop (or pincode-only legacy), distance-sorted when GPS set
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
      toast({
        title: 'Error',
        description: error.message || 'Failed to set up delivery persons listener. Please refresh the page.',
        variant: 'destructive',
      });
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
    toast,
  ]);

  const handleSavePrices = async () => {
    if (!vendor) return;

    try {
      setSavingPrices(true);
      const prices = {
        jar20L: priceForm.jar20L ? parseFloat(priceForm.jar20L) : undefined,
        jar10L: priceForm.jar10L ? parseFloat(priceForm.jar10L) : undefined,
        bottles: priceForm.bottles ? parseFloat(priceForm.bottles) : undefined,
      };

      for (const [key, val] of Object.entries(prices)) {
        if (val != null && (val < 0 || val > 99999)) {
          toast({
            title: 'Invalid price',
            description: `${key} must be between ₹0 and ₹99,999.`,
            variant: 'destructive',
          });
          setSavingPrices(false);
          return;
        }
      }

      await updateVendorDocument(vendor.uid, { prices });
      
      // Update local state
      setVendor({ ...vendor, prices });
      setIsEditingPrices(false);
      
      toast({
        title: 'Prices Updated',
        description: 'Your jar prices have been saved successfully.',
      });
    } catch (error: any) {
      console.error('Error saving prices:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save prices. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingPrices(false);
    }
  };

  const dashboardStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = orders.filter((order) => {
      const orderDate = order.createdAt?.toDate();
      if (!orderDate) return false;
      orderDate.setHours(0, 0, 0, 0);
      return orderDate.getTime() === today.getTime();
    });

    const pendingOrders = orders.filter(
      (o) => o.status === 'pending' || o.status === 'accepted' || o.status === 'preparing'
    );
    const completedToday = todayOrders.filter((o) => o.status === 'delivered');
    const todayEarnings = completedToday.reduce((sum, order) => sum + order.total, 0);

    return { todayOrders, pendingOrders, completedToday, todayEarnings };
  }, [orders]);

  const availableDrivers = deliveryPersons.filter((p) => p.isAvailable !== false).length;
  const stock20 = vendor?.stock?.jar20L ?? 0;
  const stock10 = vendor?.stock?.jar10L ?? 0;
  const lowStock = stock20 < 25 || stock10 < 25;

  if (loading) {
    return (
      <VendorLayout>
        <div className="space-y-6 animate-pulse">
          <div className="h-40 rounded-2xl bg-muted/60" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-muted/60" />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 rounded-xl bg-muted/60" />
            ))}
          </div>
        </div>
      </VendorLayout>
    );
  }
  // Show pending approval message if vendor is not approved
  if (vendor?.status === 'pending') {
  return (
    <VendorLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Vendor Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your orders and deliveries
          </p>
        </div>

          <Card className="card-shadow border-2 border-warning/50 bg-warning/5">
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-16 w-16 text-warning mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Awaiting Admin Approval</h2>
              <p className="text-muted-foreground">
                Your vendor account is pending approval. You'll be able to access the dashboard once an admin approves your registration.
              </p>
              <div className="mt-6 p-4 rounded-lg bg-muted/50 text-left max-w-md mx-auto">
                <p className="font-semibold mb-2">Registration Details:</p>
                <p className="text-sm"><span className="font-medium">Shop Name:</span> {vendor.shopName}</p>
                <p className="text-sm"><span className="font-medium">Owner:</span> {vendor.ownerName}</p>
                <p className="text-sm"><span className="font-medium">Phone:</span> {vendor.phone}</p>
                <p className="text-sm"><span className="font-medium">Address:</span> {vendor.address}</p>
                {vendor.state && <p className="text-sm"><span className="font-medium">State:</span> {vendor.state}</p>}
                {vendor.pincode && <p className="text-sm"><span className="font-medium">Pincode:</span> {vendor.pincode}</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </VendorLayout>
    );
  }

  // Show rejection message if vendor is rejected
  if (vendor?.status === 'rejected') {
    return (
      <VendorLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Vendor Dashboard</h1>
          </div>
          
          <Card className="card-shadow border-2 border-destructive/50 bg-destructive/5">
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Registration Rejected</h2>
              <p className="text-muted-foreground">
                Your vendor registration has been rejected. Please contact support for more information.
              </p>
            </CardContent>
          </Card>
        </div>
      </VendorLayout>
    );
  }

  return (
    <VendorLayout>
      <div className="space-y-8">
        {/* Hero welcome */}
        <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-background to-secondary/10 p-6 sm:p-8 animate-slide-up">
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-8 h-48 w-48 rounded-full bg-secondary/15 blur-3xl" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-background/70 px-3 py-1 text-xs font-medium text-primary backdrop-blur">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
                Shop live · Real-time updates
              </div>
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">
                Welcome back,{' '}
                <span className="water-gradient-text">{vendor?.shopName || user?.name?.split(' ')[0] || 'Partner'}</span>
              </h1>
              <p className="text-muted-foreground max-w-xl text-sm sm:text-base">
                Manage orders, subscriptions, stock, and deliveries — all from one place. Your business at a glance.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/80 border px-3 py-1.5 text-xs font-medium backdrop-blur">
                  <Package className="h-3.5 w-3.5 text-primary" />
                  {dashboardStats.todayOrders.length} orders today
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/80 border px-3 py-1.5 text-xs font-medium backdrop-blur">
                  <Truck className="h-3.5 w-3.5 text-success" />
                  {availableDrivers} driver{availableDrivers !== 1 ? 's' : ''} available
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium backdrop-blur ${
                    lowStock ? 'bg-warning/10 border-warning/40 text-warning' : 'bg-background/80'
                  }`}
                >
                  <Droplets className="h-3.5 w-3.5" />
                  Stock: {stock20}×20L · {stock10}×10L
                </span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link to="/orders">
                <Button size="lg" className="water-gradient text-primary-foreground font-semibold gap-2 w-full sm:w-auto shadow-lg">
                  <Sparkles className="h-5 w-5" />
                  Manage Quick Orders
                  {dashboardStats.pendingOrders.length > 0 && (
                    <span className="ml-1 rounded-full bg-white/25 px-2 py-0.5 text-xs">
                      {dashboardStats.pendingOrders.length} pending
                    </span>
                  )}
                </Button>
              </Link>
              <Link to="/inventory">
                <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto bg-background/60 backdrop-blur">
                  <Warehouse className="h-5 w-5" />
                  Update Stock
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <VendorPendingActionsBanner counts={pendingCounts} />

        {/* KPI stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up-delay-1">
          <Link to="/orders" className="group block">
            <Card className="relative overflow-hidden border-0 h-full card-shadow hover:card-shadow-hover transition-all duration-300 group-hover:-translate-y-1 bg-gradient-to-br from-primary/20 via-primary/5 to-background">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 rounded-xl water-gradient shadow-sm">
                    <Package className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-3xl font-bold mt-4 tabular-nums">{dashboardStats.todayOrders.length}</p>
                <p className="text-sm text-muted-foreground mt-0.5">Today&apos;s Quick Orders</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/orders?tab=pending" className="group block">
            <Card className="relative overflow-hidden border-0 h-full card-shadow hover:card-shadow-hover transition-all duration-300 group-hover:-translate-y-1 bg-gradient-to-br from-warning/20 via-warning/5 to-background">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 rounded-xl bg-warning/20">
                    <Clock className="h-5 w-5 text-warning" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-3xl font-bold mt-4 tabular-nums">{dashboardStats.pendingOrders.length}</p>
                <p className="text-sm text-muted-foreground mt-0.5">Pending Action</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/earnings" className="group block">
            <Card className="relative overflow-hidden border-0 h-full card-shadow hover:card-shadow-hover transition-all duration-300 group-hover:-translate-y-1 bg-gradient-to-br from-success/20 via-success/5 to-background">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 rounded-xl bg-success/20">
                    <IndianRupee className="h-5 w-5 text-success" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-3xl font-bold mt-4 tabular-nums">₹{dashboardStats.todayEarnings.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground mt-0.5">Today&apos;s Earnings</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/orders?tab=delivered" className="group block">
            <Card className="relative overflow-hidden border-0 h-full card-shadow hover:card-shadow-hover transition-all duration-300 group-hover:-translate-y-1 bg-gradient-to-br from-secondary/20 via-secondary/5 to-background">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 rounded-xl bg-secondary/20">
                    <CheckCircle className="h-5 w-5 text-secondary" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-3xl font-bold mt-4 tabular-nums">{dashboardStats.completedToday.length}</p>
                <p className="text-sm text-muted-foreground mt-0.5">Completed Today</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {availableDrivers === 0 && vendor?.status === 'approved' && (
          <Alert className="border-warning/50 bg-warning/10">
            <AlertCircle className="h-4 w-4 text-warning" />
            <AlertTitle>No delivery drivers available</AlertTitle>
            <AlertDescription>
              No drivers are online in your area right now. Assignments will be available when drivers go online.
            </AlertDescription>
          </Alert>
        )}

        {/* Quick actions */}
        <section className="animate-slide-up-delay-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Quick Actions</h2>
            <p className="text-sm text-muted-foreground hidden sm:block">Jump to any section</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((action) => {
              const colors = actionColorClasses(action.color);
              const Icon = action.icon;
              const badgeCount =
                'badgeKey' in action && action.badgeKey === 'subscriptionRequests'
                  ? pendingCounts.subscriptionRequests
                  : 0;
              return (
                <Link key={action.to} to={action.to} className="group">
                  <Card className="card-shadow hover:card-shadow-hover transition-all duration-300 h-full group-hover:-translate-y-1 border-border/60">
                    <CardContent className="p-5 flex items-start gap-4">
                      <div
                        className={`p-3 rounded-2xl shrink-0 transition-colors ${colors.bg} ${colors.hover}`}
                      >
                        <Icon className={`h-6 w-6 ${colors.icon}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{action.title}</h3>
                          {badgeCount > 0 && (
                            <span className="text-[10px] min-w-[1.25rem] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground font-bold flex items-center justify-center">
                              {badgeCount}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{action.desc}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Jar prices */}
        <Card className="card-shadow border-2 border-primary/10 animate-slide-up-delay-2 overflow-hidden">
          <div className="h-1 water-gradient" />
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl water-gradient">
                <Droplets className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle>Your Jar Prices</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">What customers pay per unit</p>
              </div>
            </div>
            {!isEditingPrices ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditingPrices(true)} className="gap-2 shrink-0">
                <Edit className="h-4 w-4" />
                Edit Prices
              </Button>
            ) : (
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditingPrices(false);
                    if (vendor?.prices) {
                      setPriceForm({
                        jar20L: vendor.prices.jar20L?.toString() || '',
                        jar10L: vendor.prices.jar10L?.toString() || '',
                        bottles: vendor.prices.bottles?.toString() || '',
                      });
                    }
                  }}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSavePrices} disabled={savingPrices} className="gap-2 water-gradient text-primary-foreground">
                  <Save className="h-4 w-4" />
                  {savingPrices ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {isEditingPrices ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="jar20L">20L Jar Price (₹)</Label>
                  <Input
                    id="jar20L"
                    type="number"
                    placeholder="40"
                    value={priceForm.jar20L}
                    onChange={(e) => setPriceForm({ ...priceForm, jar20L: e.target.value })}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jar10L">10L Jar Price (₹)</Label>
                  <Input
                    id="jar10L"
                    type="number"
                    placeholder="25"
                    value={priceForm.jar10L}
                    onChange={(e) => setPriceForm({ ...priceForm, jar10L: e.target.value })}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bottles">Bottles (Pack of 12) Price (₹)</Label>
                  <Input
                    id="bottles"
                    type="number"
                    placeholder="120"
                    value={priceForm.bottles}
                    onChange={(e) => setPriceForm({ ...priceForm, bottles: e.target.value })}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: '20L Jar', value: vendor?.prices?.jar20L, accent: 'from-primary/15 to-primary/5' },
                  { label: '10L Jar', value: vendor?.prices?.jar10L, accent: 'from-secondary/15 to-secondary/5' },
                  { label: 'Bottles (Pack of 12)', value: vendor?.prices?.bottles, accent: 'from-success/15 to-success/5' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`p-5 rounded-xl border bg-gradient-to-br ${item.accent} text-center transition-transform hover:scale-[1.02]`}
                  >
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="text-3xl font-bold mt-2 water-gradient-text">
                      {item.value != null ? `₹${item.value}` : '—'}
                    </p>
                    {!item.value && (
                      <p className="text-xs text-muted-foreground mt-1">Tap Edit to set price</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Nearby drivers */}
        <Card className="card-shadow animate-slide-up-delay-3">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-success/15">
                <Truck className="h-5 w-5 text-success" />
              </div>
              <div>
                <CardTitle>Nearby Delivery Partners</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {availableDrivers} available now · assign when accepting orders
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {vendor &&
              (vendor.latitude == null ||
                vendor.longitude == null ||
                Number.isNaN(vendor.latitude) ||
                Number.isNaN(vendor.longitude)) && (
              <Alert className="mb-4 border-amber-500/50 bg-amber-500/10">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-900 dark:text-amber-100">Set your shop GPS to see distances</AlertTitle>
                <AlertDescription className="text-amber-900/90 dark:text-amber-100/90">
                  Open{' '}
                  <Link to="/settings" className="underline font-medium">
                    Shop Settings
                  </Link>{' '}
                  and tap &quot;Set shop location from GPS&quot;.
                </AlertDescription>
              </Alert>
            )}
            {loadingDeliveryPersons ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-32 rounded-xl bg-muted/50 animate-pulse" />
                ))}
              </div>
            ) : deliveryPersons.length === 0 ? (
              <div className="text-center py-10 rounded-xl border border-dashed bg-muted/20">
                <Truck className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="font-medium">No delivery partners in your area yet</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Drivers must be in the same city as your shop. Set city in Shop Settings.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {deliveryPersons.map((person) => {
                  const isAvailable = person.isAvailable !== false;
                  const distM = distanceMetersShopToPerson(
                    vendor?.latitude,
                    vendor?.longitude,
                    person.latitude,
                    person.longitude
                  );
                  return (
                    <div
                      key={person.uid}
                      className={`p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                        isAvailable
                          ? 'border-success/40 bg-gradient-to-br from-success/10 to-background'
                          : 'border-muted-foreground/20 bg-muted/20 opacity-80'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2.5 rounded-xl ${isAvailable ? 'bg-success/20' : 'bg-muted'}`}>
                          <User className={`h-5 w-5 ${isAvailable ? 'text-success' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className={`font-semibold ${!isAvailable ? 'text-muted-foreground' : ''}`}>
                              {person.name}
                            </p>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                isAvailable
                                  ? 'bg-success/25 text-success'
                                  : 'bg-muted-foreground/20 text-muted-foreground'
                              }`}
                            >
                              {isAvailable ? 'Available' : 'Unavailable'}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-sm">
                            <Navigation className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                            <span>
                              {distM != null ? (
                                <span className="font-semibold tabular-nums">{formatKmNumber(distM)} km away</span>
                              ) : (
                                <span className="text-muted-foreground text-xs">Distance unavailable</span>
                              )}
                            </span>
                          </div>
                          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 shrink-0" />
                              <span>{person.phone}</span>
                            </div>
                            {person.address && (
                              <div className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                                <span className="line-clamp-2">{person.address}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </VendorLayout>
  );
}