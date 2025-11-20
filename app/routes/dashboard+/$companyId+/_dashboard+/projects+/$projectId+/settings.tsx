import { parseWithZod } from '@conform-to/zod';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { eq } from 'drizzle-orm';
import { GripVertical, Menu, Settings, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { data, Form, redirect, useFetcher, useNavigate, useNavigation } from 'react-router';
import { z } from 'zod';
import type { Route } from './+types/settings';

import { EditableText } from '~/components/kanban/editible-text';
import { QuickActionsMenu } from '~/components/quick-actions-menu';

import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Separator } from '~/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import { db } from '~/db';
import { boardColumnTable, boardMemberTable, boardTable } from '~/db/schema';
import { requireUser } from '~/services/whop.server';
import { cn } from '~/utils';

const inviteMemberSchema = z.object({
  userId: z.string().min(1, 'User is required'),
});

const createColumnSchema = z.object({
  name: z.string().min(1, 'Column name is required'),
});

const updateColumnOrderSchema = z.object({
  columnId: z.string(),
  order: z.number(),
});

const removeColumnSchema = z.object({
  columnId: z.string(),
});

const updateProjectNameSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
});

interface ProjectWithRelations {
  id: string;
  name: string;
  type: string;
  companyId: string;
  createdAt: string;
  ownerId: string | null;
  owner?: {
    id: string;
    name: string;
    profilePictureUrl: string;
  };
  members?: Array<{
    id: string;
    userId: string;
    user: {
      id: string;
      name: string | null;
    };
  }>;
  columns?: Column[];
}

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { user } = await requireUser(request, params.companyId);
  const { projectId, companyId } = params;

  const project = await db.query.boardTable.findFirst({
    with: {
      tasks: true,
      owner: true,

      columns: {
        orderBy: (boardColumnTable, { asc }) => [asc(boardColumnTable.order)],
      },
    },
    where: eq(boardTable.id, projectId),
  });

  if (!project || project.ownerId !== user.id) {
    throw redirect(`/dashboard/${companyId}/projects`);
  }

  return { project: project as ProjectWithRelations, projectId, companyId, user };
};

export const action = async ({ request, params }: Route.ActionArgs) => {
  await requireUser(request, params.companyId);
  const { projectId } = params;
  const formData = await request.formData();
  const intent = formData.get('intent')?.toString();

  switch (intent) {
    case 'inviteMember': {
      const submission = parseWithZod(formData, { schema: inviteMemberSchema });

      if (submission.status !== 'success') {
        return data(submission.reply(), {
          status: submission.status === 'error' ? 400 : 200,
        });
      }

      await db.insert(boardMemberTable).values({
        boardId: projectId,
        userId: submission.value.userId,
      });

      return data(submission.reply());
    }

    case 'createColumn': {
      const submission = parseWithZod(formData, { schema: createColumnSchema });

      if (submission.status !== 'success') {
        return data(submission.reply(), {
          status: submission.status === 'error' ? 400 : 200,
        });
      }

      const existingColumns = await db.query.boardColumnTable.findMany({
        where: eq(boardColumnTable.boardId, projectId),
      });
      const columnCount = existingColumns.length;

      await db.insert(boardColumnTable).values({
        name: submission.value.name,
        boardId: projectId,
        order: columnCount + 1,
      });

      return data(submission.reply());
    }

    case 'updateColumnOrder': {
      const submission = parseWithZod(formData, { schema: updateColumnOrderSchema });

      if (submission.status !== 'success') {
        return data(submission.reply(), {
          status: submission.status === 'error' ? 400 : 200,
        });
      }

      await db
        .update(boardColumnTable)
        .set({ order: submission.value.order })
        .where(eq(boardColumnTable.id, submission.value.columnId));

      return data(submission.reply());
    }

    case 'removeColumn': {
      const submission = parseWithZod(formData, { schema: removeColumnSchema });

      if (submission.status !== 'success') {
        return data(submission.reply(), {
          status: submission.status === 'error' ? 400 : 200,
        });
      }

      await db.delete(boardColumnTable).where(eq(boardColumnTable.id, submission.value.columnId));

      return data(submission.reply());
    }

    case 'updateProjectName': {
      const submission = parseWithZod(formData, { schema: updateProjectNameSchema });

      if (submission.status !== 'success') {
        return data(submission.reply(), {
          status: submission.status === 'error' ? 400 : 200,
        });
      }

      await db.update(boardTable).set({ name: submission.value.name }).where(eq(boardTable.id, projectId));

      return data(submission.reply());
    }

    default:
      return data({ error: 'Invalid intent' }, { status: 400 });
  }
};

const tabs = [{ id: 'columns', label: 'Columns', icon: Settings }];

interface Column {
  id: string;
  name: string;
  order: number;
  boardId: string;
}

function SortableColumn({ column, onDelete }: { column: Column; onDelete: (columnId: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card ref={setNodeRef} style={style} className="p-4 bg-muted border-0 shadow-s border-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button {...attributes} {...listeners} className="cursor-grab hover:bg-muted rounded p-1">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-medium">{column.name}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(column.id)}
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-red-500"
        >
          ×
        </Button>
      </div>
    </Card>
  );
}

const ProjectSettings = ({ loaderData }: Route.ComponentProps) => {
  const { project, projectId, companyId, user } = loaderData;
  const [activeTab, setActiveTab] = useState('columns');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createColumnDialogOpen, setCreateColumnDialogOpen] = useState(false);
  const [columns, setColumns] = useState<Column[]>(project.columns || []);
  const inputRef = useRef<HTMLInputElement>(null);
  const fetcher = useFetcher();

  useEffect(() => {
    setColumns(project.columns || []);
  }, [project.columns]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: { active: { id: string | number }; over: { id: string | number } | null }) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = columns.findIndex((column) => column.id === String(active.id));
      const newIndex = columns.findIndex((column) => column.id === String(over.id));

      const newColumns = arrayMove(columns, oldIndex, newIndex);
      setColumns(newColumns);

      // Update column orders in database - submit to settings route
      newColumns.forEach((column, index) => {
        const formData = new FormData();
        formData.append('intent', 'updateColumnOrder');
        formData.append('columnId', column.id);
        formData.append('order', (index + 1).toString());
        fetcher.submit(formData, {
          method: 'post',
          action: `/dashboard/${companyId}/projects/${projectId}/settings`,
        });
      });
    }
  };

  const handleDeleteColumn = (columnId: string) => {
    // Immediately update local state to remove the column
    setColumns((prevColumns) => prevColumns.filter((column) => column.id !== columnId));

    const formData = new FormData();
    formData.append('intent', 'removeColumn');
    formData.append('columnId', columnId);
    fetcher.submit(formData, {
      method: 'post',
      action: `/dashboard/${companyId}/projects/${projectId}/settings`,
    });
  };

  const navigation = useNavigation();
  useEffect(() => {
    if (navigation.state === 'submitting') {
      setTimeout(() => {
        setCreateColumnDialogOpen(false);
      }, 400);
    }
  }, [navigation.state]);

  const navigate = useNavigate();

  const sidebarContent = (
    <div className="flex flex-col w-full">
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hidden lg:flex hover:bg-muted"
          onClick={() => navigate(-1)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 overflow-y-auto scrollbar-thin">
        {/* Project Info */}
        <div className="mb-6">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-lg font-semibold text-primary-foreground">
            {project.name?.charAt(0) || 'P'}
          </div>
          <div className="flex items-center gap-2">
            <EditableText
              fieldName="name"
              value={project.name || 'Unnamed Project'}
              inputLabel="Edit project name"
              buttonLabel={`Edit project "${project.name || 'Unnamed Project'}" name`}
              size="md"
            >
              <input type="hidden" name="intent" value="updateProjectName" />
            </EditableText>
          </div>
        </div>

        {/* Project Details */}
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Status</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-foreground">Active Project</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Created By</h3>
            <div className="space-y-2">
              {project.owner ? (
                <div className="flex items-center gap-2 text-sm">
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarImage src={project.owner.profilePictureUrl || ''} alt="avatar" />
                    <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                      {project.owner.name ? project.owner.name[0].toUpperCase() : 'O'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-foreground">{project.owner.name || 'Unknown'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No creator</p>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Metadata</h3>
            <div className="space-y-2 text-xs">
              {project.createdAt && (
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="text-foreground">
                    {new Date(project.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Columns</p>
                <p className="text-foreground">{project.columns?.length || 0} columns</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-1 overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-80 lg:border-border lg:border-r lg:bg-muted/30">{sidebarContent}</div>

      {/* Mobile Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-3/4 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Project Settings</SheetTitle>
          </SheetHeader>
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Main Panel */}
      <div className="flex flex-1 flex-col overflow-x-hidden">
        {/* Header */}
        <div className="flex h-14 w-full items-center justify-between border-b border-border px-4">
          <div className="flex items-center w-full gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden items-center flex"
              onClick={() => setSheetOpen(true)}
            >
              <Menu className="h-4 w-4" />
              <span className="text-xs">Details</span>
            </Button>

            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
              <Settings className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold">Settings</h1>
            </div>
          </div>
          <QuickActionsMenu
            type="project"
            entityId={project.id}
            entityName={project.name || 'Unnamed Project'}
            userId={user.id}
            organizationId={companyId}
            onDelete={() => {
              const formData = new FormData();
              formData.append('projectId', project.id);
              fetcher.submit(formData, {
                method: 'post',
                action: `/dashboard/${companyId}/projects/${projectId}/removeProject`,
              });
            }}
          />
        </div>

        {/* Tabs */}
        <div className="border-b border-border px-4">
          <div className="flex gap-1 flex-1 overflow-y-auto scrollbar-thin">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors',
                  activeTab === tab.id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 scrollbar-thin">
          {activeTab === 'columns' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Project Columns</h2>
                <Dialog open={createColumnDialogOpen} onOpenChange={setCreateColumnDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="h-8 text-xs shadow-s">
                      Create Column
                    </Button>
                  </DialogTrigger>
                  <DialogContent
                    className="sm:max-w-[425px] p-0 gap-0 overflow-hidden bg-muted/30 backdrop-blur-md border-none shadow-s"
                    showCloseButton={false}
                  >
                    {/* Header */}
                    <div className="flex h-16 items-center justify-between border-b border-border px-6 bg-muted/30">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
                          <Settings className="h-3.5 w-3.5" />
                        </div>
                        <DialogTitle className="text-base font-semibold m-0">Create Column</DialogTitle>
                      </div>
                      <DialogClose asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </DialogClose>
                    </div>

                    {/* Content */}
                    <div className="overflow-auto max-h-[calc(100vh-180px)] p-6">
                      <Form method="post">
                        <input type="hidden" name="intent" value="createColumn" />
                        <Input autoFocus required ref={inputRef} type="text" name="name" placeholder="Column name..." />
                        <div className="flex justify-end mt-4">
                          <Button type="submit" size="sm" disabled={navigation.state === 'submitting'}>
                            {navigation.state === 'submitting' ? 'Creating...' : 'Create Column'}
                          </Button>
                        </div>
                      </Form>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-2">
                {columns && columns.length > 0 ? (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={columns.map((col) => col.id)} strategy={verticalListSortingStrategy}>
                      {columns.map((column) => (
                        <SortableColumn key={column.id} column={column} onDelete={handleDeleteColumn} />
                      ))}
                    </SortableContext>
                  </DndContext>
                ) : (
                  <div className="rounded-lg border border-border bg-card p-4 text-center shadow-sm">
                    <Settings className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h2 className="text-lg font-semibold mb-2">No columns yet</h2>
                    <Button variant="outline" size="sm" className="mt-4 h-8 text-xs">
                      Create your first column
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectSettings;
