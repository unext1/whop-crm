import { requireUser } from '~/services/whop.server';
import type { Route } from './+types/add-todo';
import { and, eq } from 'drizzle-orm';
import { boardColumnTable, boardTable, boardTaskTable } from '~/db/schema';
import { db } from '~/db';
import { data } from 'react-router';
import { putToast } from '~/services/cookie.server';
import { logCompanyActivity, logPersonActivity, logTaskActivity } from '~/utils/activity.server';

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { companyId: organizationId } = params;

  const { user } = await requireUser(request, organizationId);
  const userId = user.id;

  const formData = await request.formData();
  const intent = formData.get('intent');
  const personId = formData.get('personId')?.toString();
  const name = String(formData.get('name') || '');
  const content = formData.get('content') ? String(formData.get('content')) : null;
  const relatedPersonId = formData.get('relatedPersonId') ? String(formData.get('relatedPersonId')) : null;
  const relatedCompanyId = formData.get('relatedCompanyId') ? String(formData.get('relatedCompanyId')) : null;

  if (!name) {
    return data({ error: 'Task name required' }, { status: 400 });
  }

  if (intent === 'add-todo') {
    const ensureTasksBoard = async (orgId: string) => {
      const existingBoard = await db.query.boardTable.findFirst({
        where: and(eq(boardTable.companyId, orgId), eq(boardTable.type, 'tasks'), eq(boardTable.name, 'Tasks')),
      });

      if (existingBoard) {
        return existingBoard;
      }

      const newBoard = await db
        .insert(boardTable)
        .values({
          name: 'Tasks',
          type: 'tasks',
          companyId: orgId,
          ownerId: null,
        })
        .returning();

      await db.insert(boardColumnTable).values([
        { name: 'Todo', order: 1, boardId: newBoard[0].id },
        { name: 'In Progress', order: 2, boardId: newBoard[0].id },
        { name: 'Done', order: 3, boardId: newBoard[0].id },
      ]);

      return newBoard[0];
    };

    try {
      const tasksBoard = await ensureTasksBoard(organizationId);

      // Find the "Todo" column
      const todoColumn = await db.query.boardColumnTable.findFirst({
        where: and(eq(boardColumnTable.boardId, tasksBoard.id), eq(boardColumnTable.name, 'Todo')),
      });

      if (!todoColumn) {
        return data({ error: 'Todo column not found' }, { status: 500 });
      }

      // Get the highest order in the Todo column
      const maxOrderTask = await db.query.boardTaskTable.findFirst({
        where: eq(boardTaskTable.columnId, todoColumn.id),
        orderBy: (tasks, { desc }) => [desc(tasks.order)],
      });

      const nextOrder = maxOrderTask?.order ? maxOrderTask.order + 1 : 1;

      if (relatedPersonId) {
        await db.transaction(async (tx) => {
          const task = await tx
            .insert(boardTaskTable)
            .values({
              columnId: todoColumn.id,
              name,
              order: nextOrder,
              ownerId: userId,
              boardId: tasksBoard.id,
              content,
              type: 'tasks',
              status: 'open',
              personId: relatedPersonId || personId,
            })
            .returning();

          // Log activity for task creation
          await logTaskActivity({
            taskId: task[0].id,
            userId,
            activityType: 'created',
            description: `Task "${name}" was created`,
            tx,
          });

          // Log activity for person
          await logPersonActivity({
            personId: relatedPersonId || personId || '',
            userId,
            activityType: 'task_created',
            description: `Created task "${name}"`,
            relatedEntityId: task[0].id,
            relatedEntityType: 'task',
            tx,
          });
        });
      }
      if (relatedCompanyId) {
        await db.transaction(async (tx) => {
          const task = await tx
            .insert(boardTaskTable)
            .values({
              columnId: todoColumn.id,
              name,
              order: nextOrder,
              ownerId: userId,
              boardId: tasksBoard.id,
              content,
              type: 'tasks',
              status: 'open',
              personId: relatedPersonId || personId,
            })
            .returning();

          await logTaskActivity({
            taskId: task[0].id,
            userId,
            activityType: 'created',
            description: `Task "${name}" was created`,
            tx,
          });

          await logCompanyActivity({
            companyId: relatedCompanyId || organizationId,
            userId,
            activityType: 'task_created',
            description: `Created task "${name}"`,
            relatedEntityId: task[0].id,
            relatedEntityType: 'task',
            tx,
          });
        });
      }

      const headers = await putToast({
        title: 'Success',
        message: 'Todo created successfully',
        variant: 'default',
      });

      return data({ success: true }, { headers });
    } catch {
      const headers = await putToast({
        title: 'Error',
        message: 'Failed to create todo',
        variant: 'destructive',
      });
      return data({ error: 'Failed to create todo' }, { headers, status: 500 });
    }
  }

  return {};
};
