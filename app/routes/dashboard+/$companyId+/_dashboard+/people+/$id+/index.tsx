import { and, eq, gte, or, sql } from 'drizzle-orm';
import {
  ActivityIcon,
  BadgeCheck,
  Bot,
  BriefcaseBusinessIcon,
  Building2,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Circle,
  FileText,
  Globe,
  LayoutDashboardIcon,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  Menu,
  MoreHorizontal,
  Paperclip,
  Phone,
  Plus,
  SparkleIcon,
  Twitter,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { data, Form, href, Link, redirect, useFetcher, useNavigate, useSubmit } from 'react-router';
import { AddEmailDialog } from '~/components/add-email-dialog';
import { EditableField } from '~/components/editable-field';
import { EditableText } from '~/components/kanban/editible-text';
import { ActivityTimeline } from '~/components/kanban/activity-timeline';
import { QuickTodoDialog } from '~/components/kanban/quick-todo-dialog';
import { LogActivityDialog } from '~/components/log-activity-dialog';
import { MeetingDialog } from '~/components/meetings/meeting-dialog';
import { MeetingList } from '~/components/meetings/meeting-list';
import { NotesTab } from '~/components/notes-tab';
import { QuickActionsMenu } from '~/components/quick-actions-menu';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader } from '~/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible';
import { ComboboxMultiple } from '~/components/ui/combobox-multiple';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  emailsTable,
  meetingsTable,
  peopleEmailsTable,
  peopleTable,
  summaryTable,
} from '~/db/schema';
import { putToast } from '~/services/cookie.server';
import { getWhopMemberById, requireUser } from '~/services/whop.server';
import { logPersonActivity, logTaskActivity } from '~/utils/activity.server';
import type { Route } from './+types';
import { AI_SUMMARY_DAILY_LIMIT } from '../../api+/ai-summary';

// Type for Whop Member based on API response
type WhopMember = {
  id: string;
  created_at: string;
  updated_at: string;
  joined_at: string;
  access_level: 'no_access' | 'admin' | 'customer';
  status: 'drafted' | 'joined' | 'left';
  most_recent_action:
    | 'canceling'
    | 'churned'
    | 'finished_split_pay'
    | 'paused'
    | 'paid_subscriber'
    | 'paid_once'
    | 'expiring'
    | 'joined'
    | 'drafted'
    | 'left'
    | 'trialing'
    | 'pending_entry'
    | 'renewing'
    | 'past_due'
    | null;
  most_recent_action_at: string | null;
  user: {
    id: string;
    name?: string | null;
    username?: string | null;
    email?: string | null;
  } | null;
  phone: string | null;
  usd_total_spent: number;
  company: {
    id: string;
    name?: string | null;
  };
};

export const loader = async ({ params, request }: Route.LoaderArgs) => {
  const { companyId: organizationId, id: personId } = params;
  const { user } = await requireUser(request, organizationId);

  const person = await db.query.peopleTable.findFirst({
    where: and(eq(peopleTable.id, personId), eq(peopleTable.organizationId, organizationId)),
    with: {
      companiesPeople: {
        with: {
          company: true,
        },
      },
      peopleEmails: {
        with: {
          email: true,
        },
      },
    },
  });

  if (!person) {
    throw new Response('Person not found', { status: 404 });
  }

  // Fetch associated tasks - validate through board relationship
  const boards = await db.query.boardTable.findMany({
    where: eq(boardTable.companyId, organizationId),
    with: {
      tasks: {
        where: and(eq(boardTaskTable.personId, personId), eq(boardTaskTable.type, 'tasks')),
        with: {
          column: true,
          assignees: {
            with: {
              user: true,
            },
          },
        },
      },
    },
  });

  const tasks = boards.flatMap((b) => b.tasks).sort((a, b) => (a.order || 0) - (b.order || 0));

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

  // Fetch all companies in the organization for the combobox
  const allCompanies = await db.query.companiesTable.findMany({
    where: eq(companiesTable.organizationId, organizationId),
    orderBy: companiesTable.name,
  });

  // Fetch all people in the organization for the meeting dialog
  const allPeople = await db.query.peopleTable.findMany({
    where: eq(peopleTable.organizationId, organizationId),
    orderBy: peopleTable.name,
  });

  // Fetch activities for this person
  const activities = await db.query.activitiesTable.findMany({
    where: and(eq(activitiesTable.entityType, 'person'), eq(activitiesTable.entityId, personId)),
    with: {
      user: true,
    },
    orderBy: (activitiesTable, { desc }) => [desc(activitiesTable.createdAt)],
  });

  // Fetch meetings for this person
  const meetings = await db.query.meetingsTable.findMany({
    where: eq(meetingsTable.organizationId, organizationId),
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

  // Filter meetings to only those linked to this person
  const personMeetings = meetings.filter((meeting) => meeting.meetingsPeople?.some((mp) => mp.person.id === personId));

  const personSummaries = await db.query.summaryTable.findMany({
    where: and(eq(summaryTable.peopleId, personId), eq(summaryTable.organizationId, organizationId)),
  });

  // Get daily AI summary usage for organization
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  const todaySummaries = await db
    .select({ count: sql<number>`count(*)` })
    .from(summaryTable)
    .where(and(eq(summaryTable.organizationId, organizationId), gte(summaryTable.createdAt, todayStr)));

  const dailyUsage = Number(todaySummaries[0]?.count || 0);

  // Whop Member Info - only fetch if whopUserId exists
  const whopMemberInfo: WhopMember | null = person.whopUserId ? await getWhopMemberById(person.whopUserId) : null;

  return {
    user,
    organizationId,
    person: { ...person, activities },
    tasks,
    tasksByColumn,
    allCompanies,
    allPeople,
    personMeetings,
    personSummaries,
    dailyUsage,
    whopMemberInfo,
  };
};

export const action = async ({ params, request }: Route.ActionArgs) => {
  const { companyId: organizationId, id: personId } = params;
  const { user } = await requireUser(request, organizationId);
  const userId = user.id;

  const formData = await request.formData();
  const intent = formData.get('intent');

  // Update company associations
  if (intent === 'update-companies') {
    const companyIds = formData.getAll('companyIds') as string[];

    // Get current company relationships
    const currentRelationships = await db.query.companiesPeopleTable.findMany({
      where: eq(companiesPeopleTable.personId, personId),
    });

    const currentCompanyIds = currentRelationships.map((r) => r.companyId);
    const newCompanyIds = companyIds.filter(Boolean);

    // Find companies to add (in new but not in current)
    const toAdd = newCompanyIds.filter((id) => !currentCompanyIds.includes(id));

    // Find companies to remove (in current but not in new)
    const toRemove = currentCompanyIds.filter((id) => !newCompanyIds.includes(id));

    try {
      // Add new relationships
      if (toAdd.length > 0) {
        await db.insert(companiesPeopleTable).values(
          toAdd.map((companyId) => ({
            personId,
            companyId,
          })),
        );

        // Log activity for each company added
        for (const companyId of toAdd) {
          const company = await db.query.companiesTable.findFirst({
            where: eq(companiesTable.id, companyId),
          });
          await logPersonActivity({
            personId,
            userId,
            activityType: 'updated',
            description: company ? `Added to ${company.name}` : 'Added to company',
            relatedEntityId: companyId,
            relatedEntityType: 'company',
          });
        }
      }

      // Remove old relationships
      if (toRemove.length > 0) {
        await db
          .delete(companiesPeopleTable)
          .where(
            and(
              eq(companiesPeopleTable.personId, personId),
              or(...toRemove.map((companyId) => eq(companiesPeopleTable.companyId, companyId))),
            ),
          );

        // Log activity for each company removed
        for (const companyId of toRemove) {
          const company = await db.query.companiesTable.findFirst({
            where: eq(companiesTable.id, companyId),
          });
          await logPersonActivity({
            personId,
            userId,
            activityType: 'updated',
            description: company ? `Removed from ${company.name}` : 'Removed from company',
            relatedEntityId: companyId,
            relatedEntityType: 'company',
          });
        }
      }

      const headers = await putToast({
        title: 'Success',
        message: 'Companies updated successfully',
        variant: 'default',
      });

      return redirect(`/dashboard/${organizationId}/people/${personId}`, { headers });
    } catch {
      const headers = await putToast({
        title: 'Error',
        message: 'Failed to update companies',
        variant: 'destructive',
      });
      return data({ error: 'Failed to update companies' }, { headers, status: 500 });
    }
  }

  // Delete person
  if (intent === 'delete') {
    try {
      await db
        .delete(peopleTable)
        .where(and(eq(peopleTable.id, personId), eq(peopleTable.organizationId, organizationId)));

      const headers = await putToast({
        title: 'Success',
        message: 'Person deleted successfully',
        variant: 'default',
      });

      return redirect(`/dashboard/${organizationId}/people`, { headers });
    } catch {
      const headers = await putToast({
        title: 'Error',
        message: 'Failed to delete person',
        variant: 'destructive',
      });
      return data({ error: 'Failed to delete person' }, { headers, status: 500 });
    }
  }

  // Create quick todo
  if (intent === 'createQuickTodo') {
    // Helper to ensure tasks board exists
    const ensureTasksBoard = async (orgId: string) => {
      const existingBoard = await db.query.boardTable.findFirst({
        where: and(eq(boardTable.companyId, orgId), eq(boardTable.type, 'tasks'), eq(boardTable.name, 'Tasks')),
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
    const relatedPersonId = formData.get('relatedPersonId') ? String(formData.get('relatedPersonId')) : null;

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
            personId: relatedPersonId || personId,
          })
          .returning();

        // Note: For todos created from person page, we don't automatically assign the owner as an assignee
        // Owner is tracked separately via ownerId and displayed as "Created By"

        // Log activity for task creation
        await logTaskActivity({
          taskId: task[0].id,
          userId,
          activityType: 'created',
          description: `Task "${name}" was created`,
          tx,
        });

        // Log activity for person
        await logPersonActivity({
          personId: relatedPersonId || personId,
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

  // Send DM
  if (intent === 'sendDM') {
    const personId = formData.get('personId')?.toString();
    const message = formData.get('message')?.toString();

    if (!personId || !message) {
      const headers = await putToast({
        title: 'Error',
        message: 'Person ID and message are required',
        variant: 'destructive',
      });
      return data({ error: 'Missing required fields' }, { headers, status: 400 });
    }

    try {
      // TODO: Integrate with Whop Messages API

      // For now, just log the activity
      await logPersonActivity({
        personId,
        userId,
        activityType: 'updated',
        description: `DM sent: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
      });

      const headers = await putToast({
        title: 'Success',
        message: 'DM will be sent (integration pending)',
        variant: 'default',
      });

      return data({ success: true }, { headers });
    } catch {
      const headers = await putToast({
        title: 'Error',
        message: 'Failed to send DM',
        variant: 'destructive',
      });
      return data({ error: 'Failed to send DM' }, { headers, status: 500 });
    }
  }

  // Create Deal
  if (intent === 'createDeal') {
    const name = formData.get('name')?.toString();
    const content = formData.get('content')?.toString();
    const amount = formData.get('amount')?.toString();
    const relatedPersonId = formData.get('personId')?.toString();

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
            personId: relatedPersonId || personId,
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

        if (relatedPersonId || personId) {
          await logPersonActivity({
            personId: relatedPersonId || personId,
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

  // Update Person Field
  if (intent === 'updatePersonField') {
    const fieldName = formData.get('fieldName')?.toString();
    const fieldValue = formData.get('fieldValue')?.toString();

    if (!fieldName) {
      return data({ error: 'Field name required' }, { status: 400 });
    }

    const allowedFields = [
      'name',
      'description',
      'jobTitle',
      'phone',
      'address',
      'website',
      'linkedin',
      'twitter',
      'notes',
    ];
    if (!allowedFields.includes(fieldName)) {
      return data({ error: 'Invalid field' }, { status: 400 });
    }

    // Name is required, other fields can be null
    if (fieldName === 'name' && !fieldValue?.trim()) {
      return data({ error: 'Name is required' }, { status: 400 });
    }

    try {
      await db
        .update(peopleTable)
        .set({ [fieldName]: fieldName === 'name' ? fieldValue : fieldValue || null })
        .where(and(eq(peopleTable.id, personId), eq(peopleTable.organizationId, organizationId)));

      return data({ success: true });
    } catch {
      return data({ error: 'Failed to update field' }, { status: 500 });
    }
  }

  // Update Notes
  if (intent === 'updateNotes') {
    const notes = formData.get('notes')?.toString();
    const targetPersonId = formData.get('personId')?.toString();

    if (!targetPersonId) {
      const headers = await putToast({
        title: 'Error',
        message: 'Person ID is required',
        variant: 'destructive',
      });
      return data({ error: 'Person ID required' }, { headers, status: 400 });
    }

    try {
      await db
        .update(peopleTable)
        .set({ notes: notes || null })
        .where(and(eq(peopleTable.id, targetPersonId), eq(peopleTable.organizationId, organizationId)));

      await logPersonActivity({
        personId: targetPersonId,
        userId,
        activityType: 'updated',
        description: 'Notes updated',
      });

      const headers = await putToast({
        title: 'Success',
        message: 'Notes updated successfully',
        variant: 'default',
      });

      return data({ success: true }, { headers });
    } catch {
      const headers = await putToast({
        title: 'Error',
        message: 'Failed to update notes',
        variant: 'destructive',
      });
      return data({ error: 'Failed to update notes' }, { headers, status: 500 });
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

  // Add emails
  if (intent === 'addEmails') {
    const emailsData = formData.getAll('emails') as string[];
    const emailTypes = formData.getAll('emailTypes') as string[];
    const primaryIndex = formData.get('primaryIndex')
      ? Number.parseInt(formData.get('primaryIndex') as string, 10)
      : -1;

    if (!emailsData.length) {
      const headers = await putToast({
        title: 'Error',
        message: 'No emails provided',
        variant: 'destructive',
      });
      return data({ error: 'No emails provided' }, { headers, status: 400 });
    }

    try {
      await db.transaction(async (tx) => {
        for (let i = 0; i < emailsData.length; i++) {
          const email = emailsData[i].trim();
          const type = (emailTypes[i] || 'work') as 'work' | 'personal' | 'other';
          const isPrimary = i === primaryIndex;

          if (email) {
            // Check if email already exists in this organization
            const existingEmail = await tx.query.emailsTable.findFirst({
              where: and(eq(emailsTable.email, email), eq(emailsTable.organizationId, organizationId)),
            });

            let emailId: string;

            if (existingEmail) {
              emailId = existingEmail.id;
              // If marking as primary, update existing email
              if (isPrimary && !existingEmail.isPrimary) {
                await tx.update(emailsTable).set({ isPrimary: true, type }).where(eq(emailsTable.id, emailId));
              }
            } else {
              // Create new email
              const insert = await tx
                .insert(emailsTable)
                .values({
                  email,
                  organizationId,
                  type,
                  isPrimary,
                })
                .returning();
              await tx.insert(peopleEmailsTable).values({
                personId,
                emailId: insert[0].id,
              });
              emailId = insert[0].id;
            }

            // Log activity
            await logPersonActivity({
              personId,
              userId,
              activityType: 'updated',
              description: `Added email ${email}`,
              tx,
            });
          }
        }
      });

      const headers = await putToast({
        title: 'Success',
        message: 'Emails added successfully',
        variant: 'default',
      });

      return data({ success: true }, { headers });
    } catch {
      const headers = await putToast({
        title: 'Error',
        message: 'Failed to add emails',
        variant: 'destructive',
      });
      return data({ error: 'Failed to add emails' }, { headers, status: 500 });
    }
  }

  // Remove email
  if (intent === 'removeEmail') {
    const emailId = formData.get('emailId')?.toString();

    if (!emailId) {
      const headers = await putToast({
        title: 'Error',
        message: 'Email ID is required',
        variant: 'destructive',
      });
      return data({ error: 'Email ID required' }, { headers, status: 400 });
    }

    try {
      // Get email details for logging
      const email = await db.query.emailsTable.findFirst({
        where: eq(emailsTable.id, emailId),
      });

      if (!email) {
        const headers = await putToast({
          title: 'Error',
          message: 'Email not found',
          variant: 'destructive',
        });
        return data({ error: 'Email not found' }, { headers, status: 404 });
      }

      // Remove the relationship
      await db
        .delete(peopleEmailsTable)
        .where(and(eq(peopleEmailsTable.personId, personId), eq(peopleEmailsTable.emailId, emailId)));

      // Log activity
      await logPersonActivity({
        personId,
        userId,
        activityType: 'updated',
        description: `Removed email ${email.email}`,
      });

      const headers = await putToast({
        title: 'Success',
        message: 'Email removed successfully',
        variant: 'default',
      });

      return data({ success: true }, { headers });
    } catch {
      const headers = await putToast({
        title: 'Error',
        message: 'Failed to remove email',
        variant: 'destructive',
      });
      return data({ error: 'Failed to remove email' }, { headers, status: 500 });
    }
  }

  return data({ error: 'Invalid intent' }, { status: 400 });
};

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const PersonPage = ({ loaderData }: Route.ComponentProps) => {
  const {
    person,
    tasksByColumn,
    allCompanies,
    allPeople,
    user,
    organizationId,
    personMeetings,
    personSummaries,
    dailyUsage,
    whopMemberInfo,
  } = loaderData;

  const [activeTab, setActiveTab] = useState('overview');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [aiSummaryOpen, setAiSummaryOpen] = useState(false);
  const [openSummaryIds, setOpenSummaryIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const submit = useSubmit();

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboardIcon },
    { id: 'activity', label: 'Activity', icon: ActivityIcon },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'notes', label: 'Notes', icon: FileText },
    // { id: 'files', label: 'Files', icon: Paperclip },
    // { id: 'emails', label: 'Emails', icon: Mail },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'ai', label: 'AI', icon: SparkleIcon },
    whopMemberInfo && { id: 'whop', label: 'Whop Member', icon: BadgeCheck },
  ].filter(Boolean) as { id: string; label: string; icon: React.ElementType }[];

  const emails = person.peopleEmails.map((pe) => pe.email);

  // Get currently selected company IDs
  const selectedCompanyIds = person.companiesPeople.map((cp) => cp.company.id);

  // Prepare options for the combobox
  const companyOptions = allCompanies.map((company) => ({
    id: company.id,
    name: company.name,
    email: undefined,
  }));

  const handleCompaniesChange = (ids: string[]) => {
    const formData = new FormData();
    formData.append('intent', 'update-companies');
    ids.forEach((id) => {
      formData.append('companyIds', id);
    });
    submit(formData, { method: 'post' });
  };

  const handleAddEmails = (emails: { email: string; type: 'work' | 'personal' | 'other'; isPrimary: boolean }[]) => {
    const formData = new FormData();
    formData.append('intent', 'addEmails');
    emails.forEach((email, index) => {
      formData.append('emails', email.email);
      formData.append('emailTypes', email.type);
      if (email.isPrimary) {
        formData.append('primaryIndex', index.toString());
      }
    });
    submit(formData, { method: 'post' });
  };

  const generateFetcher = useFetcher();

  const isGeneratingSummary = generateFetcher.state === 'submitting';

  const isLimitReached = dailyUsage >= AI_SUMMARY_DAILY_LIMIT;

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
            {person.name?.charAt(0) || 'P'}
          </div>
          <div className="flex items-center gap-2 mb-1">
            <EditableText
              size="lg"
              fieldName="fieldValue"
              value={person.name || ''}
              inputLabel="Edit person name"
              buttonLabel={`Edit person "${person.name || 'Unnamed Person'}" name`}
            >
              <input type="hidden" name="intent" value="updatePersonField" />
              <input type="hidden" name="fieldName" value="name" />
            </EditableText>
          </div>
        </div>

        {/* Details Section */}
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Description</h3>
            <EditableField
              value={person.description}
              fieldName="fieldValue"
              intent="updatePersonField"
              fieldNameParam="description"
              placeholder="Add description..."
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <BriefcaseBusinessIcon className="mt-0.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <EditableField
              value={person.jobTitle}
              fieldName="fieldValue"
              intent="updatePersonField"
              fieldNameParam="jobTitle"
              placeholder="Add job title..."
            />
          </div>
          <Separator />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted-foreground">Contact</h3>
              <AddEmailDialog
                trigger={
                  <Button variant="ghost" size="sm" className="h-8 text-xs px-2">
                    <Plus className="mr-1 h-3 w-3" />
                    Email
                  </Button>
                }
                onAddEmails={handleAddEmails}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-sm">
                <Mail className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                {emails.length > 0 ? (
                  <div className="flex-1 flex flex-col gap-1">
                    {emails
                      .sort((a) => (a.isPrimary ? -1 : 1))
                      .map((email) => (
                        <div key={email.id} className="flex items-center gap-1.5 group">
                          <a
                            href={`mailto:${email.email}`}
                            className="text-foreground hover:text-primary text-xs flex-1"
                          >
                            {email.email}
                          </a>
                          {email.isPrimary && (
                            <Badge variant="default" className="h-5 text-[10px] px-1">
                              Primary
                            </Badge>
                          )}
                          <Badge variant="outline" className="h-5 text-[10px] px-1 capitalize">
                            {email.type}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
                            onClick={() => {
                              const formData = new FormData();
                              formData.append('intent', 'removeEmail');
                              formData.append('emailId', email.id);
                              submit(formData, { method: 'post' });
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">No emails found</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="mt-0.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <EditableField
                  value={person.phone}
                  fieldName="fieldValue"
                  intent="updatePersonField"
                  fieldNameParam="phone"
                  placeholder="Add phone..."
                />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <EditableField
                  value={person.address}
                  fieldName="fieldValue"
                  intent="updatePersonField"
                  fieldNameParam="address"
                  placeholder="Add address..."
                />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Globe className="mt-0.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <EditableField
                  value={person.website}
                  fieldName="fieldValue"
                  intent="updatePersonField"
                  fieldNameParam="website"
                  placeholder="Add website..."
                />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted-foreground">Companies</h3>
            </div>
            <ComboboxMultiple
              options={companyOptions}
              selectedIds={selectedCompanyIds}
              onSelectionChange={handleCompaniesChange}
              placeholder="Select companies..."
              searchPlaceholder="Search companies..."
              emptyText="No companies found."
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
                  value={person.linkedin}
                  fieldName="fieldValue"
                  intent="updatePersonField"
                  fieldNameParam="linkedin"
                  placeholder="Add LinkedIn..."
                />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Twitter className="mt-0.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <EditableField
                  value={person.twitter}
                  fieldName="fieldValue"
                  intent="updatePersonField"
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
              {person.createdAt && (
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="text-foreground">
                    {new Date(person.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}
              {person.updatedAt && (
                <div>
                  <p className="text-muted-foreground">Updated</p>
                  <p className="text-foreground">
                    {new Date(person.updatedAt).toLocaleDateString('en-US', {
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
    <div className="flex flex-1 overflow-x-hidden bg-background max-w-full">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:min-w-80 lg:border-border lg:border-r lg:bg-muted/30">{sidebarContent}</div>

      {/* Mobile Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-3/4 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Person Details</SheetTitle>
          </SheetHeader>
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Middle Panel - Timeline/Activity */}
      <div className="flex flex-1 flex-col overflow-x-hidden">
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4 min-w-0 max-w-full overflow-x-hidden">
          <div className="flex items-center gap-3 min-w-0 flex-1">
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
              {person.name?.charAt(0) || 'P'}
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-base font-semibold truncate">{person.name || 'Unnamed Person'}</h1>
              {person.whopUserId && (
                <Badge variant="outline" className="h-5 text-[10px] px-2 bg-primary">
                  Whop
                </Badge>
              )}
            </div>
            {person.jobTitle && (
              <Badge variant="secondary" className="h-5 text-xs">
                {person.jobTitle}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <QuickActionsMenu
              type="person"
              entityId={person.id}
              entityName={person.name || 'Unnamed Person'}
              hasWhopId={!!person.whopUserId}
              primaryEmail={
                person.peopleEmails?.find((pe) => pe.email.isPrimary)?.email.email ||
                person.peopleEmails?.[0]?.email.email
              }
              userId={user.id}
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
                <span className="whitespace-nowrap flex">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto flex p-4 flex-col scrollbar-thin min-w-0 max-w-full">
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-full overflow-x-hidden">
              {/* Key Stats */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <LayoutDashboardIcon className="h-4 w-4" />
                  <h2 className="text-sm font-semibold">Overview</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Job Title */}
                  <Card className="p-4 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Job Title</p>
                        <p className="text-sm font-medium">{person.jobTitle || 'Not specified'}</p>
                      </div>
                      <BriefcaseBusinessIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Card>

                  {/* Companies */}
                  <Card className="p-4 bg-muted/30">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Companies</p>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{person.companiesPeople.length} companies</span>
                      </div>
                    </div>
                  </Card>

                  {/* Tasks Count */}
                  <Card className="p-4 bg-muted/30">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Tasks</p>
                        <p className="text-sm font-medium">{Object.values(tasksByColumn).flat().length} total</p>
                      </div>
                      <CheckSquare className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Card>
                </div>
              </div>

              <div>
                <div className="mb-4 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <SparkleIcon className="h-4 w-4" />
                    <h2 className="text-sm font-semibold">AI Insights</h2>
                    <Badge variant="secondary" className="h-5 text-xs">
                      {dailyUsage}/{AI_SUMMARY_DAILY_LIMIT} today
                    </Badge>
                  </div>
                  <generateFetcher.Form
                    method="post"
                    action={href('/dashboard/:companyId/api/ai-summary', { companyId: organizationId })}
                  >
                    <input type="hidden" name="intent" value="aiSummary" />
                    <input type="hidden" name="personId" value={person.id} />
                    <Button size="sm" className="h-8 text-xs shadow-s" disabled={isGeneratingSummary || isLimitReached}>
                      {isGeneratingSummary ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <SparkleIcon className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {isGeneratingSummary
                        ? 'Generating...'
                        : isLimitReached
                          ? 'Daily Limit Reached'
                          : 'Generate Summary'}
                    </Button>
                  </generateFetcher.Form>
                </div>
                {isLimitReached && (
                  <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
                    You've reached the daily limit of {AI_SUMMARY_DAILY_LIMIT} AI summaries. Please try again tomorrow.
                  </div>
                )}
                {personSummaries.length > 0 ? (
                  (() => {
                    const latestSummary = personSummaries.sort(
                      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                    )[0];
                    const insights = JSON.parse(latestSummary.insights);

                    return (
                      <Collapsible open={aiSummaryOpen} onOpenChange={setAiSummaryOpen}>
                        <Card className="bg-muted/30 ">
                          <CollapsibleTrigger asChild>
                            <CardHeader className="h-auto p-4 cursor-pointer">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Bot className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <div className="text-muted-foreground font-medium text-xs">Latest Analysis</div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-foreground font-semibold text-sm">
                                        {latestSummary.ratingScore}/
                                        <span className="text-muted-foreground text-xs">100</span>
                                      </span>
                                      <Badge
                                        variant="secondary"
                                        className="bg-primary text-primary-foreground font-medium text-xs"
                                      >
                                        {latestSummary.ratingTier.replace('_', ' ').toUpperCase()}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                                {aiSummaryOpen ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </CardHeader>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="rounded-3xl">
                            <CardContent className="text-sm space-y-4 pt-0 hover:rounded-3xl">
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs font-medium text-foreground">Summary</span>
                                </div>
                                <p className="text-muted-foreground text-xs">{latestSummary.description}</p>
                              </div>

                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs font-medium text-foreground">Key Insights</span>
                                </div>
                                <ul className="space-y-1">
                                  {insights.map((insight: string, index: number) => (
                                    <li
                                      key={`insight-${index}-${insight.slice(0, 20)}`}
                                      className="flex items-start gap-2 text-xs text-muted-foreground"
                                    >
                                      <span className="text-foreground">•</span>
                                      <span className="flex-1">{insight}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="">
                                <div className="flex items-start gap-2">
                                  <div>
                                    <span className="text-xs font-medium text-foreground">Recommended Action</span>
                                    <p className="text-xs text-muted-foreground">{latestSummary.recommendation}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                                <span>Generated {new Date(latestSummary.createdAt).toLocaleDateString()}</span>
                              </div>
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    );
                  })()
                ) : (
                  <div className="rounded-lg border border-border border-dashed flex justify-center items-center flex-col p-4 py-10 text-center shadow-sm flex-1">
                    <SparkleIcon className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm text-foreground">No summaries yet</p>
                    <p className="text-xs text-muted-foreground">Generate a summary to get started</p>
                    <generateFetcher.Form
                      method="post"
                      action={href('/dashboard/:companyId/api/ai-summary', { companyId: organizationId })}
                    >
                      <input type="hidden" name="intent" value="aiSummary" />
                      <input type="hidden" name="personId" value={person.id} />
                      <Button
                        size="sm"
                        className="h-8 text-xs shadow-s mt-4"
                        disabled={isGeneratingSummary || isLimitReached}
                      >
                        {isGeneratingSummary ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <SparkleIcon className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {isGeneratingSummary
                          ? 'Generating...'
                          : isLimitReached
                            ? 'Daily Limit Reached'
                            : 'Generate Summary'}
                      </Button>
                    </generateFetcher.Form>
                    {isLimitReached && (
                      <p className="mt-2 text-xs text-destructive">
                        Daily limit reached ({dailyUsage}/{AI_SUMMARY_DAILY_LIMIT})
                      </p>
                    )}
                  </div>
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
                  activities={person.activities?.slice(0, 5) || []}
                  fallbackCreatedAt={person.createdAt}
                  fallbackUpdatedAt={person.updatedAt}
                  fallbackName={person.name}
                  fallbackType="Person"
                />

                {(!person.activities || person.activities.length === 0) && (
                  <div className="rounded-lg border border-border bg-card p-4 text-center shadow-sm">
                    <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">No activity yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-4 max-w-full overflow-x-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ActivityIcon className="h-4 w-4" />
                  <h2 className="text-sm font-semibold">All Activity</h2>
                </div>
                <LogActivityDialog entityId={person.id} entityType="person" organizationId={organizationId} />
              </div>
              <ActivityTimeline
                activities={person.activities}
                fallbackCreatedAt={person.createdAt}
                fallbackUpdatedAt={person.updatedAt}
                fallbackName={person.name}
                fallbackType="Person"
              />

              {(!person.activities || person.activities.length === 0) && (
                <div className="rounded-lg border border-border bg-card p-4 text-center shadow-sm">
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">No activity yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="flex-1 flex flex-col max-w-full overflow-x-hidden">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Tasks</h2>
                <div className="flex items-center gap-2">
                  <QuickTodoDialog
                    personId={person.id}
                    userId={user.id}
                    companies={[]}
                    people={[]}
                    trigger={
                      <Button size="sm" className="h-8 text-xs shadow-s">
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Add Todo
                      </Button>
                    }
                  />
                </div>
              </div>
              {Object.keys(tasksByColumn).length === 0 ? (
                <div className="rounded-lg border border-border border-dashed flex justify-center items-center flex-col p-4 text-center shadow-sm flex-1">
                  <CheckSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h2 className="text-lg font-semibold mb-2">No tasks yet</h2>
                  <p className="text-sm text-muted-foreground">Create a task to get started</p>
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
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
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
                                <div className="flex-1 space-y-2 min-w-0">
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
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
                                <DropdownMenuContent align="end" className="w-20">
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
                                    navigate={false}
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
            <div className="max-w-full overflow-x-hidden">
              <NotesTab
                initialNotes={person.notes || ''}
                entityType="person"
                entityId={person.id}
                organizationId={organizationId}
              />
            </div>
          )}

          {activeTab === 'files' && (
            <div className="flex-1 flex flex-col max-w-full overflow-x-hidden">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Files</h2>
                <Button size="sm" className="h-8 text-xs shadow-s">
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

          {activeTab === 'emails' && (
            <div className="flex-1 flex flex-col max-w-full overflow-x-hidden">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Email History</h2>
                <Button size="sm" className="h-8 text-xs shadow-s">
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
            <div className="flex-1 flex flex-col max-w-full overflow-x-hidden">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Upcoming Meetings</h2>
                <MeetingDialog
                  defaultPersonId={person.id}
                  userId={user.id}
                  organizationId={organizationId}
                  companies={allCompanies}
                  people={allPeople}
                  trigger={
                    <Button size="sm" className="h-8 text-xs shadow-s">
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Schedule Meeting
                    </Button>
                  }
                />
              </div>
              {personMeetings.length === 0 ? (
                <div className="rounded-lg border border-border border-dashed flex justify-center items-center flex-col p-4 text-center shadow-sm flex-1">
                  <Calendar className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-foreground">No meetings scheduled</p>
                  <p className="text-xs text-muted-foreground">Schedule a meeting to get started</p>
                </div>
              ) : (
                <MeetingList meetings={personMeetings} />
              )}
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="flex-1 flex flex-col max-w-full overflow-x-hidden">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">AI Summaries</h2>
                  <Badge variant="secondary" className="h-5 text-xs">
                    {dailyUsage}/{AI_SUMMARY_DAILY_LIMIT} today
                  </Badge>
                </div>
                <generateFetcher.Form
                  method="post"
                  action={href('/dashboard/:companyId/api/ai-summary', { companyId: organizationId })}
                >
                  <input type="hidden" name="intent" value="aiSummary" />
                  <input type="hidden" name="personId" value={person.id} />
                  <Button size="sm" className="h-8 text-xs shadow-s" disabled={isGeneratingSummary || isLimitReached}>
                    {isGeneratingSummary ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <SparkleIcon className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {isGeneratingSummary
                      ? 'Generating...'
                      : isLimitReached
                        ? 'Daily Limit Reached'
                        : 'Generate Summary'}
                  </Button>
                </generateFetcher.Form>
              </div>
              {isLimitReached && (
                <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
                  You've reached the daily limit of {AI_SUMMARY_DAILY_LIMIT} AI summaries. Please try again tomorrow.
                </div>
              )}

              {personSummaries.length > 0 ? (
                <div className="space-y-4">
                  {personSummaries
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((summary) => {
                      const insights = JSON.parse(summary.insights);
                      const isOpen = openSummaryIds.has(summary.id);
                      return (
                        <Collapsible
                          key={summary.id}
                          open={isOpen}
                          onOpenChange={(open) => {
                            setOpenSummaryIds((prev) => {
                              const next = new Set(prev);
                              if (open) {
                                next.add(summary.id);
                              } else {
                                next.delete(summary.id);
                              }
                              return next;
                            });
                          }}
                        >
                          <Card className="bg-muted/30">
                            <CollapsibleTrigger asChild>
                              <CardHeader className="h-auto p-4 cursor-pointer">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Bot className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                      <div className="text-muted-foreground font-medium text-xs">AI Analysis</div>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-foreground font-semibold text-sm">
                                          {summary.ratingScore}/
                                          <span className="text-muted-foreground text-xs">100</span>
                                        </span>
                                        <Badge
                                          variant="secondary"
                                          className="bg-primary text-primary-foreground font-medium text-xs"
                                        >
                                          {summary.ratingTier.replace('_', ' ').toUpperCase()}
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                  {isOpen ? (
                                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                              </CardHeader>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="rounded-3xl">
                              <CardContent className="text-sm space-y-4 pt-0 hover:rounded-3xl">
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-medium text-foreground">Summary</span>
                                  </div>
                                  <p className="text-muted-foreground text-xs">{summary.description}</p>
                                </div>

                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-medium text-foreground">Key Insights</span>
                                  </div>
                                  <ul className="space-y-1">
                                    {insights.map((insight: string, index: number) => (
                                      <li
                                        key={`insight-${index}-${insight.slice(0, 20)}`}
                                        className="flex items-start gap-2 text-xs text-muted-foreground"
                                      >
                                        <span className="text-foreground">•</span>
                                        <span className="flex-1">{insight}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                <div className="">
                                  <div className="flex items-start gap-2">
                                    <div>
                                      <span className="text-xs font-medium text-foreground">Recommended Action</span>
                                      <p className="text-xs text-muted-foreground">{summary.recommendation}</p>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                                  <span>Generated {new Date(summary.createdAt).toLocaleDateString()}</span>
                                </div>
                              </CardContent>
                            </CollapsibleContent>
                          </Card>
                        </Collapsible>
                      );
                    })}
                </div>
              ) : (
                <div className="rounded-lg border border-border border-dashed flex justify-center items-center flex-col p-4 text-center shadow-sm flex-1">
                  <SparkleIcon className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-foreground">No summaries yet</p>
                  <p className="text-xs text-muted-foreground">Generate a summary to get started</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'whop' && whopMemberInfo && (
            <div className="flex-1 flex flex-col max-w-full overflow-x-hidden">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4" />
                  <h2 className="text-sm font-semibold">Whop Member Information</h2>
                </div>
              </div>

              <div className="space-y-4">
                {/* Member Status & Access Level */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Status</p>
                        <Badge
                          variant={
                            whopMemberInfo.status === 'joined'
                              ? 'default'
                              : whopMemberInfo.status === 'left'
                                ? 'destructive'
                                : 'secondary'
                          }
                          className="h-5 text-xs capitalize"
                        >
                          {whopMemberInfo.status}
                        </Badge>
                      </div>
                      <BadgeCheck className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Card>

                  <Card className="p-4 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Access Level</p>
                        <Badge
                          variant={
                            whopMemberInfo.access_level === 'admin'
                              ? 'default'
                              : whopMemberInfo.access_level === 'customer'
                                ? 'secondary'
                                : 'outline'
                          }
                          className="h-5 text-xs capitalize"
                        >
                          {whopMemberInfo.access_level.replace('_', ' ')}
                        </Badge>
                      </div>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Card>
                </div>

                {/* User Information */}
                {whopMemberInfo.user && (
                  <Card className="p-4 bg-muted/30">
                    <h3 className="text-xs font-medium text-muted-foreground mb-3">User Information</h3>
                    <div className="space-y-2">
                      {whopMemberInfo.user.name && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground text-xs w-20">Name:</span>
                          <span className="text-foreground font-medium">{whopMemberInfo.user.name}</span>
                        </div>
                      )}
                      {whopMemberInfo.user.username && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground text-xs w-20">Username:</span>
                          <span className="text-foreground">{whopMemberInfo.user.username}</span>
                        </div>
                      )}
                      {whopMemberInfo.user.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground text-xs w-20">Email:</span>
                          <a
                            href={`mailto:${whopMemberInfo.user.email}`}
                            className="text-foreground hover:text-primary"
                          >
                            {whopMemberInfo.user.email}
                          </a>
                        </div>
                      )}
                      {whopMemberInfo.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground text-xs w-20">Phone:</span>
                          <a href={`tel:${whopMemberInfo.phone}`} className="text-foreground hover:text-primary">
                            {whopMemberInfo.phone}
                          </a>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {/* Financial Information */}
                <Card className="p-4 bg-muted/30">
                  <h3 className="text-xs font-medium text-muted-foreground mb-3">Financial Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground text-xs w-20">Total Spent:</span>
                      <span className="text-foreground font-semibold">
                        ${whopMemberInfo.usd_total_spent.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Recent Action */}
                {whopMemberInfo.most_recent_action && (
                  <Card className="p-4 bg-muted/30">
                    <h3 className="text-xs font-medium text-muted-foreground mb-3">Most Recent Action</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground text-xs w-20">Action:</span>
                        <Badge variant="outline" className="h-5 text-xs capitalize">
                          {whopMemberInfo.most_recent_action.replace('_', ' ')}
                        </Badge>
                      </div>
                      {whopMemberInfo.most_recent_action_at && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground text-xs w-20">Date:</span>
                          <span className="text-foreground">
                            {new Date(whopMemberInfo.most_recent_action_at).toLocaleString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {/* Timestamps */}
                <Card className="p-4 bg-muted/30">
                  <h3 className="text-xs font-medium text-muted-foreground mb-3">Timestamps</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-20">Created:</span>
                      <span className="text-foreground">
                        {new Date(whopMemberInfo.created_at).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-20">Joined:</span>
                      <span className="text-foreground">
                        {new Date(whopMemberInfo.joined_at).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-20">Updated:</span>
                      <span className="text-foreground">
                        {new Date(whopMemberInfo.updated_at).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonPage;
