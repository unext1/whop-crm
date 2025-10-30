import { parseWithZod } from '@conform-to/zod';
import { data } from 'react-router';
import { z } from 'zod';
import { requireUser } from '~/services/whop.server';
import type { Route } from './+types/manage';

const schema = z.object({
  taskId: z.string().min(1),
  startTime: z.string(),
  description: z.string().nullable(),
  stopTime: z.string(),
  _action: z.enum(['start', 'stop']),
});

export async function action({ request, params }: Route.ActionArgs) {
  await requireUser(request, params.companyId);

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema });

  if (submission.status !== 'success') {
    return data(submission.reply(), { status: 400 });
  }

  return {};
}
