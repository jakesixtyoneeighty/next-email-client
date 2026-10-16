import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

dotenv.config({ path: ['.env.local', '.env'] });

// Queries and actions guard an unconfigured workspace before using this lazy client.
export const client = postgres(
  process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    'postgres://localhost/unconfigured',
  { prepare: false, max: 5 },
);
export const db = drizzle(client, { schema });
