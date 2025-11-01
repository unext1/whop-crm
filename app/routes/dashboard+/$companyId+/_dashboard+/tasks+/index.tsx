import { and, eq } from 'drizzle-orm';
import { ArrowUpDown, CheckSquare, ListFilter } from 'lucide-react';
import { useRef } from 'react';
import { useFetchers } from 'react-router';
import type { Route } from './+types/index';

import Column from '~/components/kanban/column';
import { Button } from '~/components/ui/button';
import { db } from '~/db';
import { boardColumnTable, boardTable, boardTaskTable, taskAssigneesTable } from '~/db/schema';
import { requireUser } from '~/services/whop.server';

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

// Helper function to ensure the tasks board exists for a company
async function ensureTasksBoard(companyId: string) {
  // Check if tasks board exists
  const existingBoard = await db.query.boardTable.findFirst({
    where: and(eq(boardTable.companyId, companyId), eq(boardTable.type, 'tasks')),
  });

  if (existingBoard) {
    return existingBoard;
  }

  // Create the tasks board with preset columns
  const newBoard = await db
    .insert(boardTable)
    .values({
      name: 'Tasks',
      type: 'tasks',
      companyId: companyId,
      ownerId: null, // System board, no specific owner
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
}

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
          })
          .returning();

        await tx.insert(taskAssigneesTable).values({
          userId: user.id,
          taskId: task[0].id,
        });
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

      return db
        .update(boardTaskTable)
        .set({
          columnId,
          order,
        })
        .where(eq(boardTaskTable.id, id));
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
        },
      },
      columns: {
        orderBy: (boardColumnTable, { asc }) => [asc(boardColumnTable.order)],
      },
    },
    where: eq(boardTable.id, tasksBoard.id),
  });

  return { board, companyId, user };
}

const TasksPage = ({ loaderData }: Route.ComponentProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { board } = loaderData;
  const pendingItems = usePendingTasks();

  if (!board) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p>Loading tasks...</p>
      </div>
    );
  }

  type TaskRecord = (typeof board.tasks)[number];
  const tasksById = new Map<string, TaskRecord>(board.tasks.map((item) => [item.id, item]));

  for (const pendingItem of pendingItems) {
    const item = tasksById.get(pendingItem.id);
    let merged: TaskRecord;
    if (item) {
      merged = { ...item };
      if (pendingItem.columnId !== 'null') merged.columnId = pendingItem.columnId;
      if (!Number.isNaN(pendingItem.order)) merged.order = pendingItem.order;
      if (pendingItem.name && pendingItem.name !== 'null') merged.name = pendingItem.name;
      if (pendingItem.content !== undefined && pendingItem.content !== 'null') merged.content = pendingItem.content;
    } else {
      merged = {
        ...pendingItem,
        boardId: board.id,
        updatedAt: new Date().toISOString(),
        personId: null,
        companyId: null,
        status: 'open',
        dueDate: null,
        priority: null,
        assignees: [],
        type: 'tasks' as const,
      };
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
          <Button variant="ghost" size="sm" className="h-7 text-xs">
            <ListFilter className="h-3.5 w-3.5 mr-1.5" />
            Filter
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
            Sort
          </Button>
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
      const item: RenderedItem = {
        name,
        id,
        order,
        columnId,
        content,
        ownerId,
        boardId,
        createdAt,
      };
      return item;
    });
}
