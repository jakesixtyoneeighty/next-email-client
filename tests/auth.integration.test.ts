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
    const { authUser } = await import('../lib/db/schema');
    const origin = 'http://localhost:3000';
    const invoke = async (path: string, body?: unknown, cookie?: string) =>
      auth.handler(
        new Request(`${origin}/api/auth${path}`, {
          method: body ? 'POST' : 'GET',
          headers: {
            origin,
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
