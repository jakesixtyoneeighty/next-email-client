import { MessageHtmlFrame } from '@/app/components/message-html-frame';
import { MessagePlainText } from '@/app/components/message-plain-text';
import { ThreadActions } from '@/app/components/thread-actions';
import { getEmailsForThread, getThreadInFolder } from '@/lib/db/queries';
import { hydrateEmailForView } from '@/lib/mail/hydrate';
import { isImageAttachment, prepareEmailHtml } from '@/lib/mail/sanitize';
import { ArrowLeft, Paperclip, Reply } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const instant = false;

export default async function EmailPage({
  params,
}: {
  params: Promise<{ name: string; id: string }>;
}) {
  const { name, id } = await params;
  if (!/^[1-9]\d*$/.test(id)) notFound();
  const [thread, membership] = await Promise.all([
    getEmailsForThread(id),
    getThreadInFolder(name, id),
  ]);
  if (!thread || !thread.emails.length) notFound();

  const renderedEmails = [];
  for (const email of thread.emails) {
    const hydrated = await hydrateEmailForView(email);
    const senderDisplay = [
      email.sender.firstName || 'Contact',
      email.sender.lastName,
    ]
      .filter(Boolean)
      .join(' ');
    const prepared = hydrated.bodyHtml?.trim()
      ? prepareEmailHtml({
          emailId: email.id,
          html: hydrated.bodyHtml,
          attachments: hydrated.attachments,
          signedUrls: hydrated.signedUrls,
        })
      : null;
    const usedInlineAttachmentIds =
      prepared?.usedInlineAttachmentIds ?? new Set<string>();
    const remainingAttachments = hydrated.attachments.filter(
      (a) => !usedInlineAttachmentIds.has(a.id),
    );
    const imageAttachments = remainingAttachments.filter((a) =>
      isImageAttachment(a),
    );
    const fileAttachments = remainingAttachments.filter(
      (a) => !isImageAttachment(a),
    );

    renderedEmails.push({
      email,
      senderDisplay,
      prepared,
      signedUrls: hydrated.signedUrls,
      imageAttachments,
      fileAttachments,
    });
  }

  return (
    <div className="reader-scroll">
      <div className="reader-toolbar">
        <Link className="back-link" href={`/f/${name}`}>
          <ArrowLeft size={16} /> Back to {name}
        </Link>
        <ThreadActions threadId={thread.id} />
      </div>
      <div className="reader-content">
        <h1 className="reader-title">{thread.subject || '(No subject)'}</h1>
        <p className="thread-meta">
          {thread.emails.length} message{thread.emails.length === 1 ? '' : 's'}{' '}
          {!membership && '· This conversation has been moved'}
        </p>
        {renderedEmails.map(
          ({
            email,
            senderDisplay,
            prepared,
            signedUrls,
            imageAttachments,
            fileAttachments,
          }) => (
            <article key={email.id} className="message">
              <header className="message-header">
                <span className="avatar">
                  {email.sender.firstName?.[0]}
                  {email.sender.lastName?.[0]}
                </span>
                <div>
                  <h2>{senderDisplay}</h2>
                  <p>
                    {email.sender.email} → {email.recipientAddress || 'me'}
                  </p>
                </div>
                <time>
                  {email.sentDate
                    ? new Date(email.sentDate).toLocaleString('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'UTC',
                      }) + ' UTC'
                    : ''}
                </time>
              </header>
              {prepared ? (
                <MessageHtmlFrame
                  srcDoc={prepared.srcDoc}
                  title={`Message from ${senderDisplay}`}
                />
              ) : (
                <MessagePlainText text={email.body || ''} />
              )}
              {imageAttachments.length > 0 && (
                <div className="message-image-attachments">
                  {imageAttachments.map((a) => {
                    const fallbackHref = `/api/attachments/${email.id}/${a.id}`;
                    const imgSrc = signedUrls.get(a.id) || fallbackHref;
                    return (
                      <figure className="attachment-image-card" key={a.id}>
                        <a
                          className="attachment-image-link"
                          href={fallbackHref}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            className="attachment-image"
                            src={imgSrc}
                            alt={a.filename}
                            referrerPolicy="no-referrer"
                          />
                        </a>
                        <figcaption className="attachment-image-meta">
                          <span>{a.filename}</span>
                          <span>
                            {Math.max(1, Math.ceil(a.size / 1024))} KB
                          </span>
                        </figcaption>
                      </figure>
                    );
                  })}
                </div>
              )}
              {fileAttachments.map((a) => (
                <a
                  className="attachment-link"
                  key={a.id}
                  href={`/api/attachments/${email.id}/${a.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Paperclip size={14} /> {a.filename} (
                  {Math.max(1, Math.ceil(a.size / 1024))} KB)
                </a>
              ))}
              <Link
                className="back-link"
                href={`/f/inbox/new?${new URLSearchParams({ to: email.replyTo || email.sender.email, subject: /^re:/i.test(thread.subject || '') ? thread.subject! : `Re: ${thread.subject || ''}` })}`}
              >
                <Reply size={15} /> Reply
              </Link>
            </article>
          ),
        )}
      </div>
    </div>
  );
}
