import { and, eq, or } from 'drizzle-orm';
import {
  Building2,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Circle,
  Clock,
  Edit,
  FileText,
  Globe,
  Linkedin,
  Mail,
  MapPin,
  Menu,
  Paperclip,
  Phone,
  Plus,
  Trash2,
  Twitter,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { data, redirect, useLoaderData, useNavigate, useSubmit } from 'react-router';
import { ActivityTimeline } from '~/components/kanban/activity-timeline';
import { QuickTodoDialog } from '~/components/kanban/quick-todo-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '~/components/ui/alert-dialog';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { ComboboxMultiple } from '~/components/ui/combobox-multiple';
import { Separator } from '~/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import { db } from '~/db';
import {
  activitiesTable,
  boardColumnTable,
  boardTable,
  boardTaskTable,
  companiesPeopleTable,
  companiesTable,
  peopleTable,
} from '~/db/schema';
import { putToast } from '~/services/cookie.server';
import { verifyWhopToken, whopSdk } from '~/services/whop.server';
import { logCompanyActivity, logTaskActivity } from '~/utils/activity.server';
import type { Route } from './+types';

export const loader = async ({ params, request }: Route.LoaderArgs) => {
  const { companyId: organizationId, id: companyId } = params;
  const { userId } = await verifyWhopToken(request);
  const { access_level } = await whopSdk.users.checkAccess(organizationId, { id: userId });

  // Fetch the specific company with organization isolation and people relationships
  const company = await db.query.companiesTable.findFirst({
    where: and(eq(companiesTable.id, companyId), eq(companiesTable.organizationId, organizationId)),
    with: {
      companiesPeople: {
        with: {
          person: true,
        },
      },
    },
  });

  if (!company) {
    throw new Response('Company not found', { status: 404 });
  }

  // Fetch all people in the organization for the combobox
  const allPeople = await db.query.peopleTable.findMany({
    where: eq(peopleTable.organizationId, organizationId),
    orderBy: peopleTable.name,
  });

  // Fetch associated tasks
  const tasks = await db.query.boardTaskTable.findMany({
    where: eq(boardTaskTable.companyId, companyId),
    with: {
      column: true,
    },
    orderBy: boardTaskTable.order,
  });

  // Group tasks by column
  const tasksByColumn = tasks.reduce(
    (acc, task) => {
      if (task.column) {
        if (!acc[task.column.name]) {
          acc[task.column.name] = [];
        }
        acc[task.column.name].push(task);
      }
      return acc;
    },
    {} as Record<string, typeof tasks>,
  );

  // Fetch activities for this company
  const activities = await db.query.activitiesTable.findMany({
    where: and(eq(activitiesTable.entityType, 'company'), eq(activitiesTable.entityId, companyId)),
    with: {
      user: true,
    },
    orderBy: (activitiesTable, { desc }) => [desc(activitiesTable.createdAt)],
  });

  return { userId, access_level, organizationId, company: { ...company, activities }, allPeople, tasksByColumn };
};

export const action = async ({ params, request }: Route.ActionArgs) => {
  const { companyId: organizationId, id: companyId } = params;
  const { userId } = await verifyWhopToken(request);
  await whopSdk.users.checkAccess(organizationId, { id: userId });

  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'update-people') {
    const peopleIds = formData.getAll('peopleIds') as string[];

    // Get current people relationships
    const currentRelationships = await db.query.companiesPeopleTable.findMany({
      where: eq(companiesPeopleTable.companyId, companyId),
    });

    const currentPeopleIds = currentRelationships.map((r) => r.personId);
    const newPeopleIds = peopleIds.filter(Boolean);

    // Find people to add (in new but not in current)
    const toAdd = newPeopleIds.filter((id) => !currentPeopleIds.includes(id));

    // Find people to remove (in current but not in new)
    const toRemove = currentPeopleIds.filter((id) => !newPeopleIds.includes(id));

    try {
      // Add new relationships
      if (toAdd.length > 0) {
        await db.insert(companiesPeopleTable).values(
          toAdd.map((personId) => ({
            companyId,
            personId,
          })),
        );

        // Log activity for each person added
        for (const personId of toAdd) {
          const person = await db.query.peopleTable.findFirst({
            where: eq(peopleTable.id, personId),
          });
          await logCompanyActivity({
            companyId,
            userId,
            activityType: 'updated',
            description: person ? `Added ${person.name} to company` : 'Added person to company',
            relatedEntityId: personId,
            relatedEntityType: 'person',
          });
        }
      }

      // Remove old relationships
      if (toRemove.length > 0) {
        await db
          .delete(companiesPeopleTable)
          .where(
            and(
              eq(companiesPeopleTable.companyId, companyId),
              or(...toRemove.map((personId) => eq(companiesPeopleTable.personId, personId))),
            ),
          );

        // Log activity for each person removed
        for (const personId of toRemove) {
          const person = await db.query.peopleTable.findFirst({
            where: eq(peopleTable.id, personId),
          });
          await logCompanyActivity({
            companyId,
            userId,
            activityType: 'updated',
            description: person ? `Removed ${person.name} from company` : 'Removed person from company',
            relatedEntityId: personId,
            relatedEntityType: 'person',
          });
        }
      }

      const headers = await putToast({
        title: 'Success',
        message: 'People updated successfully',
        variant: 'default',
      });

      return redirect(`/dashboard/${organizationId}/company/${companyId}`, { headers });
    } catch {
      const headers = await putToast({
        title: 'Error',
        message: 'Failed to update people',
        variant: 'destructive',
      });
      return data({ error: 'Failed to update people' }, { headers, status: 500 });
    }
  }

  // Delete company
  if (intent === 'delete') {
    try {
      await db
        .delete(companiesTable)
        .where(and(eq(companiesTable.id, companyId), eq(companiesTable.organizationId, organizationId)));

      const headers = await putToast({
        title: 'Success',
        message: 'Company deleted successfully',
        variant: 'default',
      });

      return redirect(`/dashboard/${organizationId}/company`, { headers });
    } catch {
      const headers = await putToast({
        title: 'Error',
        message: 'Failed to delete company',
        variant: 'destructive',
      });
      return data({ error: 'Failed to delete company' }, { headers, status: 500 });
    }
  }

  // Create quick todo
  if (intent === 'createQuickTodo') {
    // Helper to ensure tasks board exists
    const ensureTasksBoard = async (orgId: string) => {
      const existingBoard = await db.query.boardTable.findFirst({
        where: and(eq(boardTable.companyId, orgId), eq(boardTable.type, 'tasks')),
      });

      if (existingBoard) {
        return existingBoard;
      }

      const newBoard = await db
        .insert(boardTable)
        .values({
          name: 'Tasks',
          type: 'tasks',
          companyId: orgId,
          ownerId: null,
        })
        .returning();

      await db.insert(boardColumnTable).values([
        { name: 'Todo', order: 1, boardId: newBoard[0].id },
        { name: 'In Progress', order: 2, boardId: newBoard[0].id },
        { name: 'Done', order: 3, boardId: newBoard[0].id },
      ]);

      return newBoard[0];
    };

    const name = String(formData.get('name') || '');
    const content = formData.get('content') ? String(formData.get('content')) : null;
    const relatedCompanyId = formData.get('relatedCompanyId') ? String(formData.get('relatedCompanyId')) : null;

    if (!name) {
      return data({ error: 'Task name required' }, { status: 400 });
    }

    try {
      const tasksBoard = await ensureTasksBoard(organizationId);

      // Find the "Todo" column
      const todoColumn = await db.query.boardColumnTable.findFirst({
        where: and(eq(boardColumnTable.boardId, tasksBoard.id), eq(boardColumnTable.name, 'Todo')),
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
            columnId: todoColumn.id,
            name,
            order: nextOrder,
            ownerId: userId,
            boardId: tasksBoard.id,
            content,
            type: 'tasks',
            status: 'open',
            companyId: relatedCompanyId || companyId,
          })
          .returning();

        // Note: For todos created from company page, we don't automatically assign the owner as an assignee
        // Owner is tracked separately via ownerId and displayed as "Created By"

        // Log activity for task creation
        await logTaskActivity({
          taskId: task[0].id,
          userId,
          activityType: 'created',
          description: `Task "${name}" was created`,
          tx,
        });

        // Log activity for company
        await logCompanyActivity({
          companyId: relatedCompanyId || companyId,
          userId,
          activityType: 'task_created',
          description: `Created task "${name}"`,
          relatedEntityId: task[0].id,
          relatedEntityType: 'task',
          tx,
        });
      });

      const headers = await putToast({
        title: 'Success',
        message: 'Todo created successfully',
        variant: 'default',
      });

      return data({ success: true }, { headers });
    } catch {
      const headers = await putToast({
        title: 'Error',
        message: 'Failed to create todo',
        variant: 'destructive',
      });
      return data({ error: 'Failed to create todo' }, { headers, status: 500 });
    }
  }

  // Complete task
  if (intent === 'completeTask') {
    const taskId = formData.get('taskId')?.toString();
    const columnName = formData.get('columnName')?.toString();

    if (!taskId) {
      return data({ error: 'Task ID required' }, { status: 400 });
    }

    try {
      // Find the "Done" or "Completed" column
      const doneColumn = await db.query.boardColumnTable.findFirst({
        where: eq(boardColumnTable.name, columnName || 'Done'),
      });

      if (doneColumn) {
        await db.update(boardTaskTable).set({ columnId: doneColumn.id }).where(eq(boardTaskTable.id, taskId));
      }

      const headers = await putToast({
        title: 'Success',
        message: 'Task completed',
        variant: 'default',
      });

      return data({ success: true }, { headers });
    } catch {
      const headers = await putToast({
        title: 'Error',
        message: 'Failed to complete task',
        variant: 'destructive',
      });
      return data({ error: 'Failed to complete task' }, { headers, status: 500 });
    }
  }

  return data({ error: 'Invalid intent' }, { status: 400 });
};

const tabs = [
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'files', label: 'Files', icon: Paperclip },
  { id: 'emails', label: 'Emails', icon: Mail },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
];

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const CompanyPage = () => {
  const { company, allPeople, tasksByColumn, userId, organizationId } = useLoaderData<typeof loader>();
  const [activeTab, setActiveTab] = useState('timeline');
  const [sheetOpen, setSheetOpen] = useState(false);
  const navigate = useNavigate();
  const submit = useSubmit();

  // Get currently selected people IDs
  const selectedPeopleIds = company.companiesPeople.map((cp) => cp.person.id);

  // Prepare options for the combobox
  const peopleOptions = allPeople.map((person) => ({
    id: person.id,
    name: person.name,
    email: undefined, // You can add email if you fetch it
  }));

  const handlePeopleChange = (ids: string[]) => {
    const formData = new FormData();
    formData.append('intent', 'update-people');
    ids.forEach((id) => {
      formData.append('peopleIds', id);
    });
    submit(formData, { method: 'post' });
  };

  // Company sidebar content
  const CompanySidebar = () => (
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
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Company</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {company.name}? This action cannot be undone and will permanently remove
                this company and all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  const formData = new FormData();
                  formData.append('intent', 'delete');
                  submit(formData, { method: 'post' });
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="overflow-auto p-4">
        {/* Avatar and Name */}
        <div className="mb-6">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-lg font-semibold text-primary-foreground">
            {company.name?.charAt(0) || 'C'}
          </div>
          <h2 className="text-lg font-semibold">{company.name || 'Unnamed Company'}</h2>
          <p className="text-sm text-muted-foreground">{company.industry || 'Company'}</p>
        </div>

        {/* Details Section */}
        <div className="space-y-4">
          {company.description && (
            <>
              <div>
                <h3 className="mb-2 text-xs font-medium text-muted-foreground">Description</h3>
                <p className="text-sm text-foreground whitespace-pre-wrap">{company.description}</p>
              </div>
              <Separator />
            </>
          )}

          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Contact</h3>
            <div className="space-y-2">
              {company.domain && (
                <div className="flex items-start gap-2 text-sm">
                  <Mail className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-foreground">{company.domain}</p>
                  </div>
                </div>
              )}
              {company.phone && (
                <div className="flex items-start gap-2 text-sm">
                  <Phone className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-foreground">{company.phone}</p>
                  </div>
                </div>
              )}
              {company.address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-foreground">{company.address}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Organization</h3>
            <div className="space-y-2">
              {company.website && (
                <div className="flex items-start gap-2 text-sm">
                  <Globe className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1 overflow-hidden">
                    <a
                      href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground hover:text-primary truncate"
                    >
                      {company.website}
                    </a>
                  </div>
                </div>
              )}
              {company.industry && (
                <div className="flex items-start gap-2 text-sm">
                  <Building2 className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1">
                    <Badge variant="secondary" className="text-xs capitalize">
                      {company.industry}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted-foreground">People</h3>
            </div>
            <ComboboxMultiple
              options={peopleOptions}
              selectedIds={selectedPeopleIds}
              onSelectionChange={handlePeopleChange}
              placeholder="Select people..."
              searchPlaceholder="Search people..."
              emptyText="No people found."
              className="w-full"
            />
          </div>

          <Separator />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted-foreground">Social</h3>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Edit className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-2">
              {company.linkedin && (
                <div className="flex items-start gap-2 text-sm">
                  <Linkedin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1 overflow-hidden">
                    <a
                      href={company.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground hover:text-primary truncate"
                    >
                      LinkedIn
                    </a>
                  </div>
                </div>
              )}
              {company.twitter && (
                <div className="flex items-start gap-2 text-sm">
                  <Twitter className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1 overflow-hidden">
                    <a
                      href={`https://twitter.com/${company.twitter.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground hover:text-primary truncate"
                    >
                      {company.twitter}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted-foreground">Metadata</h3>
            </div>
            <div className="space-y-2 text-xs">
              {company.createdAt && (
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="text-foreground">
                    {new Date(company.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}
              {company.updatedAt && (
                <div>
                  <p className="text-muted-foreground">Updated</p>
                  <p className="text-foreground">
                    {new Date(company.updatedAt).toLocaleDateString('en-US', {
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
        <CompanySidebar />
      </div>

      {/* Mobile Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-3/4 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Company Details</SheetTitle>
          </SheetHeader>
          <CompanySidebar />
        </SheetContent>
      </Sheet>

      {/* Middle Panel - Timeline/Activity */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden items-center flex shadow-s"
              onClick={() => setSheetOpen(true)}
            >
              <Menu className="h-4 w-4" />
              <span className="text-xs">Details</span>
            </Button>
            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
              {company.name?.charAt(0) || 'C'}
            </div>
            <h1 className="text-base font-semibold">{company.name || 'Unnamed Company'}</h1>
            <Badge variant="secondary" className="h-5 text-xs">
              Active
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs bg-transparent">
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              Compose email
            </Button>
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
                {company.createdAt
                  ? new Date(company.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
                  : 'Recent'}
              </div>
              <ActivityTimeline
                activities={company.activities}
                fallbackCreatedAt={company.createdAt}
                fallbackUpdatedAt={company.updatedAt}
                fallbackName={company.name}
                fallbackType="Company"
              />
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Tasks</h2>
                <div className="flex items-center gap-2">
                  <QuickTodoDialog
                    companyId={company.id}
                    userId={userId}
                    trigger={
                      <Button size="sm" className="h-8 text-xs">
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Quick Todo
                      </Button>
                    }
                  />
                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => navigate(`/dashboard/${organizationId}/tasks`)}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    New Task
                  </Button>
                </div>
              </div>
              {Object.keys(tasksByColumn).length === 0 ? (
                <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
                  <CheckSquare className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">No tasks yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 h-8 text-xs"
                    onClick={() => navigate(`/dashboard/${company.organizationId}/tasks`)}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Create first task
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(tasksByColumn).map(([columnName, tasks]) => (
                    <div key={columnName} className="space-y-2">
                      <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                        {columnName}
                        <Badge variant="secondary" className="h-4 text-[10px]">
                          {tasks.length}
                        </Badge>
                      </h3>
                      <div className="space-y-2">
                        {tasks.map((task) => (
                          <div
                            key={task.id}
                            className="rounded-lg border border-border bg-card p-3 shadow-sm hover:border-primary/50 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 flex-1">
                                {columnName.toLowerCase() === 'done' || columnName.toLowerCase() === 'completed' ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                ) : (
                                  <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1">
                                  <h4 className="text-sm font-medium">{task.name}</h4>
                                  {task.content && <p className="text-xs text-muted-foreground mt-1">{task.content}</p>}
                                </div>
                              </div>
                              {columnName.toLowerCase() !== 'done' && columnName.toLowerCase() !== 'completed' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    const formData = new FormData();
                                    formData.append('intent', 'completeTask');
                                    formData.append('taskId', task.id);
                                    formData.append('columnName', 'Done');
                                    submit(formData, { method: 'post' });
                                  }}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Complete
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Notes</h2>
                <Button size="sm" className="h-8 text-xs">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New Note
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
                <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No notes yet</p>
                <Button variant="outline" size="sm" className="mt-4">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Create first note
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div className="">
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
                <Button variant="outline" size="sm" className="mt-4">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Upload first file
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'emails' && (
            <div className="">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Email History</h2>
                <Button size="sm" className="h-8 text-xs">
                  <Mail className="mr-1.5 h-3.5 w-3.5" />
                  Compose
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
                <Mail className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No emails yet</p>
                <Button variant="outline" size="sm" className="mt-4">
                  <Mail className="mr-1.5 h-3.5 w-3.5" />
                  Send first email
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Upcoming Meetings</h2>
                <Button size="sm" className="h-8 text-xs">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Schedule
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
                <Calendar className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No meetings scheduled</p>
                <Button variant="outline" size="sm" className="mt-4">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Schedule first meeting
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompanyPage;
