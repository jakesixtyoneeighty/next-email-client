import { eq } from 'drizzle-orm';
import { convert } from 'html-to-text';
import type { GetReceivingEmailResponseSuccess } from 'resend';
import { db } from '../db/drizzle';
import {
  emails,
  folders,
  mailboxes,
  receipts,
  threadFolders,
  threads,
  users,
} from '../db/schema';
import { addressOf, destinationFor } from './routing';

export async function receiveEmail(message: GetReceivingEmailResponseSuccess) {
  // SMTP envelope recipients are authoritative; To/Cc headers can be forged.
  if (!Array.isArray(message.received_for) || !message.received_for.length)
    throw new Error('Missing envelope recipients');
  const destinations = new Map<string, string>();
  for (const recipient of message.received_for) {
    const destination = destinationFor(recipient);
    if (destination) destinations.set(destination, recipient);
  }
  const senderAddress = addressOf(message.from) || 'unknown@invalid.example';
  const senderName = message.from.includes('<')
    ? message.from.split('<')[0].replace(/^"|"$/g, '').trim()
    : senderAddress;
  const body =
    message.text ||
    convert(message.html || '', {
      wordwrap: false,
      selectors: [{ selector: 'img', format: 'skip' }],
    });
  for (const [destination, recipientAddress] of destinations) {
    await db.transaction(async (tx) => {
      const [mailbox] = await tx
        .select()
        .from(mailboxes)
        .where(eq(mailboxes.email, destination));
      if (!mailbox) throw new Error('Mailbox has not been provisioned');
      const inserted = await tx
        .insert(receipts)
        .values({ providerId: message.id, mailboxId: mailbox.id })
        .onConflictDoNothing()
        .returning();
      if (!inserted.length) return;
      await tx
        .insert(users)
        .values({ email: senderAddress, firstName: senderName.slice(0, 50) })
        .onConflictDoNothing();
      const [sender] = await tx
        .select()
        .from(users)
        .where(eq(users.email, senderAddress));
      const [folder] = await tx
        .select()
        .from(folders)
        .where(eq(folders.name, 'Inbox'))
        .limit(1);
      if (!folder) throw new Error('Inbox has not been provisioned');
      const [thread] = await tx
        .insert(threads)
        .values({
          mailboxId: mailbox.id,
          subject: (message.subject || '(No subject)').slice(0, 255),
          lastActivityDate: new Date(message.created_at),
        })
        .returning();
      await tx.insert(emails).values({
        threadId: thread.id,
        senderId: sender.id,
        recipientId: mailbox.contactId,
        subject: (message.subject || '(No subject)').slice(0, 255),
        body,
        providerId: message.id,
        recipientAddress,
        replyTo: addressOf(message.reply_to?.[0] || message.from),
        sentDate: new Date(message.created_at),
        attachments: (message.attachments || []).map((a) => ({
          id: a.id,
          filename: a.filename || 'attachment',
          size: a.size,
        })),
      });
      await tx
        .insert(threadFolders)
        .values({ threadId: thread.id, folderId: folder.id });
    });
  }
}
