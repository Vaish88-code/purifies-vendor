import { ReactNode, useMemo, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Home,
  Package,
  Warehouse,
  IndianRupee,
  LogOut,
  Menu,
  Settings,
  Users,
  Repeat,
  BookUser,
  Bell,
  ChevronRight,
  Store,
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Logo } from '@shared/components/Logo';
import { LanguageSelector } from '@shared/components/LanguageSelector';
import { useAuth, useTranslation } from '@shared/contexts/AuthContext';
import { useVendorPendingCounts } from '@shared/hooks/useVendorPendingCounts';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@shared/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@shared/components/ui/sheet';
import { cn } from '@shared/lib/utils';

interface VendorLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', icon: Home, labelKey: 'dashboard' as const, badgeKey: null as null, shortLabel: 'Home' },
  { path: '/orders', icon: Package, labelKey: 'orders' as const, badgeKey: 'orders' as const, shortLabel: 'Orders' },
  {
    path: '/subscription-requests',
    icon: Users,
    labelKey: 'subscriptionRequests' as const,
    badgeKey: 'subscriptionRequests' as const,
    shortLabel: 'Requests',
  },
  { path: '/subscriptions', icon: Repeat, labelKey: 'subscriptions' as const, badgeKey: null as null, shortLabel: 'Active' },
  {
    path: '/subscription-customers',
    icon: BookUser,
    labelKey: 'subscriptionCustomers' as const,
    badgeKey: null as null,
    shortLabel: 'Customers',
  },
  { path: '/inventory', icon: Warehouse, labelKey: 'stock' as const, badgeKey: null as null, shortLabel: 'Stock' },
  { path: '/earnings', icon: IndianRupee, labelKey: 'earnings' as const, badgeKey: null as null, shortLabel: 'Earnings' },
  { path: '/settings', icon: Settings, labelKey: 'shopSettings' as const, badgeKey: null as null, shortLabel: 'Settings' },
];

function navBadgeCount(
  badgeKey: 'orders' | 'subscriptionRequests' | null,
  counts: ReturnType<typeof useVendorPendingCounts>
): number {
  if (badgeKey === 'orders') {
    return counts.pendingOrders + counts.paymentsAwaitingApproval;
  }
  if (badgeKey === 'subscriptionRequests') {
    return counts.subscriptionRequests;
  }
  return 0;
}

function isNavActive(pathname: string, path: string): boolean {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}

function NavBadge({ count, active }: { count: number; active?: boolean }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'text-[10px] min-w-[1.15rem] h-[1.15rem] px-1 rounded-full font-bold flex items-center justify-center shrink-0',
        active ? 'bg-white/25 text-primary-foreground' : 'bg-destructive text-destructive-foreground'
      )}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}

export function VendorLayout({ children }: VendorLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pendingCounts = useVendorPendingCounts();

  const totalPending = useMemo(
    () =>
      pendingCounts.pendingOrders +
      pendingCounts.paymentsAwaitingApproval +
      pendingCounts.subscriptionRequests,
    [pendingCounts]
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const renderNavLink = (
    item: (typeof navItems)[number],
    variant: 'desktop' | 'mobile'
  ) => {
    const active = isNavActive(location.pathname, item.path);
    const badge = navBadgeCount(item.badgeKey, pendingCounts);
    const Icon = item.icon;
    const label = t(item.labelKey);

    if (variant === 'desktop') {
      return (
        <Link
          key={item.path}
          to={item.path}
          title={label}
          className={cn(
            'group relative flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 shrink-0',
            active
              ? 'water-gradient text-primary-foreground shadow-md shadow-primary/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/80'
          )}
        >
          <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary-foreground' : 'text-primary/70 group-hover:text-primary')} />
          <span className="hidden xl:inline">{label}</span>
          <span className="xl:hidden">{item.shortLabel}</span>
          <NavBadge count={badge} active={active} />
        </Link>
      );
    }

    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => setMobileMenuOpen(false)}
        className={cn(
          'flex items-center gap-3 px-3 py-3 rounded-xl transition-all',
          active
            ? 'water-gradient text-primary-foreground shadow-md'
            : 'hover:bg-accent/70'
        )}
      >
        <div
          className={cn(
            'p-2 rounded-lg shrink-0',
            active ? 'bg-white/20' : 'bg-primary/10'
          )}
        >
          <Icon className={cn('h-5 w-5', active ? 'text-primary-foreground' : 'text-primary')} />
        </div>
        <span className="font-medium flex-1 text-left">{label}</span>
        <div className="flex items-center gap-2 shrink-0">
          <NavBadge count={badge} active={active} />
          <ChevronRight className={cn('h-4 w-4 opacity-40', active && 'opacity-80')} />
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-card/85 backdrop-blur-xl">
        <div className="h-1 water-gradient" />

        {/* Top bar */}
        <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden shrink-0 rounded-xl hover:bg-primary/10"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(100vw-2rem,320px)] p-0 flex flex-col">
                <div className="water-gradient px-5 pt-8 pb-6 text-primary-foreground">
                  <SheetHeader className="text-left space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-white/20">
                        <Store className="h-5 w-5" />
                      </div>
                      <SheetTitle className="text-primary-foreground text-base font-semibold">
                        {t('vendorPortal')}
                      </SheetTitle>
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      <div className="h-10 w-10 rounded-full bg-white/25 flex items-center justify-center font-bold text-lg">
                        {user?.name?.charAt(0) || 'V'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{user?.name}</p>
                        <p className="text-xs text-primary-foreground/80">{t('vendorAccount')}</p>
                      </div>
                    </div>
                    {totalPending > 0 && (
                      <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-medium w-fit">
                        <Bell className="h-3.5 w-3.5" />
                        {totalPending} pending action{totalPending !== 1 ? 's' : ''}
                      </div>
                    )}
                  </SheetHeader>
                </div>

                <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                  {navItems.map((item) => renderNavLink(item, 'mobile'))}
                </nav>

                <div className="p-4 border-t space-y-2 bg-muted/30">
                  <LanguageSelector />
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    {t('logout')}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <Link to="/vendor" className="flex items-center gap-2.5 min-w-0 group">
              <div className="lg:hidden shrink-0">
                <Logo size="sm" showText={false} />
              </div>
              <div className="hidden lg:block shrink-0">
                <Logo size="sm" />
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full water-gradient text-primary-foreground shadow-sm">
                <Store className="h-3 w-3" />
                {t('vendorPortal')}
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {totalPending > 0 && (
              <Link
                to="/orders"
                className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full bg-warning/15 text-warning border border-warning/30 hover:bg-warning/25 transition-colors"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-warning" />
                </span>
                {totalPending} pending
              </Link>
            )}

            <div className="hidden md:block">
              <LanguageSelector />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="rounded-full pl-1 pr-2 sm:pr-3 h-9 gap-2 hover:bg-primary/10"
                >
                  <div className="h-8 w-8 rounded-full water-gradient flex items-center justify-center shadow-sm">
                    <span className="text-sm font-bold text-primary-foreground">
                      {user?.name?.charAt(0) || 'V'}
                    </span>
                  </div>
                  <span className="hidden sm:inline text-sm font-medium max-w-[100px] truncate">
                    {user?.name?.split(' ')[0]}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-2">
                  <p className="font-medium truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{t('vendorAccount')}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="cursor-pointer">
                    <Settings className="h-4 w-4 mr-2" />
                    {t('shopSettings')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  {t('logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Desktop pill navigation */}
        <div className="hidden lg:block border-t border-border/40 bg-muted/20">
          <div className="container mx-auto px-4 py-2.5">
            <nav className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              {navItems.map((item) => renderNavLink(item, 'desktop'))}
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
