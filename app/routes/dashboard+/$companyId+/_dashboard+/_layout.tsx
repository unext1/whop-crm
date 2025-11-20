import { useEffect } from 'react';
import { data, href, Outlet, redirect } from 'react-router';

import { and, eq, inArray, sql } from 'drizzle-orm';
import { AppSidebar } from '~/components/layout/app-sidebar';
import { Header } from '~/components/layout/header';
import { SidebarProvider } from '~/components/ui/sidebar';
import { useToast } from '~/components/ui/use-toast';
import { db } from '~/db';
import {
  boardTable,
  boardTaskTable,
  companiesTable,
  formsTable,
  organizationTable,
  peopleTable,
  userTable,
} from '~/db/schema';
import { popToast } from '~/services/cookie.server';
import { hasAccess, hasOrganizationPremiumAccess, verifyWhopToken } from '~/services/whop.server';
import { cn } from '~/utils';
import type { Route } from './+types/_layout';

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { companyId } = params;
  const { userId } = await verifyWhopToken(request);

  const access = await hasAccess({ request, companyId });
  if (!access) {
    throw new Response('Access denied', { status: 403 });
  }

  // Check if organization exists
  const organization = await db.query.organizationTable.findFirst({
    where: eq(organizationTable.id, companyId),
  });

  if (!organization) {
    return redirect(href('/dashboard/:companyId/onboarding/new', { companyId }));
  }
  // Check if user exists for this specific organization
  const user = await db.query.userTable.findFirst({
    where: and(eq(userTable.whopUserId, userId), eq(userTable.organizationId, companyId)),
  });

  // If organization exists, check if it has premium access
  // Organizations must pay for premium access - no individual access allowed

  const hasOrgPremium = await hasOrganizationPremiumAccess(companyId);
  if (!hasOrgPremium) {
    // Check if trial has expired
    if (organization.trialEnd) {
      const trialEndDate = new Date(organization.trialEnd);
      const now = new Date();
      if (now > trialEndDate) {
        // Trial expired, redirect to trial page
        const trialPath = href('/dashboard/:companyId/onboarding/trial', { companyId });
        if (new URL(request.url).pathname !== trialPath) {
          return redirect(trialPath);
        }
      }
    }

    const everHadPremium = organization.hadPremiumBefore;

    if (everHadPremium) {
      // Organization had premium before but lost it - redirect to billing
      const billingPath = href('/dashboard/:companyId/billing', { companyId });
      if (new URL(request.url).pathname !== billingPath) {
        return redirect(billingPath);
      }
    } else {
      // Organization never had premium - redirect to onboarding
      const onboardingPath = href('/dashboard/:companyId/onboarding/new', { companyId });
      if (new URL(request.url).pathname !== onboardingPath) {
        return redirect(onboardingPath);
      }
    }
  }

  const url = new URL(request.url);
  const onboardingNewPath = href('/dashboard/:companyId/onboarding/new', { companyId });

  // Smart redirect logic:
  // 1. If no org exists -> redirect to onboarding/new (step 1: create org)
  // 2. If org exists but no user -> redirect to onboarding/new (step 2: create user)
  // 3. If both exist -> continue to dashboard
  if (!organization) {
    if (url.pathname !== onboardingNewPath) {
      return redirect(onboardingNewPath);
    }
  } else if (!user) {
    if (url.pathname !== onboardingNewPath) {
      return redirect(onboardingNewPath);
    }
  }

  // If both org and user exist, or we're already on onboarding, continue
  const { toast: toastData, headers } = await popToast(request);

  // Optimize all queries using transaction and count queries
  const { allDeals, gettingStarted } = await db.transaction(async (tx) => {
    // Get deals (only need id and name)
    const deals = await tx.query.boardTable.findMany({
      columns: {
        id: true,
        name: true,
      },
      where: and(eq(boardTable.companyId, companyId), eq(boardTable.type, 'pipeline')),
    });

    // Check if getting started is already completed
    const gettingStartedCompleted = organization.gettingStartedCompleted;

    let gettingStartedProgress:
      | {
          hasPerson: boolean;
          hasCompany: boolean;
          hasTask: boolean;
          hasDeal: boolean;
          hasForms: boolean;
        }
      | undefined;
    if (!gettingStartedCompleted) {
      // Get board IDs for task queries
      const boardIds = await tx
        .select({ id: boardTable.id })
        .from(boardTable)
        .where(eq(boardTable.companyId, companyId));

      const boardIdArray = boardIds.map((b) => b.id);

      // Batch all count queries for getting started progress
      const [formsCount, peopleCount, companiesCount, tasksCount, dealsCount] = await Promise.all([
        tx.select({ count: sql<number>`count(*)` }).from(formsTable).where(eq(formsTable.organizationId, companyId)),
        tx.select({ count: sql<number>`count(*)` }).from(peopleTable).where(eq(peopleTable.organizationId, companyId)),
        tx
          .select({ count: sql<number>`count(*)` })
          .from(companiesTable)
          .where(eq(companiesTable.organizationId, companyId)),
        boardIdArray.length > 0
          ? tx
              .select({ count: sql<number>`count(*)` })
              .from(boardTaskTable)
              .where(and(inArray(boardTaskTable.boardId, boardIdArray), eq(boardTaskTable.type, 'tasks')))
          : Promise.resolve([{ count: 0 }]),
        boardIdArray.length > 0
          ? tx
              .select({ count: sql<number>`count(*)` })
              .from(boardTaskTable)
              .where(and(inArray(boardTaskTable.boardId, boardIdArray), eq(boardTaskTable.type, 'pipeline')))
          : Promise.resolve([{ count: 0 }]),
      ]);

      gettingStartedProgress = {
        hasPerson: Number(peopleCount[0]?.count || 0) > 0,
        hasCompany: Number(companiesCount[0]?.count || 0) > 0,
        hasTask: Number(tasksCount[0]?.count || 0) > 0,
        hasDeal: Number(dealsCount[0]?.count || 0) > 0,
        hasForms: Number(formsCount[0]?.count || 0) > 0,
      };
    }

    return {
      allDeals: deals,
      gettingStarted: gettingStartedProgress,
    };
  });

  return data(
    {
      user,
      toastData,
      organization,
      selectedOrganization: companyId,
      allDeals,
      gettingStarted,
    },
    { headers },
  );
};

const DashboardLayout = ({ loaderData }: Route.ComponentProps) => {
  const { user, toastData, organization, allDeals, gettingStarted } = loaderData;
  const { toast } = useToast();

  useEffect(() => {
    if (toastData) {
      toast({
        title: toastData.title ?? 'Success',
        description: toastData.message ?? 'Toast success',
        variant: toastData.variant ?? 'default',
      });
    }
  }, [toastData, toast]);

  return (
    <SidebarProvider>
      {user && <AppSidebar user={user} organization={organization} deals={allDeals} gettingStarted={gettingStarted} />}
      <div
        id="content"
        className={cn(
          'ml-auto w-full max-w-full pb-2',
          'peer-data-[state=collapsed]:w-[calc(100%-var(--sidebar-width-icon)-0rem)]',
          'peer-data-[state=expanded]:w-[calc(100%-var(--sidebar-width))]',
          'transition-[width] duration-200 ease-linear',
          'flex h-svh flex-col',
          'group-data-[scroll-locked=1]/body:h-full',
          'has-[main.fixed-main]:group-data-[scroll-locked=1]/body:h-svh',
        )}
      >
        <Header fixed className=" pr-4  px-2 rounded-none border-b">
          {/* <div className="ml-auto flex items-center space-x-4">
            <ThemeToggle />
          </div> */}
        </Header>

        <main className="flex-1 min-h-0 mt-11 flex flex-col">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
