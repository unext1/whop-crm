import { data, redirect } from 'react-router';
import { db } from '~/db';
import { companiesTable } from '~/db/schema';
import { requireUser } from '~/services/whop.server';
import type { Route } from './+types/create';

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUser(request, params.companyId);
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'createCompany') {
    const name = String(formData.get('name') || '');
    const domain = formData.get('domain') ? String(formData.get('domain')) : null;
    const industry = formData.get('industry') ? String(formData.get('industry')) : null;
    const website = formData.get('website') ? String(formData.get('website')) : null;
    const description = formData.get('description') ? String(formData.get('description')) : null;
    const organizationId = String(formData.get('organizationId') || '');

    if (!name || !organizationId) {
      throw data('Missing required fields', { status: 400 });
    }

    await db.insert(companiesTable).values({
      name,
      domain,
      industry,
      website,
      description,
      organizationId,
    });

    return redirect(`/dashboard/${params.companyId}/people`);
  }

  return {};
}
