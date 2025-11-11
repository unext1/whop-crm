import { eq } from 'drizzle-orm';
import { redirect } from 'react-router';
import { db } from '~/db';
import { boardTaskTable } from '~/db/schema';
import { requireUser } from '~/services/whop.server';
import type { Route } from './+types/removeTask';

export async function action({ request, params }: Route.ActionArgs) {
  await requireUser(request, params.companyId);
  const { companyId, projectId } = params;

  const formData = await request.formData();
  const taskId = String(formData.get('taskId') || '');

  await db.delete(boardTaskTable).where(eq(boardTaskTable.id, taskId));

  return redirect(`/dashboard/${companyId}/projects/${projectId}`);
}
