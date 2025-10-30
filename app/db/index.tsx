import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import 'dotenv/config';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL as string,
  authToken: process.env.TURSO_AUTH_TOKEN as string
});

const db = drizzle(client, { schema });

export { db };
