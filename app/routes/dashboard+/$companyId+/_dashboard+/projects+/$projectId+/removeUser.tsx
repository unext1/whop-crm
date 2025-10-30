import { data } from 'react-router';
import type { Route } from './+types/removeUser';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { parseWithZod } from '@conform-to/zod';
import { db } from '~/db';
import { taskAssigneesTable } from '~/db/kanban-schemas';
import { requireUser } from '~/services/whop.server';

export async function action({ request, params }: Route.ActionArgs) {
  await requireUser(request, params.companyId);

  const formData = await request.formData();
  const submission = parseWithZod(formData, {
    schema: z.object({ userId: z.string().min(1) }),
  });

  if (submission.status !== 'success') {
    return data(submission.reply(), { status: 400 });
  }

  // TODO: check if user is owner and check if owner is not removing himself
  return await db.delete(taskAssigneesTable).where(eq(taskAssigneesTable.userId, submission.value.userId));
}
