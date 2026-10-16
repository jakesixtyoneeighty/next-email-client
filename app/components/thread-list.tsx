import type { emails, users } from '@/lib/db/schema';
import { formatEmailString, highlightText } from '@/lib/utils';
import { Inbox, Search } from 'lucide-react';
import Form from 'next/form';
import Link from 'next/link';
import { RefreshMail } from './refresh-mail';
import { ThreadActions } from './thread-actions';

type User = typeof users.$inferSelect;
type Email = Pick<
  typeof emails.$inferSelect,
  'id' | 'senderId' | 'recipientId' | 'subject' | 'body' | 'sentDate'
> & {
  sender: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
};
export type MailThread = {
  id: number;
  subject: string | null;
  lastActivityDate: Date | null;
  emails: Email[];
};

export function MailTopbar() {
  return (
    <div className="mail-topbar">
      <span>
        Workspace <span className="breadcrumb-slash">/</span>{' '}
        <strong>Mail</strong>
      </span>
      <RefreshMail />
      <Form action="/search" className="quick-search">
        <Search size={16} />
        <input name="q" aria-label="Search mail" placeholder="Search mail" />
      </Form>
    </div>
  );
}
export function ThreadHeader({
  folderName,
  count,
}: {
  folderName: string;
  count?: number;
}) {
  return (
    <>
      <MailTopbar />
      <header className="mail-heading">
        <div>
          <h1>
            {folderName || 'Mail'}
            {count !== undefined && (
              <span className="count-badge">{count}</span>
            )}
          </h1>
          <p>
            {folderName === 'inbox'
              ? 'Your conversations, in one place.'
              : `A little more clarity. Everything in ${folderName || 'your mailbox'}.`}
          </p>
        </div>
      </header>
    </>
  );
}
export function ThreadList({
  folderName,
  threads,
  configured = true,
}: {
  folderName: string;
  threads: MailThread[];
  configured?: boolean;
}) {
  return (
    <div className="mail-page">
      <ThreadHeader folderName={folderName} count={threads.length} />
      <div className="list-labels">
        <span>Conversation</span>
        <span>Last activity</span>
      </div>
      <div className="thread-scroll">
        {threads.length ? (
          threads.map((thread) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              folderName={folderName}
            />
          ))
        ) : (
          <div className="empty-state">
            <span className="empty-icon">
              <Inbox size={28} strokeWidth={1.3} />
            </span>
            <h2>
              {configured
                ? 'A little breathing room.'
                : 'Your next conversation starts here.'}
            </h2>
            <p>
              {configured
                ? `There are no conversations in ${folderName} yet.`
                : 'Connect your mailbox database to bring your conversations into sixtyoneeighty.'}
            </p>
            {configured ? (
              <Link className="secondary-button" href="/f/inbox/new">
                Write a message
              </Link>
            ) : (
              <p className="setup-hint">
                Run the database setup in the project README to get started.
              </p>
            )}
          </div>
        )}
      </div>
      <footer className="mail-footer">
        <span>
          {threads.length} conversation{threads.length === 1 ? '' : 's'}
        </span>
        <span>sixtyoneeighty mail</span>
      </footer>
    </div>
  );
}
export function ThreadRow({
  thread,
  folderName,
  query,
}: {
  thread: MailThread;
  folderName: string;
  query?: string;
}) {
  const email = thread.emails[0];
  if (!email) return null;
  const name = formatEmailString(email.sender).trim();
  return (
    <article className="thread-row">
      <Link className="thread-link" href={`/f/${folderName}/${thread.id}`}>
        <span className="avatar">
          {(email.sender.firstName?.[0] || email.sender.email[0]).toUpperCase()}
          {email.sender.lastName?.[0]}
        </span>
        <div className="thread-copy">
          <span className="sender-name">{highlightText(name, query)}</span>
          <h2>
            {highlightText(thread.subject || '(No subject)', query)}
            {thread.emails.length > 1 && (
              <span className="message-count">{thread.emails.length}</span>
            )}
          </h2>
          <p>{highlightText(email.body || '', query)}</p>
        </div>
        <time
          dateTime={
            thread.lastActivityDate
              ? new Date(thread.lastActivityDate).toISOString()
              : undefined
          }
        >
          {thread.lastActivityDate
            ? new Date(thread.lastActivityDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'UTC',
              })
            : ''}
        </time>
      </Link>
      <div className="row-actions">
        <ThreadActions threadId={thread.id} />
      </div>
    </article>
  );
}
