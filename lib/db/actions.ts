'use server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod/v3';
import { sendMessage } from '../mail/send';
import { requireMailbox } from '../session';
import { db } from './drizzle';
import { folders, threadFolders, threads } from './schema';

const sendEmailSchema = z.object({
  id: z.string().uuid(),
  subject: z.string().trim().min(1, 'Subject is required').max(255),
  body: z.string().min(1, 'Body is required').max(100_000),
  recipientEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email address')
    .max(255),
});
export async function sendEmailAction(_: unknown, formData: FormData) {
  const mailbox = await requireMailbox();
  const previous = {
    id: String(formData.get('id') || ''),
    subject: String(formData.get('subject') || ''),
    body: String(formData.get('body') || ''),
    recipientEmail: String(formData.get('recipientEmail') || ''),
  };
  const parsed = sendEmailSchema.safeParse(previous);
  if (!parsed.success)
    return { error: parsed.error.issues[0].message, previous };
  let threadId;
  try {
    threadId = await sendMessage(mailbox, parsed.data);
  } catch (error) {
    return {
      error:
        error instanceof Error && !('query' in error)
          ? error.message
          : 'Delivery could not be confirmed. Retry this unchanged message.',
      previous,
    };
  }
  revalidatePath('/', 'layout');
  redirect(`/f/sent/${threadId}`);
}
async function moveThread(formData: FormData, destination: string) {
  const mailbox = await requireMailbox();
  const id = z.coerce
    .number()
    .int()
    .positive()
    .safeParse(formData.get('threadId'));
  if (!id.success) return { error: 'Invalid conversation', success: false };
  try {
    await db.transaction(async (tx) => {
      const [thread] = await tx
        .select()
        .from(threads)
        .where(and(eq(threads.id, id.data), eq(threads.mailboxId, mailbox.id)))
        .for('update');
      if (!thread) throw new Error('Conversation not found');
      const [folder] = await tx
        .select()
        .from(folders)
        .where(eq(folders.name, destination))
        .limit(1);
      if (!folder) throw new Error('Folder not found');
      await tx
        .delete(threadFolders)
        .where(eq(threadFolders.threadId, thread.id));
      await tx
        .insert(threadFolders)
        .values({ threadId: thread.id, folderId: folder.id });
    });
    revalidatePath('/', 'layout');
    return { success: true, error: null };
  } catch {
    return { success: false, error: 'Unable to move this conversation.' };
  }
}
export async function moveThreadToDone(_: unknown, formData: FormData) {
  return moveThread(formData, 'Archive');
}
export async function moveThreadToTrash(_: unknown, formData: FormData) {
  return moveThread(formData, 'Trash');
}
