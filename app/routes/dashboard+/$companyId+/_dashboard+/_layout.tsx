import { useEffect } from 'react';
import { data, href, Outlet, redirect } from 'react-router';

import { AppSidebar } from '~/components/layout/app-sidebar';
import { Header } from '~/components/layout/header';
import { ThemeToggle } from '~/components/theme-switcher';
import { SidebarProvider } from '~/components/ui/sidebar';
import { useToast } from '~/components/ui/use-toast';
import { popToast } from '~/services/cookie.server';
import { cn } from '~/utils';
import type { Route } from './+types/_layout';
import { organizationTable, userTable } from '~/db/schema';
import { db } from '~/db';
import { eq } from 'drizzle-orm';
import { hasAccess, hasOrganizationPremiumAccess, verifyWhopToken } from '~/services/whop.server';

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
  // Check if user exists
  const user = await db.query.userTable.findFirst({
    where: eq(userTable.whopUserId, userId),
  });

  // If organization exists, check if it has premium access
  // Organizations must pay for premium access - no individual access allowed

  const hasOrgPremium = await hasOrganizationPremiumAccess(companyId);
  if (!hasOrgPremium) {
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

  return data(
    {
      user,
      toastData,
      organization,
      selectedOrganization: companyId,
    },
    { headers },
  );
};

const DashboardLayout = ({ loaderData }: Route.ComponentProps) => {
  const { user, toastData, organization } = loaderData;
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
      {user && <AppSidebar user={user} organization={organization} />}
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
          <div className="ml-auto flex items-center space-x-4">
            <ThemeToggle />
          </div>
        </Header>

        <main className="flex-1 min-h-0 mt-13 flex flex-col">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
