import { db } from '@/lib/db/drizzle';
import { emails, threads } from '@/lib/db/schema';
import { getResend } from '@/lib/resend';
import { requireMailbox } from '@/lib/session';
import { and, eq } from 'drizzle-orm';
export async function GET(
  _: Request,
  { params }: { params: Promise<{ emailId: string; attachmentId: string }> },
) {
  const mailbox = await requireMailbox();
  const { emailId, attachmentId } = await params;
  if (!/^[1-9]\d*$/.test(emailId))
    return new Response('Not found', { status: 404 });
  const [message] = await db
    .select({ providerId: emails.providerId, attachments: emails.attachments })
    .from(emails)
    .innerJoin(threads, eq(threads.id, emails.threadId))
    .where(
      and(eq(emails.id, Number(emailId)), eq(threads.mailboxId, mailbox.id)),
    );
  if (
    !message?.providerId ||
    !message.attachments.some((a) => a.id === attachmentId)
  )
    return new Response('Not found', { status: 404 });
  const result = await getResend().emails.receiving.attachments.get({
    emailId: message.providerId,
    id: attachmentId,
  });
  if (!result.data)
    return new Response('Attachment is unavailable', { status: 502 });
  return new Response(null, {
    status: 302,
    headers: {
      Location: result.data.download_url,
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
