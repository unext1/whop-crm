import { eq } from 'drizzle-orm';
import { data } from 'react-router';
import { db } from '~/db';
import { boardTaskTable } from '~/db/schema';
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

  // Verify task exists and belongs to this organization
  const task = await db.query.boardTaskTable.findFirst({
    where: eq(boardTaskTable.id, taskId),
    with: {
      board: true,
    },
  });

  if (!task) {
    return data({ error: 'Task not found' }, { status: 404 });
  }

  // Verify task belongs to this organization
  if (task.board && task.board.companyId !== companyId) {
    return data({ error: 'Unauthorized' }, { status: 403 });
  }

  // Delete the task
  await db.delete(boardTaskTable).where(eq(boardTaskTable.id, taskId));

  return data({ success: true });
};
