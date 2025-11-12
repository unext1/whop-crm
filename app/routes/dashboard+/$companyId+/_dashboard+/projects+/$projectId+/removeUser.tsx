import { data } from 'react-router';
import type { Route } from './+types/removeUser';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { parseWithZod } from '@conform-to/zod';
import { db } from '~/db';
import { taskAssigneesTable, boardTaskTable, userTable } from '~/db/schema';
import { logTaskActivity } from '~/utils/activity.server';
import { requireUser } from '~/services/whop.server';

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUser(request, params.companyId);

  const formData = await request.formData();
  const submission = parseWithZod(formData, {
    schema: z.object({
      userId: z.string().min(1),
      taskId: z.string().min(1),
    }),
  });

  if (submission.status !== 'success') {
    return data(submission.reply(), { status: 400 });
  }

  const { userId: userIdToRemove, taskId } = submission.value;

  // Get user info and task before removing for activity log
  const removedUser = await db.query.userTable.findFirst({
    where: eq(userTable.id, userIdToRemove),
  });

  // Verify task belongs to this organization's project
  const task = await db.query.boardTaskTable.findFirst({
    where: eq(boardTaskTable.id, taskId),
    with: {
      board: true,
    },
  });

  if (!task || !task.board || task.board.companyId !== params.companyId) {
    return data({ error: 'Task not found or unauthorized' }, { status: 404 });
  }

  await db
    .delete(taskAssigneesTable)
    .where(and(eq(taskAssigneesTable.taskId, taskId), eq(taskAssigneesTable.userId, userIdToRemove)));

  // Log user removal activity
  if (task) {
    await logTaskActivity({
      taskId,
      userId: user.id,
      activityType: 'assignee_removed',
      description: removedUser ? `Unassigned ${removedUser.name || 'a user'}` : 'Unassigned a user',
      relatedEntityId: userIdToRemove,
      relatedEntityType: 'user',
    });
  }

  return {};
}
