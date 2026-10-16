import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { auth } from './auth';
import { db } from './db/drizzle';
import { mailboxes } from './db/schema';

// React cache is request-local. Never put sessions in Next's shared data cache.
export const requireMailbox = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  const [mailbox] = await db
    .select({
      id: mailboxes.id,
      contactId: mailboxes.contactId,
      email: mailboxes.email,
    })
    .from(mailboxes)
    .where(eq(mailboxes.authUserId, session.user.id));
  if (!mailbox) redirect('/login?error=unavailable');
  return mailbox;
});
