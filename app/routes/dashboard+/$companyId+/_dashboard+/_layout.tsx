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
import { hasAccess, verifyWhopToken } from '~/services/whop.server';

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { companyId } = params;
  const { userId } = await verifyWhopToken(request);
  const access = await hasAccess({ userId, companyId });
  if (!access) {
    throw new Response('Access denied', { status: 403 });
  }
  // Check if organization exists
  const organization = await db.query.organizationTable.findFirst({
    where: eq(organizationTable.id, companyId),
  });

  const url = new URL(request.url);
  if (!organization && url.pathname !== href('/dashboard/:companyId/onboarding/new', { companyId })) {
    return redirect(href('/dashboard/:companyId/onboarding/new', { companyId }));
  }

  const user = await db.query.userTable.findFirst({
    where: eq(userTable.whopUserId, userId),
  });

  if (!user) {
    return redirect(href('/dashboard/:companyId/onboarding/invited', { companyId }));
  }

  const { toast: toastData, headers } = await popToast(request);

  return data(
    {
      user,
      toastData,
      selectedOrganization: companyId,
    },
    { headers },
  );
};

const DashboardLayout = ({ loaderData }: Route.ComponentProps) => {
  const { user, toastData } = loaderData;
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
      {user && <AppSidebar user={user} />}
      <div
        id="content"
        className={cn(
          'ml-auto w-full max-w-full pb-2',
          'peer-data-[state=collapsed]:w-[calc(100%-var(--sidebar-width-icon)-1rem)]',
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

        <main className="flex-1 mt-13 flex flex-col">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
