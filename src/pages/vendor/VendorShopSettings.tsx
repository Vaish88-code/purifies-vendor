import { useState, useEffect } from 'react';
import {
  Edit,
  Save,
  X,
  Image as ImageIcon,
  MapPin,
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card';
import { VendorLayout } from '@/components/layouts/VendorLayout';
import { useAuth } from '@shared/contexts/AuthContext';
import { getVendorByUid, updateVendorDocument, Vendor } from '@shared/lib/firebase/firestore';
import { useToast } from '@shared/hooks/use-toast';

export default function VendorShopSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingShopDetails, setIsEditingShopDetails] = useState(false);
  const [shopDetailsForm, setShopDetailsForm] = useState({
    shopName: '',
    address: '',
    city: '',
    state: '',
    phone: '',
    pincode: '',
    upiId: '',
  });
  const [shopImageUrl, setShopImageUrl] = useState<string>('');
  const [shopImagePreview, setShopImagePreview] = useState<string | null>(null);
  const [validatingImageUrl, setValidatingImageUrl] = useState(false);
  const [savingShopDetails, setSavingShopDetails] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

  const deriveCityFromAddress = (address?: string | null): string => {
    if (!address) return '';
    const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
    if (!parts.length) return '';
    return parts[parts.length - 1];
  };

  useEffect(() => {
    const fetchVendorData = async () => {
      if (user?.id) {
        try {
          const vendorData = await getVendorByUid(user.id);
          setVendor(vendorData);
          if (vendorData) {
            setShopDetailsForm({
              shopName: vendorData.shopName || '',
              address: vendorData.address || '',
              city: vendorData.city || deriveCityFromAddress(vendorData.address),
              state: vendorData.state || '',
              phone: vendorData.phone || '',
              pincode: vendorData.pincode || '',
              upiId: vendorData.upiId || '',
            });
            if (vendorData.shopImage && vendorData.shopImage.startsWith('https://')) {
              setShopImageUrl(vendorData.shopImage);
              setShopImagePreview(vendorData.shopImage);
            } else {
              setShopImageUrl('');
              setShopImagePreview(null);
            }
          }
        } catch (error) {
          console.error('Error fetching vendor data:', error);
          toast({
            title: 'Error',
            description: 'Failed to load shop details. Please try again.',
            variant: 'destructive',
          });
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchVendorData();
  }, [user?.id, toast]);

  const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value.trim();
    setShopImageUrl(url);
    
    if (!url) {
      setShopImagePreview(null);
      return;
    }
    
    try {
      const urlObj = new URL(url);
      const validProtocols = ['http:', 'https:'];
      if (!validProtocols.includes(urlObj.protocol)) {
        toast({
          title: 'Invalid URL',
          description: 'Please enter a valid HTTP or HTTPS image URL.',
          variant: 'destructive',
        });
        setShopImagePreview(null);
        return;
      }
      
      setValidatingImageUrl(true);
      const img = new Image();
      img.onload = () => {
        setShopImagePreview(url);
        setValidatingImageUrl(false);
      };
      img.onerror = () => {
        toast({
          title: 'Invalid Image URL',
          description: 'Could not load image from this URL. Please check the URL and try again.',
          variant: 'destructive',
        });
        setShopImagePreview(null);
        setValidatingImageUrl(false);
      };
      img.src = url;
    } catch (error) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid image URL (e.g., https://example.com/image.jpg)',
        variant: 'destructive',
      });
      setShopImagePreview(null);
    }
  };

  const handleSaveShopDetails = async () => {
    if (!vendor || !user?.id) return;

    if (user.id !== vendor.uid) {
      toast({
        title: 'Error',
        description: 'User authentication mismatch. Please log out and log in again.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSavingShopDetails(true);
      
      const baseAddress = shopDetailsForm.address.trim();
      const cityPart = shopDetailsForm.city.trim();
      const fullAddress =
        cityPart && baseAddress && !baseAddress.toLowerCase().includes(cityPart.toLowerCase())
          ? `${baseAddress}, ${cityPart}`
          : baseAddress;

      const updates: any = {
        shopName: shopDetailsForm.shopName.trim(),
        address: fullAddress,
        city: shopDetailsForm.city.trim() || null,
        state: shopDetailsForm.state.trim() || null,
        phone: shopDetailsForm.phone.trim(),
        pincode: shopDetailsForm.pincode.trim() || null,
        upiId: shopDetailsForm.upiId.trim() || null,
      };
      
      const trimmedUrl = shopImageUrl.trim();
      if (trimmedUrl) {
        try {
          const urlObj = new URL(trimmedUrl);
          if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
            updates.shopImage = trimmedUrl;
          } else {
            throw new Error('Invalid URL protocol. Use http:// or https://');
          }
        } catch (urlError: any) {
          toast({
            title: 'Invalid Image URL',
            description: urlError.message || 'Please enter a valid image URL.',
            variant: 'destructive',
          });
          setSavingShopDetails(false);
          return;
        }
      } else {
        if (vendor.shopImage) {
          updates.shopImage = null;
        }
      }
      
      await updateVendorDocument(vendor.uid, updates, false);
      const updatedVendor = await getVendorByUid(vendor.uid);
      
      if (!updatedVendor) {
        throw new Error('Failed to retrieve updated vendor data');
      }
      
      setVendor(updatedVendor);
      setShopDetailsForm({
        shopName: updatedVendor.shopName || '',
        address: updatedVendor.address || '',
        city: updatedVendor.city || deriveCityFromAddress(updatedVendor.address),
        state: updatedVendor.state || '',
        phone: updatedVendor.phone || '',
        pincode: updatedVendor.pincode || '',
        upiId: updatedVendor.upiId || '',
      });
      
      if (updatedVendor.shopImage) {
        setShopImageUrl(updatedVendor.shopImage);
        setShopImagePreview(updatedVendor.shopImage);
      } else {
        setShopImageUrl('');
        setShopImagePreview(null);
      }
      
      setIsEditingShopDetails(false);
      
      toast({
        title: 'Shop Details Updated',
        description: 'Your shop information has been updated successfully.',
      });
    } catch (error: any) {
      console.error('Error saving shop details:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save shop details. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingShopDetails(false);
      setValidatingImageUrl(false);
    }
  };

  if (loading) {
    return (
      <VendorLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </VendorLayout>
    );
  }

  return (
    <VendorLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Shop Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your shop details and information
          </p>
        </div>

        <Card className={`card-shadow ${isEditingShopDetails ? 'border-2 border-primary/30 bg-muted/20' : ''}`}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Shop Details</CardTitle>
              {isEditingShopDetails && (
                <p className="text-sm text-primary mt-1">Editing mode — unsaved changes will be lost if you cancel</p>
              )}
            </div>
            {!isEditingShopDetails ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingShopDetails(true)}
                className="gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit Shop Details
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditingShopDetails(false);
                    if (vendor) {
                      setShopDetailsForm({
                        shopName: vendor.shopName || '',
                        address: vendor.address || '',
                        phone: vendor.phone || '',
                        pincode: vendor.pincode || '',
                        upiId: vendor.upiId || '',
                      });
                      if (vendor.shopImage && vendor.shopImage.startsWith('http')) {
                        setShopImageUrl(vendor.shopImage);
                        setShopImagePreview(vendor.shopImage);
                      } else {
                        setShopImageUrl('');
                        setShopImagePreview(null);
                      }
                    }
                    setValidatingImageUrl(false);
                  }}
                  className="gap-2"
                  disabled={savingShopDetails || validatingImageUrl}
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveShopDetails}
                  disabled={savingShopDetails || validatingImageUrl || !shopDetailsForm.shopName.trim() || !shopDetailsForm.address.trim() || !shopDetailsForm.phone.trim()}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {savingShopDetails ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {isEditingShopDetails ? (
              <div className="space-y-6">
                {/* Shop Image URL Input */}
                <div className="space-y-2">
                  <Label htmlFor="shopImageUrl">Shop Image URL</Label>
                  <div className="flex items-start gap-4">
                    {shopImagePreview && (
                      <div className="relative flex-shrink-0">
                        <img
                          src={shopImagePreview}
                          alt="Shop preview"
                          className="w-32 h-32 object-cover rounded-lg border-2 border-border"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        {validatingImageUrl && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
                            <div className="text-xs text-muted-foreground">Validating...</div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <Input
                        id="shopImageUrl"
                        type="url"
                        placeholder="https://example.com/shop-image.jpg"
                        value={shopImageUrl}
                        onChange={handleImageUrlChange}
                        disabled={savingShopDetails || validatingImageUrl}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter the direct URL of your shop image. Supported formats: JPG, PNG, GIF, WebP, SVG
                      </p>
                      {validatingImageUrl && (
                        <p className="text-sm text-primary mt-1">Validating image URL...</p>
                      )}
                      {shopImageUrl && !shopImagePreview && !validatingImageUrl && (
                        <p className="text-sm text-warning mt-1">⚠️ Image validation failed. Please check the URL.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Shop Name */}
                <div className="space-y-2">
                  <Label htmlFor="shopName">Shop Name *</Label>
                  <Input
                    id="shopName"
                    type="text"
                    placeholder="Enter shop name"
                    value={shopDetailsForm.shopName}
                    onChange={(e) => setShopDetailsForm({ ...shopDetailsForm, shopName: e.target.value })}
                    disabled={savingShopDetails || validatingImageUrl}
                    required
                  />
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <Label htmlFor="address">Shop Address *</Label>
                  <Input
                    id="address"
                    type="text"
                    placeholder="House / Flat, Street, Area"
                    value={shopDetailsForm.address}
                    onChange={(e) => setShopDetailsForm({ ...shopDetailsForm, address: e.target.value })}
                    disabled={savingShopDetails || validatingImageUrl}
                    required
                  />
                </div>

                {/* City / State / Pincode */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      type="text"
                      placeholder="e.g. Kolhapur"
                      value={shopDetailsForm.city}
                      onChange={(e) => setShopDetailsForm({ ...shopDetailsForm, city: e.target.value })}
                      disabled={savingShopDetails || validatingImageUrl}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      type="text"
                      placeholder="e.g. Maharashtra"
                      value={shopDetailsForm.state}
                      onChange={(e) => setShopDetailsForm({ ...shopDetailsForm, state: e.target.value })}
                      disabled={savingShopDetails || validatingImageUrl}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pincode">Shop Pincode</Label>
                    <Input
                      id="pincode"
                      type="text"
                      placeholder="e.g. 400001"
                      value={shopDetailsForm.pincode}
                      onChange={(e) => setShopDetailsForm({ ...shopDetailsForm, pincode: e.target.value })}
                      disabled={savingShopDetails || validatingImageUrl}
                    />
                    <p className="text-xs text-muted-foreground">
                      Customers near your city and pincode will see this shop first.
                    </p>
                  </div>
                </div>

                {/* Phone Number */}
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Enter phone number"
                    value={shopDetailsForm.phone}
                    onChange={(e) => setShopDetailsForm({ ...shopDetailsForm, phone: e.target.value })}
                    disabled={savingShopDetails || validatingImageUrl}
                    required
                  />
                </div>

                {/* UPI ID for receiving payments */}
                <div className="space-y-2">
                  <Label htmlFor="upiId">UPI ID</Label>
                  <Input
                    id="upiId"
                    type="text"
                    placeholder="vendor@upi or 9876543210@paytm"
                    value={shopDetailsForm.upiId}
                    onChange={(e) => setShopDetailsForm({ ...shopDetailsForm, upiId: e.target.value })}
                    disabled={savingShopDetails || validatingImageUrl}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your UPI ID for receiving direct payments. Required for Pay Now (UPI) option.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Shop Image Display */}
                {vendor?.shopImage ? (
                  <div className="space-y-2">
                    <Label>Shop Image</Label>
                    <div className="relative w-full max-w-md">
                      <img
                        src={vendor.shopImage}
                        alt={vendor.shopName || 'Shop image'}
                        className="w-full h-48 object-cover rounded-lg border-2 border-border"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Shop Image</Label>
                    <div className="w-full max-w-md h-48 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-muted/30">
                      <div className="text-center">
                        <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No shop image uploaded</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Shop Details Display */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Shop Name</Label>
                    <p className="font-semibold mt-1">{vendor?.shopName || 'Not set'}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Phone Number</Label>
                    <p className="font-semibold mt-1">{vendor?.phone || 'Not set'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-sm text-muted-foreground">Shop Address</Label>
                    <p className="font-semibold mt-1">{vendor?.address || 'Not set'}</p>
                    {vendor?.pincode && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Pincode: {vendor.pincode}
                      </p>
                    )}
                    {/* Set shop location from GPS - for accurate delivery map */}
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (!vendor || !navigator.geolocation) return;
                          setSavingLocation(true);
                          try {
                            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                              navigator.geolocation.getCurrentPosition(resolve, reject, {
                                enableHighAccuracy: true,
                                timeout: 15000,
                                maximumAge: 0,
                              });
                            });
                            await updateVendorDocument(vendor.uid, {
                              latitude: pos.coords.latitude,
                              longitude: pos.coords.longitude,
                            });
                            setVendor({ ...vendor, latitude: pos.coords.latitude, longitude: pos.coords.longitude });
                            toast({
                              title: 'Location saved',
                              description: 'Delivery person will see accurate shop location on map.',
                            });
                          } catch (err: any) {
                            toast({
                              title: 'Could not get location',
                              description: err?.message || 'Please allow location access and try again.',
                              variant: 'destructive',
                            });
                          } finally {
                            setSavingLocation(false);
                          }
                        }}
                        disabled={savingLocation}
                        className="gap-1.5"
                      >
                        <MapPin className="h-4 w-4" />
                        {savingLocation ? 'Getting location...' : vendor?.latitude != null ? 'Update shop location from GPS' : 'Set shop location from GPS'}
                      </Button>
                      {vendor?.latitude != null && vendor?.longitude != null && (
                        <span className="text-xs text-muted-foreground">
                          Saved: {vendor.latitude.toFixed(5)}, {vendor.longitude.toFixed(5)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">UPI ID</Label>
                    <p className="font-semibold mt-1 font-mono">{vendor?.upiId || 'Not set'}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </VendorLayout>
  );
}
