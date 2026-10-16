import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { z } from 'zod/v3';
import { client, db } from '../lib/db/drizzle';
import { authUser, folders, mailboxes, users } from '../lib/db/schema';

async function main() {
  const recovery = z
    .tuple([z.string().email(), z.string().email()])
    .parse(process.argv.slice(2));
  await db.transaction(async (tx) => {
    for (const name of [
      'Inbox',
      'Flagged',
      'Drafts',
      'Sent',
      'Archive',
      'Trash',
    ]) {
      if (
        !(await tx.select().from(folders).where(eq(folders.name, name))).length
      )
        await tx.insert(folders).values({ name });
    }
    for (const [index, name] of ['Jake', 'Ivar'].entries()) {
      const email = `${name.toLowerCase()}@sixtyoneeighty.com`;
      const [existing] = await tx
        .select()
        .from(mailboxes)
        .where(eq(mailboxes.email, email));
      if (existing) {
        if (existing.recoveryEmail !== recovery[index])
          throw new Error(
            'Existing recovery address differs; review before changing account access.',
          );
        continue;
      }
      await tx
        .insert(users)
        .values({
          email,
          firstName: name,
          company: 'sixtyoneeighty',
          jobTitle: 'Member',
        })
        .onConflictDoNothing();
      const [contact] = await tx
        .select()
        .from(users)
        .where(eq(users.email, email));
      const id = randomUUID();
      // No initial password exists. Only a single-use link to the recovery address can set one.
      await tx
        .insert(authUser)
        .values({ id, name, email, emailVerified: true });
      await tx.insert(mailboxes).values({
        authUserId: id,
        contactId: contact.id,
        email,
        recoveryEmail: recovery[index],
      });
    }
  });
  console.log(
    'Jake and Ivar mailboxes are provisioned. Existing passwords and recovery addresses were preserved.',
  );
}
main()
  .catch(() => {
    console.error(
      'Provisioning failed. Verify the recovery addresses and database configuration.',
    );
    process.exitCode = 1;
  })
  .finally(() => client.end());
