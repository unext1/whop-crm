import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { ArrowDown, ArrowUp, Building2, CheckSquare, User } from 'lucide-react';
import { href, Link, useLoaderData } from 'react-router';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { db } from '~/db/index';
import { boardTable, boardTaskTable, companiesTable, peopleTable } from '~/db/schema';
import { requireUser, verifyWhopToken, whopSdk } from '~/services/whop.server';
import type { Route } from './+types/';

function formatNumber(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return n.toLocaleString();
  return n.toString();
}

export const loader = async ({ params, request }: Route.LoaderArgs) => {
  const { companyId } = params;
  await requireUser(request, companyId);
  const { userId } = await verifyWhopToken(request);
  const { access_level } = await whopSdk.users.checkAccess(companyId, { id: userId });

  // Calculate date 30 days ago for growth comparison
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

  // Fetch total counts
  const [peopleCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(peopleTable)
    .where(eq(peopleTable.organizationId, companyId));
  const totalPeople = Number(peopleCount.count);

  const [companiesCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(companiesTable)
    .where(eq(companiesTable.organizationId, companyId));
  const totalCompanies = Number(companiesCount.count);

  // Get all boards for this organization
  const boards = await db.query.boardTable.findMany({
    where: eq(boardTable.companyId, companyId),
  });
  const boardIds = boards.map((b) => b.id);

  // Count tasks from all boards
  const totalTasks =
    boardIds.length > 0
      ? Number(
          (
            await db
              .select({ count: sql<number>`count(*)` })
              .from(boardTaskTable)
              .where(inArray(boardTaskTable.boardId, boardIds))
          )[0]?.count || 0,
        )
      : 0;

  // Fetch counts from last 30 days for growth calculation
  const [peopleLast30Days] = await db
    .select({ count: sql<number>`count(*)` })
    .from(peopleTable)
    .where(and(eq(peopleTable.organizationId, companyId), gte(peopleTable.createdAt, thirtyDaysAgoStr)));
  const peopleLast30DaysCount = Number(peopleLast30Days.count);

  const [companiesLast30Days] = await db
    .select({ count: sql<number>`count(*)` })
    .from(companiesTable)
    .where(and(eq(companiesTable.organizationId, companyId), gte(companiesTable.createdAt, thirtyDaysAgoStr)));
  const companiesLast30DaysCount = Number(companiesLast30Days.count);

  const tasksLast30DaysCount =
    boardIds.length > 0
      ? Number(
          (
            await db
              .select({ count: sql<number>`count(*)` })
              .from(boardTaskTable)
              .where(and(inArray(boardTaskTable.boardId, boardIds), gte(boardTaskTable.createdAt, thirtyDaysAgoStr)))
          )[0]?.count || 0,
        )
      : 0;

  // Calculate growth percentages (based on previous period)
  const peopleBefore30Days = totalPeople - peopleLast30DaysCount;
  const peopleGrowth =
    peopleBefore30Days > 0
      ? Number.parseFloat(((peopleLast30DaysCount / peopleBefore30Days) * 100).toFixed(1))
      : peopleLast30DaysCount > 0
        ? 100.0
        : 0.0;

  const companiesBefore30Days = totalCompanies - companiesLast30DaysCount;
  const companiesGrowth =
    companiesBefore30Days > 0
      ? Number.parseFloat(((companiesLast30DaysCount / companiesBefore30Days) * 100).toFixed(1))
      : companiesLast30DaysCount > 0
        ? 100.0
        : 0.0;

  const tasksBefore30Days = totalTasks - tasksLast30DaysCount;
  const tasksGrowth =
    tasksBefore30Days > 0
      ? Number.parseFloat(((tasksLast30DaysCount / tasksBefore30Days) * 100).toFixed(1))
      : tasksLast30DaysCount > 0
        ? 100.0
        : 0.0;

  // Fetch recent items
  const recentPeople = await db.query.peopleTable.findMany({
    where: eq(peopleTable.organizationId, companyId),
    orderBy: (peopleTable, { desc }) => [desc(peopleTable.createdAt)],
    limit: 5,
  });

  const recentCompanies = await db.query.companiesTable.findMany({
    where: eq(companiesTable.organizationId, companyId),
    orderBy: (companiesTable, { desc }) => [desc(companiesTable.createdAt)],
    limit: 5,
  });

  // Fetch recent tasks from all boards
  const recentTasks =
    boardIds.length > 0
      ? await db.query.boardTaskTable.findMany({
          where: inArray(boardTaskTable.boardId, boardIds),
          with: {
            column: true,
          },
          orderBy: (boardTaskTable, { desc }) => [desc(boardTaskTable.createdAt)],
          limit: 3,
        })
      : [];

  // Fetch company and person relations for recent tasks
  if (recentTasks.length > 0) {
    for (const task of recentTasks) {
      if (task.companyId) {
        const company = await db.query.companiesTable.findFirst({
          where: eq(companiesTable.id, task.companyId),
        });
        if (company) {
          Object.assign(task, { company });
        }
      }
      if (task.personId) {
        const person = await db.query.peopleTable.findFirst({
          where: eq(peopleTable.id, task.personId),
        });
        if (person) {
          Object.assign(task, { person });
        }
      }
    }
  }

  return {
    userId,
    access_level,
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
    },
    recentPeople,
    recentCompanies,
    recentTasks,
  };
};

const DashboardPage = () => {
  const { stats, recentPeople, recentCompanies, recentTasks, companyId } = useLoaderData<typeof loader>();

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
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold">Dashboard</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {statsCards.map((stat) => {
            const Icon = stat.icon;
            const hasGrowth = stat.growth > 0;
            return (
              <Card key={stat.title} className="bg-muted/30 backdrop-blur-md border shadow-sm">
                <CardHeader className="border-0 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-muted-foreground text-sm font-medium">{stat.title}</CardTitle>
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl font-medium text-foreground tracking-tight">
                      {formatNumber(stat.value)}
                    </span>
                    {hasGrowth && (
                      <Badge variant={stat.positive ? 'default' : 'destructive'} className="h-5 text-xs gap-1">
                        {stat.positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        {stat.growth}%
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2 border-t pt-2.5">
                    Last 30 days:{' '}
                    <span className="font-medium text-foreground">
                      {formatNumber(
                        stat.title === 'People'
                          ? stats.people.last30Days
                          : stat.title === 'Companies'
                            ? stats.companies.last30Days
                            : stats.tasks.last30Days,
                      )}
                    </span>{' '}
                    new
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Items Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent People */}
          <Card className="bg-muted/30 backdrop-blur-md border shadow-sm">
            <CardHeader className="border-0 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Recent People</CardTitle>
                <Link to={href('/dashboard/:companyId/people', { companyId })}>
                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                    View all
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentPeople.length === 0 ? (
                <div className="text-center py-8">
                  <User className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No people yet</p>
                  <Link to={href('/dashboard/:companyId/people', { companyId })}>
                    <Button variant="outline" size="sm" className="mt-4 h-8 text-xs">
                      Add first person
                    </Button>
                  </Link>
                </div>
              ) : (
                recentPeople.map((person) => (
                  <Link
                    key={person.id}
                    to={href('/dashboard/:companyId/people/:id', { companyId, id: person.id })}
                    className="flex items-center gap-2.5 p-2 rounded-md hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
                      {person.name?.charAt(0) || 'P'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {person.name || 'Unnamed Person'}
                      </p>
                      {person.jobTitle && <p className="text-xs text-muted-foreground truncate">{person.jobTitle}</p>}
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          {/* Recent Companies */}
          <Card className="bg-muted/30 backdrop-blur-md border shadow-sm">
            <CardHeader className="border-0 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Recent Companies</CardTitle>
                <Link to={href('/dashboard/:companyId/company', { companyId })}>
                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                    View all
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentCompanies.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No companies yet</p>
                  <Link to={href('/dashboard/:companyId/company', { companyId })}>
                    <Button variant="outline" size="sm" className="mt-4 h-8 text-xs">
                      Add first company
                    </Button>
                  </Link>
                </div>
              ) : (
                recentCompanies.map((company) => (
                  <Link
                    key={company.id}
                    to={href('/dashboard/:companyId/company/:id', { companyId, id: company.id })}
                    className="flex items-center gap-2.5 p-2 rounded-md hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
                      {company.name?.charAt(0) || 'C'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {company.name || 'Unnamed Company'}
                      </p>
                      {company.industry && <p className="text-xs text-muted-foreground truncate">{company.industry}</p>}
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          {/* Recent Tasks */}
          <Card className="bg-muted/30 backdrop-blur-md border shadow-sm">
            <CardHeader className="border-0 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Recent Tasks</CardTitle>
                <Link to={href('/dashboard/:companyId/tasks', { companyId })}>
                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                    View all
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentTasks.length === 0 ? (
                <div className="text-center py-8">
                  <CheckSquare className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No tasks yet</p>
                  <Link to={href('/dashboard/:companyId/tasks', { companyId })}>
                    <Button variant="outline" size="sm" className="mt-4 h-8 text-xs">
                      Create first task
                    </Button>
                  </Link>
                </div>
              ) : (
                recentTasks.map((task) => {
                  const taskWithRelations = task as typeof task & {
                    company?: { id: string; name: string };
                    person?: { id: string; name: string };
                  };
                  return (
                    <Link
                      key={task.id}
                      to={href('/dashboard/:companyId/tasks', { companyId })}
                      className="flex items-start gap-2.5 p-2 rounded-md hover:bg-muted/50 transition-colors group"
                    >
                      <CheckSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {task.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {task.column && (
                            <Badge variant="secondary" className="h-4 text-[10px] px-1.5">
                              {task.column.name}
                            </Badge>
                          )}
                          {taskWithRelations.company && (
                            <span className="text-xs text-muted-foreground truncate">
                              {taskWithRelations.company.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
