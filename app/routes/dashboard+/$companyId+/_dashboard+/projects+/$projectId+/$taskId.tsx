import { parseWithZod } from '@conform-to/zod';
import { and, eq } from 'drizzle-orm';
import { EllipsisVerticalIcon } from 'lucide-react';
import { data, Form, redirect, useFetcher } from 'react-router';
import { z } from 'zod';
import { EditableText } from '~/components/kanban/editible-text';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Textarea } from '~/components/ui/textarea';
import { H4, P } from '~/components/ui/typography';
import { db } from '~/db/index';
import { requireUser } from '~/services/whop.server';
import type { Route } from './+types/$taskId';
import { boardTaskTable, taskAssigneesTable, taskCommentTable } from '~/db/schema';

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

    return await db
      .update(boardTaskTable)
      .set({
        name: submission.value.name,
      })
      .where(and(eq(boardTaskTable.id, taskId)));
  }

  if (intent === 'insertComment') {
    const submission = parseWithZod(formData, { schema: insertCommentSchema });

    if (submission.status !== 'success') {
      return data(submission.reply(), {
        status: submission.status === 'error' ? 400 : 200,
      });
    }

    return await db.insert(taskCommentTable).values({
      taskId: taskId,
      description: submission.value.description,
      userId: user.id,
    });
  }

  if (intent === 'removeComment') {
    const submission = parseWithZod(formData, { schema: removeCommentSchema });

    if (submission.status !== 'success') {
      return data(submission.reply(), {
        status: submission.status === 'error' ? 400 : 200,
      });
    }

    return await db
      .delete(taskCommentTable)
      .where(and(eq(taskCommentTable.id, submission.value.commentId), eq(taskCommentTable.userId, user.id)));
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
      comments: true,
      column: true,
      board: {
        with: {
          members: true,
        },
      },
    },
    where: eq(boardTaskTable.id, taskId),
  });

  if (!task || !task.board) {
    throw redirect(`/dashboard/${companyId}/projects/${projectId}`);
  }

  const isMember = task.board.members.find((i) => i.userId === user.id);
  if (!isMember) {
    throw redirect(`/dashboard/${companyId}/projects/${projectId}`);
  }

  return { task: task, user, projectId, companyId, taskId };
}

const TaskRoute = ({ loaderData }: Route.ComponentProps) => {
  const { task, user, projectId, companyId } = loaderData;

  const fetcher = useFetcher();

  return (
    <div>
      <div className="flex justify-between">
        <H4 className="mb-6 capitalize tracking-wide">Project / Task / {task.name}</H4>
        <div className="flex gap-4">
          {task.ownerId === user.id ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="default" size="sm">
                  Manage Users
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Manage Users</DialogTitle>
                  <DialogDescription>Manage your task users.</DialogDescription>
                </DialogHeader>
                <div>
                  <div className="flex mt-8">
                    {task.assignees
                      ? task.assignees.map((assignee) => {
                          return (
                            <div key={assignee.taskId} className="flex">
                              <button type="button" className="text-xs text-muted-foreground">
                                <Avatar>
                                  <AvatarImage src={assignee.user.name || ''} alt="avatar" />
                                  <AvatarFallback>{assignee.user.name ? assignee.user.name[0] : ''}</AvatarFallback>
                                </Avatar>
                              </button>
                              {task.ownerId === user.id ? (
                                <div className="flex justify-end">
                                  <fetcher.Form
                                    method="post"
                                    action={`/dashboard/${companyId}/projects/${projectId}/removeUser`}
                                  >
                                    <input type="hidden" value={assignee.userId} name="userId" />
                                    <Button type="submit" variant="ghost" size="sm">
                                      X
                                    </Button>
                                  </fetcher.Form>
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                      : null}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <div>
          <P className="text-xs text-muted-foreground">{task.createdAt}</P>
          <div className="flex gap-6 mt-4 items-center justify-between">
            <EditableText
              size="lg"
              fieldName="name"
              value={task.name}
              inputLabel="Edit column name"
              buttonLabel={`Edit column "${task.name}" name`}
            >
              <input type="hidden" name="intent" value="updateTask" />
              <input type="hidden" name="taskId" value={task.id} />
            </EditableText>
            {user.id === task.ownerId ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <EllipsisVerticalIcon className="h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-20">
                  <DropdownMenuLabel>Task Control</DropdownMenuLabel>
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
                        <DropdownMenuItem>Delete</DropdownMenuItem>
                      </button>
                    </fetcher.Form>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
          <div className="flex items-center gap-6 mt-4 text-muted-foreground text-xs">
            <div>Status</div>
            <div>{task?.column?.name}</div>
          </div>
          <div className="flex items-center gap-6 mt-2 text-muted-foreground text-xs">
            <P>Assignees </P>
            <div className="flex gap-2 flex-wrap">
              {task.assignees.map((i) => {
                return (
                  <div key={i.userId} className="flex items-center gap-1">
                    <Avatar>
                      <AvatarImage src={i.user.name || ''} alt="avatar" />
                      <AvatarFallback>{i.user.name ? i.user.name[0] : null}</AvatarFallback>
                    </Avatar>
                    <div>{i.user.name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <P className="text-sm mb-4 mt-6">Content</P>

        <P className="text-sm">{task.content}</P>

        <div className="mt-8">
          <Tabs defaultValue="timesheets">
            <TabsList className="grid grid-cols-2 w-[200px]">
              <TabsTrigger value="comments">Comments</TabsTrigger>
            </TabsList>

            <TabsContent value="comments">
              <Form className="mb-2 mt-4" method="post">
                <Card className="p-6">
                  <span className="text-xs font-semibold ">Comment</span>
                  <div className="mt-2 gap-2 flex w-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.name || ''} alt="avatar" />
                      <AvatarFallback className="text-muted-foreground">{user.name ? user.name[0] : ''}</AvatarFallback>
                    </Avatar>
                    <Textarea name="description" rows={2} />
                    <input type="hidden" name="intent" value="insertComment" />
                  </div>
                  <div className="flex justify-end">
                    <Button className="mt-2" variant="outline" size="sm">
                      Post
                    </Button>
                  </div>
                </Card>
              </Form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default TaskRoute;
