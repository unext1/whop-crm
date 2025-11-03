import { parseWithZod } from '@conform-to/zod';
import { and, eq } from 'drizzle-orm';
import {
  CheckSquare,
  Clock,
  Edit,
  FileText,
  Menu,
  MoreHorizontal,
  Paperclip,
  Plus,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { data, Form, redirect, useFetcher, useNavigate } from 'react-router';
import { z } from 'zod';
import { ActivityTimeline } from '~/components/kanban/activity-timeline';
import { EditableText } from '~/components/kanban/editible-text';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '~/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Label } from '~/components/ui/label';
import { Separator } from '~/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import { Textarea } from '~/components/ui/textarea';
import { db } from '~/db/index';
import { requireUser } from '~/services/whop.server';
import { logTaskActivity } from '~/utils/activity.server';
import { cn } from '~/utils';
import type { Route } from './+types/$taskId';
import { boardTaskTable, taskAssigneesTable, taskCommentTable, activitiesTable } from '~/db/schema';

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
  const { taskId } = params;

  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'updateTask') {
    const submission = parseWithZod(formData, { schema: updateTaskSchema });

    if (submission.status !== 'success') {
      return data(submission.reply(), {
        status: submission.status === 'error' ? 400 : 200,
      });
    }

    const oldTask = await db.query.boardTaskTable.findFirst({
      where: eq(boardTaskTable.id, taskId),
    });

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

  const task = await db.query.boardTaskTable.findFirst({
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
      // Note: Activities are now stored in the unified activities table
      // We'll fetch them separately with a filter
      column: true,
      board: {
        with: {
          members: true,
        },
      },
      owner: true,
    },
    where: eq(boardTaskTable.id, taskId),
  });

  if (!task || !task.board) {
    throw redirect(`/dashboard/${companyId}/projects/${projectId}`);
  }

  // Fetch activities for this task
  const activities = await db.query.activitiesTable.findMany({
    where: and(eq(activitiesTable.entityType, 'task'), eq(activitiesTable.entityId, taskId)),
    with: {
      user: true,
    },
    orderBy: (activitiesTable, { desc }) => [desc(activitiesTable.createdAt)],
  });

  return { task: { ...task, activities }, user, projectId, companyId, taskId };
}

const tabs = [
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'comments', label: 'Comments', icon: FileText },
  { id: 'tasks', label: 'Sub-tasks', icon: CheckSquare },
  { id: 'files', label: 'Files', icon: Paperclip },
];

const TaskRoute = ({ loaderData }: Route.ComponentProps) => {
  const { task, user, projectId, companyId } = loaderData;
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const [activeTab, setActiveTab] = useState('timeline');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [manageUsersOpen, setManageUsersOpen] = useState(false);

  // Task sidebar content
  const TaskSidebar = () => (
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
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      <div className=" p-4">
        {/* Avatar and Name */}
        <div className="mb-6">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-lg font-semibold text-primary-foreground">
            {task.name?.charAt(0) || 'T'}
          </div>
          <h2 className="text-lg font-semibold">{task.name || 'Unnamed Task'}</h2>
          {task.column && (
            <Badge variant="secondary" className="mt-1.5 text-xs capitalize">
              {task.column.name}
            </Badge>
          )}
        </div>

        {/* Details Section */}
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Status</h3>
            <div className="space-y-2">
              {task.column && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="mt-0.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                  <div className="flex-1">
                    <p className="text-foreground">{task.column.name}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted-foreground">Assignees</h3>
              {task.ownerId === user.id && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setManageUsersOpen(true)}>
                  <Edit className="h-3 w-3" />
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {task.assignees && task.assignees.length > 0 ? (
                task.assignees.map((assignee) => (
                  <div key={assignee.userId} className="flex items-center gap-2 text-sm">
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarImage src={assignee.user.name || ''} alt="avatar" />
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

          <Separator />

          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Owner</h3>
            <div className="space-y-2">
              {task.owner ? (
                <div className="flex items-center gap-2 text-sm">
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarImage src={task.owner.name || ''} alt="avatar" />
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
      <div className="hidden lg:flex lg:min-w-72 lg:w-96 lg:border-r lg:border-border lg:bg-muted/30">
        <TaskSidebar />
      </div>

      {/* Mobile Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-3/4 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Task Details</SheetTitle>
          </SheetHeader>
          <TaskSidebar />
        </SheetContent>
      </Sheet>

      {/* Main Panel */}
      <div className="flex flex-1 flex-col">
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
            {task.ownerId === user.id && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs bg-transparent"
                  onClick={() => setManageUsersOpen(true)}
                >
                  <User className="mr-1.5 h-3.5 w-3.5" />
                  Manage Users
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-32 bg-muted/30 backdrop-blur-md border-none shadow-lg">
                    <DropdownMenuLabel className="text-xs">Task Control</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <fetcher.Form
                        method="post"
                        action={`/dashboard/${companyId}/projects/${projectId}/removeTask`}
                        className="my-auto"
                      >
                        <input type="hidden" name="intent" value="removeTask" />
                        <input type="hidden" name="taskId" value={task.id} />
                        <button aria-label="Delete Task" type="submit" className="w-full">
                          <DropdownMenuItem className="text-xs text-destructive">
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </button>
                      </fetcher.Form>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border px-4">
          <div className="flex gap-1">
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
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'timeline' && (
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground">
                {new Date(task.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
              </div>
              <ActivityTimeline
                activities={task.activities}
                fallbackCreatedAt={task.createdAt}
                fallbackUpdatedAt={task.updatedAt}
                fallbackName={task.name}
                fallbackType="Task"
              />
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="space-y-4">
              {/* Comment Form */}
              <Card className="p-4 bg-muted/30 backdrop-blur-md border-none shadow-sm">
                <Form method="post" className="space-y-3">
                  <Label className="text-xs font-semibold text-muted-foreground">Add Comment</Label>
                  <div className="flex gap-2 mt-4">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={user.name || ''} alt="avatar" />
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                        {user.name ? user.name[0].toUpperCase() : 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <Textarea
                        name="description"
                        rows={3}
                        placeholder="Write a comment..."
                        className="text-sm resize-none"
                      />
                      <div className="flex justify-end">
                        <Button type="submit" variant="outline" size="sm" className="h-8 text-xs bg-transparent">
                          Post
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
                          <AvatarImage src={comment.user?.name || ''} alt="avatar" />
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
                          </div>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{comment.description}</p>
                          {comment.userId === user.id && (
                            <fetcher.Form method="post" className="mt-2">
                              <input type="hidden" name="intent" value="removeComment" />
                              <input type="hidden" name="commentId" value={comment.id} />
                              <Button
                                type="submit"
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs text-muted-foreground hover:text-destructive"
                              >
                                Delete
                              </Button>
                            </fetcher.Form>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
                    <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">No comments yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Sub-tasks</h2>
                <Button size="sm" className="h-8 text-xs">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New Sub-task
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
                <CheckSquare className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No sub-tasks yet</p>
                <Button variant="outline" size="sm" className="mt-4 h-8 text-xs">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Create first sub-task
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Files</h2>
                <Button size="sm" className="h-8 text-xs">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Upload
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
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

      {/* Manage Users Dialog */}
      <Dialog open={manageUsersOpen} onOpenChange={setManageUsersOpen}>
        <DialogContent
          className="sm:max-w-xl p-0 gap-0 overflow-hidden bg-muted/30 backdrop-blur-md border-none shadow-lg"
          showCloseButton={false}
        >
          {/* Header */}
          <div className="flex h-14 items-center justify-between border-b border-border px-6 bg-muted/40">
            <DialogTitle className="text-sm font-semibold m-0">Manage Users</DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>
          {/* Content */}
          <div className="overflow-auto max-h-[calc(100vh-180px)] p-6">
            <div className="space-y-3">
              {task.assignees && task.assignees.length > 0 ? (
                task.assignees.map((assignee) => {
                  return (
                    <div
                      key={assignee.taskId}
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={assignee.user.name || ''} alt="avatar" />
                          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                            {assignee.user.name ? assignee.user.name[0].toUpperCase() : ''}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{assignee.user.name}</span>
                      </div>
                      {task.ownerId === user.id ? (
                        <fetcher.Form method="post" action={`/dashboard/${companyId}/projects/${projectId}/removeUser`}>
                          <input type="hidden" value={assignee.userId} name="userId" />
                          <input type="hidden" value={task.id} name="taskId" />
                          <Button type="submit" variant="ghost" size="sm" className="h-7 w-7 text-xs">
                            ×
                          </Button>
                        </fetcher.Form>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No users assigned</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TaskRoute;
