import { and, eq, inArray, sql } from 'drizzle-orm';
import { KanbanSquareIcon, X } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { href, Link, useFetcher, useFetchers, useNavigate } from 'react-router';
import type { Route } from './+types/index';

import Column from '~/components/kanban/column';
import { KanbanFilterList } from '~/components/kanban/kanban-filter-list';
import { NewColumn } from '~/components/kanban/new-column';
import { Badge } from '~/components/ui/badge';
import { Button, buttonVariants } from '~/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Switch } from '~/components/ui/switch';
import { db } from '~/db';
import { COLUMN_TEMPLATES } from '~/utils/column-templates';

import {
  boardColumnTable,
  boardTable,
  boardTaskTable,
  companiesTable,
  peopleTable,
  taskCommentTable,
  userTable,
} from '~/db/schema';
import { requireUser } from '~/services/whop.server';
import { cn } from '~/utils';
import { logActivity } from '~/utils/activity.server';

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
      const amount = formData.get('amount') ? Number(formData.get('amount')) : null;
      const relatedCompanyId = formData.get('relatedCompanyId') ? String(formData.get('relatedCompanyId')) : null;
      const relatedPersonId = formData.get('relatedPersonId') ? String(formData.get('relatedPersonId')) : null;

      const [task] = await db
        .insert(boardTaskTable)
        .values({
          columnId,
          name,
          order,
          ownerId: user.id,
          boardId: projectId,
          content,
          type: 'pipeline',
          companyId: relatedCompanyId,
          personId: relatedPersonId,
          amount,
        })
        .returning();

      await logActivity({
        userId: user.id,
        activityType: 'task_created',
        description: `Created Deal "${name}"`,
        relatedEntityId: task.id,
        relatedEntityType: 'task',
        entityType: 'task',
        entityId: task.id,
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
      tasks: {
        where: eq(boardTaskTable.type, 'pipeline'),
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
    where: and(eq(boardTable.id, projectId), eq(boardTable.type, 'pipeline')),
  });

  // Fetch company and person relations for tasks, and comment counts
  if (project[0]?.tasks) {
    const taskIds = project[0].tasks.map((t) => t.id);

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

    for (const task of project[0].tasks) {
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

  const projects = await db.query.boardTable.findMany({
    where: and(eq(boardTable.companyId, companyId), eq(boardTable.type, 'pipeline')),
  });

  // Fetch companies and people for task creation dialogs
  const companies = await db.query.companiesTable.findMany({
    where: eq(companiesTable.organizationId, companyId),
    orderBy: companiesTable.name,
  });

  const people = await db.query.peopleTable.findMany({
    where: eq(peopleTable.organizationId, companyId),
    orderBy: peopleTable.name,
  });

  const users = await db.query.userTable.findMany({
    where: eq(userTable.organizationId, companyId),
    orderBy: userTable.name,
  });

  return { project: project[0], companyId, projectId, user, projects, companies, people, users };
}

const ProjectPage = ({ loaderData }: Route.ComponentProps) => {
  const { project, companyId, projectId, user, projects, companies, people, users } = loaderData;
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [createMore, setCreateMore] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('default');
  const [selectedProjectId, setSelectedProjectId] = useState(project.id);
  const [filteredTasks, setFilteredTasks] = useState(project.tasks);
  const createFetcher = useFetcher();

  // Memoize additionalFields to prevent infinite re-renders
  const additionalFields = useMemo(() => [], []);

  // Update selected project and filtered tasks when navigation happens
  useEffect(() => {
    setSelectedProjectId(project.id);
    setFilteredTasks(project.tasks);
  }, [project.id, project.tasks]);

  // Call hooks at top level
  const pendingItems = usePendingTasks();
  const optAddingColumns = usePendingColumns();
  const optRemovingColumns = usePendingRemovedColumns();

  // Memoize expensive computations to prevent unnecessary re-renders
  const { columns } = useMemo(() => {
    type TaskRecord = (typeof filteredTasks)[number];
    const tasksById = new Map<string, TaskRecord>(filteredTasks.map((item) => [item.id, item]));

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
        // For new items, use the pending item data
        merged = {
          ...pendingItem,
          amount: pendingItem.amount && pendingItem.amount > 0 ? pendingItem.amount : null, // Don't show 0 in optimistic UI
          boardId: project.id,
          updatedAt: new Date().toISOString(),
          personId: pendingItem.relatedPersonId || null,
          companyId: pendingItem.relatedCompanyId || null,
          status: 'open',
          dueDate: null,
          priority: null,
          assignees: [], // Start with empty assignees - owner is not auto-assigned
          owner: user, // Add owner for "Created By" display
          ownerId: user.id,
          type: 'pipeline',
          parentTaskId: null,
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

    type Column = (typeof project.columns)[number] | (typeof optAddingColumns)[number];
    type TaskWithOrderAndColumn = TaskRecord & { order: number; columnId: string; assignees?: TaskRecord['assignees'] };
    type ColumnWithTasks = Column & { tasks: TaskWithOrderAndColumn[] };
    const columns = new Map<string, ColumnWithTasks>();
    for (const column of [...project.columns, ...optAddingColumns]) {
      columns.set(column.id, { ...column, tasks: [] });
    }

    for (const columnToRemove of optRemovingColumns) {
      const removedColumnId = columnToRemove.id;
      columns.delete(removedColumnId);
    }

    for (const item of tasksById.values()) {
      const columnId = item.columnId;
      if (!columnId) continue; // Skip items with null columnId
      const column = columns.get(columnId);
      if (!column) continue; // Skip tasks with missing columns
      // Ensure order is not null for UI components and assignees exist

      const taskWithValidOrder: TaskWithOrderAndColumn = {
        ...item,
        order: item.order ?? 0,
        columnId, // We know this is not null because of the check above
        assignees: item.assignees || [],
      };
      column.tasks.push(taskWithValidOrder);
    }

    return { tasksById, columns };
  }, [filteredTasks, project.columns, project.id, user, pendingItems, optAddingColumns, optRemovingColumns]);

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
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
            <KanbanSquareIcon className="h-3.5 w-3.5" />
          </div>
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
              <SelectContent className="bg-muted/30 backdrop-blur-md border-none shadow-lg">
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
                <SelectSeparator />
                <div className="p-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full text-xs bg-transparent"
                    onClick={() => setCreateOpen(true)}
                  >
                    + Create new project
                  </Button>
                </div>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Secondary Action Bar */}
      <div className="flex h-10 items-center justify-between border-b border-border px-4 bg-muted/20">
        <div className="flex items-center gap-2">
          <KanbanFilterList
            tasks={project.tasks}
            companies={companies}
            people={people}
            users={users}
            onFilteredTasksChange={setFilteredTasks}
            additionalFields={additionalFields}
          />
        </div>
        <div className="flex items-center gap-2">
          {project.ownerId === user.id ? (
            <Link
              to={`/dashboard/${companyId}/projects/${projectId}/settings`}
              className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'h-8 text-xs  shadow-s')}
            >
              Project Settings
            </Link>
          ) : null}
        </div>
      </div>

      {/* Create Project Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          className="sm:max-w-[600px] p-0 gap-0 overflow-hidden bg-muted/30 backdrop-blur-md border-none shadow-s"
          showCloseButton={false}
        >
          {/* Header */}
          <div className="flex h-16 items-center justify-between border-b border-border px-6 bg-muted/30">
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
                <KanbanSquareIcon className="h-3.5 w-3.5" />
              </div>
              <DialogTitle className="text-base font-semibold m-0">Create Project</DialogTitle>
            </div>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>

          {/* Form Content */}
          <div className="overflow-auto max-h-[calc(100vh-180px)]">
            <createFetcher.Form
              method="post"
              action={href('/dashboard/:companyId/projects', { companyId })}
              id="create-project-form"
              className="space-y-4 p-6"
              onSubmit={() => {
                if (!createMore) {
                  setCreateOpen(false);
                }
              }}
            >
              <Input name="ownerId" type="hidden" value={user.id} />
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm text-muted-foreground">
                  Project name <span className="text-muted-foreground">(required)</span>
                </Label>
                <Input id="name" name="name" type="text" placeholder="Set Project name..." className="h-9" required />
              </div>

              <div className="space-y-3">
                <Label className="text-sm text-muted-foreground">Column Template</Label>
                <div className="grid grid-cols-1 gap-2">
                  {COLUMN_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className={`cursor-pointer rounded-lg border p-4 transition-all w-full text-left ${
                        selectedTemplateId === template.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border/50 hover:border-border'
                      }`}
                      onClick={() => setSelectedTemplateId(template.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedTemplateId(template.id);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="h-10 w-10 rounded-lg bg-muted/20 flex items-center justify-center text-lg">
                            {template.icon}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="text-sm font-medium">{template.name}</div>
                            </div>
                            <div className="text-xs text-muted-foreground mb-2">{template.description}</div>
                            <div className="flex flex-wrap gap-1">
                              {template.columns.map((column) => (
                                <Badge key={column} variant="outline" className="text-xs">
                                  {column}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <input type="hidden" name="templateId" value={selectedTemplateId} />
              </div>
            </createFetcher.Form>
          </div>

          {/* Footer */}
          <div className="flex h-14 items-center justify-between border-t border-border px-6 bg-muted/30">
            <div className="flex items-center gap-2">
              <Switch id="create-more" checked={createMore} onCheckedChange={setCreateMore} />
              <Label htmlFor="create-more" className="text-sm font-normal cursor-pointer">
                Create more
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <DialogClose asChild>
                <Button type="button" variant="ghost" size="sm" className="h-8 text-xs">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" form="create-project-form" size="sm" className="h-8 text-xs">
                {createFetcher.state === 'submitting' ? 'Creating...' : 'Create record'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                  taskType="pipeline"
                  companies={companies}
                  people={people}
                  boardId={project.id}
                  userId={user.id}
                />
              );
            })}
            <NewColumn projectId={project.id} onAdd={scrollRight} editInitially={project.columns.length === 0} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(ProjectPage);

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
      const relatedCompanyId = fetcher.formData.get('relatedCompanyId')
        ? String(fetcher.formData.get('relatedCompanyId'))
        : null;
      const relatedPersonId = fetcher.formData.get('relatedPersonId')
        ? String(fetcher.formData.get('relatedPersonId'))
        : null;
      const companyName = fetcher.formData.get('companyName') ? String(fetcher.formData.get('companyName')) : null;
      const personName = fetcher.formData.get('personName') ? String(fetcher.formData.get('personName')) : null;
      const amount = fetcher.formData.get('amount') ? Number(fetcher.formData.get('amount')) : 0;
      const item: RenderedItem & {
        relatedCompanyId?: string | null;
        relatedPersonId?: string | null;
        companyName?: string | null;
        personName?: string | null;
        amount?: number;
      } = {
        name,
        id,
        order,
        columnId,
        content,
        ownerId,
        boardId,
        createdAt,
        relatedCompanyId,
        relatedPersonId,
        companyName,
        personName,
        amount,
      };
      return item;
    });
}
