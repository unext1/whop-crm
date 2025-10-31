import { eq } from 'drizzle-orm';
import { useLoaderData } from 'react-router';
import { db } from '~/db/index';
import { companiesTable } from '~/db/schema';
import { verifyWhopToken, whopSdk } from '~/services/whop.server';
import type { Route } from './+types/';
import { parseAsInteger, useQueryStates } from 'nuqs';
import { useTransition } from 'react';

export const loader = async ({ params, request }: Route.LoaderArgs) => {
  const { companyId } = params;
  const url = new URL(request.url);
  const counter = Number(url.searchParams.get('counter'));
  const { userId } = await verifyWhopToken(request);
  const { access_level } = await whopSdk.users.checkAccess(companyId, { id: userId });

  // Fetch companies for this organization
  const companies = await db.query.companiesTable.findMany({
    where: eq(companiesTable.organizationId, companyId),
    orderBy: (companiesTable, { desc }) => [desc(companiesTable.createdAt)],
  });

  return { userId, access_level, companyId, companies, counter };
};

const DashboardPage = () => {
  const {
    userId: _userId,
    access_level: _access_level,
    companyId: _companyId,
    counter: serverCounter,
  } = useLoaderData<typeof loader>();
  const [isLoading, startTransition] = useTransition();
  const [{ counter }, setSearchParams] = useQueryStates(
    { counter: parseAsInteger.withDefault(0) },
    {
      shallow: false,
      startTransition,
    },
  );
  return (
    <div className="">
      <div className="mb-6 flex items-center justify-between">
        {' '}
        <div>Counter: {counter}</div>
        <div>Server Counter: {serverCounter}</div>
        {isLoading && <div>Loading...</div>}
        <button
          type="button"
          className="bg-blue-500 text-white p-2 rounded-md"
          onClick={() => setSearchParams({ counter: counter + 1 })}
        >
          Increment
        </button>
      </div>
    </div>
  );
};

export default DashboardPage;
