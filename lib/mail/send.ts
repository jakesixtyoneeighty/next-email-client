import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/drizzle';
import {
  emails,
  folders,
  mailboxes,
  outbox,
  threadFolders,
  threads,
  users,
} from '../db/schema';
import { getResend } from '../resend';

type Mailbox = { id: number; email: string; contactId: number };
type Message = {
  id: string;
  recipientEmail: string;
  subject: string;
  body: string;
};
export async function sendMessage(
  mailbox: Mailbox,
  message: Message,
  provider = getResend(),
) {
  // Persist the request before contacting the provider, preserving the retry key after a timeout.
  await db.transaction(async (tx) => {
    await tx
      .select()
      .from(mailboxes)
      .where(eq(mailboxes.id, mailbox.id))
      .for('update');
    const [existing] = await tx
      .select()
      .from(outbox)
      .where(eq(outbox.id, message.id));
    if (existing) return;
    const [rate] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(outbox)
      .where(
        and(
          eq(outbox.mailboxId, mailbox.id),
          sql`${outbox.createdAt} > now() - interval '1 hour'`,
        ),
      );
    if (Number(rate.count) >= 100)
      throw new Error(
        'The hourly sending limit has been reached. Please try later.',
      );
    await tx.insert(outbox).values({
      id: message.id,
      mailboxId: mailbox.id,
      recipient: message.recipientEmail,
      subject: message.subject,
      body: message.body,
    });
  });
  return db.transaction(async (tx) => {
    const [pending] = await tx
      .select()
      .from(outbox)
      .where(and(eq(outbox.id, message.id), eq(outbox.mailboxId, mailbox.id)))
      .for('update');
    if (
      !pending ||
      pending.recipient !== message.recipientEmail ||
      pending.subject !== message.subject ||
      pending.body !== message.body
    )
      throw new Error(
        'This send request has changed. Open a new draft to send a different message.',
      );
    if (pending.threadId) return pending.threadId;
    // Resend expires idempotency keys after 24 hours. Never automatically resend an old uncertain request.
    if (Date.now() - pending.createdAt.getTime() > 23 * 60 * 60 * 1000)
      throw new Error(
        'Delivery needs review in Resend before this message can be retried.',
      );
    const result = await provider.emails.send(
      {
        from: mailbox.email,
        to: pending.recipient,
        subject: pending.subject,
        text: pending.body,
      },
      { idempotencyKey: `mail/${mailbox.id}/${message.id}` },
    );
    if (result.error || !result.data)
      throw new Error(
        'Delivery could not be confirmed. Retry this unchanged message to safely check again.',
      );
    await tx
      .insert(users)
      .values({ email: pending.recipient })
      .onConflictDoNothing();
    const [recipient] = await tx
      .select()
      .from(users)
      .where(eq(users.email, pending.recipient));
    const [sent] = await tx
      .select()
      .from(folders)
      .where(eq(folders.name, 'Sent'))
      .limit(1);
    if (!sent) throw new Error('Sent folder is missing');
    const [thread] = await tx
      .insert(threads)
      .values({ mailboxId: mailbox.id, subject: pending.subject })
      .returning();
    await tx.insert(emails).values({
      threadId: thread.id,
      senderId: mailbox.contactId,
      recipientId: recipient.id,
      subject: pending.subject,
      body: pending.body,
      recipientAddress: pending.recipient,
      providerId: result.data.id,
    });
    await tx
      .insert(threadFolders)
      .values({ threadId: thread.id, folderId: sent.id });
    await tx
      .update(outbox)
      .set({
        status: 'accepted',
        providerId: result.data.id,
        threadId: thread.id,
      })
      .where(eq(outbox.id, message.id));
    return thread.id;
  });
}
