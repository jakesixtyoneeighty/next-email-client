'use client';
import { authClient } from '@/lib/auth-client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
export function ResetForm() {
  const params = useSearchParams();
  const token = params.get('token');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const password = String(fields.get('password'));
    if (password !== fields.get('confirm')) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await authClient.resetPassword({
        token: token!,
        newPassword: password,
      });
      if (result.error)
        setError(
          'This link may have expired or already been used. Request a new link from the sign-in page.',
        );
      else {
        setDone(true);
        window.history.replaceState(null, '', '/reset-password');
      }
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-card">
      <div className="auth-eyebrow">YOUR ACCOUNT</div>
      <h1>{done ? 'You’re all set.' : 'A fresh start.'}</h1>
      {done ? (
        <>
          <p className="auth-intro">
            Your password is saved. Sign in to open your mailbox.
          </p>
          <Link className="primary-button" href="/login">
            Go to sign in
          </Link>
        </>
      ) : !token || params.has('error') ? (
        <>
          <p className="auth-intro">
            This password link is missing or expired.
          </p>
          <Link href="/login">Request a new link</Link>
        </>
      ) : (
        <>
          <p className="auth-intro">
            Choose a password with at least 12 characters.
          </p>
          <form onSubmit={submit} className="auth-form">
            <label htmlFor="password">New password</label>
            <input
              id="password"
              name="password"
              type="password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
            />
            <label htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button" disabled={busy}>
              {busy ? 'Saving…' : 'Save password'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
