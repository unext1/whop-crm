import type { Config } from '@react-router/dev/config';


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
  ]
} satisfies Config;
