import type { Config } from '@react-router/dev/config';

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
