import { and, eq, sql } from 'drizzle-orm';
import { data } from 'react-router';
import { db } from '~/db';
import { boardTaskTable } from '~/db/kanban-schemas/board-task';
import { boardTable } from '~/db/schema';
import { companiesTable } from '~/db/schema/companies';
import { peopleTable } from '~/db/schema/people';
import { requireUser } from '~/services/whop.server';
import type { Route } from './+types/update-note';

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { companyId: organizationId } = params;
  await requireUser(request, organizationId);

  const formData = await request.formData();
  const entityType = formData.get('entityType')?.toString();
  const entityId = formData.get('entityId')?.toString();
  const notes = formData.get('notes')?.toString() || '';

  if (!entityType || !entityId) {
    return data({ error: 'Entity type and ID are required' }, { status: 400 });
  }

  try {
    if (entityType === 'person') {
      await db
        .update(peopleTable)
        .set({
          notes,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(and(eq(peopleTable.id, entityId), eq(peopleTable.organizationId, organizationId)));
    } else if (entityType === 'company') {
      await db
        .update(companiesTable)
        .set({
          notes,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(and(eq(companiesTable.id, entityId), eq(companiesTable.organizationId, organizationId)));
    } else if (entityType === 'task') {
      // Verify task belongs to organization through board relationship
      const boards = await db.query.boardTable.findMany({
        where: eq(boardTable.companyId, organizationId),
        with: {
          tasks: {
            where: eq(boardTaskTable.id, entityId),
          },
        },
      });

      const task = boards.flatMap((b) => b.tasks).find((t) => t.id === entityId);

      if (!task) {
        return data({ error: 'Task not found' }, { status: 404 });
      }

      await db
        .update(boardTaskTable)
        .set({
          notes,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(boardTaskTable.id, entityId));
    } else {
      return data({ error: 'Invalid entity type' }, { status: 400 });
    }

    return data({ success: true });
  } catch {
    return data({ error: 'Failed to update notes' }, { status: 500 });
  }
};
