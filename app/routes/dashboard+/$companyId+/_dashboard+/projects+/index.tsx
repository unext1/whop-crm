import { parseWithZod } from '@conform-to/zod';
import { data, Form, Link, redirect, useNavigation } from 'react-router';
import { z } from 'zod';
import type { Route } from './+types/index';

import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip';
import { db } from '~/db';
import { boardColumnTable, boardMemberTable, boardTable, type UserType } from '~/db/schema';

import { eq, and } from 'drizzle-orm';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/ui/card';
import { requireUser } from '~/services/whop.server';

const schema = z.object({
  name: z.string().min(1, 'Project name is required'),
  ownerId: z.string(),
  defaultColumns: z.boolean().default(false),
});

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUser(request, params.companyId);
  const { companyId } = params;
  const formData = await request.formData();

  const submission = parseWithZod(formData, { schema });

  if (submission.status !== 'success') {
    return data(submission.reply(), {
      status: submission.status === 'error' ? 400 : 200,
    });
  }

  const newProject = await db
    .insert(boardTable)
    .values({
      name: submission.value.name,
      ownerId: submission.value.ownerId,
      companyId: companyId,
      type: 'pipeline',
    })
    .returning();

  await db.insert(boardMemberTable).values({
    boardId: newProject[0].id,
    userId: user.id,
  });

  if (submission.value.defaultColumns) {
    await db.insert(boardColumnTable).values({
      name: '❌ Not Started',
      order: 1,
      boardId: newProject[0].id,
    });
    await db.insert(boardColumnTable).values({
      name: '💡 To Do',
      order: 2,
      boardId: newProject[0].id,
    });
    await db.insert(boardColumnTable).values({
      name: '⏳ In Progress',
      order: 3,
      boardId: newProject[0].id,
    });
    await db.insert(boardColumnTable).values({
      name: '� Done',
      order: 4,
      boardId: newProject[0].id,
    });
  }

  return redirect(`/dashboard/${companyId}/projects/${newProject[0].id}`);
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUser(request, params.companyId);
  const { companyId } = params;

  const projects = await db.query.boardTable.findMany({
    where: and(eq(boardTable.companyId, companyId), eq(boardTable.type, 'pipeline')),
  });

  // If projects exist, default to the first one
  if (projects.length > 0) {
    return redirect(`/dashboard/${companyId}/projects/${projects[0].id}`);
  }

  return {
    user,
    projects,
    companyId,
  };
}

const ProjectPage = ({ loaderData }: Route.ComponentProps) => {
  const { user, projects, companyId } = loaderData;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold">Projects</h1>
        </div>
        <div className="flex items-center gap-2">
          <CreateProjectDialog user={user} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {projects.length >= 1 ? (
          <div className="grid sm:grid-cols-2 grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((project) => {
              return (
                <div key={project.id}>
                  <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-base">{project.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xs text-muted-foreground">
                        Created {new Date(project.createdAt).toLocaleDateString()}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button asChild variant="outline" size="sm" className="w-full">
                        <Link to={`/dashboard/${companyId}/projects/${project.id}`}>View Project</Link>
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-1 items-center py-40 justify-center">
            <div className="flex flex-col items-center gap-1 text-center max-w-md">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <svg
                  aria-hidden="true"
                  className="h-8 w-8 text-muted-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold">No projects yet</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Create your first project to start organizing your tasks and collaborating with your team.
              </p>
              <CreateProjectDialog user={user} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectPage;

const CreateProjectDialog = ({ user }: { user: UserType }) => {
  const navigation = useNavigation();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 text-xs">
          <svg aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
          <DialogDescription>
            Create a new project to organize your tasks and collaborate with your team.
          </DialogDescription>
        </DialogHeader>

        <Form method="post" className="grid gap-4 py-4">
          <div className="grid grid-cols-6 items-center gap-x-4 gap-y-2">
            <Input name="ownerId" type="hidden" value={user.id} />
            <Label htmlFor="name" className="text-right col-span-2 text-sm whitespace-nowrap w-fit">
              Project Name
            </Label>

            <Input name="name" type="text" placeholder="My awesome project" className="col-span-4" />

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="defaultColumns" className="text-right col-span-2 text-sm whitespace-nowrap w-fit">
                    Default Columns
                  </Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Default columns: Not Started, Todo, In Progress, Done</p>{' '}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Checkbox name="defaultColumns" />
          </div>
          <Button type="submit" className="w-full">
            {navigation.location ? 'Creating...' : 'Create Project'}
          </Button>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
