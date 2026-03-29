import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import {
  ArrowDown,
  ArrowUp,
  Building2,
  CheckSquare,
  DollarSign,
  LayoutDashboardIcon,
  TrendingUp,
  User,
} from 'lucide-react';
import { href, Link } from 'react-router';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import type { ChartConfig } from '~/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '~/components/ui/chart';
import { db } from '~/db/index';
import { boardTable, boardTaskTable, companiesTable, peopleTable } from '~/db/schema';
import { hasPremiumAccess, requireUser } from '~/services/whop.server';
import type { Route } from './+types/';

function formatNumber(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return n.toLocaleString();
  return n.toString();
}

export const loader = async ({ params, request }: Route.LoaderArgs) => {
  const { companyId } = params;

  // Check premium access first
  const { user } = await requireUser(request, companyId);
  const userId = user.id;
  const premiumAccess = await hasPremiumAccess({ request, companyId, userId });

  // Calculate date 30 days ago for growth comparison
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

  // Calculate date 12 months ago for chart data
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const twelveMonthsAgoStr = twelveMonthsAgo.toISOString();

  return await db.transaction(async (tx) => {
    // Get all boards for this organization (single query)
    const boards = await tx.query.boardTable.findMany({
      where: eq(boardTable.companyId, companyId),
    });
    const boardIds = boards.map((b) => b.id);

    // Batch all count queries
    const [
      peopleTotalResult,
      companiesTotalResult,
      tasksTotalResult,
      dealsTotalResult,
      peopleLast30Result,
      companiesLast30Result,
      tasksLast30Result,
      dealsLast30Result,
    ] = await Promise.all([
      // Total counts
      tx
        .select({ count: sql<number>`count(*)` })
        .from(peopleTable)
        .where(eq(peopleTable.organizationId, companyId)),
      tx
        .select({ count: sql<number>`count(*)` })
        .from(companiesTable)
        .where(eq(companiesTable.organizationId, companyId)),
      boardIds.length > 0
        ? tx
            .select({ count: sql<number>`count(*)` })
            .from(boardTaskTable)
            .where(inArray(boardTaskTable.boardId, boardIds))
        : Promise.resolve([{ count: 0 }]),
      boardIds.length > 0
        ? tx
            .select({ count: sql<number>`count(*)` })
            .from(boardTaskTable)
            .where(and(inArray(boardTaskTable.boardId, boardIds), eq(boardTaskTable.type, 'pipeline')))
        : Promise.resolve([{ count: 0 }]),

      // Last 30 days counts
      tx
        .select({ count: sql<number>`count(*)` })
        .from(peopleTable)
        .where(and(eq(peopleTable.organizationId, companyId), gte(peopleTable.createdAt, thirtyDaysAgoStr))),
      tx
        .select({ count: sql<number>`count(*)` })
        .from(companiesTable)
        .where(and(eq(companiesTable.organizationId, companyId), gte(companiesTable.createdAt, thirtyDaysAgoStr))),
      boardIds.length > 0
        ? tx
            .select({ count: sql<number>`count(*)` })
            .from(boardTaskTable)
            .where(and(inArray(boardTaskTable.boardId, boardIds), gte(boardTaskTable.createdAt, thirtyDaysAgoStr)))
        : Promise.resolve([{ count: 0 }]),
      boardIds.length > 0
        ? tx
            .select({ count: sql<number>`count(*)` })
            .from(boardTaskTable)
            .where(
              and(
                inArray(boardTaskTable.boardId, boardIds),
                eq(boardTaskTable.type, 'pipeline'),
                gte(boardTaskTable.createdAt, thirtyDaysAgoStr),
              ),
            )
        : Promise.resolve([{ count: 0 }]),
    ]);

    // Extract counts
    const totalPeople = Number(peopleTotalResult[0]?.count || 0);
    const totalCompanies = Number(companiesTotalResult[0]?.count || 0);
    const totalTasks = Number(tasksTotalResult[0]?.count || 0);
    const totalDeals = Number(dealsTotalResult[0]?.count || 0);

    const peopleLast30DaysCount = Number(peopleLast30Result[0]?.count || 0);
    const companiesLast30DaysCount = Number(companiesLast30Result[0]?.count || 0);
    const tasksLast30DaysCount = Number(tasksLast30Result[0]?.count || 0);
    const dealsLast30DaysCount = Number(dealsLast30Result[0]?.count || 0);

    // Calculate growth percentages
    const calculateGrowth = (total: number, recent: number) => {
      const beforePeriod = total - recent;
      return beforePeriod > 0
        ? Number.parseFloat(((recent / beforePeriod) * 100).toFixed(1))
        : recent > 0
          ? 100.0
          : 0.0;
    };

    const peopleGrowth = calculateGrowth(totalPeople, peopleLast30DaysCount);
    const companiesGrowth = calculateGrowth(totalCompanies, companiesLast30DaysCount);
    const tasksGrowth = calculateGrowth(totalTasks, tasksLast30DaysCount);
    const dealsGrowth = calculateGrowth(totalDeals, dealsLast30DaysCount);

    // Generate historical data efficiently - single query per table
    const generateHistoricalData = async () => {
      const months = [];

      // Get all historical data in single queries
      const [peopleHistory, companiesHistory, tasksHistory, dealsHistory] = await Promise.all([
        tx
          .select({
            createdAt: peopleTable.createdAt,
          })
          .from(peopleTable)
          .where(and(eq(peopleTable.organizationId, companyId), gte(peopleTable.createdAt, twelveMonthsAgoStr))),

        tx
          .select({
            createdAt: companiesTable.createdAt,
          })
          .from(companiesTable)
          .where(and(eq(companiesTable.organizationId, companyId), gte(companiesTable.createdAt, twelveMonthsAgoStr))),

        boardIds.length > 0
          ? tx
              .select({
                createdAt: boardTaskTable.createdAt,
              })
              .from(boardTaskTable)
              .where(and(inArray(boardTaskTable.boardId, boardIds), gte(boardTaskTable.createdAt, twelveMonthsAgoStr)))
          : Promise.resolve([]),

        boardIds.length > 0
          ? tx
              .select({
                createdAt: boardTaskTable.createdAt,
              })
              .from(boardTaskTable)
              .where(
                and(
                  inArray(boardTaskTable.boardId, boardIds),
                  eq(boardTaskTable.type, 'pipeline'),
                  gte(boardTaskTable.createdAt, twelveMonthsAgoStr),
                ),
              )
          : Promise.resolve([]),
      ]);

      // Group by month in JavaScript
      const groupByMonth = (data: { createdAt: string | null }[]) => {
        const grouped: Record<string, number> = {};
        for (const item of data) {
          if (!item.createdAt) continue;
          const date = new Date(item.createdAt);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          grouped[monthKey] = (grouped[monthKey] || 0) + 1;
        }
        return grouped;
      };

      const peopleMap = groupByMonth(peopleHistory);
      const companiesMap = groupByMonth(companiesHistory);
      const tasksMap = groupByMonth(tasksHistory);
      const dealsMap = groupByMonth(dealsHistory);

      // Generate 12 months of data
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        months.push({
          month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          people: peopleMap[monthKey] || 0,
          companies: companiesMap[monthKey] || 0,
          tasks: tasksMap[monthKey] || 0,
          deals: dealsMap[monthKey] || 0,
        });
      }

      return months;
    };

    const chartData = await generateHistoricalData();

    // Fetch recent items with relations in single queries
    const [recentPeople, recentCompanies, recentTasks, recentDeals] = await Promise.all([
      tx.query.peopleTable.findMany({
        where: eq(peopleTable.organizationId, companyId),
        orderBy: (peopleTable, { desc }) => [desc(peopleTable.createdAt)],
        limit: 4,
      }),

      tx.query.companiesTable.findMany({
        where: eq(companiesTable.organizationId, companyId),
        orderBy: (companiesTable, { desc }) => [desc(companiesTable.createdAt)],
        limit: 4,
      }),

      boardIds.length > 0
        ? tx.query.boardTaskTable.findMany({
            where: inArray(boardTaskTable.boardId, boardIds),
            with: {
              column: true,
            },
            orderBy: (boardTaskTable, { desc }) => [desc(boardTaskTable.createdAt)],
            limit: 4,
          })
        : Promise.resolve([]),

      boardIds.length > 0
        ? tx.query.boardTaskTable.findMany({
            where: and(inArray(boardTaskTable.boardId, boardIds), eq(boardTaskTable.type, 'pipeline')),
            with: {
              column: true,
            },
            orderBy: (boardTaskTable, { desc }) => [desc(boardTaskTable.createdAt)],
            limit: 4,
          })
        : Promise.resolve([]),
    ]);

    // Add relations for tasks and deals
    const addRelations = async (items: (typeof recentTasks)[0][]) => {
      if (items.length === 0) return;

      const companyIds = [...new Set(items.map((item) => item.companyId).filter(Boolean))].filter(
        (id): id is string => id !== null,
      );
      const personIds = [...new Set(items.map((item) => item.personId).filter(Boolean))].filter(
        (id): id is string => id !== null,
      );

      const [companies, people] = await Promise.all([
        companyIds.length > 0
          ? tx.query.companiesTable.findMany({
              where: inArray(companiesTable.id, companyIds),
            })
          : Promise.resolve([]),
        personIds.length > 0
          ? tx.query.peopleTable.findMany({
              where: inArray(peopleTable.id, personIds),
            })
          : Promise.resolve([]),
      ]);

      const companiesMap = new Map(companies.map((c) => [c.id, c]));
      const peopleMap = new Map(people.map((p) => [p.id, p]));

      for (const item of items) {
        if (item.companyId && companiesMap.has(item.companyId)) {
          Object.assign(item, { company: companiesMap.get(item.companyId) });
        }
        if (item.personId && peopleMap.has(item.personId)) {
          Object.assign(item, { person: peopleMap.get(item.personId) });
        }
      }
    };

    await Promise.all([addRelations(recentTasks), addRelations(recentDeals)]);

    return {
      userId,
      user,
      premiumAccess,
      companyId,
      stats: {
        people: {
          total: totalPeople,
          growth: peopleGrowth,
          last30Days: peopleLast30DaysCount,
        },
        companies: {
          total: totalCompanies,
          growth: companiesGrowth,
          last30Days: companiesLast30DaysCount,
        },
        tasks: {
          total: totalTasks,
          growth: tasksGrowth,
          last30Days: tasksLast30DaysCount,
        },
        deals: {
          total: totalDeals,
          growth: dealsGrowth,
          last30Days: dealsLast30DaysCount,
        },
      },
      chartData,
      recentPeople,
      recentCompanies,
      recentTasks,
      recentDeals,
    };
  });
};

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

const DashboardPage = ({
  loaderData: { stats, chartData, recentPeople, recentCompanies, recentTasks, recentDeals, companyId, user },
}: Route.ComponentProps) => {
  const statsCards = [
    {
      title: 'People',
      value: stats.people.total,
      growth: stats.people.growth,
      icon: User,
      href: href('/dashboard/:companyId/people', { companyId }),
      positive: stats.people.growth >= 0,
    },
    {
      title: 'Companies',
      value: stats.companies.total,
      growth: stats.companies.growth,
      icon: Building2,
      href: href('/dashboard/:companyId/company', { companyId }),
      positive: stats.companies.growth >= 0,
    },
    {
      title: 'Tasks',
      value: stats.tasks.total,
      growth: stats.tasks.growth,
      icon: CheckSquare,
      href: href('/dashboard/:companyId/tasks', { companyId }),
      positive: stats.tasks.growth >= 0,
    },
    {
      title: 'Deals',
      value: stats.deals.total,
      growth: stats.deals.growth,
      icon: TrendingUp,
      href: href('/dashboard/:companyId/tasks', { companyId }),
      positive: stats.deals.growth >= 0,
    },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
            <LayoutDashboardIcon className="h-3.5 w-3.5" />
          </div>
          <h1 className="text-base font-semibold">Dashboard</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 scrollbar-thin">
        <div className="mb-6">
          <h2 className="text-3xl font-semibold">Welcome back, {user.name} 👋</h2>
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
                            ? stats.people.last30Days
                            : stat.title === 'Companies'
                              ? stats.companies.last30Days
                              : stat.title === 'Tasks'
                                ? stats.tasks.last30Days
                                : stats.deals.last30Days,
                        )}{' '}
                        this month
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Chart and Recent Activity - 2 Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
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
                <ChartContainer config={chartConfig} className="h-75 w-full">
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

            {/* Recent Activity */}
            <Card className="bg-muted/30 shadow-sm border border-border col-span-3">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
                  <Link to={href('/dashboard/:companyId/tasks', { companyId })}>
                    <Button variant="ghost" size="sm" className="h-8 text-xs shadow-s">
                      View all
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {[...recentTasks, ...recentDeals].slice(0, 4).map((item) => {
                  const isDeal = 'type' in item && item.type === 'pipeline';

                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted duration-300 transition-colors"
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                          isDeal ? 'bg-primary/10' : 'bg-primary/10'
                        }`}
                      >
                        {isDeal ? (
                          <DollarSign className={`h-3.5 w-3.5 ${isDeal ? 'text-primary' : 'text-primary'}`} />
                        ) : (
                          <CheckSquare className={`h-3.5 w-3.5 ${isDeal ? 'text-primary' : 'text-primary'}`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {item.column && <span>{item.column.name}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {recentTasks.length === 0 && recentDeals.length === 0 && (
                  <div className="text-center py-6">
                    <CheckSquare className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No recent activity</p>
                    <p className="text-xs text-muted-foreground">Start by creating your first task or deal</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Companies, People, and Deals - 3 Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Recent Companies */}
            <Card className="bg-muted/30 shadow border border-border flex flex-col h-full">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Recent Companies</CardTitle>
                  <Link to={href('/dashboard/:companyId/company', { companyId })}>
                    <Button variant="ghost" size="sm" className="h-8 text-xs shadow-s">
                      View all
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                {recentCompanies.slice(0, 4).map((company) => (
                  <Link
                    key={company.id}
                    to={href('/dashboard/:companyId/company/:id', { companyId, id: company.id })}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-muted/50 duration-300 transition-colors"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                      {company.name?.charAt(0) || 'C'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {company.name || 'Unnamed Company'}
                      </p>
                    </div>
                  </Link>
                ))}
                {recentCompanies.length === 0 && (
                  <div className="flex-1 flex items-center justify-center py-6">
                    <div className="text-center">
                      <Building2 className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No companies yet</p>
                      <Link to={href('/dashboard/:companyId/company', { companyId })}>
                        <Button variant="outline" size="sm" className="mt-3 h-8 text-xs">
                          Add first company
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent People */}
            <Card className="bg-muted/30 shadow border border-border flex flex-col h-full">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Recent People</CardTitle>
                  <Link to={href('/dashboard/:companyId/people', { companyId })}>
                    <Button variant="ghost" size="sm" className="h-8 text-xs shadow-s">
                      View all
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                {recentPeople.slice(0, 4).map((person) => (
                  <Link
                    key={person.id}
                    to={href('/dashboard/:companyId/people/:id', { companyId, id: person.id })}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-muted/50 duration-300 transition-colors"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                      {person.name?.charAt(0) || 'P'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {person.name || 'Unnamed Person'}
                      </p>
                    </div>
                  </Link>
                ))}
                {recentPeople.length === 0 && (
                  <div className="flex-1 flex items-center justify-center py-6">
                    <div className="text-center">
                      <User className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No people yet</p>
                      <Link to={href('/dashboard/:companyId/people', { companyId })}>
                        <Button variant="outline" size="sm" className="mt-3 h-8 text-xs">
                          Add first person
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Deals */}
            <Card className="bg-muted/30 shadow border border-border flex flex-col h-full">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Recent Deals</CardTitle>
                  <Link to={href('/dashboard/:companyId/tasks', { companyId })}>
                    <Button variant="ghost" size="sm" className="h-8 text-xs shadow-s">
                      View all
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                {recentDeals.slice(0, 4).map((deal) => {
                  return (
                    <Link
                      key={deal.id}
                      to={href('/dashboard/:companyId/tasks', { companyId })}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-muted/50 duration-300 transition-colors"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-orange-500/10">
                        <TrendingUp className="h-3.5 w-3.5 text-orange-600" />
                      </div>
                      <div className="flex-1 flex items-center min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {deal.name}
                        </p>
                      </div>
                    </Link>
                  );
                })}
                {recentDeals.length === 0 && (
                  <div className="flex-1 flex items-center justify-center py-6">
                    <div className="text-center">
                      <TrendingUp className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No deals yet</p>
                      <Link to={href('/dashboard/:companyId/tasks', { companyId })}>
                        <Button variant="outline" size="sm" className="mt-3 h-8 text-xs">
                          Create first deal
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
