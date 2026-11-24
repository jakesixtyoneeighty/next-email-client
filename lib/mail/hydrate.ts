import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/drizzle';
import { emails, type EmailAttachment } from '../db/schema';
import { getResend } from '../resend';
import { sanitizeHttpsUrl } from './links';
import { isImageAttachment } from './sanitize';

export type HydratableEmail = {
  id: number;
  bodyHtml: string | null;
  providerId: string | null;
  isInbound: boolean;
  attachments: EmailAttachment[];
};

const RESEND_TIMEOUT_MS = 4000;

/**
 * Lazily hydrates legacy inbound HTML bodies and resolves temporary Resend
 * signed attachment URLs in a single list call per message.
 */
export async function hydrateEmailForView(email: HydratableEmail): Promise<{
  bodyHtml: string | null;
  attachments: EmailAttachment[];
  signedUrls: Map<string, string>;
}> {
  let bodyHtml = email.bodyHtml;
  let attachments = email.attachments;
  const signedUrls = new Map<string, string>();

  if (
    email.isInbound &&
    email.providerId &&
    bodyHtml === null &&
    process.env.RESEND_API_KEY
  ) {
    try {
      const result = await getResend().emails.receiving.get(
        email.providerId,
        { html_format: 'cid' },
        { signal: AbortSignal.timeout(RESEND_TIMEOUT_MS) },
      );

      if (result.data) {
        const fetchedHtml = result.data.html ?? '';
        const fetchedById = new Map(
          (result.data.attachments || []).map((a) => [a.id, a]),
        );

        const enrichedAttachments: EmailAttachment[] =
          attachments.length > 0
            ? attachments.map((att) => {
                const remote = fetchedById.get(att.id);
                if (!remote) return att;
                return {
                  ...att,
                  contentType: att.contentType ?? remote.content_type ?? null,
                  contentId: att.contentId ?? remote.content_id ?? null,
                  contentDisposition:
                    att.contentDisposition ??
                    remote.content_disposition ??
                    null,
                };
              })
            : (result.data.attachments || []).map((a) => ({
                id: a.id,
                filename: a.filename || 'attachment',
                size: a.size,
                contentType: a.content_type || null,
                contentId: a.content_id || null,
                contentDisposition: a.content_disposition || null,
              }));

        bodyHtml = fetchedHtml;
        attachments = enrichedAttachments;

        await db
          .update(emails)
          .set({ bodyHtml: fetchedHtml, attachments: enrichedAttachments })
          .where(and(eq(emails.id, email.id), isNull(emails.bodyHtml)));
      } else if (
        result.error?.statusCode === 404 ||
        result.error?.name === 'not_found'
      ) {
        bodyHtml = '';
        await db
          .update(emails)
          .set({ bodyHtml: '' })
          .where(and(eq(emails.id, email.id), isNull(emails.bodyHtml)));
      }
    } catch {
      // Fall back to plain-text rendering on transient provider/DB failures.
    }
  }

  const needsAttachmentUrls =
    email.isInbound &&
    Boolean(email.providerId) &&
    attachments.length > 0 &&
    Boolean(process.env.RESEND_API_KEY) &&
    ((bodyHtml !== null && /cid:/i.test(bodyHtml)) ||
      attachments.some((a) => isImageAttachment(a) || !a.contentType));

  if (needsAttachmentUrls && email.providerId) {
    try {
      const listResult = await getResend().emails.receiving.attachments.list(
        { emailId: email.providerId },
        { signal: AbortSignal.timeout(RESEND_TIMEOUT_MS) },
      );

      if (listResult.data?.data?.length) {
        const remoteById = new Map(listResult.data.data.map((a) => [a.id, a]));
        for (const item of listResult.data.data) {
          const safeUrl = sanitizeHttpsUrl(item.download_url);
          if (safeUrl) {
            signedUrls.set(item.id, safeUrl);
          }
        }
        attachments = attachments.map((att) => {
          const remote = remoteById.get(att.id);
          if (!remote) return att;
          return {
            ...att,
            contentType: att.contentType ?? remote.content_type ?? null,
            contentId: att.contentId ?? remote.content_id ?? null,
            contentDisposition:
              att.contentDisposition ?? remote.content_disposition ?? null,
          };
        });
      }
    } catch {
      // Fall back to proxy endpoint URLs if listing signed attachment URLs fails.
    }
  }

  return { bodyHtml, attachments, signedUrls };
}
