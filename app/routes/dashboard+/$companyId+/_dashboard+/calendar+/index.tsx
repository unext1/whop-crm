import { and, eq } from 'drizzle-orm';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { data, redirect, useLoaderData, useSubmit } from 'react-router';
import { MeetingDetailSheet } from '~/components/meetings/meeting-detail-sheet';
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

  // Fetch all meetings for the organization
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
    user,
    organizationId,
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
        message: 'Meeting created successfully',
        variant: 'default',
      });

      return redirect(`/dashboard/${organizationId}/calendar`, { headers });
    } catch (error) {
      const headers = await putToast({
        title: 'Error',
        message: 'Failed to create meeting',
        variant: 'destructive',
      });
      return data({ error: 'Failed to create meeting' }, { headers, status: 500 });
    }
  }

  if (intent === 'updateMeeting') {
    const meetingId = formData.get('meetingId')?.toString();
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

    if (!meetingId || !title || !startDate) {
      const headers = await putToast({
        title: 'Error',
        message: 'Meeting ID, title, and start date are required',
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
        // Update meeting
        await tx
          .update(meetingsTable)
          .set({
            title,
            description: description || null,
            startDate,
            duration,
            location: location || null,
            notes: notes || null,
            recurrenceType,
            recurrenceEndDate: recurrenceEndDate || null,
          })
          .where(and(eq(meetingsTable.id, meetingId), eq(meetingsTable.organizationId, organizationId)));

        // Update people links
        await tx.delete(meetingsPeopleTable).where(eq(meetingsPeopleTable.meetingId, meetingId));
        if (peopleIds.length > 0) {
          await tx.insert(meetingsPeopleTable).values(
            peopleIds.map((personId) => ({
              meetingId,
              personId,
            })),
          );
        }

        // Update company links
        await tx.delete(meetingsCompaniesTable).where(eq(meetingsCompaniesTable.meetingId, meetingId));
        if (companyIds.length > 0) {
          await tx.insert(meetingsCompaniesTable).values(
            companyIds.map((companyId) => ({
              meetingId,
              companyId,
            })),
          );
        }

        // Log activity
        await logMeetingActivity({
          meetingId,
          userId,
          activityType: 'updated',
          description: `Meeting "${title}" was updated`,
          tx,
        });
      });

      const headers = await putToast({
        title: 'Success',
        message: 'Meeting updated successfully',
        variant: 'default',
      });

      return redirect(`/dashboard/${organizationId}/calendar`, { headers });
    } catch (error) {
      const headers = await putToast({
        title: 'Error',
        message: 'Failed to update meeting',
        variant: 'destructive',
      });
      return data({ error: 'Failed to update meeting' }, { headers, status: 500 });
    }
  }

  if (intent === 'deleteMeeting') {
    const meetingId = formData.get('meetingId')?.toString();

    if (!meetingId) {
      const headers = await putToast({
        title: 'Error',
        message: 'Meeting ID is required',
        variant: 'destructive',
      });
      return data({ error: 'Meeting ID required' }, { headers, status: 400 });
    }

    try {
      // Get meeting details for logging
      const meeting = await db.query.meetingsTable.findFirst({
        where: and(eq(meetingsTable.id, meetingId), eq(meetingsTable.organizationId, organizationId)),
      });

      if (!meeting) {
        const headers = await putToast({
          title: 'Error',
          message: 'Meeting not found',
          variant: 'destructive',
        });
        return data({ error: 'Meeting not found' }, { headers, status: 404 });
      }

      await db
        .delete(meetingsTable)
        .where(and(eq(meetingsTable.id, meetingId), eq(meetingsTable.organizationId, organizationId)));

      // Log activity
      await logMeetingActivity({
        meetingId,
        userId,
        activityType: 'deleted',
        description: `Meeting "${meeting.title}" was deleted`,
      });

      const headers = await putToast({
        title: 'Success',
        message: 'Meeting deleted successfully',
        variant: 'default',
      });

      return redirect(`/dashboard/${organizationId}/calendar`, { headers });
    } catch (error) {
      const headers = await putToast({
        title: 'Error',
        message: 'Failed to delete meeting',
        variant: 'destructive',
      });
      return data({ error: 'Failed to delete meeting' }, { headers, status: 500 });
    }
  }

  return data({ error: 'Invalid intent' }, { status: 400 });
};

type MeetingWithRelations = Awaited<ReturnType<typeof loader>>['meetings'][0];

export default function CalendarPage() {
  const { meetings, allCompanies, allPeople, user, organizationId } = useLoaderData<typeof loader>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingWithRelations | null>(null);
  const submit = useSubmit();

  const handleDeleteMeeting = (meeting: MeetingWithRelations) => {
    if (!confirm(`Are you sure you want to delete "${meeting.title}"?`)) {
      return;
    }

    const formData = new FormData();
    formData.append('intent', 'deleteMeeting');
    formData.append('meetingId', meeting.id);
    submit(formData, { method: 'post' });
  };

  const handleMeetingClick = (meeting: MeetingWithRelations) => {
    setSelectedMeeting(meeting);
    setSheetOpen(true);
  };

  const handleEditMeeting = (meeting: MeetingWithRelations) => {
    setSheetOpen(false);
    // TODO: Open edit dialog with meeting data pre-filled
    // For now, just close the sheet
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <h1 className="text-base font-semibold">Meetings</h1>
        <MeetingDialog
          userId={user.id}
          organizationId={organizationId}
          companies={allCompanies}
          people={allPeople}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          trigger={
            <Button size="sm" className="h-8 text-xs">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Meeting
            </Button>
          }
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 scrollbar-thin">
        <MeetingList
          meetings={meetings as any}
          onMeetingClick={handleMeetingClick as any}
          onDeleteMeeting={handleDeleteMeeting as any}
        />
      </div>

      {/* Meeting Detail Sheet */}
      <MeetingDetailSheet
        meeting={selectedMeeting as any}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onEdit={handleEditMeeting as any}
        onDelete={handleDeleteMeeting as any}
      />
    </div>
  );
}
