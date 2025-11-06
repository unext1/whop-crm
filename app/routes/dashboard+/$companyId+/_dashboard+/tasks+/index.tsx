import { and, eq, inArray, sql } from 'drizzle-orm';
import { CheckSquare } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useFetchers } from 'react-router';
import type { Route } from './+types/index';

import Column from '~/components/kanban/column';
import { KanbanFilterList } from '~/components/kanban/kanban-filter-list';
import { db } from '~/db';
import {
  boardColumnTable,
  boardTable,
  boardTaskTable,
  companiesTable,
  peopleTable,
  taskCommentTable,
} from '~/db/schema';
import { requireUser } from '~/services/whop.server';
import { logTaskActivity } from '~/utils/activity.server';

export interface RenderedItem {
  id: string;
  name: string;
  order: number;
  createdAt: string;
  content: string | null;
  columnId: string;
  boardId: string;
  ownerId: string | null;
}

const ensureTasksBoard = async (companyId: string) => {
  const existingBoard = await db.query.boardTable.findFirst({
    where: and(eq(boardTable.companyId, companyId), eq(boardTable.type, 'tasks')),
  });

  if (existingBoard) {
    return existingBoard;
  }

  const newBoard = await db
    .insert(boardTable)
    .values({
      name: 'Tasks',
      type: 'tasks',
      companyId: companyId,
      ownerId: null,
    })
    .returning();

  // Create the three preset columns
  await db.insert(boardColumnTable).values([
    {
      name: 'Todo',
      order: 1,
      boardId: newBoard[0].id,
    },
    {
      name: 'In Progress',
      order: 2,
      boardId: newBoard[0].id,
    },
    {
      name: 'Done',
      order: 3,
      boardId: newBoard[0].id,
    },
  ]);

  return newBoard[0];
};

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUser(request, params.companyId);
  const formData = await request.formData();
  const intent = formData.get('intent');
  const { companyId } = params;

  if (!intent) throw Error('Missing intent');

  // Ensure tasks board exists
  const tasksBoard = await ensureTasksBoard(companyId);

  switch (intent) {
    case 'createTask': {
      const name = String(formData.get('name') || '');
      const columnId = String(formData.get('columnId') || '');
      const content = String(formData.get('content') || '');
      const order = Number(formData.get('order') || 0);
      const dueDate = formData.get('dueDate') ? String(formData.get('dueDate')) : null;
      const status = formData.get('status') ? String(formData.get('status')) : null;
      const priority = formData.get('priority') ? String(formData.get('priority')) : null;
      const relatedCompanyId = formData.get('relatedCompanyId') ? String(formData.get('relatedCompanyId')) : null;
      const relatedPersonId = formData.get('relatedPersonId') ? String(formData.get('relatedPersonId')) : null;

      await db.transaction(async (tx) => {
        const task = await tx
          .insert(boardTaskTable)
          .values({
            columnId,
            name,
            order,
            ownerId: user.id,
            boardId: tasksBoard.id,
            content,
            type: 'tasks',
            dueDate,
            status: status || 'open',
            priority,
            companyId: relatedCompanyId,
            personId: relatedPersonId,
          })
          .returning();

        await logTaskActivity({
          taskId: task[0].id,
          userId: user.id,
          activityType: 'created',
          description: `Task "${name}" was created`,
          tx,
        });

        // Log company/person associations if any
        if (relatedCompanyId) {
          await logTaskActivity({
            taskId: task[0].id,
            userId: user.id,
            activityType: 'company_linked',
            relatedEntityId: relatedCompanyId,
            relatedEntityType: 'company',
            tx,
          });
        }

        if (relatedPersonId) {
          await logTaskActivity({
            taskId: task[0].id,
            userId: user.id,
            activityType: 'person_linked',
            relatedEntityId: relatedPersonId,
            relatedEntityType: 'person',
            tx,
          });
        }

        if (dueDate) {
          await logTaskActivity({
            taskId: task[0].id,
            userId: user.id,
            activityType: 'due_date_changed',
            metadata: {
              field: 'dueDate',
              newValue: dueDate,
            },
            tx,
          });
        }

        if (priority) {
          await logTaskActivity({
            taskId: task[0].id,
            userId: user.id,
            activityType: 'priority_changed',
            metadata: {
              field: 'priority',
              newValue: priority,
            },
            tx,
          });
        }
      });
      return {};
    }
    case 'removeTask': {
      const taskId = String(formData.get('taskId') || 0);
      return db.delete(boardTaskTable).where(eq(boardTaskTable.id, taskId));
    }
    case 'moveTask': {
      const order = Number(formData.get('order') || 0);
      const columnId = String(formData.get('columnId') || 0);
      const id = String(formData.get('id') || 0);

      // Get old task state for activity log
      const oldTask = await db.query.boardTaskTable.findFirst({
        with: { column: true },
        where: eq(boardTaskTable.id, id),
      });

      const newColumn = await db.query.boardColumnTable.findFirst({
        where: eq(boardColumnTable.id, columnId),
      });

      await db
        .update(boardTaskTable)
        .set({
          columnId,
          order,
        })
        .where(eq(boardTaskTable.id, id));

      // Log activity if column changed
      if (oldTask && oldTask.columnId !== columnId && oldTask.column && newColumn) {
        await logTaskActivity({
          taskId: id,
          userId: oldTask.ownerId,
          activityType: 'column_moved',
          metadata: {
            field: 'column',
            oldValue: oldTask.column.name,
            newValue: newColumn.name,
          },
          description: `Moved from "${oldTask.column.name}" to "${newColumn.name}"`,
        });
      }

      return {};
    }

    default:
      break;
  }
  return {};
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUser(request, params.companyId);
  const { companyId } = params;

  // Ensure tasks board exists
  const tasksBoard = await ensureTasksBoard(companyId);

  // Fetch the tasks board with all tasks of type 'tasks'
  const board = await db.query.boardTable.findFirst({
    with: {
      tasks: {
        where: eq(boardTaskTable.type, 'tasks'),
        with: {
          assignees: {
            with: {
              user: true,
            },
          },
          owner: true,
        },
      },
      columns: {
        orderBy: (boardColumnTable, { asc }) => [asc(boardColumnTable.order)],
      },
    },
    where: eq(boardTable.id, tasksBoard.id),
  });

  // Fetch company and person relations for tasks, and comment counts
  if (board?.tasks) {
    const taskIds = board.tasks.map((t) => t.id);

    // Fetch comment counts for all tasks in one query
    const commentCounts =
      taskIds.length > 0
        ? await db
            .select({
              taskId: taskCommentTable.taskId,
              count: sql<number>`count(*)`,
            })
            .from(taskCommentTable)
            .where(inArray(taskCommentTable.taskId, taskIds))
            .groupBy(taskCommentTable.taskId)
        : [];

    const countsMap = new Map(commentCounts.map((cc) => [cc.taskId, Number(cc.count)]));

    for (const task of board.tasks) {
      if (task.companyId) {
        const company = await db.query.companiesTable.findFirst({
          where: eq(companiesTable.id, task.companyId),
        });
        if (company) {
          Object.assign(task, { company });
        }
      }
      if (task.personId) {
        const person = await db.query.peopleTable.findFirst({
          where: eq(peopleTable.id, task.personId),
        });
        if (person) {
          Object.assign(task, { person });
        }
      }
      // Add comment count
      Object.assign(task, { commentsCount: countsMap.get(task.id) ?? 0 });
    }
  }

  // Fetch companies and people for task creation dialogs
  const companies = await db.query.companiesTable.findMany({
    where: eq(companiesTable.organizationId, companyId),
    orderBy: companiesTable.name,
  });

  const people = await db.query.peopleTable.findMany({
    where: eq(peopleTable.organizationId, companyId),
    orderBy: peopleTable.name,
  });

  return { board, companyId, user, companies, people };
}

const TasksPage = ({ loaderData }: Route.ComponentProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { board, companies, people, user } = loaderData;
  const [filteredTasks, setFilteredTasks] = useState(board?.tasks || []);
  const pendingItems = usePendingTasks();

  // Memoize additionalFields to prevent infinite re-renders
  const additionalFields = React.useMemo(
    () => [
      {
        id: 'priority',
        label: 'Priority',
        variant: 'select' as const,
        options: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
          { value: 'urgent', label: 'Urgent' },
        ],
      },
      {
        id: 'dueDate',
        label: 'Due Date',
        variant: 'date' as const,
      },
      {
        id: 'status',
        label: 'Status',
        variant: 'select' as const,
        options: [
          { value: 'open', label: 'Open' },
          { value: 'in_progress', label: 'In Progress' },
          { value: 'completed', label: 'Completed' },
          { value: 'cancelled', label: 'Cancelled' },
        ],
      },
    ],
    [],
  );

  if (!board) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p>Loading tasks...</p>
      </div>
    );
  }

  type TaskRecord = (typeof filteredTasks)[number];
  const tasksById = new Map<string, TaskRecord>(filteredTasks.map((item) => [item.id, item]));

  for (const pendingItem of pendingItems) {
    const item = tasksById.get(pendingItem.id);
    let merged: TaskRecord;
    if (item) {
      merged = { ...item };
      if (pendingItem.columnId !== 'null') merged.columnId = pendingItem.columnId;
      if (!Number.isNaN(pendingItem.order)) merged.order = pendingItem.order;
      if (pendingItem.name && pendingItem.name !== 'null') merged.name = pendingItem.name;
      if (pendingItem.content !== undefined && pendingItem.content !== 'null') merged.content = pendingItem.content;
      if (pendingItem.dueDate && pendingItem.dueDate !== 'null') merged.dueDate = pendingItem.dueDate;
      if (pendingItem.priority && pendingItem.priority !== 'null') merged.priority = pendingItem.priority;
      if (pendingItem.relatedCompanyId && pendingItem.relatedCompanyId !== 'null') {
        merged.companyId = pendingItem.relatedCompanyId;
        if (pendingItem.companyName) {
          Object.assign(merged, {
            company: { id: pendingItem.relatedCompanyId, name: pendingItem.companyName },
          });
        }
      }
      if (pendingItem.relatedPersonId && pendingItem.relatedPersonId !== 'null') {
        merged.personId = pendingItem.relatedPersonId;
        if (pendingItem.personName) {
          Object.assign(merged, {
            person: { id: pendingItem.relatedPersonId, name: pendingItem.personName },
          });
        }
      }
    } else {
      merged = {
        ...pendingItem,
        amount: null,
        boardId: board.id,
        updatedAt: new Date().toISOString(),
        personId: pendingItem.relatedPersonId || null,
        companyId: pendingItem.relatedCompanyId || null,
        status: 'open',
        dueDate: pendingItem.dueDate || null,
        priority: pendingItem.priority || null,
        assignees: [], // Start with empty assignees - owner is not auto-assigned
        owner: user, // Add owner for "Created By" display
        ownerId: user.id,
        type: 'tasks' as const,
      } as TaskRecord;
      // Add company/person objects for optimistic UI
      if (pendingItem.companyName && pendingItem.relatedCompanyId) {
        Object.assign(merged, {
          company: { id: pendingItem.relatedCompanyId, name: pendingItem.companyName },
        });
      }
      if (pendingItem.personName && pendingItem.relatedPersonId) {
        Object.assign(merged, {
          person: { id: pendingItem.relatedPersonId, name: pendingItem.personName },
        });
      }
    }

    tasksById.set(pendingItem.id, merged);
  }

  type Column = (typeof board.columns)[number];
  type TaskWithOrderAndColumn = TaskRecord & { order: number; columnId: string; assignees?: TaskRecord['assignees'] };
  type ColumnWithTasks = Column & { tasks: TaskWithOrderAndColumn[] };
  const columns = new Map<string, ColumnWithTasks>();
  for (const column of board.columns) {
    columns.set(column.id, { ...column, tasks: [] });
  }

  for (const item of tasksById.values()) {
    const columnId = item.columnId;
    if (!columnId) continue;
    const column = columns.get(columnId);
    if (!column) continue;
    const taskWithValidOrder: TaskWithOrderAndColumn = {
      ...item,
      order: item.order ?? 0,
      columnId,
      assignees: item.assignees || [],
    };
    column.tasks.push(taskWithValidOrder);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
            <CheckSquare className="h-3.5 w-3.5" />
          </div>
          <h1 className="text-base font-semibold">Tasks</h1>
        </div>
      </div>

      {/* Secondary Action Bar */}
      <div className="flex h-10 items-center justify-between border-b border-border px-4 bg-muted/20">
        <div className="flex items-center gap-2">
          <KanbanFilterList
            tasks={board.tasks}
            companies={companies}
            people={people}
            onFilteredTasksChange={setFilteredTasks}
            additionalFields={additionalFields}
          />
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">Preset columns: Todo, In Progress, Done</p>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 min-h-0">
        <div className="h-full overflow-x-auto scrollbar" ref={scrollContainerRef}>
          <div className="flex items-start gap-4 p-4 h-full">
            {[...columns.values()].map((col) => {
              return (
                <Column
                  key={col.id}
                  name={col.name}
                  columnId={col.id}
                  tasks={col.tasks}
                  order={col.order}
                  disableEdit={true} // Disable editing for preset columns
                  taskType="tasks"
                  companies={companies}
                  people={people}
                  boardId={board?.id}
                  userId={user.id}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TasksPage;

function usePendingTasks() {
  type PendingItem = ReturnType<typeof useFetchers>[number] & {
    formData: FormData;
  };
  return useFetchers()
    .filter((fetcher): fetcher is PendingItem => {
      if (!fetcher.formData) return false;
      const intent = fetcher.formData.get('intent');
      return intent === 'createTask' || intent === 'moveTask';
    })
    .map((fetcher) => {
      const columnId = String(fetcher.formData.get('columnId'));
      const name = String(fetcher.formData.get('name'));
      const id = String(fetcher.formData.get('id'));
      const createdAt = String(fetcher.formData.get('createdAt'));
      const order = Number(fetcher.formData.get('order'));
      const boardId = String(fetcher.formData.get('boardId'));
      const ownerId = String(fetcher.formData.get('ownerId'));
      const content = String(fetcher.formData.get('content'));
      const dueDate = fetcher.formData.get('dueDate') ? String(fetcher.formData.get('dueDate')) : null;
      const priority = fetcher.formData.get('priority') ? String(fetcher.formData.get('priority')) : null;
      const relatedCompanyId = fetcher.formData.get('relatedCompanyId')
        ? String(fetcher.formData.get('relatedCompanyId'))
        : null;
      const relatedPersonId = fetcher.formData.get('relatedPersonId')
        ? String(fetcher.formData.get('relatedPersonId'))
        : null;
      const companyName = fetcher.formData.get('companyName') ? String(fetcher.formData.get('companyName')) : null;
      const personName = fetcher.formData.get('personName') ? String(fetcher.formData.get('personName')) : null;
      const item: RenderedItem & {
        dueDate?: string | null;
        priority?: string | null;
        relatedCompanyId?: string | null;
        relatedPersonId?: string | null;
        companyName?: string | null;
        personName?: string | null;
      } = {
        name,
        id,
        order,
        columnId,
        content,
        ownerId,
        boardId,
        createdAt,
        dueDate,
        priority,
        relatedCompanyId,
        relatedPersonId,
        companyName,
        personName,
      };
      return item;
    });
}
