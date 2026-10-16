'use client';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useTransition } from 'react';
export function RefreshMail() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, 30_000);
    return () => clearInterval(interval);
  }, [router]);
  return (
    <button
      className="icon-button"
      aria-label="Refresh mail"
      title="Refresh mail"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCw size={16} />
    </button>
  );
}
