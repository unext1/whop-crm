import { eq } from 'drizzle-orm';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';
import { useState } from 'react';
import { data, redirect, useLoaderData } from 'react-router';
import { MeetingDialog } from '~/components/meetings/meeting-dialog';
import { MeetingList } from '~/components/meetings/meeting-list';
import { Button } from '~/components/ui/button';
import { db } from '~/db';
import { companiesTable, meetingsCompaniesTable, meetingsPeopleTable, meetingsTable, peopleTable } from '~/db/schema';
import { putToast } from '~/services/cookie.server';
import { requireUser } from '~/services/whop.server';
import { logMeetingActivity } from '~/utils/activity.server';
import type { Route } from './+types';

export const loader = async ({ params, request }: Route.LoaderArgs) => {
  const { companyId: organizationId } = params;
  const { user } = await requireUser(request, organizationId);

  // Fetch all calendar events (meetings) for the organization
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

  // Fetch all companies and people for the dialog
  const allCompanies = await db.query.companiesTable.findMany({
    where: eq(companiesTable.organizationId, organizationId),
    orderBy: companiesTable.name,
  });

  const allPeople = await db.query.peopleTable.findMany({
    where: eq(peopleTable.organizationId, organizationId),
    orderBy: peopleTable.name,
  });

  return {
    organizationId,
    userId: user.id,
    meetings,
    allCompanies,
    allPeople,
  };
};

export const action = async ({ params, request }: Route.ActionArgs) => {
  const { companyId: organizationId } = params;
  const { user } = await requireUser(request, organizationId);
  const userId = user.id;

  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'createMeeting') {
    const title = formData.get('title')?.toString();
    const description = formData.get('description')?.toString();
    const startDate = formData.get('startDate')?.toString();
    const duration = formData.get('duration') ? Number.parseInt(formData.get('duration') as string, 10) : 60;
    const location = formData.get('location')?.toString();
    const notes = formData.get('notes')?.toString();
    const recurrenceType = (formData.get('recurrenceType') as 'none' | 'daily' | 'weekly' | 'monthly') || 'none';
    const recurrenceEndDate = formData.get('recurrenceEndDate')?.toString();
    const peopleIds = formData.getAll('peopleIds') as string[];
    const companyIds = formData.getAll('companyIds') as string[];

    if (!title || !startDate) {
      const headers = await putToast({
        title: 'Error',
        message: 'Title and start date are required',
        variant: 'destructive',
      });
      return data({ error: 'Missing required fields' }, { headers, status: 400 });
    }

    if (peopleIds.length === 0 && companyIds.length === 0) {
      const headers = await putToast({
        title: 'Error',
        message: 'Please select at least one person or company',
        variant: 'destructive',
      });
      return data({ error: 'At least one person or company required' }, { headers, status: 400 });
    }

    try {
      await db.transaction(async (tx) => {
        const meeting = await tx
          .insert(meetingsTable)
          .values({
            title,
            description: description || null,
            startDate,
            duration,
            location: location || null,
            notes: notes || null,
            recurrenceType,
            recurrenceEndDate: recurrenceEndDate || null,
            organizationId,
            ownerId: userId,
          })
          .returning();

        // Link people
        if (peopleIds.length > 0) {
          await tx.insert(meetingsPeopleTable).values(
            peopleIds.map((personId) => ({
              meetingId: meeting[0].id,
              personId,
            })),
          );
        }

        // Link companies
        if (companyIds.length > 0) {
          await tx.insert(meetingsCompaniesTable).values(
            companyIds.map((companyId) => ({
              meetingId: meeting[0].id,
              companyId,
            })),
          );
        }

        // Log activity
        await logMeetingActivity({
          meetingId: meeting[0].id,
          userId,
          activityType: 'created',
          description: `Meeting "${title}" was created`,
          tx,
        });

        // Log activity for linked people
        for (const personId of peopleIds) {
          await logMeetingActivity({
            meetingId: meeting[0].id,
            userId,
            activityType: 'created',
            description: `Meeting "${title}" was created`,
            relatedEntityId: personId,
            relatedEntityType: 'person',
            tx,
          });
        }

        // Log activity for linked companies
        for (const companyId of companyIds) {
          await logMeetingActivity({
            meetingId: meeting[0].id,
            userId,
            activityType: 'created',
            description: `Meeting "${title}" was created`,
            relatedEntityId: companyId,
            relatedEntityType: 'company',
            tx,
          });
        }
      });

      const headers = await putToast({
        title: 'Success',
        message: 'Calendar event created successfully',
        variant: 'default',
      });

      return redirect(`/dashboard/${organizationId}/calendar`, { headers });
    } catch {
      const headers = await putToast({
        title: 'Error',
        message: 'Failed to create calendar event',
        variant: 'destructive',
      });
      return data({ error: 'Failed to create calendar event' }, { headers, status: 500 });
    }
  }

  return data({ error: 'Invalid intent' }, { status: 400 });
};

export default function CalendarPage() {
  const { meetings, allCompanies, allPeople, organizationId, userId } = useLoaderData<typeof loader>();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
            <CalendarIcon className="h-3.5 w-3.5" />
          </div>
          <h1 className="text-base font-semibold">Calendar</h1>
        </div>
        <Button size="sm" className="h-8 text-xs shadow-s" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New Event
        </Button>
        <MeetingDialog
          userId={userId}
          organizationId={organizationId}
          companies={allCompanies}
          people={allPeople}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 scrollbar-thin">
        <MeetingList meetings={meetings} />
      </div>
    </div>
  );
}
