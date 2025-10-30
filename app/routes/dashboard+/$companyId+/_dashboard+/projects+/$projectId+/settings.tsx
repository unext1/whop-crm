import { parseWithZod } from '@conform-to/zod';
import { eq } from 'drizzle-orm';
import { useRef } from 'react';
import { data, Form, redirect, useFetcher } from 'react-router';
import { z } from 'zod';
import type { Route } from './+types/settings';

import { SaveButton } from '~/components/kanban/editible-text';

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
import { Input } from '~/components/ui/input';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { H4 } from '~/components/ui/typography';
import { db } from '~/db';
import { boardMemberTable, boardTable } from '~/db/schema';
import { requireUser } from '~/services/whop.server';

const schema = z.object({
  userId: z.string().min(1, 'User is required'),
});

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { user } = await requireUser(request, params.companyId);
  const { projectId, companyId } = params;

  const project = await db.query.boardTable.findFirst({
    with: {
      tasks: true,
      owner: true,
      members: true,
      columns: {
        orderBy: (boardColumnTable, { asc }) => [asc(boardColumnTable.order)],
      },
    },
    where: eq(boardTable.id, projectId),
  });

  if (project?.ownerId !== user.id) {
    throw redirect(`/dashboard/${companyId}/projects`);
  }

  return { project, projectId, companyId };
};

export const action = async ({ request, params }: Route.ActionArgs) => {
  await requireUser(request, params.companyId);
  const { projectId } = params;
  const formData = await request.formData();

  const submission = parseWithZod(formData, { schema });

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
};

const ProjectSettings = ({ loaderData }: Route.ComponentProps) => {
  const { project, projectId, companyId } = loaderData;

  const inputRef = useRef<HTMLInputElement>(null);
  const fetcher = useFetcher();

  return (
    <div>
      <div className="flex justify-between">
        <H4 className="mb-6 capitalize tracking-wide">Project / {project.name} / Settings</H4>
        <div className="flex gap-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="default" size="sm">
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Invite Member</DialogTitle>
                <DialogDescription>Invite member to join your project.</DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="default" size="sm">
                Create Column
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create Column</DialogTitle>
                {/* <DialogDescription>Create Column</DialogDescription> */}
              </DialogHeader>

              <fetcher.Form method="post" action={`/dashboard/${companyId}/projects/${projectId}?index`}>
                <input type="hidden" name="intent" value="createColumn" />
                <input type="hidden" name="projectId" value={projectId} />
                <Input
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  required
                  ref={inputRef}
                  type="text"
                  name="name"
                />
                <div className="flex justify-between mt-4">
                  <SaveButton type="submit">Save Column</SaveButton>
                </div>
              </fetcher.Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Card className="p-4 py-6">
        <Table>
          <TableCaption>Project Columns</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Column</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {project
              ? project.columns.map((column) => (
                  <TableRow key={column.id} draggable={true}>
                    <TableCell>{column?.name}</TableCell>
                    <TableCell className="flex justify-end">
                      <Form
                        method="post"
                        action={`/dashboard/${companyId}/projects/${projectId}?index`}
                        navigate={false}
                      >
                        <input type="hidden" name="intent" value="removeColumn" />
                        <input type="hidden" name="columnId" value={column.id} />
                        <Button variant="destructive" type="submit" size="sm">
                          X
                        </Button>
                      </Form>
                    </TableCell>
                  </TableRow>
                ))
              : null}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};
export default ProjectSettings;
