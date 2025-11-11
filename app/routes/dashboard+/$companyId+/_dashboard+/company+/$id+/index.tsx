import { and, eq, or } from 'drizzle-orm';
import {
  ActivityIcon,
  Building2,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Circle,
  Eye,
  FileText,
  Globe,
  LayoutDashboardIcon,
  Linkedin,
  Mail,
  MapPin,
  Menu,
  MoreHorizontal,
  Paperclip,
  Phone,
  Plus,
  Twitter,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { data, Form, Link, redirect, useLoaderData, useNavigate, useNavigation, useSubmit } from 'react-router';
import { EditableField } from '~/components/editable-field';
import { ActivityTimeline } from '~/components/kanban/activity-timeline';
import { LogActivityDialog } from '~/components/log-activity-dialog';
import { MeetingDialog } from '~/components/meetings/meeting-dialog';
import { QuickTodoDialog } from '~/components/kanban/quick-todo-dialog';
import { QuickActionsMenu } from '~/components/quick-actions-menu';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { ComboboxMultiple } from '~/components/ui/combobox-multiple';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
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
  meetingsTable,
  meetingsCompaniesTable,
  peopleTable,
} from '~/db/schema';
import { putToast } from '~/services/cookie.server';
import { requireUser } from '~/services/whop.server';
import { logCompanyActivity, logTaskActivity } from '~/utils/activity.server';
import type { Route } from './+types';
import { MeetingList } from '~/components/meetings/meeting-list';

export const loader = async ({ params, request }: Route.LoaderArgs) => {
  const { companyId: organizationId, id: companyId } = params;
  const { user } = await requireUser(request, organizationId);
  const userId = user.id;

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
    where: and(eq(boardTaskTable.companyId, companyId), eq(boardTaskTable.type, 'tasks')),
    with: {
      column: true,
      assignees: {
        with: {
          user: true,
        },
      },
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

  // Fetch meetings for this company
  const companyMeetings = await db.query.meetingsTable.findMany({
    where: and(eq(meetingsTable.organizationId, organizationId), eq(meetingsCompaniesTable.companyId, companyId)),
    with: {
      meetingsPeople: {
        with: {
          person: true,
        },
      },
      meetingsCompanies: {
        with: {
          company: true,
        },
      },
    },
    orderBy: (meetingsTable, { asc }) => [asc(meetingsTable.startDate)],
  });

  // Fetch all companies for the meeting dialog
  const allCompanies = await db.query.companiesTable.findMany({
    where: eq(companiesTable.organizationId, organizationId),
    orderBy: companiesTable.name,
  });

  return {
    userId,
    organizationId,
    company: { ...company, activities },
    allPeople,
    tasksByColumn,
    companyMeetings,
    allCompanies,
  };
};

export const action = async ({ params, request }: Route.ActionArgs) => {
  const { companyId: organizationId, id: companyId } = params;
  const { user } = await requireUser(request, organizationId);
  const userId = user.id;

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
          ownerId: userId,
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
            status: 'Todo',
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

  // Update Company Field
  if (intent === 'updateCompanyField') {
    const fieldName = formData.get('fieldName')?.toString();
    const fieldValue = formData.get('fieldValue')?.toString();

    if (!fieldName) {
      return data({ error: 'Field name required' }, { status: 400 });
    }

    const allowedFields = ['description', 'industry', 'phone', 'address', 'website', 'domain', 'linkedin', 'twitter'];
    if (!allowedFields.includes(fieldName)) {
      return data({ error: 'Invalid field' }, { status: 400 });
    }

    try {
      await db
        .update(companiesTable)
        .set({ [fieldName]: fieldValue || null })
        .where(and(eq(companiesTable.id, companyId), eq(companiesTable.organizationId, organizationId)));

      return data({ success: true });
    } catch {
      return data({ error: 'Failed to update field' }, { status: 500 });
    }
  }

  // Create Deal
  if (intent === 'createDeal') {
    const name = formData.get('name')?.toString();
    const content = formData.get('content')?.toString();
    const amount = formData.get('amount')?.toString();
    const relatedCompanyId = formData.get('companyId')?.toString();

    if (!name) {
      const headers = await putToast({
        title: 'Error',
        message: 'Deal name is required',
        variant: 'destructive',
      });
      return data({ error: 'Deal name required' }, { headers, status: 400 });
    }

    try {
      // Helper to ensure pipeline board exists
      const ensurePipelineBoard = async (orgId: string) => {
        const existingBoard = await db.query.boardTable.findFirst({
          where: and(eq(boardTable.companyId, orgId), eq(boardTable.type, 'pipeline')),
        });

        if (existingBoard) {
          return existingBoard;
        }

        const newBoard = await db
          .insert(boardTable)
          .values({
            name: 'Pipeline',
            type: 'pipeline',
            companyId: orgId,
            ownerId: userId,
          })
          .returning();

        await db.insert(boardColumnTable).values([
          { name: '👋 Lead', order: 1, boardId: newBoard[0].id },
          { name: '👍 Qualified', order: 2, boardId: newBoard[0].id },
          { name: '💡 Proposal', order: 3, boardId: newBoard[0].id },
          { name: '💬 Negotiation', order: 4, boardId: newBoard[0].id },
          { name: '🎉 Won', order: 5, boardId: newBoard[0].id },
        ]);

        return newBoard[0];
      };

      const pipelineBoard = await ensurePipelineBoard(organizationId);

      // Find the first column (Lead)
      const firstColumn = await db.query.boardColumnTable.findFirst({
        where: eq(boardColumnTable.boardId, pipelineBoard.id),
        orderBy: (columns, { asc }) => [asc(columns.order)],
      });

      if (!firstColumn) {
        return data({ error: 'No columns found' }, { status: 500 });
      }

      // Get the highest order in the first column
      const maxOrderTask = await db.query.boardTaskTable.findFirst({
        where: eq(boardTaskTable.columnId, firstColumn.id),
        orderBy: (tasks, { desc }) => [desc(tasks.order)],
      });

      const nextOrder = maxOrderTask?.order ? maxOrderTask.order + 1 : 1;

      await db.transaction(async (tx) => {
        const task = await tx
          .insert(boardTaskTable)
          .values({
            columnId: firstColumn.id,
            name,
            order: nextOrder,
            ownerId: userId,
            boardId: pipelineBoard.id,
            content,
            type: 'pipeline',
            status: 'open',
            companyId: relatedCompanyId || companyId,
            amount: amount ? Number.parseInt(amount, 10) : null,
          })
          .returning();

        await logTaskActivity({
          taskId: task[0].id,
          userId,
          activityType: 'created',
          description: `Deal "${name}" was created`,
          tx,
        });

        if (relatedCompanyId || companyId) {
          await logCompanyActivity({
            companyId: relatedCompanyId || companyId,
            userId,
            activityType: 'task_created',
            description: `Created deal "${name}"`,
            relatedEntityId: task[0].id,
            relatedEntityType: 'task',
            tx,
          });
        }
      });

      const headers = await putToast({
        title: 'Success',
        message: 'Deal created successfully',
        variant: 'default',
      });

      return data({ success: true }, { headers });
    } catch {
      const headers = await putToast({
        title: 'Error',
        message: 'Failed to create deal',
        variant: 'destructive',
      });
      return data({ error: 'Failed to create deal' }, { headers, status: 500 });
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
  { id: 'overview', label: 'Overview', icon: LayoutDashboardIcon },
  { id: 'activity', label: 'Activity', icon: ActivityIcon },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  // { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'team', label: 'Team', icon: Users },
  // { id: 'files', label: 'Files', icon: Paperclip },
  // { id: 'emails', label: 'Emails', icon: Mail },
  // { id: 'calendar', label: 'Calendar', icon: Calendar },
];

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const CompanyPage = () => {
  const { company, allPeople, tasksByColumn, userId, organizationId, companyMeetings, allCompanies } =
    useLoaderData<typeof loader>();
  const [activeTab, setActiveTab] = useState('overview');
  const [sheetOpen, setSheetOpen] = useState(false);
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state === 'loading';

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
            {company.name?.charAt(0) || 'C'}
          </div>
          <h2 className="text-lg font-semibold">{company.name || 'Unnamed Company'}</h2>
          <p className="text-sm text-muted-foreground">{company.industry || 'Company'}</p>
        </div>

        {/* Details Section */}
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Description</h3>
            <EditableField
              value={company.description}
              fieldName="fieldValue"
              intent="updateCompanyField"
              fieldNameParam="description"
              placeholder="Add description..."
            />
          </div>
          <Separator />

          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Contact</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="mt-0.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <EditableField
                  value={company.domain}
                  fieldName="fieldValue"
                  intent="updateCompanyField"
                  fieldNameParam="domain"
                  placeholder="Add domain..."
                />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="mt-0.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <EditableField
                  value={company.phone}
                  fieldName="fieldValue"
                  intent="updateCompanyField"
                  fieldNameParam="phone"
                  placeholder="Add phone..."
                />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <EditableField
                  value={company.address}
                  fieldName="fieldValue"
                  intent="updateCompanyField"
                  fieldNameParam="address"
                  placeholder="Add address..."
                />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Organization</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Globe className="mt-0.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <EditableField
                  value={company.website}
                  fieldName="fieldValue"
                  intent="updateCompanyField"
                  fieldNameParam="website"
                  placeholder="Add website..."
                />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="mt-0.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <EditableField
                  value={company.industry}
                  fieldName="fieldValue"
                  intent="updateCompanyField"
                  fieldNameParam="industry"
                  placeholder="Add industry..."
                />
              </div>
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
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Social</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Linkedin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <EditableField
                  value={company.linkedin}
                  fieldName="fieldValue"
                  intent="updateCompanyField"
                  fieldNameParam="linkedin"
                  placeholder="Add LinkedIn..."
                />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Twitter className=" h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <EditableField
                  value={company.twitter}
                  fieldName="fieldValue"
                  intent="updateCompanyField"
                  fieldNameParam="twitter"
                  placeholder="Add Twitter..."
                />
              </div>
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
      <div className="hidden lg:flex lg:min-w-80 lg:border-border lg:border-r lg:bg-muted/30">{sidebarContent}</div>

      {/* Mobile Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-3/4 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Company Details</SheetTitle>
          </SheetHeader>
          {sidebarContent}
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
            {isLoading && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            )}
            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
              {company.name?.charAt(0) || 'C'}
            </div>
            <h1 className="text-base font-semibold">{company.name || 'Unnamed Company'}</h1>
            <Badge variant="secondary" className="h-5 text-xs">
              Active
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <QuickActionsMenu
              type="company"
              entityId={company.id}
              entityName={company.name || 'Unnamed Company'}
              userId={userId}
              organizationId={organizationId}
              onDelete={() => {
                const formData = new FormData();
                formData.append('intent', 'delete');
                submit(formData, { method: 'post' });
              }}
            />
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
        <div className="flex-1 overflow-auto p-4 flex flex-col scrollbar-thin">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Key Stats */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <LayoutDashboardIcon className="h-4 w-4" />
                  <h2 className="text-sm font-semibold">Overview</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Industry */}
                  <Card className="p-4 bg-muted shadow-s border-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Industry</p>
                        <p className="text-sm font-medium">{company.industry || 'Not specified'}</p>
                      </div>
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Card>

                  {/* Team Size */}
                  <Card className="p-4 bg-muted shadow-s border-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Team</p>
                        <p className="text-sm font-medium">{company.companiesPeople.length} Members</p>
                      </div>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Card>

                  {/* Tasks Count */}
                  <Card className="p-4 bg-muted shadow-s border-0">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Tasks</p>
                        <p className="text-sm font-medium">{Object.values(tasksByColumn).flat().length} Total</p>
                      </div>
                      <CheckSquare className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Card>
                </div>
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
                  activities={company.activities?.slice(0, 5) || []}
                  fallbackCreatedAt={company.createdAt}
                  fallbackUpdatedAt={company.updatedAt}
                  fallbackName={company.name}
                  fallbackType="Company"
                />

                {(!company.activities || company.activities.length === 0) && (
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
                <LogActivityDialog entityId={company.id} entityType="company" organizationId={organizationId} />
              </div>
              <ActivityTimeline
                activities={company.activities}
                fallbackCreatedAt={company.createdAt}
                fallbackUpdatedAt={company.updatedAt}
                fallbackName={company.name}
                fallbackType="Company"
              />

              {(!company.activities || company.activities.length === 0) && (
                <div className="rounded-lg border border-border bg-card p-4 text-center shadow-sm">
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">No activity yet</p>
                </div>
              )}
            </div>
          )}
          {activeTab === 'tasks' && (
            <div className="flex-1 flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Tasks</h2>
                <div className="flex items-center gap-2">
                  <QuickTodoDialog
                    companyId={company.id}
                    userId={userId}
                    companies={[]}
                    people={[]}
                    trigger={
                      <Button size="sm" className="h-8 text-xs">
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Add Todo
                      </Button>
                    }
                  />
                </div>
              </div>
              {Object.keys(tasksByColumn).length === 0 ? (
                <div className="rounded-lg border border-border border-dashed flex justify-center items-center flex-col p-4 text-center shadow-sm flex-1">
                  <CheckSquare className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm font-semibold">No tasks yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Create a task to get started</p>
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
                          <Card key={task.id} className="p-4 bg-muted/30 border-0 shadow-s">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                {columnName.toLowerCase() === 'done' || columnName.toLowerCase() === 'completed' ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const formData = new FormData();
                                      formData.append('intent', 'completeTask');
                                      formData.append('taskId', task.id);
                                      formData.append('columnName', 'Todo');
                                      submit(formData, { method: 'post' });
                                    }}
                                    className="shrink-0 mt-0.5"
                                  >
                                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const formData = new FormData();
                                      formData.append('intent', 'completeTask');
                                      formData.append('taskId', task.id);
                                      formData.append('columnName', 'Done');
                                      submit(formData, { method: 'post' });
                                    }}
                                    className="shrink-0 mt-0.5"
                                  >
                                    <Circle className="h-4 w-4 text-muted-foreground" />
                                  </button>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="text-sm font-medium truncate">{task.name}</h4>
                                    {task.priority && (
                                      <Badge variant="outline" className="h-5 text-[10px] px-1.5 capitalize shrink-0">
                                        {task.priority}
                                      </Badge>
                                    )}
                                    {task.column && (
                                      <Badge variant="secondary" className="h-5 text-[10px] px-1.5 shrink-0">
                                        {task.column.name}
                                      </Badge>
                                    )}
                                  </div>
                                  {task.content && (
                                    <p className="text-xs text-muted-foreground line-clamp-2">{task.content}</p>
                                  )}
                                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                    {task.dueDate && (
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {new Date(task.dueDate).toLocaleDateString()}
                                      </span>
                                    )}
                                    {task.assignees && task.assignees.length > 0 && (
                                      <span className="flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        {task.assignees.length}
                                      </span>
                                    )}
                                  </div>
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
                                      to={`/dashboard/${organizationId}/tasks/${task.id}`}
                                      className="w-full cursor-pointer"
                                    >
                                      View
                                    </Link>
                                  </DropdownMenuItem>
                                  <Form
                                    method="post"
                                    action={`/dashboard/${organizationId}/api/delete-todo`}
                                    onSubmit={(e) => {
                                      if (!confirm('Are you sure you want to delete this task?')) {
                                        e.preventDefault();
                                      }
                                    }}
                                  >
                                    <input type="hidden" name="taskId" value={task.id} />
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="flex-1 flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Notes</h2>
                <Button size="sm" className="h-8 text-xs">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New Note
                </Button>
              </div>
              <div className="rounded-lg border border-border border-dashed flex justify-center items-center flex-col p-4 text-center shadow-sm flex-1">
                <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-foreground">No notes yet</p>
                <p className="text-xs text-muted-foreground">Create a note to get started</p>
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div className="flex-1 flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Files</h2>
                <Button size="sm" className="h-8 text-xs">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Upload
                </Button>
              </div>
              <div className="rounded-lg border border-border border-dashed flex justify-center items-center flex-col p-4 text-center shadow-sm flex-1">
                <Paperclip className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-foreground">No files yet</p>
                <p className="text-xs text-muted-foreground">Upload a file to get started</p>
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="flex-1 flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Team</h2>
                <ComboboxMultiple
                  options={peopleOptions}
                  selectedIds={selectedPeopleIds}
                  onSelectionChange={handlePeopleChange}
                  placeholder="Add team members..."
                  searchPlaceholder="Search people..."
                  emptyText="No people found."
                  className="w-64"
                />
              </div>
              {company.companiesPeople.length === 0 ? (
                <div className="rounded-lg border border-border border-dashed flex justify-center items-center flex-col p-4 text-center shadow-sm flex-1">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">No team members yet</p>
                  <p className="text-xs text-muted-foreground mt-2">Use the dropdown above to add team members</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3">
                    {company.companiesPeople.map(({ person }) => (
                      <div
                        key={person.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                            {person.name?.charAt(0) || 'P'}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{person.name}</p>
                            <p className="text-xs text-muted-foreground">{person.jobTitle || 'No title'}</p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link
                                to={`/dashboard/${organizationId}/people/${person.id}`}
                                className="flex items-center"
                              >
                                <Eye className="mr-2 h-3 w-3" />
                                View Person
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive hover:text-destructive-foreground"
                              onClick={() => {
                                const formData = new FormData();
                                formData.append('intent', 'update-people');
                                // Remove this person from selected people
                                const newIds = selectedPeopleIds.filter((id) => id !== person.id);
                                newIds.forEach((id) => {
                                  formData.append('peopleIds', id);
                                });
                                submit(formData, { method: 'post' });
                              }}
                            >
                              <X className="mr-2 h-3 w-3" />
                              Remove Association
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'emails' && (
            <div className="flex-1 flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Email History</h2>
                <Button size="sm" className="h-8 text-xs">
                  <Mail className="mr-1.5 h-3.5 w-3.5" />
                  Compose
                </Button>
              </div>
              <div className="rounded-lg border border-border border-dashed flex justify-center items-center flex-col p-4 text-center shadow-sm flex-1">
                <Mail className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-foreground">No emails yet</p>
                <p className="text-xs text-muted-foreground">Send an email to get started</p>
              </div>
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="flex-1 flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Upcoming Meetings</h2>
                <MeetingDialog
                  defaultCompanyId={company.id}
                  userId={userId}
                  organizationId={organizationId}
                  companies={allCompanies}
                  people={allPeople}
                  trigger={
                    <Button size="sm" className="h-8 text-xs">
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Schedule Meeting
                    </Button>
                  }
                />
              </div>
              {companyMeetings.length === 0 ? (
                <div className="rounded-lg border border-border border-dashed flex justify-center items-center flex-col p-4 text-center shadow-sm flex-1">
                  <Calendar className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-foreground">No meetings scheduled</p>
                  <p className="text-xs text-muted-foreground">Schedule a meeting to get started</p>
                </div>
              ) : (
                <MeetingList meetings={companyMeetings} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompanyPage;
