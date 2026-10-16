import { eq } from 'drizzle-orm';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

const enabled = process.env.MAIL_INTEGRATION_TEST === '1';
test(
  'invite-only password setup, session access and single-use reset',
  { skip: !enabled },
  async () => {
    if (!process.env.POSTGRES_URL?.includes('127.0.0.1:55461'))
      throw new Error('Requires isolated local database');
    const { auth } = await import('../lib/auth');
    const { db, client } = await import('../lib/db/drizzle');
    const { authUser, passkey, session } = await import('../lib/db/schema');
    const origin = 'http://localhost:3000';
    const testIP = `2001:db8:${randomUUID().slice(0, 4)}:${randomUUID().slice(0, 4)}::1`;
    const invoke = async (path: string, body?: unknown, cookie?: string) =>
      auth.handler(
        new Request(`${origin}/api/auth${path}`, {
          method: body ? 'POST' : 'GET',
          headers: {
            origin,
            'x-forwarded-for': testIP,
            'content-type': 'application/json',
            ...(cookie ? { cookie } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        }),
      );
    try {
      const signup = await invoke('/sign-up/email', {
        name: 'Uninvited',
        email: 'not-invited@example.test',
        password: 'Local-only-password-6180!',
      });
      assert.ok(signup.status >= 400);
      const context = await auth.$context;
      for (const name of ['jake', 'ivar']) {
        const [user] = await db
          .select()
          .from(authUser)
          .where(eq(authUser.email, `${name}@sixtyoneeighty.com`));
        const token = randomUUID();
        await context.internalAdapter.createVerificationValue({
          identifier: `reset-password:${token}`,
          value: user.id,
          expiresAt: new Date(Date.now() + 60_000),
        });
        const reset = await invoke('/reset-password', {
          token,
          newPassword: 'Local-only-password-6180!',
        });
        assert.equal(reset.status, 200, await reset.text());
        const replay = await invoke('/reset-password', {
          token,
          newPassword: 'Local-only-password-6180!',
        });
        assert.ok(replay.status >= 400);
        const login = await invoke('/sign-in/email', {
          email: user.email,
          password: 'Local-only-password-6180!',
        });
        assert.equal(login.status, 200, await login.text());
        const cookie = login.headers.get('set-cookie')?.split(';')[0];
        assert.ok(cookie);
        const current = await invoke('/get-session', undefined, cookie);
        assert.equal((await current.json()).user.id, user.id);
        await invoke('/sign-out', {}, cookie);
        const expired = await invoke('/get-session', undefined, cookie);
        assert.equal(await expired.json(), null);
      }
      // Enrollment and management require a session, even when callers bypass the UI.
      for (const path of [
        '/passkey/generate-register-options',
        '/passkey/list-user-passkeys',
      ]) {
        assert.equal((await invoke(path)).status, 401);
      }
      assert.equal(
        (await invoke('/passkey/verify-registration', { response: {} })).status,
        401,
      );
      const loginAs = async (name: string) => {
        const response = await invoke('/sign-in/email', {
          email: `${name}@sixtyoneeighty.com`,
          password: 'Local-only-password-6180!',
        });
        assert.equal(response.status, 200);
        return response.headers.get('set-cookie')!.split(';')[0];
      };
      const jakeCookie = await loginAs('jake');
      const ivarCookie = await loginAs('ivar');
      const currentJake = await (
        await invoke('/get-session', undefined, jakeCookie)
      ).json();
      const registration = await invoke(
        '/passkey/generate-register-options',
        undefined,
        jakeCookie,
      );
      assert.equal(registration.status, 200);
      const options = await registration.json();
      assert.equal(options.rp.id, 'localhost');
      assert.equal(options.authenticatorSelection.residentKey, 'required');
      const foreignOrigin = await auth.handler(
        new Request(`${origin}/api/auth/passkey/verify-registration`, {
          method: 'POST',
          headers: {
            origin: 'https://untrusted.example',
            cookie: jakeCookie,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ response: {} }),
        }),
      );
      assert.equal(foreignOrigin.status, 403);
      const credentialId = randomUUID();
      await db.insert(passkey).values({
        id: credentialId,
        name: 'Ownership test',
        userId: currentJake.user.id,
        publicKey: 'invalid-test-key',
        credentialID: randomUUID(),
        counter: 0,
        deviceType: 'singleDevice',
        backedUp: false,
      });
      try {
        const own = await (
          await invoke('/passkey/list-user-passkeys', undefined, jakeCookie)
        ).json();
        const other = await (
          await invoke('/passkey/list-user-passkeys', undefined, ivarCookie)
        ).json();
        assert.ok(own.some((key: { id: string }) => key.id === credentialId));
        assert.ok(
          !other.some((key: { id: string }) => key.id === credentialId),
        );
        assert.equal(
          (await invoke('/passkey/delete-passkey', { id: credentialId }))
            .status,
          401,
        );
        assert.equal(
          (
            await invoke(
              '/passkey/delete-passkey',
              { id: credentialId },
              ivarCookie,
            )
          ).status,
          401,
        );
        assert.equal(
          (
            await invoke(
              '/passkey/update-passkey',
              { id: credentialId, name: 'Hijacked' },
              ivarCookie,
            )
          ).status,
          401,
        );
        assert.equal(
          (
            await invoke(
              '/passkey/delete-passkey',
              { id: credentialId },
              jakeCookie,
            )
          ).status,
          200,
        );
        // Older sessions must sign in again before registering another credential.
        await db
          .update(session)
          .set({ createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) })
          .where(eq(session.id, currentJake.session.id));
        assert.equal(
          (
            await invoke(
              '/passkey/generate-register-options',
              undefined,
              jakeCookie,
            )
          ).status,
          403,
        );
      } finally {
        await db.delete(passkey).where(eq(passkey.id, credentialId));
        await invoke('/sign-out', {}, jakeCookie);
        await invoke('/sign-out', {}, ivarCookie);
      }
      const invalid = await invoke('/sign-in/email', {
        email: 'jake@sixtyoneeighty.com',
        password: 'wrong-password-test',
      });
      assert.equal(invalid.status, 401);
    } finally {
      await client.end();
    }
  },
);
