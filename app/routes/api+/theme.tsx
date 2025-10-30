import type { ActionFunctionArgs } from 'react-router';
import { data, redirect } from 'react-router';

import { setTheme, themeSchema } from '~/services/theme.server';

export function loader() {
  return redirect('/');
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const theme = formData.get('theme');
    const parsedData = themeSchema.parse(theme);
    return data({}, { headers: { 'Set-Cookie': await setTheme(parsedData) } });
  } catch (error) {
    return data(error, { status: 400 });
  }
}
