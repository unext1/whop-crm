import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

export default defineConfig({
  schema: './app/db/schema',
  out: './app/db/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL as string,
    authToken: process.env.TURSO_AUTH_TOKEN as string
  }
});
