import { data, redirect } from 'react-router';
import { db } from '~/db';
import { peopleTable } from '~/db/schema';
import { requireUser } from '~/services/whop.server';
import type { Route } from './+types/create';

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUser(request, params.companyId);
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'createPerson') {
    const name = String(formData.get('name') || '');
    const jobTitle = formData.get('jobTitle') ? String(formData.get('jobTitle')) : null;
    const companyId = String(formData.get('companyId') || '');
    const phone = formData.get('phone') ? String(formData.get('phone')) : null;
    const email = formData.get('email') ? String(formData.get('email')) : null;
    const organizationId = String(formData.get('organizationId') || '');

    if (!name || !companyId || !organizationId) {
      throw data('Missing required fields', { status: 400 });
    }

    await db.insert(peopleTable).values({
      name,
      jobTitle,
      companyId,
      phone,
      organizationId,
    });

    return redirect(`/dashboard/${params.companyId}/people`);
  }

  return {};
}
