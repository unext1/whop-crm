import { parseWithZod } from '@conform-to/zod';
import { and, eq, inArray } from 'drizzle-orm';
import {
  ActivityIcon,
  Calendar,
  CheckSquare,
  FileText,
  LayoutDashboardIcon,
  Menu,
  MoreHorizontal,
  Paperclip,
  Plus,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { data, Form, Link, redirect, useFetcher, useNavigate, useNavigation, useParams, useSubmit } from 'react-router';
import { z } from 'zod';
import { EditableDateField } from '~/components/editable-date-field';
import { EditableSelectField } from '~/components/editable-select-field';
import { ActivityTimeline } from '~/components/kanban/activity-timeline';
import { EditableText } from '~/components/kanban/editible-text';
import { QuickTodoDialog } from '~/components/kanban/quick-todo-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { ComboboxMultiple } from '~/components/ui/combobox-multiple';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Separator } from '~/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import { Textarea } from '~/components/ui/textarea';
import { db } from '~/db/index';
import {
  activitiesTable,
  boardColumnTable,
  boardTable,
  boardTaskTable,
  companiesTable,
  peopleTable,
  taskAssigneesTable,
  taskCommentTable,
  userTable,
} from '~/db/schema';
import { requireUser } from '~/services/whop.server';
import { cn } from '~/utils';
import { logTaskActivity } from '~/utils/activity.server';
import type { Route } from './+types/$taskId';
import { QuickActionsMenu } from '~/components/quick-actions-menu';
import { NotesTab } from '~/components/notes-tab';

const removeUserSchema = z.object({
  invitedUser: z.string(),
});

const updateTaskSchema = z.object({
  taskId: z.string(),
  name: z.string(),
});

const insertCommentSchema = z.object({
  description: z.string(),
});
const removeCommentSchema = z.object({
  commentId: z.string(),
});

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { user } = await requireUser(request, params.companyId);
  const { taskId, companyId } = params;

  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'updateTask') {
    const submission = parseWithZod(formData, { schema: updateTaskSchema });

    if (submission.status !== 'success') {
      return data(submission.reply(), {
        status: submission.status === 'error' ? 400 : 200,
      });
    }

    // Verify task belongs to organization and get old task name
    const boards = await db.query.boardTable.findMany({
      where: eq(boardTable.companyId, companyId),
      with: {
        tasks: {
          where: eq(boardTaskTable.id, taskId),
        },
      },
    });

    const oldTask = boards.flatMap((b) => b.tasks).find((t) => t.id === taskId);

    if (!oldTask) {
      return data({ error: 'Task not found' }, { status: 404 });
    }

    await db
      .update(boardTaskTable)
      .set({
        name: submission.value.name,
      })
      .where(and(eq(boardTaskTable.id, taskId)));

    // Log activity if name changed
    if (oldTask && oldTask.name !== submission.value.name) {
      await logTaskActivity({
        taskId,
        userId: user.id,
        activityType: 'name_changed',
        metadata: {
          field: 'name',
          oldValue: oldTask.name,
          newValue: submission.value.name,
        },
      });
    }

    return {};
  }

  if (intent === 'insertComment') {
    const submission = parseWithZod(formData, { schema: insertCommentSchema });

    if (submission.status !== 'success') {
      return data(submission.reply(), {
        status: submission.status === 'error' ? 400 : 200,
      });
    }

    await db.insert(taskCommentTable).values({
      taskId: taskId,
      description: submission.value.description,
      userId: user.id,
    });

    // Log comment activity
    await logTaskActivity({
      taskId,
      userId: user.id,
      activityType: 'updated',
      description: 'Added a comment',
      metadata: {
        field: 'comment',
        action: 'added',
      },
    });

    return {};
  }

  if (intent === 'removeComment') {
    const submission = parseWithZod(formData, { schema: removeCommentSchema });

    if (submission.status !== 'success') {
      return data(submission.reply(), {
        status: submission.status === 'error' ? 400 : 200,
      });
    }

    await db
      .delete(taskCommentTable)
      .where(and(eq(taskCommentTable.id, submission.value.commentId), eq(taskCommentTable.userId, user.id)));

    // Log comment removal activity
    await logTaskActivity({
      taskId,
      userId: user.id,
      activityType: 'updated',
      description: 'Removed a comment',
      metadata: {
        field: 'comment',
        action: 'removed',
      },
    });

    return {};
  }

  if (intent === 'updateTaskField') {
    const fieldName = formData.get('fieldName')?.toString();
    const fieldValue = formData.get('fieldValue')?.toString();

    if (!fieldName) {
      return data({ error: 'Field name required' }, { status: 400 });
    }

    const allowedFields = ['priority', 'dueDate', 'status', 'amount', 'attachmentType'];
    if (!allowedFields.includes(fieldName)) {
      return data({ error: 'Invalid field' }, { status: 400 });
    }

    try {
      const updateData: Record<string, string | null | number> = {};
      if (fieldName === 'dueDate') {
        updateData.dueDate = fieldValue || null;
      } else if (fieldName === 'priority') {
        updateData.priority = fieldValue || null;
      } else if (fieldName === 'status') {
        // For status updates, fieldValue should be the columnId
        updateData.columnId = fieldValue || null;
      } else if (fieldName === 'amount') {
        updateData.amount = fieldValue ? Number.parseInt(fieldValue, 10) : null;
      } else if (fieldName === 'attachmentType') {
        let attachmentType: string | null = null;
        let attachmentName: string | null = null;

        if (fieldValue && fieldValue !== 'none') {
          const [type, id] = fieldValue.split(':');
          attachmentType = type;
          if (type === 'company') {
            updateData.companyId = id;
            updateData.personId = null;
            // Get company name for better logging
            const company = await db.query.companiesTable.findFirst({
              where: eq(companiesTable.id, id),
            });
            attachmentName = company?.name || 'company';
          } else if (type === 'person') {
            updateData.personId = id;
            updateData.companyId = null;
            // Get person name for better logging
            const person = await db.query.peopleTable.findFirst({
              where: eq(peopleTable.id, id),
            });
            attachmentName = person?.name || 'person';
          }
        } else {
          updateData.companyId = null;
          updateData.personId = null;
        }

        // Log attachment changes as these are significant relationships
        let description: string;
        if (fieldValue === 'none') {
          description = 'Removed attachment';
        } else {
          description = `Linked to ${attachmentName}`;
        }

        await logTaskActivity({
          taskId,
          userId: user.id,
          activityType: 'updated',
          description,
          relatedEntityId: fieldValue && fieldValue !== 'none' ? fieldValue.split(':')[1] : undefined,
          relatedEntityType: attachmentType as 'company' | 'person' | undefined,
        });
      }

      // Get old task data for logging status changes - validate through board
      let oldTask = null;
      if (fieldName === 'status') {
        const boards = await db.query.boardTable.findMany({
          where: eq(boardTable.companyId, companyId),
          with: {
            tasks: {
              where: eq(boardTaskTable.id, taskId),
              with: {
                column: true,
              },
            },
          },
        });

        oldTask = boards.flatMap((b) => b.tasks).find((t) => t.id === taskId) || null;
      }

      await db.update(boardTaskTable).set(updateData).where(eq(boardTaskTable.id, taskId));

      // Log status changes
      if (fieldName === 'status' && oldTask) {
        const oldColumnId = oldTask.columnId;
        const newColumnId = fieldValue;

        // Get column names for logging
        let oldColumnName = 'None';
        let newColumnName = 'None';

        if (oldColumnId) {
          const oldColumn = await db.query.boardColumnTable.findFirst({
            where: eq(boardColumnTable.id, oldColumnId),
          });
          oldColumnName = oldColumn?.name || 'Unknown';
        }

        if (newColumnId) {
          const newColumn = await db.query.boardColumnTable.findFirst({
            where: eq(boardColumnTable.id, newColumnId),
          });
          newColumnName = newColumn?.name || 'Unknown';
        }

        // Only log if status actually changed
        if (oldColumnId !== newColumnId) {
          await logTaskActivity({
            taskId,
            userId: user.id,
            activityType: 'status_changed',
            description: `Status changed from ${oldColumnName} to ${newColumnName}`,
            metadata: {
              field: 'status',
              oldValue: oldColumnName,
              newValue: newColumnName,
              oldColumnId,
              newColumnId,
            },
          });
        }
      }

      return data({ success: true });
    } catch {
      return data({ error: 'Failed to update field' }, { status: 500 });
    }
  }

  if (intent === 'updateAssignees') {
    const assigneeIds = formData.getAll('assigneeIds') as string[];

    // Get current assignees
    const currentAssignees = await db.query.taskAssigneesTable.findMany({
      where: eq(taskAssigneesTable.taskId, taskId),
    });

    const currentAssigneeIds = currentAssignees.map((a) => a.userId);
    const newAssigneeIds = assigneeIds.filter(Boolean);

    // Find users to add and remove
    const toAdd = newAssigneeIds.filter((id) => !currentAssigneeIds.includes(id));
    const toRemove = currentAssigneeIds.filter((id) => !newAssigneeIds.includes(id));

    // Add new assignees
    if (toAdd.length > 0) {
      await db.insert(taskAssigneesTable).values(
        toAdd.map((userId) => ({
          taskId,
          userId,
        })),
      );

      // Log activity for added users
      for (const userId of toAdd) {
        const addedUser = await db.query.userTable.findFirst({
          where: eq(userTable.id, userId),
        });
        await logTaskActivity({
          taskId,
          userId: user.id,
          activityType: 'assignee_added',
          relatedEntityId: userId,
          relatedEntityType: 'user',
          description: addedUser ? `${addedUser.name} was assigned` : 'User was assigned',
        });
      }
    }

    // Remove old assignees
    if (toRemove.length > 0) {
      await db
        .delete(taskAssigneesTable)
        .where(and(eq(taskAssigneesTable.taskId, taskId), inArray(taskAssigneesTable.userId, toRemove)));

      // Log activity for removed users
      for (const userId of toRemove) {
        const removedUser = await db.query.userTable.findFirst({
          where: eq(userTable.id, userId),
        });
        await logTaskActivity({
          taskId,
          userId: user.id,
          activityType: 'assignee_removed',
          relatedEntityId: userId,
          relatedEntityType: 'user',
          description: removedUser ? `${removedUser.name} was unassigned` : 'User was unassigned',
        });
      }
    }

    return {};
  }

  if (intent === 'createQuickTodo') {
    const name = String(formData.get('name') || '');
    const content = formData.get('content') ? String(formData.get('content')) : null;
    const priority = formData.get('priority') ? String(formData.get('priority')) : null;
    const dueDate = formData.get('dueDate') ? String(formData.get('dueDate')) : null;
    const relatedDealId = formData.get('parentTaskId') ? String(formData.get('parentTaskId')) : null;

    if (!name) {
      return data({ error: 'Task name required' }, { status: 400 });
    }

    // If relatedDealId is provided, create a regular task linked to the deal
    if (relatedDealId) {
      // Verify deal belongs to organization through board
      const boards = await db.query.boardTable.findMany({
        where: eq(boardTable.companyId, companyId),
        with: {
          tasks: {
            where: eq(boardTaskTable.id, relatedDealId),
          },
        },
      });

      const deal = boards.flatMap((b) => b.tasks).find((t) => t.id === relatedDealId);

      if (!deal) {
        return data({ error: 'Deal not found' }, { status: 404 });
      }

      // Ensure tasks board exists
      const tasksBoard = await db.query.boardTable.findFirst({
        where: and(eq(boardTable.companyId, companyId), eq(boardTable.type, 'tasks')),
      });

      if (!tasksBoard) {
        return data({ error: 'Tasks board not found' }, { status: 500 });
      }

      // Get the Todo column from existing tasks board
      const todoColumn = await db.query.boardColumnTable.findFirst({
        where: eq(boardColumnTable.boardId, tasksBoard.id),
        orderBy: (boardColumnTable, { asc }) => [asc(boardColumnTable.order)],
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

      await db.transaction(async (tx) => {
        const task = await tx
          .insert(boardTaskTable)
          .values({
            name,
            content: content || null,
            priority: priority || null,
            dueDate: dueDate || null,
            boardId: tasksBoard.id,
            columnId: todoColumn.id,
            type: 'tasks',
            order: nextOrder,
            ownerId: user.id,
            status: 'open',
            parentTaskId: relatedDealId, // Link task to the deal
          })
          .returning();

        await logTaskActivity({
          taskId: relatedDealId,
          userId: user.id,
          activityType: 'updated',
          description: `Created related task "${name}"`,
          relatedEntityId: task[0].id,
          relatedEntityType: 'task',
          tx,
        });
      });

      return {};
    }

    // Otherwise, create as regular task (fallback behavior)
    return data({ error: 'Deal ID required' }, { status: 400 });
  }

  const submission = parseWithZod(formData, { schema: removeUserSchema });

  if (submission.status !== 'success') {
    return data(submission.reply(), {
      status: submission.status === 'error' ? 400 : 200,
    });
  }

  const invitedUser = JSON.parse(submission.value.invitedUser);

  await db.insert(taskAssigneesTable).values({
    taskId: taskId,
    userId: invitedUser.id,
  });

  // Log user assignment activity
  await logTaskActivity({
    taskId,
    userId: user.id,
    activityType: 'assignee_added',
    description: `Assigned ${invitedUser.name || 'a user'}`,
    relatedEntityId: invitedUser.id,
    relatedEntityType: 'user',
  });

  return data(submission.reply());
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUser(request, params.companyId);
  const { projectId, companyId, taskId } = params;

  // Verify task belongs to organization through board relationship
  const boards = await db.query.boardTable.findMany({
    where: eq(boardTable.companyId, companyId),
    with: {
      tasks: {
        where: eq(boardTaskTable.id, taskId),
        with: {
          assignees: {
            with: {
              user: true,
            },
          },
          comments: {
            with: {
              user: true,
            },
            orderBy: (taskCommentTable, { desc }) => [desc(taskCommentTable.createdAt)],
          },
          column: true,
          board: {
            with: {
              members: true,
            },
          },
          owner: true,
        },
      },
    },
  });

  const task = boards.flatMap((b) => b.tasks).find((t) => t.id === taskId);

  if (!task || !task.board) {
    throw redirect(`/dashboard/${companyId}/projects/${projectId}`);
  }

  // Verify task belongs to this project
  if (task.board.id !== projectId) {
    throw redirect(`/dashboard/${companyId}/projects/${projectId}`);
  }

  // Fetch related tasks (tasks linked to this deal via parentTaskId) - validate through board
  const relatedTasksBoards = await db.query.boardTable.findMany({
    where: eq(boardTable.companyId, companyId),
    with: {
      tasks: {
        where: and(
          eq(boardTaskTable.type, 'tasks'),
          eq(boardTaskTable.parentTaskId, taskId), // Tasks where this deal is the parent
        ),
        with: {
          assignees: {
            with: {
              user: true,
            },
          },
          owner: true,
          column: true,
        },
      },
    },
  });

  const relatedTasks = relatedTasksBoards
    .flatMap((b) => b.tasks)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  // Fetch available columns for status changes
  const columns = task.boardId
    ? await db.query.boardColumnTable.findMany({
        where: eq(boardColumnTable.boardId, task.boardId),
        orderBy: (boardColumnTable, { asc }) => [asc(boardColumnTable.order)],
      })
    : [];

  // Fetch all users in the organization for assigning
  const users = await db.query.userTable.findMany({
    where: eq(userTable.organizationId, companyId),
    orderBy: userTable.name,
  });

  // Fetch all companies and people in the organization for attachment selection
  const allCompanies = await db.query.companiesTable.findMany({
    where: eq(companiesTable.organizationId, companyId),
    orderBy: companiesTable.name,
  });

  const allPeople = await db.query.peopleTable.findMany({
    where: eq(peopleTable.organizationId, companyId),
    orderBy: peopleTable.name,
  });

  // Fetch activities for this task
  const activities = await db.query.activitiesTable.findMany({
    where: and(eq(activitiesTable.entityType, 'task'), eq(activitiesTable.entityId, taskId)),
    with: {
      user: true,
    },
    orderBy: (activitiesTable, { desc }) => [desc(activitiesTable.createdAt)],
  });

  return {
    task: { ...task, activities },
    user,
    projectId,
    companyId,
    taskId,
    columns,
    users,
    allCompanies,
    allPeople,
    relatedTasks,
  };
}

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboardIcon },
  { id: 'activity', label: 'Activity', icon: ActivityIcon },
  { id: 'comments', label: 'Comments', icon: FileText },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'notes', label: 'Notes', icon: FileText },
  // { id: 'files', label: 'Files', icon: Paperclip },
];

const TaskRoute = ({ loaderData }: Route.ComponentProps) => {
  const { task, user, projectId, companyId, columns, users, allCompanies, allPeople, relatedTasks } = loaderData;
  const navigate = useNavigate();
  const navigation = useNavigation();
  const isAdding = navigation.state === 'submitting' && navigation.formData?.get('intent') === 'insertComment';
  const fetcher = useFetcher();
  const submit = useSubmit();
  const [activeTab, setActiveTab] = useState('overview');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [subTaskDialogOpen, setSubTaskDialogOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const params = useParams();

  useEffect(() => {
    if (isAdding) {
      formRef.current?.reset();
    }
  }, [isAdding]);

  // Prepare options for the assignee combobox
  const userOptions = users.map((u) => ({
    id: u.id,
    name: u.name || 'Unknown User',
    profilePictureUrl: u.profilePictureUrl || '',
  }));

  const selectedAssigneeIds = task.assignees?.map((a) => a.userId) || [];

  const handleAssigneeChange = (ids: string[]) => {
    const formData = new FormData();
    formData.append('intent', 'updateAssignees');
    ids.forEach((id) => {
      formData.append('assigneeIds', id);
    });
    submit(formData, { method: 'post' });
  };

  // Sidebar JSX
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
        {/* Avatar and Name */}
        <div className="mb-6">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-lg font-semibold text-primary-foreground">
            {task.name?.charAt(0) || 'T'}
          </div>
          <EditableText
            size="lg"
            fieldName="name"
            value={task.name}
            inputLabel="Edit task name"
            buttonLabel={`Edit task "${task.name}" name`}
          >
            <input type="hidden" name="intent" value="updateTask" />
            <input type="hidden" name="taskId" value={task.id} />
          </EditableText>
        </div>

        {/* Details Section */}
        <div className="space-y-4">
          <Separator />

          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Properties</h3>
            <div className="space-y-2">
              <div>
                <p className="text-muted-foreground text-xs mb-1">Status</p>
                <EditableSelectField
                  value={task.columnId || ''}
                  fieldName="fieldValue"
                  intent="updateTaskField"
                  fieldNameParam="status"
                  placeholder="Set status..."
                  options={columns.map((column) => ({
                    value: column.id,
                    label: column.name,
                  }))}
                />
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Due Date</p>
                <EditableDateField
                  value={task.dueDate}
                  fieldName="fieldValue"
                  intent="updateTaskField"
                  fieldNameParam="dueDate"
                  placeholder="Set due date..."
                />
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Priority</p>
                <EditableSelectField
                  value={task.priority}
                  fieldName="fieldValue"
                  intent="updateTaskField"
                  fieldNameParam="priority"
                  placeholder="Set priority..."
                  options={[
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' },
                  ]}
                />
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Deal Value</p>
                <EditableText
                  size="sm"
                  fieldName="fieldValue"
                  value={task.amount ? `$${task.amount.toLocaleString()}` : ''}
                  inputLabel="Edit deal value"
                  buttonLabel="Edit deal value"
                >
                  <input type="hidden" name="intent" value="updateTaskField" />
                  <input type="hidden" name="fieldName" value="amount" />
                </EditableText>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Attach to</h3>
            <div className="space-y-2">
              <EditableSelectField
                value={
                  task.companyId ? `company:${task.companyId}` : task.personId ? `person:${task.personId}` : 'none'
                }
                fieldName="fieldValue"
                intent="updateTaskField"
                fieldNameParam="attachmentType"
                placeholder="Select attachment..."
                options={[
                  { value: 'none', label: 'None' },
                  ...allCompanies.map((company) => ({
                    value: `company:${company.id}`,
                    label: `${company.name}`,
                  })),
                  ...allPeople.map((person) => ({
                    value: `person:${person.id}`,
                    label: `${person.name}`,
                  })),
                ]}
              />
            </div>
          </div>

          <Separator />

          <div>
            <div className="mb-2">
              <h3 className="text-xs font-medium text-muted-foreground">Assignees</h3>
              <div>
                <ComboboxMultiple
                  options={userOptions}
                  selectedIds={selectedAssigneeIds}
                  onSelectionChange={handleAssigneeChange}
                  placeholder="Select assignees..."
                  searchPlaceholder="Search users..."
                  emptyText="No users found."
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Owner</h3>
            <div className="space-y-2">
              {task.owner ? (
                <div className="flex items-center gap-2 text-sm">
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarImage src={task.owner.profilePictureUrl || ''} alt="avatar" />
                    <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                      {task.owner.name ? task.owner.name[0].toUpperCase() : 'O'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-foreground">{task.owner.name || 'Unknown'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No owner</p>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted-foreground">Metadata</h3>
            </div>
            <div className="space-y-2 text-xs">
              {task.createdAt && (
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="text-foreground">
                    {new Date(task.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}
              {task.updatedAt && task.updatedAt !== task.createdAt && (
                <div>
                  <p className="text-muted-foreground">Updated</p>
                  <p className="text-foreground">
                    {new Date(task.updatedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-1 overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:min-w-80 lg:border-border lg:border-r lg:bg-muted/30">{sidebarContent}</div>

      {/* Mobile Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-3/4 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Task Details</SheetTitle>
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
              {task.name?.charAt(0) || 'T'}
            </div>
            <div>
              <EditableText
                size="md"
                fieldName="name"
                value={task.name}
                inputLabel="Edit task name"
                buttonLabel={`Edit task "${task.name}" name`}
              >
                <input type="hidden" name="intent" value="updateTask" />
                <input type="hidden" name="taskId" value={task.id} />
              </EditableText>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <QuickActionsMenu
              type="task"
              entityId={task.id}
              entityName={task.name || 'Unnamed Task'}
              userId={user.id}
              organizationId={companyId}
              companies={allCompanies}
              people={allPeople}
              parentTaskId={task.id}
              onDelete={() => {
                const formData = new FormData();
                formData.append('intent', 'removeTask');
                formData.append('taskId', task.id);
                fetcher.submit(formData, {
                  method: 'post',
                  action: `/dashboard/${companyId}/projects/${projectId}/removeTask`,
                });
              }}
            />
          </div>
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
        <div className="flex-1 flex flex-col overflow-auto p-4">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Key Stats */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <LayoutDashboardIcon className="h-4 w-4" />
                  <h2 className="text-sm font-semibold">Overview</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Status */}
                  <Card className="p-4 bg-muted shadow-s border-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Status</p>
                        {task.column && (
                          <div className="flex items-center gap-2 text-sm">
                            <div className="mt-0.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                            <p className="text-foreground">{task.column.name}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>

                  {/* Assignees */}
                  <Card className="p-4 bg-muted shadow-s border-0">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Assignees</p>
                      <div className="space-y-2">
                        {task.assignees && task.assignees.length > 0 ? (
                          task.assignees.map((assignee) => (
                            <div key={assignee.userId} className="flex items-center gap-2 text-sm">
                              <Avatar className="h-6 w-6 shrink-0">
                                <AvatarImage src={assignee.user.profilePictureUrl || ''} alt="avatar" />
                                <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                                  {assignee.user.name ? assignee.user.name[0].toUpperCase() : 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 overflow-hidden">
                                <p className="truncate text-foreground">{assignee.user.name || 'Unassigned'}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground">No assignees</p>
                        )}
                      </div>
                    </div>
                  </Card>

                  {/* Comments Count */}
                  <Card className="p-4 bg-muted shadow-s border-0">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Comments</p>
                        <p className="text-sm font-medium">{task.comments?.length || 0} comments</p>
                      </div>
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Card>
                </div>
              </div>

              {/* Description */}
              <div>
                <div className="mb-3">
                  <h2 className="text-sm font-semibold">Description</h2>
                </div>
                {task.content ? (
                  <Card className="p-4 bg-muted shadow-s border-0">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{task.content}</p>
                  </Card>
                ) : (
                  <Card className="p-4 bg-muted/30 border-0 shadow-s text-center">
                    <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No description</p>
                  </Card>
                )}
              </div>

              {/* Recent Activity */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 mb-2">
                    <ActivityIcon className="h-4 w-4" />
                    <h2 className="text-sm font-semibold">Recent Activity</h2>
                  </div>
                </div>
                <ActivityTimeline
                  activities={task.activities?.slice(0, 5) || []}
                  fallbackCreatedAt={task.createdAt}
                  fallbackUpdatedAt={task.updatedAt}
                  fallbackName={task.name}
                  fallbackType="Task"
                />

                {(!task.activities || task.activities.length === 0) && (
                  <div className="rounded-lg border border-border bg-card p-4 text-center shadow-sm">
                    <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">No activity yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ActivityIcon className="h-4 w-4" />
                  <h2 className="text-sm font-semibold">All Activity</h2>
                </div>
              </div>
              <ActivityTimeline
                activities={task.activities}
                fallbackCreatedAt={task.createdAt}
                fallbackUpdatedAt={task.updatedAt}
                fallbackName={task.name}
                fallbackType="Task"
              />

              {(!task.activities || task.activities.length === 0) && (
                <div className="rounded-lg border border-border bg-card p-4 text-center shadow-sm">
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">No activity yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="space-y-4">
              {/* Comment Form */}
              <Card className="p-4 bg-muted/30 border-0 shadow-s border-none backdrop-blur-md">
                <Form method="post" className="space-y-3" ref={formRef}>
                  <div className="flex gap-2">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={user.profilePictureUrl || ''} alt="avatar" />
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                        {user.name ? user.name[0].toUpperCase() : 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <Textarea
                        name="description"
                        rows={2}
                        placeholder="Write a comment..."
                        className="text-sm resize-none"
                        disabled={isAdding}
                      />
                      <div className="flex justify-start">
                        <Button type="submit" variant="default" size="sm" className="h-8 text-xs" disabled={isAdding}>
                          {isAdding ? 'Posting...' : 'Post'}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <input type="hidden" name="intent" value="insertComment" />
                </Form>
              </Card>

              {/* Comments List */}
              <div className="space-y-3">
                {task.comments && task.comments.length > 0 ? (
                  task.comments.map((comment) => (
                    <Card key={comment.id} className="p-4 bg-card shadow-sm">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={comment.user?.profilePictureUrl || ''} alt="avatar" />
                          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                            {comment.user?.name ? comment.user.name[0].toUpperCase() : 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">{comment.user?.name || 'Unknown User'}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(comment.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                            {comment.userId === user.id && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto">
                                    <MoreHorizontal className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-32">
                                  <Form method="post">
                                    <input type="hidden" name="intent" value="removeComment" />
                                    <input type="hidden" name="commentId" value={comment.id} />
                                    <DropdownMenuItem asChild>
                                      <button type="submit" className="w-full">
                                        Delete
                                      </button>
                                    </DropdownMenuItem>
                                  </Form>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{comment.description}</p>
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <div className="rounded-lg border border-border bg-card p-4 text-center shadow-sm">
                    <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">No comments yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="flex-1 flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Related Tasks</h2>
                <Button size="sm" className="h-8 text-xs shadow-s" onClick={() => setSubTaskDialogOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New Task
                </Button>
              </div>
              {relatedTasks && relatedTasks.length > 0 ? (
                <div className="space-y-2">
                  {relatedTasks.map((relatedTask) => (
                    <Card key={relatedTask.id} className="p-4 bg-muted/30 border-0 shadow-s">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                            <h3 className="text-sm font-medium truncate">{relatedTask.name}</h3>
                            {relatedTask.priority && (
                              <Badge variant="outline" className="h-5 text-[10px] px-1.5 capitalize">
                                {relatedTask.priority}
                              </Badge>
                            )}
                            {relatedTask.column && (
                              <Badge variant="secondary" className="h-5 text-[10px] px-1.5">
                                {relatedTask.column.name}
                              </Badge>
                            )}
                          </div>
                          {relatedTask.content && (
                            <p className="text-xs text-muted-foreground line-clamp-2 ml-6">{relatedTask.content}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 ml-6 text-xs text-muted-foreground">
                            {relatedTask.dueDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(relatedTask.dueDate).toLocaleDateString()}
                              </span>
                            )}
                            {relatedTask.assignees && relatedTask.assignees.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {relatedTask.assignees.length}
                              </span>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-32">
                            <DropdownMenuItem asChild>
                              <Link
                                to={`/dashboard/${companyId}/tasks/${relatedTask.id}`}
                                className="w-full cursor-pointer"
                              >
                                View
                              </Link>
                            </DropdownMenuItem>
                            <Form method="post" action={`/dashboard/${companyId}/api/delete-todo`} navigate={false}>
                              <input type="hidden" name="taskId" value={relatedTask.id} />
                              <DropdownMenuItem asChild>
                                <button type="submit" className="w-full text-destructive">
                                  Delete
                                </button>
                              </DropdownMenuItem>
                            </Form>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-border border-dashed flex justify-center items-center flex-col p-4 text-center shadow-sm flex-1">
                  <CheckSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h2 className="text-lg font-semibold mb-2">No tasks yet</h2>
                  <p className="text-sm text-muted-foreground">Create a task to get started</p>
                </div>
              )}
              <QuickTodoDialog
                parentTaskId={params.taskId}
                userId={user.id}
                open={subTaskDialogOpen}
                onOpenChange={setSubTaskDialogOpen}
              />
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="max-w-full overflow-x-hidden">
              <NotesTab
                initialNotes={task.notes || ''}
                entityType="task"
                entityId={task.id}
                organizationId={companyId}
              />
            </div>
          )}

          {activeTab === 'files' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Files</h2>
                <Button size="sm" className="h-8 text-xs shadow-s">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Upload
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center shadow-sm">
                <Paperclip className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No files yet</p>
                <Button variant="outline" size="sm" className="mt-4 h-8 text-xs">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Upload first file
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskRoute;
