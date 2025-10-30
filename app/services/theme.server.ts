import { createCookie } from 'react-router';
import { createTypedCookie } from 'remix-utils/typed-cookie';
import { z } from 'zod';

export const themeSchema = z.enum(['light', 'dark', 'system']);
type Theme = z.infer<typeof themeSchema>;

const themeCookie = createCookie('user-theme', {
  path: '/',
  maxAge: 60 * 60 * 24 * 30 * 12 * 10 // 10 years
});

const userThemeCookie = createTypedCookie({
  cookie: themeCookie,
  schema: themeSchema
});

export async function getTheme(request: Request) {
  const theme = await userThemeCookie.parse(request.headers.get('Cookie'));
  if (!theme) return 'system';
  return theme;
}

export async function setTheme(theme: Theme) {
  return userThemeCookie.serialize(theme);
}
