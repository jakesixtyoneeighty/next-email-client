import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

dotenv.config();

// Queries and actions guard an unconfigured workspace before using this lazy client.
export const client = postgres(
  process.env.POSTGRES_URL || 'postgres://localhost/unconfigured',
);
export const db = drizzle(client, { schema });
