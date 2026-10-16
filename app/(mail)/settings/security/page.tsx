import { requireMailbox } from '@/lib/session';
import { Suspense } from 'react';
import { PasskeySettings } from './passkey-settings';

export const metadata = { title: 'Security' };
export const instant = false;

async function Security() {
  await requireMailbox();
  return <PasskeySettings />;
}

export default function SecurityPage() {
  return (
    <div className="security-page">
      <header className="mail-heading">
        <div>
          <h1>Security</h1>
          <p>A simpler way to sign in to your mailbox.</p>
        </div>
      </header>
      <Suspense
        fallback={<p className="loading-state">Loading security settings…</p>}
      >
        <Security />
      </Suspense>
    </div>
  );
}
