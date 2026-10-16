'use client';
import { sendEmailAction } from '@/lib/db/actions';
import { ArrowLeft, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useActionState } from 'react';

export default function ComposePage() {
  const [state, formAction, pending] = useActionState(sendEmailAction, {
    error: '',
    previous: { recipientEmail: '', subject: '', body: '' },
  });
  const isProduction = process.env.NEXT_PUBLIC_VERCEL_ENV === 'production';
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
          <br />
          Messages are saved to this workspace. External email delivery is not
          connected.
        </p>
        {state.error && (
          <div className="form-error" role="alert">
            {state.error}
          </div>
        )}
        <form action={formAction} className="compose-form">
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
                !isProduction
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
              disabled={pending || isProduction}
            >
              <Send size={15} />
              {pending ? 'Saving…' : 'Save to sent'}
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
          {isProduction && (
            <p className="compose-note">
              This workspace is read-only in production.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
