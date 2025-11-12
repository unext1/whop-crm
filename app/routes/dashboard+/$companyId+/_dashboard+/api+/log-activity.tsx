import { data, type ActionFunctionArgs } from 'react-router';
import { db } from '~/db';
import { activitiesTable } from '~/db/schema/activities';
import { putToast } from '~/services/cookie.server';
import { requireUser } from '~/services/whop.server';

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
  const activityDateTimeString = formData.get('activityDateTime') as string;

  // Validate required fields
  if (!entityId || !entityType || !activityType || !activityName || !activityDateTimeString) {
    return data({ error: 'Missing required fields' }, { status: 400 });
  }

  // Parse the datetime from the ISO string
  const activityDateTime = new Date(activityDateTimeString);

  // Validate date is not in the future
  if (activityDateTime > new Date()) {
    const headers = await putToast({
      title: 'Error',
      message: 'Activity date cannot be in the future',
      variant: 'destructive',
    });
    return data({}, { headers });
  }
  try {
    await db.insert(activitiesTable).values({
      entityType,
      entityId,
      userId: user.id,
      activityType,
      description: `${activityName}${activityDescription ? `: ${activityDescription}` : ''}`,
      activityDate: activityDateTime.toISOString(),
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
