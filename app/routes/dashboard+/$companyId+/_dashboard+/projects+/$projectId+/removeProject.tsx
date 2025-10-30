import { redirect } from 'react-router';
import type { Route } from './+types/removeProject';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { parseWithZod } from '@conform-to/zod';
import { db } from '~/db';
import { boardTable } from '~/db/schema';
import { requireUser } from '~/services/whop.server';

export async function action({ request, params }: Route.ActionArgs) {
  await requireUser(request, params.companyId);
  const { companyId, projectId } = params;

  const formData = await request.formData();
  const submission = parseWithZod(formData, {
    schema: z.object({ columnId: z.string().min(1) }),
  });

  if (submission.status !== 'success') {
    return redirect(`/dashboard/${companyId}/projects/${projectId}/settings`);
  }

  // TODO: check if user is owner
  await db.delete(boardTable).where(eq(boardTable.id, projectId));

  return redirect(`/dashboard/${companyId}/projects/${projectId}/settings`);
}
