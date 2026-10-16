'use client';

import { useEffect, useState } from 'react';

export function usePasskeySupport() {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    setSupported(
      window.isSecureContext &&
        typeof window.PublicKeyCredential !== 'undefined',
    );
  }, []);
  return supported;
}

export function passkeyError(
  error: { status?: number; code?: string },
  registering = false,
) {
  if (registering && (error.status === 401 || error.status === 403))
    return 'Please sign out and sign in again before managing passkeys.';
  if (error.status === 429)
    return 'Too many attempts. Please wait a minute and try again.';
  if (error.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED')
    return 'This passkey is already registered. Choose a different device or password manager to add another.';
  return registering
    ? 'Passkey setup wasn’t completed. You can try again; your password still works.'
    : 'We couldn’t sign you in with a passkey. Try again or use your password.';
}
