import { useState, useEffect } from 'react';
import { 
  Warehouse, 
  Plus,
  Minus,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card';
import { VendorLayout } from '@/components/layouts/VendorLayout';
import { useAuth } from '@shared/contexts/AuthContext';
import { useToast } from '@shared/hooks/use-toast';
import { getVendorByUid, updateVendorDocument, subscribeToVendors, Vendor } from '@shared/lib/firebase/firestore';

const MAX_STOCK = 250;
const MIN_STOCK = 25;

export default function VendorInventory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Real-time listener for vendor data to sync stock updates from backend
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToVendors((vendors) => {
      const currentVendor = vendors.find(v => v.uid === user.id);
      if (currentVendor) {
        setVendor(currentVendor);
        setLoading(false);
        console.log('🟢 Real-time stock update in Inventory:', {
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
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const vendorData = await getVendorByUid(user.id);
        setVendor(vendorData);
      } catch (error) {
        console.error('Error fetching vendor data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load inventory. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchVendorData();
  }, [user?.id, toast]);

  const updateStock = async (jarType: 'jar20L' | 'jar10L', delta: number) => {
    if (!vendor || !user?.id) return;

    const currentStock = vendor.stock?.[jarType] || 0;
    const newStock = Math.max(0, Math.min(MAX_STOCK, currentStock + delta));

    if (newStock === currentStock && delta > 0) {
      toast({
        title: 'Stock Limit Reached',
        description: `Maximum stock limit is ${MAX_STOCK} jars. Cannot add more.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setUpdating(true);
      await updateVendorDocument(user.id, {
        stock: {
          ...vendor.stock,
          [jarType]: newStock,
        },
      });

        // Stock will be updated automatically via real-time listener
        // Don't update local state to avoid conflicts with real-time updates
        
        toast({
          title: 'Stock Updated',
          description: `${jarType === 'jar20L' ? '20L' : '10L'} jar stock ${delta > 0 ? 'increased' : 'decreased'} to ${newStock}. Stock saved to database.`,
        });
    } catch (error: any) {
      console.error('Error updating stock:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update stock. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const setStockDirectly = async (jarType: 'jar20L' | 'jar10L', value: number) => {
    if (!vendor || !user?.id) return;

    const numValue = parseInt(value.toString(), 10);
    if (isNaN(numValue) || numValue < 0) {
      toast({
        title: 'Invalid Input',
        description: 'Please enter a valid number (0 or greater).',
        variant: 'destructive',
      });
      return;
    }

    const newStock = Math.min(MAX_STOCK, numValue);

    if (newStock > MAX_STOCK) {
      toast({
        title: 'Stock Limit Reached',
        description: `Maximum stock limit is ${MAX_STOCK} jars.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setUpdating(true);
      await updateVendorDocument(user.id, {
        stock: {
          ...vendor.stock,
          [jarType]: newStock,
        },
      });

      // Stock will be updated automatically via real-time listener
      // Don't update local state to avoid conflicts with real-time updates

      toast({
        title: 'Stock Updated',
        description: `${jarType === 'jar20L' ? '20L' : '10L'} jar stock set to ${newStock}. Stock saved to database.`,
      });
    } catch (error: any) {
      console.error('Error updating stock:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update stock. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <VendorLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading inventory...</p>
        </div>
      </VendorLayout>
    );
  }

  const stock20L = vendor?.stock?.jar20L || 0;
  const stock10L = vendor?.stock?.jar10L || 0;
  const totalStock = stock20L + stock10L;
  
  const lowStock20L = stock20L <= MIN_STOCK;
  const lowStock10L = stock10L <= MIN_STOCK;
  const lowStockCount = (lowStock20L ? 1 : 0) + (lowStock10L ? 1 : 0);
  const zeroStock20L = stock20L === 0;
  const zeroStock10L = stock10L === 0;

  return (
    <VendorLayout>
      <div className="space-y-6">
        {(zeroStock20L || zeroStock10L) && (
          <div className="sticky top-16 z-40 -mx-4 px-4 py-3 bg-destructive text-destructive-foreground shadow-lg">
            <div className="container mx-auto flex items-center gap-3">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="font-semibold text-sm sm:text-base">
                {zeroStock20L && zeroStock10L
                  ? 'Critical: Both 20L and 10L jars are out of stock — deliveries are blocked.'
                  : zeroStock20L
                  ? 'Critical: 20L jars out of stock — 20L deliveries are blocked.'
                  : 'Critical: 10L jars out of stock — 10L deliveries are blocked.'}
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Stock Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage your water jar inventory (Max: {MAX_STOCK} per type, Min: {MIN_STOCK} for low stock alert)
          </p>
        </div>

        {/* Alerts */}
        {(zeroStock20L || zeroStock10L) && (
          <Card className="card-shadow border-2 border-destructive/50 bg-destructive/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-destructive mb-1">Out of Stock Alert</p>
                  <p className="text-sm text-muted-foreground">
                    {zeroStock20L && zeroStock10L && 'Both 20L and 10L jars are out of stock. Cannot assign deliveries.'}
                    {zeroStock20L && !zeroStock10L && '20L jars are out of stock. Cannot assign 20L jar deliveries.'}
                    {!zeroStock20L && zeroStock10L && '10L jars are out of stock. Cannot assign 10L jar deliveries.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="card-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Warehouse className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalStock}</p>
                  <p className="text-sm text-muted-foreground">Total Jars</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`card-shadow ${lowStockCount > 0 ? 'border-2 border-warning/50' : ''}`}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${lowStockCount > 0 ? 'bg-warning/10' : 'bg-success/10'}`}>
                  {lowStockCount > 0 ? (
                    <AlertCircle className="h-6 w-6 text-warning" />
                  ) : (
                    <CheckCircle className="h-6 w-6 text-success" />
                  )}
                </div>
                <div>
                  <p className="text-2xl font-bold">{lowStockCount}</p>
                  <p className="text-sm text-muted-foreground">Low Stock Items</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stock Items */}
        <div className="space-y-4">
          {/* 20L Jars */}
          <Card className={`card-shadow ${lowStock20L ? 'border-2 border-warning/50' : ''} ${zeroStock20L ? 'border-destructive/50' : ''}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Warehouse className={`h-5 w-5 ${zeroStock20L ? 'text-destructive' : lowStock20L ? 'text-warning' : 'text-primary'}`} />
                20L Water Jars
                {zeroStock20L && (
                  <span className="ml-2 text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive font-medium">
                    Out of Stock
                  </span>
                )}
                {lowStock20L && !zeroStock20L && (
                  <span className="ml-2 text-xs px-2 py-1 rounded-full bg-warning/10 text-warning font-medium">
                    Low Stock
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-3xl font-bold ${zeroStock20L ? 'text-destructive' : lowStock20L ? 'text-warning' : ''}`}>
                      {stock20L}
                    </span>
                    <span className="text-sm text-muted-foreground">/ {MAX_STOCK} max</span>
                  </div>
                  {lowStock20L && (
                    <p className="text-sm text-warning flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      Stock is low. Minimum recommended: {MIN_STOCK} jars
                    </p>
                  )}
                  {zeroStock20L && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      Cannot assign deliveries until stock is added
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    onClick={() => updateStock('jar20L', -1)}
                    disabled={updating || stock20L <= 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min="0"
                    max={MAX_STOCK}
                    value={stock20L}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value)) {
                        setStockDirectly('jar20L', value);
                      }
                    }}
                    className="w-20 text-center text-lg font-semibold"
                    disabled={updating}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    onClick={() => updateStock('jar20L', 1)}
                    disabled={updating || stock20L >= MAX_STOCK}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 10L Jars */}
          <Card className={`card-shadow ${lowStock10L ? 'border-2 border-warning/50' : ''} ${zeroStock10L ? 'border-destructive/50' : ''}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Warehouse className={`h-5 w-5 ${zeroStock10L ? 'text-destructive' : lowStock10L ? 'text-warning' : 'text-primary'}`} />
                10L Water Jars
                {zeroStock10L && (
                  <span className="ml-2 text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive font-medium">
                    Out of Stock
                  </span>
                )}
                {lowStock10L && !zeroStock10L && (
                  <span className="ml-2 text-xs px-2 py-1 rounded-full bg-warning/10 text-warning font-medium">
                    Low Stock
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-3xl font-bold ${zeroStock10L ? 'text-destructive' : lowStock10L ? 'text-warning' : ''}`}>
                      {stock10L}
                    </span>
                    <span className="text-sm text-muted-foreground">/ {MAX_STOCK} max</span>
                  </div>
                  {lowStock10L && (
                    <p className="text-sm text-warning flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      Stock is low. Minimum recommended: {MIN_STOCK} jars
                    </p>
                  )}
                  {zeroStock10L && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      Cannot assign deliveries until stock is added
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    onClick={() => updateStock('jar10L', -1)}
                    disabled={updating || stock10L <= 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min="0"
                    max={MAX_STOCK}
                    value={stock10L}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value)) {
                        setStockDirectly('jar10L', value);
                      }
                    }}
                    className="w-20 text-center text-lg font-semibold"
                    disabled={updating}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    onClick={() => updateStock('jar10L', 1)}
                    disabled={updating || stock10L >= MAX_STOCK}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </VendorLayout>
  );
}
