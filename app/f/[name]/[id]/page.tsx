import { ThreadActions } from '@/app/components/thread-actions';
import { getEmailsForThread, getThreadInFolder } from '@/lib/db/queries';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

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
        {thread.emails.map((email) => (
          <article key={email.id} className="message">
            <header className="message-header">
              <span className="avatar">
                {email.sender.firstName?.[0]}
                {email.sender.lastName?.[0]}
              </span>
              <div>
                <h2>
                  {email.sender.firstName || 'Contact'} {email.sender.lastName}
                </h2>
                <p>To {email.recipientId === 1 ? 'me' : 'recipient'}</p>
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
            <div className="message-body">{email.body}</div>
          </article>
        ))}
      </div>
    </div>
  );
}
