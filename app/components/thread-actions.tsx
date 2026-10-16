'use client';
import { moveThreadToDone, moveThreadToTrash } from '@/lib/db/actions';
import { Archive, Trash2 } from 'lucide-react';
import { useActionState, useEffect } from 'react';
import { toast } from 'sonner';

export function ThreadActions({ threadId }: { threadId: number }) {
  const [archiveState, archiveAction, archivePending] = useActionState(
    moveThreadToDone,
    { error: null, success: false },
  );
  const [trashState, trashAction, trashPending] = useActionState(
    moveThreadToTrash,
    { error: null, success: false },
  );
  useEffect(() => {
    if (archiveState.error) toast.error(archiveState.error);
    else if (archiveState.success) toast.success('Conversation archived');
  }, [archiveState]);
  useEffect(() => {
    if (trashState.error) toast.error(trashState.error);
    else if (trashState.success) toast.success('Conversation moved to trash');
  }, [trashState]);
  const disabled =
    archivePending ||
    trashPending ||
    process.env.NEXT_PUBLIC_VERCEL_ENV === 'production';
  return (
    <div className="thread-actions">
      <form action={archiveAction}>
        <input type="hidden" name="threadId" value={threadId} />
        <button
          className="icon-button"
          disabled={disabled}
          aria-label="Archive conversation"
          title="Archive conversation"
        >
          <Archive size={16} />
        </button>
      </form>
      <form action={trashAction}>
        <input type="hidden" name="threadId" value={threadId} />
        <button
          className="icon-button"
          disabled={disabled}
          aria-label="Move conversation to trash"
          title="Move to trash"
        >
          <Trash2 size={16} />
        </button>
      </form>
    </div>
  );
}
