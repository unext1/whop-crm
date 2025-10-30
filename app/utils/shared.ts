import { createCookie } from 'react-router';
import { env } from '~/services/env.server';

export const MINUTE = 60;
export const HOUR = MINUTE * 60;
export const DAY = HOUR * 24;
export const WEEK = DAY * 7;
export const YEAR = DAY * 365;

export const SESSION_MAX_AGE = WEEK;

export function cookie({
  name,
  maxAge = SESSION_MAX_AGE,
  sameSite = 'lax'
}: {
  name: string;
  maxAge?: number;
  sameSite?: 'lax' | 'strict' | 'none';
}) {
  return createCookie(name, {
    path: '/',
    sameSite,
    httpOnly: true,
    secrets: [env.SESSION_SECRET],
    secure: env.NODE_ENV === 'production',
    maxAge
  });
}

export const selectedOrgCookie = createCookie('selectedOrganization', {
  maxAge: YEAR
});
