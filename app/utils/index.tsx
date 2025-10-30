import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function asJweKey(secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(secret)) {
    throw new Error('Secret must be a 64 character hex string');
  }
  return new Uint8Array(Buffer.from(secret, 'hex'));
}

export const parseCookies = (cookieHeader: string): Record<string, string> => {
  return cookieHeader.split(';').reduce(
    (acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) {
        acc[key] = decodeURIComponent(value);
      }
      return acc;
    },
    {} as Record<string, string>
  );
};
