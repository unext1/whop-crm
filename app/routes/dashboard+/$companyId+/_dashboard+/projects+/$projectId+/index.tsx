import { eq, sql } from 'drizzle-orm';
import { useRef, useState, useEffect } from 'react';
import { Link, useFetchers, useFetcher, useNavigate, href } from 'react-router';
import type { Route } from './+types/index';

import Column from '~/components/kanban/column';
import { NewColumn } from '~/components/kanban/new-column';
import { buttonVariants } from '~/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '~/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Checkbox } from '~/components/ui/checkbox';
import { db } from '~/db';
import { boardTable, boardColumnTable, boardTaskTable, taskAssigneesTable } from '~/db/schema';
import { requireUser } from '~/services/whop.server';
import { cn } from '~/utils';

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

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUser(request, params.companyId);
  const formData = await request.formData();
  const intent = formData.get('intent');
  const { projectId } = params;

  if (!intent) throw Error('Missing intent');

  switch (intent) {
    case 'updateColumn': {
      const name = String(formData.get('name') || '');
      const columnId = String(formData.get('columnId') || '');

      return db
        .update(boardColumnTable)
        .set({
          name,
        })
        .where(eq(boardColumnTable.id, columnId));
    }
    case 'createColumn': {
      const name = String(formData.get('name') || '');
      const projectId = String(formData.get('projectId') || '');

      await db.transaction(async (tx) => {
        const columnCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(boardColumnTable)
          .where(eq(boardColumnTable.boardId, projectId))
          .then((result) => result[0].count);

        return await tx.insert(boardColumnTable).values({
          name,
          boardId: projectId,
          order: columnCount + 1,
        });
      });

      return {};
    }
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
            boardId: projectId,
            content,
          })
          .returning();

        await tx.insert(taskAssigneesTable).values({
          userId: user.id,
          taskId: task[0].id,
        });
      });
      return {};
    }
    case 'removeColumn': {
      const columnId = String(formData.get('columnId') || 0);

      return db.delete(boardColumnTable).where(eq(boardColumnTable.id, columnId));
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
    case 'moveColumn': {
      const order = Number(formData.get('order') || 0);
      const id = String(formData.get('id') || 0);
      return db
        .update(boardColumnTable)
        .set({
          order,
          id,
        })
        .where(eq(boardColumnTable.id, id));
    }

    default:
      break;
  }
  return {};
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUser(request, params.companyId);
  const { projectId, companyId } = params;

  const project = await db.query.boardTable.findMany({
    with: {
      tasks: true,
      columns: {
        orderBy: (boardColumnTable, { asc }) => [asc(boardColumnTable.order)],
      },
    },
    where: eq(boardTable.id, projectId),
  });

  const projects = await db.query.boardTable.findMany({
    where: eq(boardTable.companyId, companyId),
  });

  return { project: project[0], companyId, projectId, user, projects };
}

const ProjectPage = ({ loaderData }: Route.ComponentProps) => {
  const { project, companyId, projectId, user, projects } = loaderData;
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(project.id);
  const createFetcher = useFetcher();

  // Update selected project when navigation happens
  useEffect(() => {
    setSelectedProjectId(project.id);
  }, [project.id]);

  type TaskRecord = (typeof project.tasks)[number];
  const tasksById = new Map<string, TaskRecord>(project.tasks.map((item) => [item.id, item]));

  const pendingItems = usePendingTasks();
  for (const pendingItem of pendingItems) {
    const item = tasksById.get(pendingItem.id);
    let merged: TaskRecord;
    if (item) {
      // For existing items, only update the fields that are actually present in pendingItem
      merged = { ...item };
      // Always update columnId and order from pending item
      if (pendingItem.columnId !== 'null') merged.columnId = pendingItem.columnId;
      if (!Number.isNaN(pendingItem.order)) merged.order = pendingItem.order;
      // Only update other fields if they're not null/empty
      if (pendingItem.name && pendingItem.name !== 'null') merged.name = pendingItem.name;
      if (pendingItem.content !== undefined && pendingItem.content !== 'null') merged.content = pendingItem.content;
    } else {
      // For new items, use the pending item data
      merged = {
        ...pendingItem,
        boardId: project.id,
        updatedAt: new Date().toISOString(),
        personId: null,
        companyId: null,
        status: 'open',
        dueDate: null,
        priority: null,
      };
    }

    tasksById.set(pendingItem.id, merged);
  }

  const optAddingColumns = usePendingColumns();
  type Column = (typeof project.columns)[number] | (typeof optAddingColumns)[number];
  type TaskWithOrderAndColumn = TaskRecord & { order: number; columnId: string };
  type ColumnWithTasks = Column & { tasks: TaskWithOrderAndColumn[] };
  const columns = new Map<string, ColumnWithTasks>();
  for (const column of [...project.columns, ...optAddingColumns]) {
    columns.set(column.id, { ...column, tasks: [] });
  }

  const optRemovingColumns = usePendingRemovedColumns();
  for (const columnToRemove of optRemovingColumns) {
    const removedColumnId = columnToRemove.id;
    columns.delete(removedColumnId);
  }

  for (const item of tasksById.values()) {
    const columnId = item.columnId;
    if (!columnId) continue; // Skip items with null columnId
    const column = columns.get(columnId);
    if (!column) throw Error('missing column');
    // Ensure order is not null for UI components
    const taskWithValidOrder: TaskWithOrderAndColumn = {
      ...item,
      order: item.order ?? 0,
      columnId, // We know this is not null because of the check above
    };
    column.tasks.push(taskWithValidOrder);
  }

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Header */}

      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Select
            value={selectedProjectId}
            onValueChange={(value) => {
              setSelectedProjectId(value);
              navigate(`/dashboard/${companyId}/projects/${value}`);
            }}
          >
            <SelectTrigger className="h-8 w-56 text-xs">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
              <SelectSeparator />
              <div className="p-1">
                <Button type="button" size="sm" className="h-8 w-full text-xs" onClick={() => setCreateOpen(true)}>
                  + Create new project
                </Button>
              </div>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          {project.ownerId === user.id ? (
            <Link
              to={`/dashboard/${companyId}/projects/${projectId}/settings`}
              className={cn(buttonVariants({ variant: 'default', size: 'sm' }), '')}
            >
              Project Settings
            </Link>
          ) : null}
        </div>
      </div>

      {/* Create Project Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
            <DialogDescription>
              Create a new project to organize your tasks and collaborate with your team.
            </DialogDescription>
          </DialogHeader>
          <createFetcher.Form
            method="post"
            action={href('/dashboard/:companyId/projects', { companyId })}
            className="grid gap-4 py-4"
            onSubmit={() => setCreateOpen(false)}
          >
            <div className="grid grid-cols-6 items-center gap-x-4 gap-y-2">
              <Input name="ownerId" type="hidden" value={user.id} />
              <Label htmlFor="name" className="text-right col-span-2 text-sm whitespace-nowrap w-fit">
                Project Name
              </Label>
              <Input name="name" type="text" placeholder="My awesome project" className="col-span-4" />
              <Label htmlFor="defaultColumns" className="text-right col-span-2 text-sm whitespace-nowrap w-fit">
                Default Columns
              </Label>
              <div className="col-span-4">
                <Checkbox name="defaultColumns" />
              </div>
            </div>
            <Button type="submit" className="w-full">
              {createFetcher.state === 'submitting' ? 'Creating...' : 'Create Project'}
            </Button>
          </createFetcher.Form>
        </DialogContent>
      </Dialog>

      {/* Board */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col overflow-x-scroll" ref={scrollContainerRef}>
          <div className="flex grow h-full items-start gap-4 pb-4">
            {[...columns.values()].map((col) => {
              return <Column key={col.id} name={col.name} columnId={col.id} tasks={col.tasks} order={col.order} />;
            })}
            <NewColumn projectId={project.id} onAdd={scrollRight} editInitially={project.columns.length === 0} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectPage;

function usePendingColumns() {
  type CreateColumnFetcher = ReturnType<typeof useFetchers>[number] & {
    formData: FormData;
  };

  return useFetchers()
    .filter((fetcher): fetcher is CreateColumnFetcher => {
      return fetcher.formData?.get('intent') === 'createColumn';
    })
    .map((fetcher) => {
      const name = String(fetcher.formData.get('name'));
      const id = String(fetcher.formData.get('id'));
      const order = Number(fetcher.formData.get('order'));

      return { name, id, order };
    });
}

function usePendingRemovedColumns() {
  type CreateColumnFetcher = ReturnType<typeof useFetchers>[number] & {
    formData: FormData;
  };

  return useFetchers()
    .filter((fetcher): fetcher is CreateColumnFetcher => {
      return fetcher.formData?.get('intent') === 'removeColumn';
    })
    .map((fetcher) => {
      const id = String(fetcher.formData.get('columnId'));
      return { id };
    });
}

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
