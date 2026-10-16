import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { passkey } from '@better-auth/passkey';
import { waitUntil } from '@vercel/functions';
import { betterAuth } from 'better-auth';
import { eq } from 'drizzle-orm';
import { db } from './db/drizzle';
import {
  account,
  authUser,
  mailboxes,
  passkey as passkeyTable,
  rateLimit,
  session,
  verification,
} from './db/schema';
import { getResend } from './resend';

const authURL = new URL(process.env.BETTER_AUTH_URL || 'http://localhost:3000');

export const auth = betterAuth({
  appName: 'sixtyoneeighty Mail',
  advanced: {
    backgroundTasks: { handler: waitUntil },
    ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
  },
  baseURL: authURL.origin,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'pg',
    transaction: true,
    schema: {
      user: authUser,
      session,
      account,
      verification,
      rateLimit,
      passkey: passkeyTable,
    },
  }),
  plugins: [
    passkey({
      rpID: authURL.hostname,
      rpName: 'sixtyoneeighty Mail',
      origin: authURL.origin,
      registration: { requireSession: true },
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
    }),
  ],
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 1800,
    async sendResetPassword({ user, url, token }) {
      const [mailbox] = await db
        .select()
        .from(mailboxes)
        .where(eq(mailboxes.authUserId, user.id));
      if (!mailbox) return;
      const result = await getResend().emails.send(
        {
          from: 'sixtyoneeighty Mail <jake@sixtyoneeighty.com>',
          to: mailbox.recoveryEmail,
          subject: 'Set your sixtyoneeighty Mail password',
          text: `Set or reset the password for ${mailbox.email}:\n\n${url}\n\nThis link expires in 30 minutes and can be used once. If you did not request it, you can ignore this email.\n\nsixtyoneeighty Mail`,
        },
        { idempotencyKey: `password-reset/${token}` },
      );
      if (result.error)
        throw new Error('Password email could not be delivered');
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  rateLimit: {
    enabled: true,
    storage: 'database',
    window: 60,
    max: 60,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/request-password-reset': { window: 300, max: 3 },
      '/passkey/generate-authenticate-options': { window: 60, max: 10 },
      '/passkey/verify-authentication': { window: 60, max: 10 },
      '/passkey/generate-register-options': { window: 60, max: 5 },
      '/passkey/verify-registration': { window: 60, max: 5 },
    },
  },
  user: { changeEmail: { enabled: false }, deleteUser: { enabled: false } },
});
