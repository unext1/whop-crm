import { eq } from 'drizzle-orm';
import { data } from 'react-router';
import { db } from '~/db';
import { boardTable, boardTaskTable } from '~/db/schema';
import { requireUser } from '~/services/whop.server';
import type { Route } from './+types/delete-todo';

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { companyId } = params;
  await requireUser(request, companyId);

  const formData = await request.formData();
  const taskId = formData.get('taskId')?.toString();

  if (!taskId) {
    return data({ error: 'Task ID is required' }, { status: 400 });
  }

  // Verify task belongs to organization through board relationship
  const boards = await db.query.boardTable.findMany({
    where: eq(boardTable.companyId, companyId),
    with: {
      tasks: {
        where: eq(boardTaskTable.id, taskId),
      },
    },
  });

  const task = boards.flatMap((b) => b.tasks).find((t) => t.id === taskId);

  if (!task) {
    return data({ error: 'Task not found' }, { status: 404 });
  }

  // Delete the task
  await db.delete(boardTaskTable).where(eq(boardTaskTable.id, taskId));

  return data({ success: true });
};
