import { parseWithZod } from '@conform-to/zod';
import { data, Form, Link, redirect, useNavigation } from 'react-router';
import { z } from 'zod';
import type { Route } from './+types/index';
import { useEffect, useState } from 'react';
import { KanbanSquareIcon, X } from 'lucide-react';

import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { db } from '~/db';
import { boardColumnTable, boardMemberTable, boardTable, type UserType } from '~/db/schema';

import { eq, and } from 'drizzle-orm';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/ui/card';
import { requireUser } from '~/services/whop.server';
import { COLUMN_TEMPLATES } from '~/utils/column-templates';

const schema = z.object({
  name: z.string().min(1, 'Project name is required'),
  ownerId: z.string(),
  templateId: z.string().optional(),
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

  // Fetch template columns if templateId is provided
  if (submission.value.templateId) {
    const template = COLUMN_TEMPLATES.find((t) => t.id === submission.value.templateId);

    if (template?.columns) {
      await db.insert(boardColumnTable).values(
        template.columns.map((columnName: string, index: number) => ({
          name: columnName,
          order: index + 1,
          boardId: newProject[0].id,
        })),
      );
    }
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
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
            <KanbanSquareIcon className="h-3.5 w-3.5" />
          </div>
          <h1 className="text-base font-semibold">Projects</h1>
        </div>
        <div className="flex items-center gap-2">
          <CreateProjectDialog user={user} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 scrollbar-thin">
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
          <div className="flex flex-1 items-center justify-center py-40">
            <div className="text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <svg
                  aria-hidden="true"
                  className="h-6 w-6 text-muted-foreground"
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
              <h2 className="text-lg font-semibold mb-2">No projects yet</h2>
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
  const [open, setOpen] = useState(false);
  const [createMore, setCreateMore] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('default');

  useEffect(() => {
    if (navigation.state === 'idle' && !createMore) {
      setOpen(false);
    }
  }, [navigation.state, createMore]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 text-xs shadow-s">
          <svg aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create Project
        </Button>
      </DialogTrigger>
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
          <Form method="post" id="project-form" className="space-y-4 p-6">
            <input type="hidden" name="ownerId" value={user.id} />

            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm text-muted-foreground">
                Project name <span className="text-muted-foreground">(required)</span>
              </Label>
              <Input id="name" name="name" placeholder="Set Project name..." required className="h-9" />
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
          </Form>
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
            <Button type="submit" form="project-form" size="sm" className="h-8 text-xs shadow-s">
              {navigation.state === 'submitting' ? 'Creating...' : 'Create record'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
