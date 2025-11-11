import { eq } from 'drizzle-orm';
import { db } from '~/db';
import { activitiesTable, userTable } from '~/db/schema';

type ActivityType =
  | 'created'
  | 'updated'
  | 'name_changed'
  | 'content_changed'
  | 'status_changed'
  | 'assignee_added'
  | 'assignee_removed'
  | 'column_moved'
  | 'due_date_changed'
  | 'priority_changed'
  | 'company_linked'
  | 'person_linked'
  | 'task_created'
  | 'subtask_created'
  | 'deleted';

type EntityType = 'task' | 'person' | 'company' | 'meeting';

interface LogActivityParams {
  entityType: EntityType;
  entityId: string;
  userId: string | null;
  activityType: ActivityType;
  description?: string;
  metadata?: {
    field?: string;
    oldValue?: string | null;
    newValue?: string | null;
    [key: string]: unknown;
  };
  relatedEntityId?: string | null;
  relatedEntityType?: 'user' | 'company' | 'person' | 'task' | null;
}

export async function logActivity({
  entityType,
  entityId,
  userId,
  activityType,
  description,
  metadata,
  relatedEntityId,
  relatedEntityType,
  tx,
}: LogActivityParams & {
  tx?: Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;
}) {
  try {
    let validUserId = userId;
    if (userId) {
      const dbToUse = tx || db;
      const userExists = await dbToUse.query.userTable.findFirst({
        where: eq(userTable.id, userId),
      });
      if (!userExists) {
        validUserId = null;
      }
    }

    const values = {
      entityType,
      entityId,
      userId: validUserId,
      activityType,
      description: description || generateActivityDescription(activityType, metadata, relatedEntityType),
      metadata: metadata ? JSON.stringify(metadata) : null,
      relatedEntityId,
      relatedEntityType,
    };

    const dbToUse = tx || db;
    const result = await dbToUse.insert(activitiesTable).values(values);

    return result;
  } catch (error) {
    // Try to extract more details
    if (error && typeof error === 'object') {
      try {
        console.error('[logActivity] Error full object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      } catch {
        // eslint-disable-next-line no-console
        console.error('[logActivity] Could not stringify error');
      }
    }
  }
}

function generateActivityDescription(
  activityType: ActivityType,
  metadata?: LogActivityParams['metadata'],
  relatedEntityType?: string | null,
): string {
  switch (activityType) {
    case 'created':
      return 'Item was created';
    case 'name_changed':
      return `Title changed from "${metadata?.oldValue || 'Untitled'}" to "${metadata?.newValue || 'Untitled'}"`;
    case 'content_changed':
      return metadata?.oldValue ? 'Description updated' : 'Description added';
    case 'status_changed':
      return `Status changed from "${metadata?.oldValue || 'None'}" to "${metadata?.newValue || 'None'}"`;
    case 'column_moved':
      return `Moved from "${metadata?.oldValue || 'Unknown'}" to "${metadata?.newValue || 'Unknown'}"`;
    case 'assignee_added':
      return relatedEntityType === 'user' ? 'User assigned' : 'Assignee added';
    case 'assignee_removed':
      return relatedEntityType === 'user' ? 'User unassigned' : 'Assignee removed';
    case 'due_date_changed':
      return `Due date changed ${metadata?.newValue ? `to ${metadata.newValue}` : 'removed'}`;
    case 'priority_changed':
      return `Priority changed from "${metadata?.oldValue || 'None'}" to "${metadata?.newValue || 'None'}"`;
    case 'company_linked':
      return 'Company linked';
    case 'person_linked':
      return 'Person linked';
    case 'task_created':
      return 'Created a new task';
    case 'subtask_created':
      return 'Created a new sub-task';
    case 'updated':
      return metadata?.field ? `${metadata.field} updated` : 'Item updated';
    case 'deleted':
      return 'Item was deleted';
    default:
      return 'Activity recorded';
  }
}

// Convenience functions for backward compatibility and ease of use
export async function logTaskActivity(
  params: Omit<LogActivityParams, 'entityType' | 'entityId'> & {
    taskId: string;
    tx?: Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;
  },
) {
  await logActivity({ ...params, entityType: 'task', entityId: params.taskId, tx: params.tx });
}

export async function logPersonActivity(
  params: Omit<LogActivityParams, 'entityType' | 'entityId'> & {
    personId: string;
    tx?: Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;
  },
) {
  await logActivity({ ...params, entityType: 'person', entityId: params.personId, tx: params.tx });
}

export async function logCompanyActivity(
  params: Omit<LogActivityParams, 'entityType' | 'entityId'> & {
    companyId: string;
    tx?: Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;
  },
) {
  await logActivity({ ...params, entityType: 'company', entityId: params.companyId, tx: params.tx });
}

export async function logMeetingActivity(
  params: Omit<LogActivityParams, 'entityType' | 'entityId'> & {
    meetingId: string;
    tx?: Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;
  },
) {
  await logActivity({ ...params, entityType: 'meeting', entityId: params.meetingId, tx: params.tx });
}
