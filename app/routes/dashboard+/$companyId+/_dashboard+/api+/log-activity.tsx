import { data, type ActionFunctionArgs } from 'react-router';
import { requireUser } from '~/services/whop.server';
import { db } from '~/db';
import { activitiesTable } from '~/db/schema/activities';

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { companyId } = params;
  if (!companyId) {
    return data({ error: 'Company ID is required' }, { status: 400 });
  }
  const { user } = await requireUser(request, companyId);
  const formData = await request.formData();

  const entityId = formData.get('entityId') as string;
  const entityType = formData.get('entityType') as string;
  const activityType = formData.get('activityType') as string;
  const activityName = formData.get('activityName') as string;
  const activityDescription = formData.get('activityDescription') as string;
  const activityDate = formData.get('activityDate') as string;
  const activityTime = formData.get('activityTime') as string;

  // Validate required fields
  if (!entityId || !entityType || !activityType || !activityName || !activityDate || !activityTime) {
    return data({ error: 'Missing required fields' }, { status: 400 });
  }

  // Combine date and time into a single datetime string
  const activityDateTime = new Date(`${activityDate}T${activityTime}`);

  // Validate date is not in the future
  if (activityDateTime > new Date()) {
    return data({ error: 'Activity date cannot be in the future' }, { status: 400 });
  }

  try {
    // Insert the activity into the database
    await db.insert(activitiesTable).values({
      entityType,
      entityId,
      userId: user.id,
      activityType,
      description: `${activityName}${activityDescription ? `: ${activityDescription}` : ''}`,
      createdAt: activityDateTime.toISOString(),
      metadata: JSON.stringify({
        name: activityName,
        description: activityDescription,
        type: activityType,
      }),
    });

    return data({ success: true }, { status: 200 });
  } catch {
    return data({ error: 'Failed to log activity' }, { status: 500 });
  }
};
