import { createSdk } from '@whop/iframe';
import { eq } from 'drizzle-orm';
import { ArrowDown, ArrowUp, Building2, Check, CheckSquare, LayoutDashboardIcon, TrendingUp, User } from 'lucide-react';
import { useState } from 'react';
import { data, Form, href, redirect, useActionData, useNavigate, useNavigation, useParams } from 'react-router';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import type { ChartConfig } from '~/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '~/components/ui/chart';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { db } from '~/db';
import { boardColumnTable, boardTable, organizationTable, userTable } from '~/db/schema';
import { createCheckoutSession } from '~/services/checkout.server';
import { putToast } from '~/services/cookie.server';
import { env } from '~/services/env.server';
import {
  getAuthorizedUserId,
  getPublicUser,
  hasOrganizationPremiumAccess,
  verifyWhopToken,
  whopSdk,
} from '~/services/whop.server';
import type { Route } from './+types/new';

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { companyId } = params;
  const { userId } = await verifyWhopToken(request);

  const authorizedUser = await getAuthorizedUserId({ companyId, regularUserId: userId });
  const whopCompany = await whopSdk.companies.retrieve(companyId);
  // Check if organization exists
  const existingOrg = await db.select().from(organizationTable).where(eq(organizationTable.id, companyId)).limit(1);

  // Check if user profile exists
  const existingUser = await db.select().from(userTable).where(eq(userTable.whopUserId, userId)).limit(1);

  const hasOrg = existingOrg.length > 0;
  const hasUser = existingUser.length > 0;

  // Check if organization already has premium access
  const hasPremiumAccess = hasOrg ? await hasOrganizationPremiumAccess(companyId) : false;

  // Determine starting step based on what exists
  let initialStep = 1;
  if (hasOrg && !hasUser) {
    initialStep = 2; // Skip org creation, go to user profile
  } else if (hasOrg && hasUser) {
    if (hasPremiumAccess) {
      throw redirect(href('/dashboard/:companyId', { companyId }));
    }
    initialStep = 3; // Org and user exist but no premium - go to payment
  }
  // If both exist, redirect to dashboard (onboarding complete)
  if (hasOrg && hasUser && hasPremiumAccess) {
    throw redirect(href('/dashboard/:companyId', { companyId }));
  }

  const monthlyCheckout = await createCheckoutSession(env.WHOP_PREMIUM_PLAN_ID, companyId);
  const annualCheckout = await createCheckoutSession(env.WHOP_ANNUAL_PLAN_ID, companyId);

  return {
    whopUser: {
      id: authorizedUser.id,
      username: authorizedUser.user.username || null,
      name: authorizedUser.user.name,
      email: authorizedUser.user.email,
    },
    initialStep,
    hasOrg,
    hasUser,
    hasPremiumAccess,
    monthlyCheckout,
    annualCheckout,
    whopAppId: env.WHOP_APP_ID,
    whopCompany,
  };
};

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { companyId } = params;
  const { userId } = await verifyWhopToken(request);
  const authorizedUser = await getAuthorizedUserId({ companyId, regularUserId: userId });
  const publicWhopUser = await getPublicUser(userId);

  const formData = await request.formData();
  const intent = formData.get('intent')?.toString();

  if (intent === 'createOrg') {
    const name = formData.get('name')?.toString();
    const teamSize = formData.get('teamSize')?.toString();

    if (!name || name.trim().length === 0) {
      return data({ error: 'Organization name is required', step: 1 } as const, { status: 400 });
    }

    if (!teamSize) {
      return data({ error: 'Team size is required', step: 1 } as const, { status: 400 });
    }

    const org = await db
      .insert(organizationTable)
      .values({
        id: companyId,
        name: name.trim(),
      })
      .returning();

    const newBoard = await db
      .insert(boardTable)
      .values({
        name: 'Pipeline',
        type: 'pipeline',
        companyId: org[0].id,
      })
      .returning();

    await db.insert(boardColumnTable).values([
      { name: '👋 Lead', order: 1, boardId: newBoard[0].id },
      { name: '👍 Qualified', order: 2, boardId: newBoard[0].id },
      { name: '💡 Proposal', order: 3, boardId: newBoard[0].id },
      { name: '💬 Negotiation', order: 4, boardId: newBoard[0].id },
      { name: '🎉 Won', order: 5, boardId: newBoard[0].id },
    ]);

    return data({ success: true, step: 1, message: 'Organization created' } as const);
  }

  if (intent === 'createUser') {
    const firstName = formData.get('firstName')?.toString();
    const lastName = formData.get('lastName')?.toString();

    if (!firstName || !lastName) {
      return data({ error: 'First name and last name are required', step: 2 } as const, { status: 400 });
    }

    const [createdUser] = await db
      .insert(userTable)
      .values({
        email: authorizedUser.user.email || 'user@example.com',
        name: firstName.trim(),
        lastName: lastName.trim(),
        whopUserId: userId,
        organizationId: companyId,
        profilePictureUrl: publicWhopUser.profile_picture?.url || null,
      })
      .returning();

    await db.update(organizationTable).set({ ownerId: createdUser.id }).where(eq(organizationTable.id, companyId));

    // Update the default board to set the owner
    await db.update(boardTable).set({ ownerId: createdUser.id }).where(eq(boardTable.companyId, companyId));

    return data({ success: true, step: 2, message: 'Profile created' } as const);
  }

  if (intent === 'processPayment') {
    // Check if organization already has premium access
    const hasPremiumAccess = await hasOrganizationPremiumAccess(companyId);

    // If they already have premium, redirect to dashboard
    if (hasPremiumAccess) {
      const headers = await putToast({
        title: 'Welcome! 🎉',
        message: 'Your Organization is ready to go',
        variant: 'default',
      });
      return redirect(href('/dashboard/:companyId', { companyId }), { headers });
    }

    const selectedPlan = formData.get('selectedPlan')?.toString();

    if (!selectedPlan || !['monthly', 'annual'].includes(selectedPlan)) {
      return data({ error: 'Please select a valid plan', step: 3 } as const, { status: 400 });
    }

    // Get the appropriate checkout session
    const planId = selectedPlan === 'monthly' ? env.WHOP_PREMIUM_PLAN_ID : env.WHOP_ANNUAL_PLAN_ID;
    const checkoutSession = await createCheckoutSession(planId, companyId);

    if (!checkoutSession) {
      return data({ error: 'Failed to create checkout session', step: 3 } as const, { status: 500 });
    }

    // Return checkout session data for client-side payment processing
    return data({
      success: true,
      step: 3,
      selectedPlan,
      checkoutSession,
      message: `Processing ${selectedPlan} payment`,
    } as const);
  }

  return data({ error: 'Invalid intent' } as const, { status: 400 });
};

function formatNumber(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return n.toLocaleString();
  return n.toString();
}

const chartConfig = {
  people: {
    label: 'People',
    color: 'hsl(var(--chart-1))',
  },
  companies: {
    label: 'Companies',
    color: 'hsl(var(--chart-2))',
  },
  tasks: {
    label: 'Tasks',
    color: 'hsl(var(--chart-3))',
  },
  deals: {
    label: 'Deals',
    color: 'hsl(var(--chart-4))',
  },
} satisfies ChartConfig;

const DashboardMockup = ({ orgName, userName }: { orgName: string; userName: string }) => {
  const statsCards = [
    {
      title: 'People',
      value: 47,
      growth: 12,
      icon: User,
      last30Days: 5,
      positive: true,
    },
    {
      title: 'Companies',
      value: 23,
      growth: 8,
      icon: Building2,
      last30Days: 2,
      positive: true,
    },
    {
      title: 'Tasks',
      value: 156,
      growth: 15,
      icon: CheckSquare,
      last30Days: 23,
      positive: true,
    },
    {
      title: 'Deals',
      value: 12,
      growth: 25,
      icon: TrendingUp,
      last30Days: 4,
      positive: true,
    },
  ];

  const chartData = [
    { month: 'Jan 2024', people: 10, companies: 5, tasks: 20, deals: 2 },
    { month: 'Feb 2024', people: 15, companies: 8, tasks: 35, deals: 4 },
    { month: 'Mar 2024', people: 20, companies: 12, tasks: 50, deals: 5 },
    { month: 'Apr 2024', people: 25, companies: 15, tasks: 70, deals: 6 },
    { month: 'May 2024', people: 30, companies: 18, tasks: 90, deals: 7 },
    { month: 'Jun 2024', people: 35, companies: 20, tasks: 110, deals: 8 },
    { month: 'Jul 2024', people: 38, companies: 21, tasks: 125, deals: 9 },
    { month: 'Aug 2024', people: 40, companies: 22, tasks: 135, deals: 10 },
    { month: 'Sep 2024', people: 42, companies: 22, tasks: 145, deals: 11 },
    { month: 'Oct 2024', people: 44, companies: 23, tasks: 150, deals: 11 },
    { month: 'Nov 2024', people: 46, companies: 23, tasks: 154, deals: 12 },
    { month: 'Dec 2024', people: 47, companies: 23, tasks: 156, deals: 12 },
  ];

  return (
    <div className="overflow-hidden w-full max-w-4xl">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
            <LayoutDashboardIcon className="h-3.5 w-3.5" />
          </div>
          <h1 className="text-base font-semibold">{orgName}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="mb-6">
          <h2 className="text-3xl font-semibold">Welcome back, {userName} 👋</h2>
          <p className="text-base text-muted-foreground">Here's a quick overview of your activity this month.</p>
        </div>
        <div className=" space-y-4">
          {/* Statistics Cards - 4 Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-4">
            {statsCards.map((stat) => {
              const Icon = stat.icon;
              const hasGrowth = Math.abs(stat.growth) > 0;
              return (
                <Card
                  key={stat.title}
                  className="bg-linear-to-b from-muted to-muted/30 shadow col-span-2 border transition-all duration-300 transform"
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      {hasGrowth && (
                        <Badge variant={stat.positive ? 'default' : 'destructive'} className="text-xs gap-1 shadow-s">
                          {stat.positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                          {Math.abs(stat.growth)}%
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="text-xl flex items-center gap-2 font-bold tracking-tight">
                        {formatNumber(stat.value)}{' '}
                        <span className="text-sm font-normal text-muted-foreground">{stat.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        +
                        {formatNumber(
                          stat.title === 'People'
                            ? statsCards[0].last30Days
                            : stat.title === 'Companies'
                              ? statsCards[1].last30Days
                              : stat.title === 'Tasks'
                                ? statsCards[2].last30Days
                                : statsCards[3].last30Days,
                        )}{' '}
                        this month
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Growth Chart */}
          <Card className="bg-muted/30 shadow-sm col-span-4">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Growth Overview</CardTitle>
                  <p className="text-sm text-muted-foreground">12-month trend across all metrics</p>
                </div>
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <AreaChart
                  accessibilityLayer
                  data={chartData}
                  margin={{
                    left: 12,
                    right: 12,
                    top: 12,
                    bottom: 12,
                  }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => value.slice(0, 3)}
                  />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                  <defs>
                    <linearGradient id="fillPeople" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="fillCompanies" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="fillTasks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="fillDeals" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-4))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--chart-4))" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <Area
                    dataKey="deals"
                    type="natural"
                    fill="url(#fillDeals)"
                    fillOpacity={0.4}
                    stroke="hsl(var(--chart-4))"
                    stackId="a"
                  />
                  <Area
                    dataKey="tasks"
                    type="natural"
                    fill="url(#fillTasks)"
                    fillOpacity={0.4}
                    stroke="hsl(var(--chart-3))"
                    stackId="a"
                  />
                  <Area
                    dataKey="companies"
                    type="natural"
                    fill="url(#fillCompanies)"
                    fillOpacity={0.4}
                    stroke="hsl(var(--chart-2))"
                    stackId="a"
                  />
                  <Area
                    dataKey="people"
                    type="natural"
                    fill="url(#fillPeople)"
                    fillOpacity={0.4}
                    stroke="hsl(var(--chart-1))"
                    stackId="a"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

const TaskDetailMockup = () => (
  <div className="flex flex-col overflow-hidden w-full max-w-4xl">
    {/* Header */}
    <div className="flex h-14 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-3">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
          <User className="h-3.5 w-3.5" />
        </div>
        <h1 className="text-base font-semibold">People</h1>
        <Badge variant="secondary" className="h-5 text-xs font-normal">
          3
        </Badge>
      </div>
    </div>

    {/* Content */}
    <div className="flex-1 overflow-auto p-4 scrollbar-thin">
      <div className="rounded-md border border-border overflow-x-scroll">
        {/* Table Header */}
        <div className="border-b border-border bg-muted/30">
          <div className="grid grid-cols-3 gap-3 px-4 py-3 text-xs font-medium text-muted-foreground">
            <div>Person</div>
            <div>Emails</div>
            <div>Phone</div>
          </div>
        </div>

        {/* Table Rows - Only 3 rows to fit better */}
        <div className="divide-y divide-border">
          <div className="grid grid-cols-3 gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
                SJ
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-sm">Sarah</span>
                </div>
                <span className="text-xs text-muted-foreground">Sales</span>
              </div>
            </div>
            <div className="flex gap-1.5 text-xs items-center">
              <span className="mr-1">✉️</span>
              sarah@company.com
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="truncate">+1 (555) 123-4567</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
                MR
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-medium text-sm">Mike</span>
                <span className="text-xs text-muted-foreground">CTO</span>
              </div>
            </div>
            <div className="flex gap-1.5 text-xs items-center">
              <span className="mr-1">✉️</span>
              mike@company.com
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span>+1 (555) 987-6543</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
                AC
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-sm">Alex </span>
                  <Badge variant="outline" className="h-4 text-[10px] px-2 mt-0.5 bg-primary">
                    Whop
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">VP Marketing</span>
              </div>
            </div>
            <div className="flex gap-1.5 text-xs items-center">
              <span className="mr-1">✉️</span>
              alex@company.com
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const SalesFeaturesMockup = () => (
  <div className="w-full max-w-2xl space-y-6">
    {/* Header */}
    <div className="flex h-14 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
          📊
        </div>
        <h1 className="text-base font-semibold">Sales Pipeline</h1>
      </div>
    </div>

    {/* Kanban Board */}
    <div className="flex gap-4 overflow-x-auto scrollbar-thin pb-4">
      {/* Lead Column */}
      <div className="shrink-0 w-64 space-y-3">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-medium">Lead</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">3</span>
        </div>
        <div className="space-y-2">
          <div className="p-3 bg-background border border-border/50 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <div className="text-sm font-medium">Global Solutions Inc</div>
              <div className="text-sm font-semibold">$45K</div>
            </div>
            <div className="text-xs text-muted-foreground">Enterprise software</div>
          </div>
          <div className="p-3 bg-background border border-border/50 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <div className="text-sm font-medium">TechStart Ltd</div>
              <div className="text-sm font-semibold">$12K</div>
            </div>
            <div className="text-xs text-muted-foreground">SaaS platform</div>
          </div>
        </div>
      </div>

      {/* Qualified Column */}
      <div className="shrink-0 w-64 space-y-3">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-medium">Qualified</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">2</span>
        </div>
        <div className="space-y-2">
          <div className="p-3 bg-background border border-border/50 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <div className="text-sm font-medium">DataFlow Corp</div>
              <div className="text-sm font-semibold">$78K</div>
            </div>
            <div className="text-xs text-muted-foreground">Data analytics</div>
          </div>
        </div>
      </div>

      {/* Proposal Column */}
      <div className="shrink-0 w-64 space-y-3">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-medium">Proposal</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">1</span>
        </div>
        <div className="space-y-2">
          <div className="p-3 bg-background border border-border/50 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <div className="text-sm font-medium">CloudTech Systems</div>
              <div className="text-sm font-semibold">$32K</div>
            </div>
            <div className="text-xs text-muted-foreground">Cloud migration</div>
          </div>
        </div>
      </div>

      {/* Won Column */}
      <div className="shrink-0 w-64 space-y-3">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-medium">Won</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">5</span>
        </div>
        <div className="space-y-2">
          <div className="p-3 bg-background border border-border/50 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <div className="text-sm font-medium">InnovateLabs</div>
              <div className="text-sm font-semibold">$55K</div>
            </div>
            <div className="text-xs text-muted-foreground">Product development</div>
          </div>
          <div className="p-3 bg-background border border-border/50 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <div className="text-sm font-medium">NextGen Solutions</div>
              <div className="text-sm font-semibold">$18K</div>
            </div>
            <div className="text-xs text-muted-foreground">Consulting services</div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const OnboardingPage = ({ loaderData }: Route.ComponentProps) => {
  const params = useParams();
  const step = loaderData.initialStep;
  const [orgName, setOrgName] = useState(loaderData.whopCompany?.title);
  const [teamSize, setTeamSize] = useState('');
  const [firstName, setFirstName] = useState(loaderData.whopUser?.name || '');
  const [lastName, setLastName] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{ status: string; [key: string]: unknown } | null>(null);

  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  const navigate = useNavigate();

  const handlePayment = async (plan: 'monthly' | 'annual') => {
    setIsProcessingPayment(true);
    setPaymentResult(null);

    try {
      const iframeSdk = createSdk({ appId: loaderData.whopAppId });

      if (plan === 'monthly') {
        if (!loaderData.monthlyCheckout) {
          throw new Error('Checkout session not available');
        }
        const result = await iframeSdk.inAppPurchase(loaderData.monthlyCheckout);
        if (result.status === 'ok') {
          setTimeout(() => window.location.reload(), 2000);
        }
      } else if (plan === 'annual') {
        if (!loaderData.annualCheckout) {
          throw new Error('Checkout session not available');
        }
        const result = await iframeSdk.inAppPurchase(loaderData.annualCheckout);
        if (result.status === 'ok') {
          setTimeout(() => window.location.reload(), 2000);
        }
      }

      navigate(href('/dashboard/:companyId', { companyId: params.companyId as string }), { replace: true });
    } catch (error) {
      setPaymentResult({ status: 'error', error: String(error) });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const totalSteps = 3;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left Column - Form Content */}
      <div className="flex w-full flex-col lg:w-1/2">
        {/* Header */}
        <div className="flex items-center justify-between px-12 py-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <img src="/logo.png" alt="WHOP CRM" className="h-8 w-8 rounded" />
            </div>
            <span className="text-base font-semibold">CRM</span>
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            {step} of {totalSteps}
          </span>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 flex-col justify-center px-12 py-12">
          {step === 1 && (
            <div className="flex flex-col gap-12">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h1 className="text-3xl font-bold text-foreground">Welcome to your CRM</h1>
                  <p className="text-lg text-muted-foreground">
                    Create your organization workspace to start collaborating with your team and managing deals
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <Form method="post" className="flex flex-col gap-6">
                  <input type="hidden" name="intent" value="createOrg" />

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="name" className="text-sm font-semibold text-foreground">
                        Organization name
                      </Label>
                      <Input
                        id="name"
                        name="name"
                        defaultValue={loaderData.whopCompany.title}
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="Acme Corp"
                        required
                        autoFocus
                        className="h-10 text-sm"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="teamSize" className="text-sm font-semibold text-foreground">
                        How big is your team?
                      </Label>
                      <Select value={teamSize} onValueChange={(value) => setTeamSize(value)} name="teamSize">
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select team size" className="w-full" />
                        </SelectTrigger>
                        <SelectContent className="w-full">
                          <SelectItem value="1-5">1-5 people</SelectItem>
                          <SelectItem value="6-10">6-10 people</SelectItem>
                          <SelectItem value="11-25">11-25 people</SelectItem>
                          <SelectItem value="26-50">26-50 people</SelectItem>
                          <SelectItem value="51-100">51-100 people</SelectItem>
                          <SelectItem value="100+">100+ people</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={isSubmitting || !orgName?.trim() || !teamSize?.trim()}
                    className="h-10 text-sm font-semibold bg-primary hover:bg-primary/90"
                  >
                    {isSubmitting ? 'Creating...' : 'Continue'}
                  </Button>
                </Form>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-12">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h1 className="text-3xl font-bold text-foreground">Set up your profile</h1>
                  <p className="text-lg text-muted-foreground">
                    Add your details so your team can assign tasks to you and stay connected
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <Form method="post" className="flex flex-col gap-6">
                  <input type="hidden" name="intent" value="createUser" />

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="firstName" className="text-sm font-semibold text-foreground">
                        First name
                      </Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="John"
                        required
                        autoFocus
                        className="h-10 text-sm"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="lastName" className="text-sm font-semibold text-foreground">
                        Last name
                      </Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Doe"
                        required
                        className="h-10 text-sm"
                      />
                    </div>
                  </div>

                  {actionData && 'error' in actionData && 'step' in actionData && actionData.step === 2 && (
                    <p className="text-sm text-destructive">{actionData.error}</p>
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitting || !firstName.trim() || !lastName.trim()}
                    className="h-10 text-sm font-semibold bg-primary hover:bg-primary/90"
                  >
                    {isSubmitting ? 'Saving...' : 'Continue'}
                  </Button>
                </Form>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-12">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h1 className="text-3xl font-bold text-foreground">Unlock full team access</h1>
                  <p className="text-lg text-muted-foreground">
                    Get unlimited team members, advanced reporting, and priority support to scale your sales process
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                {loaderData.hasPremiumAccess && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Monthly */}
                      <Card
                        className={`cursor-pointer transition-all border ${
                          selectedPlan === 'monthly'
                            ? 'border-primary bg-primary/5'
                            : 'border-border/50 hover:border-border'
                        }`}
                        onClick={() => setSelectedPlan('monthly')}
                      >
                        <CardContent className="p-4 text-center space-y-1">
                          <div className="text-xs font-medium text-muted-foreground">Monthly</div>
                          <div className="text-xl font-bold text-foreground">$19</div>
                          <div className="text-xs text-muted-foreground">per month</div>
                        </CardContent>
                      </Card>

                      {/* Annual */}
                      <Card
                        className={`cursor-pointer transition-all border relative ${
                          selectedPlan === 'annual'
                            ? 'border-primary bg-primary/5'
                            : 'border-border/50 hover:border-border'
                        }`}
                        onClick={() => setSelectedPlan('annual')}
                      >
                        <CardContent className="p-4 text-center space-y-1">
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="text-xs font-medium text-muted-foreground">Annual</div>
                            <Badge
                              variant="default"
                              className="absolute left-1/2 -translate-x-1/2 -top-3.5 text-xs h-6  text-primary-foreground"
                            >
                              Save 17%
                            </Badge>
                          </div>
                          <div className="text-xl font-bold text-foreground">$190</div>
                          <div className="text-xs text-muted-foreground">per year</div>
                        </CardContent>
                        {selectedPlan === 'annual' && (
                          <div className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                            <Check className="h-3 w-3 text-background" />
                          </div>
                        )}
                      </Card>
                    </div>

                    {/* Feature highlights */}
                    <div className="space-y-3 mb-2">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>Visual sales pipeline</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>Team task management</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>Advanced reporting</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>Priority support</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>Unlimited team members</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>Custom integrations</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {actionData && 'error' in actionData && 'step' in actionData && actionData.step === 3 && (
                  <p className="text-sm text-destructive text-center">{actionData.error}</p>
                )}

                <Form method="post" className="flex flex-col gap-6">
                  <input type="hidden" name="intent" value="processPayment" />
                  {!loaderData.hasPremiumAccess && <input type="hidden" name="selectedPlan" value={selectedPlan} />}

                  <Button
                    type="submit"
                    disabled={isSubmitting || isProcessingPayment}
                    className="h-10 text-sm font-semibold bg-primary hover:bg-primary/90"
                    onClick={() => handlePayment(selectedPlan)}
                  >
                    {isSubmitting
                      ? 'Processing...'
                      : isProcessingPayment
                        ? 'Processing payment...'
                        : loaderData.hasPremiumAccess
                          ? 'Get Started'
                          : selectedPlan === 'monthly'
                            ? 'Subscribe to Monthly Plan'
                            : 'Start Free Today'}
                  </Button>
                </Form>

                {paymentResult && (
                  <div
                    className={`p-4 rounded-md border ${
                      paymentResult.status === 'ok'
                        ? 'bg-muted/50 border-border text-green-700'
                        : 'bg-destructive/5 border-destructive/20 text-destructive'
                    }`}
                  >
                    <pre className="text-xs overflow-auto">{JSON.stringify(paymentResult, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Column - Mockups */}
      <div className="hidden lg:flex w-1/2 flex-col bg-muted/30 px-12 py-12">
        <div className="flex-1 flex flex-col justify-center">
          {step === 1 && <DashboardMockup orgName={orgName} userName={loaderData.whopUser?.name || ''} />}
          {step === 2 && <TaskDetailMockup />}
          {step === 3 && <SalesFeaturesMockup />}

          {/* Explanatory text */}
          <div className="mt-8 text-center">
            {step === 1 && (
              <p className="text-sm text-muted-foreground">
                Your dashboard shows key metrics, growth trends, and recent activity across your business
              </p>
            )}
            {step === 2 && (
              <p className="text-sm text-muted-foreground">
                Organize contacts, companies, and relationships with powerful search and filtering
              </p>
            )}
            {step === 3 && (
              <p className="text-sm text-muted-foreground">
                Track deals through your sales pipeline with visual kanban boards and metrics
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
