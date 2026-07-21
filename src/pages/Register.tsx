import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Phone, Lock, Check } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@shared/components/ui/select';
import { Logo } from '@shared/components/Logo';
import { LanguageSelector } from '@shared/components/LanguageSelector';
import { LocationPinPicker, type LocationPinValue } from '@shared/components/location/LocationPinPicker';
import { useAuth, useTranslation, Language } from '@shared/contexts/AuthContext';
import { useToast } from '@shared/hooks/use-toast';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [state, setState] = useState('');
  const [location, setLocation] = useState<LocationPinValue | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('en');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const t = useTranslation();

  const handleLocationChange = (value: LocationPinValue) => {
    setLocation(value);
    setAddress(value.address);
    if (value.suggestedState && !state) setState(value.suggestedState);
    if (value.suggestedPincode && !pincode) setPincode(value.suggestedPincode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast({ title: 'Name is required', description: 'Please enter your full name', variant: 'destructive' });
      return;
    }

    if (!shopName.trim()) {
      toast({ title: 'Shop name is required', description: 'Please enter your shop name', variant: 'destructive' });
      return;
    }

    if (phone.length !== 10) {
      toast({ title: 'Invalid phone number', description: 'Please enter a valid 10-digit phone number', variant: 'destructive' });
      return;
    }

    if (!location) {
      toast({ title: 'Location required', description: 'Please pin your shop location on the map', variant: 'destructive' });
      return;
    }

    if (!address.trim()) {
      toast({ title: 'Address is required', description: 'Pin your shop on the map to fill the address', variant: 'destructive' });
      return;
    }

    if (!state.trim()) {
      toast({ title: 'State is required', description: 'Please enter your state', variant: 'destructive' });
      return;
    }

    const cleanedPincode = pincode.replace(/\D/g, '');
    if (cleanedPincode.length !== 6) {
      toast({ title: 'Invalid pincode', description: 'Please enter a valid 6-digit pincode', variant: 'destructive' });
      return;
    }

    if (password.length < 6) {
      toast({ title: 'Password too short', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: 'Passwords do not match', description: 'Please make sure both passwords are the same', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const result = await register(
        phone,
        password,
        selectedLanguage,
        fullName.trim(),
        'vendor',
        address.trim(),
        cleanedPincode,
        state.trim(),
        shopName.trim(),
        location.latitude,
        location.longitude,
        location.city
      );
      setIsLoading(false);

      if (result.success) {
        toast({
          title: 'Registration successful!',
          description: result.error || 'Your vendor account is pending approval.',
        });
        setTimeout(() => navigate('/dashboard'), 500);
      } else {
        toast({
          title: 'Registration failed',
          description: result.error || 'Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error: unknown) {
      setIsLoading(false);
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      toast({ title: 'Registration error', description: message, variant: 'destructive' });
    }
  };

  const passwordMatch = password && confirmPassword && password === confirmPassword;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="p-4 flex justify-between items-center">
        <Logo />
        <LanguageSelector />
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg card-shadow animate-slide-up">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl font-bold">{t('register')}</CardTitle>
            <CardDescription>Create your vendor account to manage your water delivery shop</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Owner Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shopName">Shop Name *</Label>
                <Input
                  id="shopName"
                  type="text"
                  placeholder="Enter your shop name"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t('phone')}</Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span className="text-sm font-medium">+91</span>
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="pl-20"
                    maxLength={10}
                  />
                </div>
              </div>

              <LocationPinPicker value={location} onChange={handleLocationChange} />

              <div className="space-y-2">
                <Label htmlFor="address">Shop Address *</Label>
                <Input
                  id="address"
                  type="text"
                  placeholder="Filled from map pin — you can edit if needed"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Input
                    id="state"
                    type="text"
                    placeholder="Enter state"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode *</Label>
                  <Input
                    id="pincode"
                    type="tel"
                    placeholder="6-digit pincode"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t('password')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  {passwordMatch && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-success" />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">{t('selectLanguage')}</Label>
                <Select value={selectedLanguage} onValueChange={(v) => setSelectedLanguage(v as Language)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="hi">हिंदी (Hindi)</SelectItem>
                    <SelectItem value="mr">मराठी (Marathi)</SelectItem>
                    <SelectItem value="kn">ಕನ್ನಡ (Kannada)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                className="w-full water-gradient text-primary-foreground font-semibold"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? 'Creating account...' : t('register')}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                {t('existingUser')}{' '}
                <Link to="/login" className="text-primary font-medium hover:underline">
                  {t('login')}
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
