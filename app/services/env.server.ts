import { z } from 'zod';
import 'dotenv/config';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  SESSION_SECRET: z.string().min(1).trim(),
  CSRF_SECRET: z.string().min(1).trim(),

  WHOP_WEBHOOK_SECRET: z.string().min(1).trim(),
  WHOP_API_KEY: z.string().min(1).trim(),
  WHOP_APP_ID: z.string().min(1).trim(),
  WHOP_AGENT_USER_ID: z.string().min(1).trim(),
  WHOP_COMPANY_ID: z.string().min(1).trim(),

  WHOP_MONTHLY_PLAN_ID: z.string().min(1).trim(),
  WHOP_ANNUAL_PLAN_ID: z.string().min(1).trim(),
  WHOP_PREMIUM_PRODUCT_ID: z.string().min(1).trim(),

  TURSO_DATABASE_URL: z.string().min(1).trim(),
  TURSO_AUTH_TOKEN: z.string().min(1).trim(),

  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).trim(),

  OPENROUTER_API_KEY: z.string().min(1).trim(),
});

export const env = environmentSchema.parse(process.env);
