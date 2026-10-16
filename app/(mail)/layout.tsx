import { Navigation } from '@/app/components/navigation';
import { RightSidebar } from '@/app/components/right-sidebar';
import { requireMailbox } from '@/lib/session';
import { Suspense } from 'react';

// Session redirects depend on the request and cannot satisfy instant-route validation.
export const instant = false;

async function Workspace({ children }: { children: React.ReactNode }) {
  const mailbox = await requireMailbox();
  return (
    <>
      <Navigation email={mailbox.email} />
      <main id="main-content" className="mail-main">
        {children}
      </main>
      <RightSidebar />
    </>
  );
}
export default function MailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={<div className="auth-loading">Opening your mailbox…</div>}
    >
      <Workspace>{children}</Workspace>
    </Suspense>
  );
}
