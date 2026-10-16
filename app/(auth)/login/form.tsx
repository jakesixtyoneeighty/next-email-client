'use client';
import { authClient } from '@/lib/auth-client';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { useState, type FormEvent } from 'react';
export function LoginForm() {
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get('email')).trim().toLowerCase();
    try {
      if (recovery) {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: '/reset-password',
        });
        if (result.error)
          setError(
            'We couldn’t send a link right now. Please wait a few minutes and try again.',
          );
        else
          setMessage(
            'If this mailbox is registered, a password link has been sent to its recovery email. Check your Gmail inbox.',
          );
      } else {
        const result = await authClient.signIn.email({
          email,
          password: String(fields.get('password')),
        });
        if (result.error)
          setError(
            result.error.status === 429
              ? 'Too many attempts. Please wait a minute and try again.'
              : 'That email and password didn’t match. Please try again.',
          );
        else window.location.assign('/f/inbox');
      }
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-card">
      <div className="auth-eyebrow">
        <LockKeyhole size={15} /> PRIVATE MAIL
      </div>
      <h1>{recovery ? 'Make it yours.' : 'Good to see you.'}</h1>
      <p className="auth-intro">
        {recovery
          ? 'Set your first password or recover access. We’ll send a link to the recovery email on your account.'
          : 'Sign in to your sixtyoneeighty mailbox.'}
      </p>
      <form onSubmit={submit} className="auth-form">
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="you@sixtyoneeighty.com"
          autoComplete="username"
          required
        />
        {!recovery && (
          <>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="auth-success" role="status">
            {message}
          </p>
        )}
        <button className="primary-button" disabled={busy}>
          {busy ? 'One moment…' : recovery ? 'Send password link' : 'Sign in'}
          <ArrowRight size={17} />
        </button>
      </form>
      <button
        className="auth-text-button"
        onClick={() => {
          setRecovery(!recovery);
          setError('');
          setMessage('');
        }}
      >
        {recovery
          ? 'Back to sign in'
          : 'First time here or forgot your password?'}
      </button>
      <p className="auth-private-note">
        This workspace is for invited members only.
      </p>
    </div>
  );
}
