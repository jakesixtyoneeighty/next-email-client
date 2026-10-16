import dotenv from 'dotenv';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'path';
import { client, db } from './drizzle';

dotenv.config();

async function main() {
  await migrate(db, {
    migrationsSchema: 'mail_migrations',
    migrationsTable: '__mail_migrations',
    migrationsFolder: path.join(process.cwd(), '/lib/db/mail-migrations'),
  });
  console.log(`Migrations complete`);
  await client.end();
}

main();
