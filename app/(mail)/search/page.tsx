import { MailTopbar, ThreadRow } from '@/app/components/thread-list';
import { searchThreads } from '@/lib/db/queries';
import { Search } from 'lucide-react';
import Form from 'next/form';
import { Suspense } from 'react';

export default function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return (
    <div className="mail-page">
      <MailTopbar />
      <Suspense
        fallback={<div className="loading-state">Searching conversations…</div>}
      >
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
async function Results({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const threads = await searchThreads(q);
  return (
    <>
      <header className="mail-heading">
        <div>
          <h1>
            Search<span className="count-badge">{threads.length}</span>
          </h1>
          <p>
            {q
              ? `Results for “${q}”`
              : 'Find the conversation you’re looking for.'}
          </p>
        </div>
      </header>
      <Form action="/search" className="search-form">
        <Search size={17} />
        <input
          name="q"
          aria-label="Search conversations"
          placeholder="Search people, subjects, or messages"
          defaultValue={q}
          key={q}
          autoFocus
        />
      </Form>
      <div className="list-labels">
        <span>Conversation</span>
        <span>Last activity</span>
      </div>
      <div className="thread-scroll">
        {threads.map((thread) => (
          <ThreadRow
            key={thread.id}
            folderName={
              thread.folderName?.toLowerCase() === 'flagged'
                ? 'starred'
                : thread.folderName?.toLowerCase() || 'inbox'
            }
            query={q}
            thread={{ ...thread, emails: [thread.latestEmail] }}
          />
        ))}
        {!threads.length && (
          <div className="empty-state">
            <span className="empty-icon">
              <Search size={28} />
            </span>
            <h2>{q ? 'No conversations found.' : 'Find your next thread.'}</h2>
            <p>
              {q
                ? 'Try a different name, subject, or phrase.'
                : 'Search across your people, subjects, and messages.'}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
