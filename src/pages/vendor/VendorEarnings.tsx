import { useEffect, useMemo, useState } from 'react';
import {
  IndianRupee,
  TrendingUp,
  Calendar,
  Clock,
  Users,
  Package,
  Repeat,
  FileDown,
  BarChart3,
  PieChartIcon,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { Button } from '@shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@shared/components/ui/chart';
import { VendorLayout } from '@/components/layouts/VendorLayout';
import { useAuth } from '@shared/contexts/AuthContext';
import { useToast } from '@shared/hooks/use-toast';
import {
  Order,
  Subscription,
  SubscriptionPayment,
  getVendorByUid,
  subscribeToOrdersByVendor,
  subscribeToSubscriptionsByVendor,
  subscribeToSubscriptionPaymentsByVendor,
} from '@shared/lib/firebase/firestore';
import {
  buildVendorAnalyticsReport,
  formatAnalyticsReportText,
  CHART_COLORS,
} from '@shared/utils/vendorAnalytics';

const revenueChartConfig = {
  quickOrders: { label: 'Quick Orders', color: CHART_COLORS.quickOrders },
  subscriptions: { label: 'Subscriptions', color: CHART_COLORS.subscriptions },
} satisfies ChartConfig;

const customerChartConfig = {
  quickOnly: { label: 'Quick order only', color: CHART_COLORS.quickOnly },
  subscriptionOnly: { label: 'Subscription only', color: CHART_COLORS.subscriptionOnly },
  both: { label: 'Both channels', color: CHART_COLORS.both },
} satisfies ChartConfig;

const orderTypeChartConfig = {
  today: { label: 'Today', color: CHART_COLORS.today },
  schedule: { label: 'Scheduled', color: CHART_COLORS.schedule },
  subscriptionDelivery: { label: 'Subscription', color: CHART_COLORS.subscriptionDelivery },
} satisfies ChartConfig;

const jarChartConfig = {
  jar20L: { label: '20L Jars', color: CHART_COLORS.jar20L },
  jar10L: { label: '10L Jars', color: CHART_COLORS.jar10L },
  bottles: { label: 'Bottles', color: CHART_COLORS.bottles },
} satisfies ChartConfig;

const monthlyChartConfig = {
  quick: { label: 'Quick orders', color: CHART_COLORS.quickOrders },
  subscription: { label: 'Subscriptions', color: CHART_COLORS.subscriptions },
} satisfies ChartConfig;

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[220px] text-center px-4">
      <PieChartIcon className="h-10 w-10 text-muted-foreground/30 mb-2" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function AnalyticsPieCard({
  title,
  description,
  data,
  config,
  emptyMessage,
}: {
  title: string;
  description: string;
  data: { name: string; key: string; value: number; fill: string }[];
  config: ChartConfig;
  emptyMessage: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card className="card-shadow border-border/60 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <PieChartIcon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyChart message={emptyMessage} />
        ) : (
          <>
            <ChartContainer config={config} className="mx-auto aspect-square max-h-[240px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={88}
                  paddingAngle={3}
                  strokeWidth={2}
                >
                  {data.map((entry) => (
                    <Cell key={entry.key} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
            <p className="text-center text-sm font-semibold mt-2 text-muted-foreground">
              Total: {typeof total === 'number' && title.includes('Revenue') ? `₹${total.toLocaleString()}` : total.toLocaleString()}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function VendorEarnings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subscriptionPayments, setSubscriptionPayments] = useState<SubscriptionPayment[]>([]);
  const [shopName, setShopName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let ordersReady = false;
    let subsReady = false;
    let payReady = false;

    const maybeDone = () => {
      if (ordersReady && subsReady && payReady) setLoading(false);
    };

    setLoading(true);

    const unsubOrders = subscribeToOrdersByVendor(
      user.id,
      (list) => {
        setOrders(list);
        ordersReady = true;
        maybeDone();
      },
      (err) => {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
        ordersReady = true;
        maybeDone();
      }
    );

    const unsubSubs = subscribeToSubscriptionsByVendor(user.id, (list) => {
      setSubscriptions(list);
      subsReady = true;
      maybeDone();
    });

    const unsubPay = subscribeToSubscriptionPaymentsByVendor(user.id, (list) => {
      setSubscriptionPayments(list);
      payReady = true;
      maybeDone();
    });

    getVendorByUid(user.id)
      .then((v) => setShopName(v?.shopName || ''))
      .catch(() => {});

    return () => {
      unsubOrders();
      unsubSubs();
      unsubPay();
    };
  }, [user?.id, toast]);

  const report = useMemo(
    () => buildVendorAnalyticsReport(orders, subscriptions, subscriptionPayments),
    [orders, subscriptions, subscriptionPayments]
  );

  const handleDownloadReport = () => {
    const text = formatAnalyticsReportText(report, shopName || user?.name);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `purifies-analytics-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast({
      title: 'Report downloaded',
      description: 'Your analytics report has been saved as a text file.',
    });
  };

  if (loading) {
    return (
      <VendorLayout>
        <div className="space-y-6 animate-pulse">
          <div className="h-36 rounded-2xl bg-muted/60" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-muted/60" />
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="h-72 rounded-xl bg-muted/60" />
            <div className="h-72 rounded-xl bg-muted/60" />
          </div>
        </div>
      </VendorLayout>
    );
  }

  return (
    <VendorLayout>
      <div className="space-y-8">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-success/15 via-background to-primary/10 p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-success/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-background/70 px-3 py-1 text-xs font-medium text-success mb-3">
                <BarChart3 className="h-3.5 w-3.5" />
                Business analytics
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold">
                Earnings &amp; <span className="water-gradient-text">Insights</span>
              </h1>
              <p className="text-muted-foreground mt-2 max-w-xl">
                Revenue breakdown, customer reports, quick orders vs subscriptions — visual analysis for your shop.
              </p>
            </div>
            <Button
              size="lg"
              className="water-gradient text-primary-foreground gap-2 shadow-lg shrink-0"
              onClick={handleDownloadReport}
            >
              <FileDown className="h-5 w-5" />
              Download Analysis Report
            </Button>
          </div>
        </section>

        {/* Earnings KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Today', value: report.earnings.today, icon: IndianRupee, gradient: 'from-success/20 to-success/5', iconBg: 'bg-success/20', iconColor: 'text-success' },
            { label: 'This Week', value: report.earnings.thisWeek, icon: TrendingUp, gradient: 'from-primary/20 to-primary/5', iconBg: 'bg-primary/20', iconColor: 'text-primary' },
            { label: 'This Month', value: report.earnings.thisMonth, icon: Calendar, gradient: 'from-secondary/20 to-secondary/5', iconBg: 'bg-secondary/20', iconColor: 'text-secondary' },
            { label: 'Pending', value: report.earnings.pending, icon: Clock, gradient: 'from-warning/20 to-warning/5', iconBg: 'bg-warning/20', iconColor: 'text-warning' },
          ].map((stat) => (
            <Card key={stat.label} className={`card-shadow border-0 bg-gradient-to-br ${stat.gradient}`}>
              <CardContent className="p-5">
                <div className={`p-2 rounded-lg w-fit ${stat.iconBg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
                <p className="text-2xl sm:text-3xl font-bold mt-3 tabular-nums">₹{stat.value.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Customer & order summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Unique Customers', value: report.customers.totalUnique, icon: Users, desc: 'Ordered from your shop' },
            { label: 'Quick Order Users', value: report.customers.quickOrderUsers, icon: ShoppingBag, desc: `${report.orders.quickDelivered} delivered` },
            { label: 'Subscription Users', value: report.customers.subscriptionUsers, icon: Repeat, desc: `${report.customers.activeSubscriptionUsers} active now` },
            { label: 'All-Time Revenue', value: `₹${report.earnings.allTime.toLocaleString()}`, icon: Sparkles, desc: 'Quick + subscription', isText: true },
          ].map((item) => (
            <Card key={item.label} className="card-shadow">
              <CardContent className="p-5">
                <item.icon className="h-5 w-5 text-primary mb-2" />
                <p className={`font-bold tabular-nums ${item.isText ? 'text-xl' : 'text-2xl'}`}>{item.value}</p>
                <p className="text-sm font-medium mt-0.5">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pie charts row */}
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          <AnalyticsPieCard
            title="Revenue Sources"
            description="Quick orders vs subscription income"
            data={report.revenueBySource}
            config={revenueChartConfig}
            emptyMessage="No revenue recorded yet"
          />
          <AnalyticsPieCard
            title="Customer Channels"
            description="How customers buy from you"
            data={report.customersByType}
            config={customerChartConfig}
            emptyMessage="No customers yet"
          />
          <AnalyticsPieCard
            title="Order Types"
            description="Today, scheduled & subscription"
            data={report.orderTypeBreakdown}
            config={orderTypeChartConfig}
            emptyMessage="No orders yet"
          />
          <AnalyticsPieCard
            title="Jars Delivered"
            description="Units from completed orders"
            data={report.jarTypeBreakdown}
            config={jarChartConfig}
            emptyMessage="No deliveries yet"
          />
        </div>

        {/* Bar charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                This Week&apos;s Earnings
              </CardTitle>
              <CardDescription>Daily revenue from orders &amp; subscription payments</CardDescription>
            </CardHeader>
            <CardContent>
              {report.weeklyEarnings.every((d) => d.amount === 0) ? (
                <EmptyChart message="No earnings this week yet" />
              ) : (
                <ChartContainer
                  config={{ amount: { label: 'Revenue', color: CHART_COLORS.quickOrders } }}
                  className="h-[280px] w-full"
                >
                  <BarChart data={report.weeklyEarnings} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} width={48} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'Revenue']} />} />
                    <Bar dataKey="amount" fill={CHART_COLORS.quickOrders} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="card-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-success" />
                6-Month Revenue Trend
              </CardTitle>
              <CardDescription>Quick orders vs subscriptions by month</CardDescription>
            </CardHeader>
            <CardContent>
              {report.monthlyEarnings.every((m) => m.amount === 0) ? (
                <EmptyChart message="No monthly data yet" />
              ) : (
                <ChartContainer config={monthlyChartConfig} className="h-[280px] w-full">
                  <BarChart data={report.monthlyEarnings} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} width={48} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(v) => [`₹${Number(v).toLocaleString()}`, '']} />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="quick" stackId="a" fill="var(--color-quick)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="subscription" stackId="a" fill="var(--color-subscription)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick orders vs subscription report cards */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="card-shadow border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Quick Orders Report
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Total quick orders</span>
                <span className="font-semibold">{report.orders.quickTotal}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Delivered</span>
                <span className="font-semibold">{report.orders.quickDelivered}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Unique customers</span>
                <span className="font-semibold">{report.customers.quickOrderUsers}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Revenue (delivered)</span>
                <span className="font-semibold text-success">₹{report.earnings.quickOrders.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Avg order value</span>
                <span className="font-semibold">₹{report.orders.avgQuickOrderValue.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="card-shadow border-l-4 border-l-success">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Repeat className="h-5 w-5 text-success" />
                Subscription Users Report
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Total subscription customers</span>
                <span className="font-semibold">{report.customers.subscriptionUsers}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Active subscribers</span>
                <span className="font-semibold text-success">{report.customers.activeSubscriptionUsers}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Subscription deliveries</span>
                <span className="font-semibold">{report.orders.subscriptionDeliveries}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Also use quick orders</span>
                <span className="font-semibold">{report.customers.bothChannels}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Subscription revenue</span>
                <span className="font-semibold text-success">₹{report.earnings.subscriptionPayments.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analysis report */}
        <Card className="card-shadow border-2 border-primary/15 overflow-hidden">
          <div className="h-1 water-gradient" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Auto-Generated Analysis Report
            </CardTitle>
            <CardDescription>Key insights from your shop data — updated in real time</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {report.insights.map((insight, i) => (
                <li
                  key={i}
                  className="flex gap-3 p-3 rounded-xl bg-muted/40 border border-border/50 text-sm leading-relaxed"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full water-gradient text-primary-foreground text-xs font-bold">
                    {i + 1}
                  </span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
            <Button variant="outline" className="mt-6 gap-2" onClick={handleDownloadReport}>
              <FileDown className="h-4 w-4" />
              Export full report (.txt)
            </Button>
          </CardContent>
        </Card>
      </div>
    </VendorLayout>
  );
}
