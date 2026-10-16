'use client';

import { authClient } from '@/lib/auth-client';
import { passkeyError, usePasskeySupport } from '@/lib/passkeys';
import { Fingerprint, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

export function PasskeySettings() {
  const supported = usePasskeySupport();
  const {
    data: passkeys,
    isPending,
    error: loadError,
    refetch,
  } = authClient.useListPasskeys();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  async function addPasskey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await authClient.passkey.addPasskey({
        name: name.trim() || 'My passkey',
      });
      if (result.error) setError(passkeyError(result.error, true));
      else {
        setName('');
        setMessage(
          'Passkey added. You can now use it to sign in to your mailbox.',
        );
      }
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function removePasskey(id: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await authClient.passkey.deletePasskey({ id });
      if (result.error)
        setError(
          result.error.status === 401 || result.error.status === 403
            ? 'Please sign out and sign in again before managing passkeys.'
            : 'We couldn’t remove this passkey. Please try again.',
        );
      else {
        setRemoving(null);
        setMessage(
          'Passkey removed. Your password and any other passkeys still work.',
        );
      }
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="security-card"
      aria-labelledby="passkeys-heading"
      aria-busy={busy}
    >
      <span className="security-icon">
        <Fingerprint size={26} />
      </span>
      <h2 id="passkeys-heading">Your passkeys</h2>
      <p className="security-intro">
        Sign in using your device’s screen lock, fingerprint, face recognition,
        or a security key. Your password and recovery email remain available.
      </p>
      {supported === false && (
        <p className="form-error">
          This browser can’t create passkeys. Try a supported browser over a
          secure connection.
        </p>
      )}
      <form className="auth-form" onSubmit={addPasskey}>
        <label htmlFor="passkey-name">Passkey name (optional)</label>
        <input
          id="passkey-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="For example, iCloud Keychain"
          maxLength={80}
          disabled={busy || !supported}
        />
        <button className="primary-button" disabled={busy || !supported}>
          {busy ? 'One moment…' : 'Add a passkey'}
          <Plus size={17} />
        </button>
      </form>
      <p className="passkey-hint">
        Your device will guide you through setup. If your session is older, sign
        out and back in first.
      </p>
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
      <div className="passkey-list" aria-label="Saved passkeys">
        {isPending ? (
          <p className="passkey-hint">Loading passkeys…</p>
        ) : loadError ? (
          <div role="alert">
            <p className="form-error">We couldn’t load your passkeys.</p>
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => refetch()}
            >
              Try again
            </button>
          </div>
        ) : !passkeys?.length ? (
          <p className="passkey-hint">
            No passkeys yet. Add your first one above.
          </p>
        ) : (
          <ul>
            {passkeys.map((passkey) => (
              <li key={passkey.id} className="passkey-item">
                <div className="passkey-details">
                  <strong>{passkey.name || 'Passkey'}</strong>
                  {passkey.createdAt && (
                    <span>
                      Added {new Date(passkey.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {removing === passkey.id ? (
                  <div className="passkey-confirm">
                    <p>Remove this passkey from your account?</p>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={busy}
                      onClick={() => removePasskey(passkey.id)}
                    >
                      Remove passkey
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={busy}
                      onClick={() => setRemoving(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove ${passkey.name || 'passkey'}`}
                    disabled={busy}
                    onClick={() => setRemoving(passkey.id)}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
