'use client';
import { sendEmailAction } from '@/lib/db/actions';
import { ArrowLeft, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

export default function ComposeForm() {
  const params = useSearchParams();
  const [requestId, setRequestId] = useState('');
  useEffect(() => setRequestId(crypto.randomUUID()), []);
  const [state, formAction, pending] = useActionState(sendEmailAction, {
    error: '',
    previous: {
      id: '',
      recipientEmail: params.get('to') || '',
      subject: params.get('subject') || '',
      body: '',
    },
  });
  return (
    <div className="compose-scroll">
      <div className="reader-toolbar">
        <Link className="back-link" href="/f/inbox">
          <ArrowLeft size={16} /> Back to inbox
        </Link>
        <span className="muted">New conversation</span>
      </div>
      <div className="compose-content">
        <h1>New message</h1>
        <p className="compose-note">
          A good conversation starts with a few words.
        </p>
        {state.error && (
          <div className="form-error" role="alert">
            {state.error}
          </div>
        )}
        <form action={formAction} className="compose-form">
          <input
            type="hidden"
            name="id"
            value={state.previous.id || requestId}
          />
          <div className="compose-field">
            <label htmlFor="recipient">To</label>
            <input
              id="recipient"
              type="email"
              name="recipientEmail"
              placeholder="name@example.com"
              required
              defaultValue={state.previous.recipientEmail?.toString()}
            />
          </div>
          <div className="compose-field">
            <label htmlFor="subject">Subject</label>
            <input
              id="subject"
              name="subject"
              placeholder="Give your message a subject"
              required
              defaultValue={state.previous.subject?.toString()}
            />
          </div>
          <label htmlFor="body" className="sr-only">
            Message
          </label>
          <textarea
            id="body"
            className="compose-body"
            name="body"
            placeholder="Write something worth opening…"
            required
            defaultValue={state.previous.body?.toString()}
            onKeyDown={(event) => {
              if (
                (event.metaKey || event.ctrlKey) &&
                event.key === 'Enter' &&
                !pending &&
                requestId
              ) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div className="compose-footer">
            <button
              className="primary-button"
              type="submit"
              disabled={pending || !requestId}
            >
              <Send size={15} />
              {pending ? 'Sending…' : 'Send message'}
            </button>
            <span className="keyboard-hint">⌘ / Ctrl + Enter</span>
            <Link
              href="/f/inbox"
              className="icon-button"
              aria-label="Discard message"
              title="Discard message"
            >
              <Trash2 size={17} />
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
