import { data, type ActionFunctionArgs } from 'react-router';
import { requireUser } from '~/services/whop.server';
import { db } from '~/db';
import { activitiesTable } from '~/db/schema/activities';
import { putToast } from '~/services/cookie.server';

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

  console.log('Activity DateTime:', activityDateTimeString);
  console.log('Entity ID:', entityId);
  console.log('Entity Type:', entityType);
  console.log('Activity Type:', activityType);
  // Validate required fields
  if (!entityId || !entityType || !activityType || !activityName || !activityDateTimeString) {
    console.log('Missing required fields');
    return data({ error: 'Missing required fields' }, { status: 400 });
  }

  // Parse the datetime from the ISO string
  const activityDateTime = new Date(activityDateTimeString);

  console.log('Activity DateTime:', activityDateTime);
  // Validate date is not in the future
  if (activityDateTime > new Date()) {
    console.log('Activity date cannot be in the future');
    const headers = await putToast({
      title: 'Error',
      message: 'Activity date cannot be in the future',
      variant: 'destructive',
    });
    return data({}, { headers });
  }
  console.log('Activity date is not in the future');
  try {
    // Insert the activity into the database
    console.log('Inserting activity with:', {
      entityType,
      entityId,
      userId: user.id,
      activityType,
      description: `${activityName}${activityDescription ? `: ${activityDescription}` : ''}`,
      activityDate: activityDateTime.toISOString(),
    });

    const hi = await db.insert(activitiesTable).values({
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
    console.log('Activity inserted:', hi);

    return data({ success: true }, { status: 200 });
  } catch {
    console.log('Failed to log activity');
    return data({ error: 'Failed to log activity' }, { status: 500 });
  }
};
