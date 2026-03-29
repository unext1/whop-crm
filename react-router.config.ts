import type { Config } from '@react-router/dev/config';

/**
 * Single-fetch POST actions run CSRF: `Origin` must match `Host` / `X-Forwarded-Host`, OR
 * the origin host must be listed here. Whop embeds often send `Origin: https://whop.com`
 * while the app runs on e.g. `*.vercel.app` — that fails without this list.
 * @see https://reactrouter.com/api/framework-conventions/react-router.config.ts#allowedactionorigins
 */
const extraAllowedActionOrigins =
  process.env.ALLOWED_ACTION_ORIGINS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) ?? [];

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: true,
  future: {
    unstable_optimizeDeps: true
  },
  allowedActionOrigins: [
    'whop.com',
    'www.whop.com',
    '*.whop.com',
    '**.whop.com',
    '*.vercel.app',
    '*.vercel.dev',
    ...extraAllowedActionOrigins
  ]
} satisfies Config;
