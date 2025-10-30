import { parseWithZod } from '@conform-to/zod';
import { data } from 'react-router';
import type { z } from 'zod';

interface ZodParsePublicFormProps<T extends z.ZodSchema> {
  request: Request;
  schema: T;
}
export const zodParsePublicForm = async <T extends z.ZodSchema>({ request, schema }: ZodParsePublicFormProps<T>) => {
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema });

  if (submission.status !== 'success') {
    return {
      submission: undefined,
      errors: data(submission.reply(), {
        status: submission.status === 'error' ? 400 : 200
      })
    };
  }
  return { submission, errors: undefined };
};
