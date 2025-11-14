import { requireUser } from '~/services/whop.server';
import type { Route } from './+types/complete-getting-started';
import { organizationTable } from '~/db/schema';
import { db } from '~/db';
import { eq } from 'drizzle-orm';
import { data } from 'react-router';
import { putToast } from '~/services/cookie.server';

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { companyId } = params;
  await requireUser(request, companyId);

  const formData = await request.formData();
  const intent = formData.get('intent')?.toString();

  if (intent === 'completeGettingStarted') {
    await db
      .update(organizationTable)
      .set({ gettingStartedCompleted: true })
      .where(eq(organizationTable.id, companyId));

    const headers = await putToast({
      title: 'Success',
      message: 'Getting started completed',
      variant: 'default',
    });

    return data({ success: true }, { headers });
  }

  return { success: false };
};
