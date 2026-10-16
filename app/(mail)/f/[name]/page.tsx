import { ThreadHeader, ThreadList } from '@/app/components/thread-list';
import { getThreadsForFolder } from '@/lib/db/queries';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

const folderNames = ['inbox', 'starred', 'drafts', 'sent', 'archive', 'trash'];
export function generateStaticParams() {
  return folderNames.map((name) => ({ name }));
}
export const instant = false;

export default function ThreadsPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="mail-page">
          <ThreadHeader folderName="" />
          <div className="loading-state">Loading conversations…</div>
        </div>
      }
    >
      <Threads params={params} />
    </Suspense>
  );
}
async function Threads({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!folderNames.includes(name)) notFound();
  const threads = await getThreadsForFolder(name);
  return (
    <ThreadList
      folderName={name}
      threads={threads}
      configured={Boolean(process.env.POSTGRES_URL)}
    />
  );
}
