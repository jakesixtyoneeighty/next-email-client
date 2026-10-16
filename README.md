# sixtyoneeighty Mail

Private mail for Jake and Ivar, built with Next.js 16.4.2, React 19.3.1, Better Auth, Postgres, Drizzle, and Resend. The interface uses the supplied black, white, and red sixtyoneeighty artwork.

Production: https://mail.sixtyoneeighty.dev

## Accounts and routing

| Recipient                               | Mailbox          |
| --------------------------------------- | ---------------- |
| `jake@sixtyoneeighty.com`               | Jake             |
| `jacob@sixtyoneeighty.com`              | Jake             |
| `jake@sixtyoneeighty.dev`               | Jake             |
| `jacob@sixtyoneeighty.dev`              | Jake             |
| `ivar@sixtyoneeighty.com`               | Ivar             |
| Any other `@sixtyoneeighty.com` address | Jake (catch-all) |

Other `.dev` recipients are not imported. Routing uses the SMTP envelope (`received_for`), never the potentially forged To/Cc headers. Messages delivered to multiple aliases of one mailbox are stored once.

Sign in with the primary `.com` address and a password. Public registration is disabled. On the login page, **First time here or forgot your password?** sends a single-use, 30-minute link to the account's separately configured recovery address. Password resets revoke all existing sessions. Recovery addresses are stored only in the server database.

## Configuration

### Passkeys

After signing in with your password, open **Security** in the sidebar and choose **Add a passkey**. Give it a name so you can recognize it later, then follow your device or password manager’s prompt. Setup requires a recent sign-in; sign out and back in if prompted. On future visits, choose **Sign in with a passkey** on the login page without entering an email or password. You can review and remove saved passkeys in Security settings. Password sign-in and recovery remain available.

Passkeys use [Better Auth’s passkey plugin](https://better-auth.com/docs/plugins/passkey) and require HTTPS (or localhost for development) and a browser with WebAuthn support. The relying-party ID and allowed origin come from `BETTER_AUTH_URL`; production must use `https://mail.sixtyoneeighty.dev`. Passkeys registered on localhost or a preview domain will not work on the production domain. Registration requires an existing account session; public sign-up remains disabled.

Before deploying this feature, run `pnpm db:migrate` against the target database to create `mail.auth_passkey`. The migration only adds the passkey table, indexes, and user foreign key.

### Environment

Use Node 24 LTS and pnpm 12.4.1. Create a gitignored `.env.local` with:

```dotenv
POSTGRES_URL=postgresql://...
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=<at-least-32-random-characters>
RESEND_API_KEY=<server-only-resend-key>
RESEND_WEBHOOK_SECRET=<resend-webhook-signing-secret>
```

Use an isolated development database and a separate Resend webhook for local tests. Never share a production webhook secret or live mailbox data with a public preview deployment. Production requires the same environment variable names, with `BETTER_AUTH_URL=https://mail.sixtyoneeighty.dev`.

```sh
pnpm install
pnpm db:migrate
pnpm mail:provision <jake-recovery-email> <ivar-recovery-email>
pnpm dev
```

Provisioning is idempotent, does not create passwords or send emails, and refuses to silently change existing recovery addresses. `db:seed` is disabled to prevent demo messages from entering live mailboxes.

All application tables live in the dedicated `mail` schema. Migrations live in `lib/db/mail-migrations`, tracked separately in `mail_migrations.__mail_migrations`. The legacy template migration folder is retained for reference and is not applied. Existing tables and migration histories in other schemas are untouched. CLI scripts load `.env.local` before `.env`, while explicit process environment variables take precedence. Run migrations before deploying a schema change.

## Receiving and sending

Create a Resend webhook for `email.received` at `/api/webhooks/resend` and store its signing secret in Vercel. Enable receiving on each domain and apply the **exact MX record supplied by Resend**. For `.com`, replace the old Zoho root MX records only after the new deployment is verified. Existing Zoho messages are not imported by this change.

The webhook verifies signatures and timestamps before fetching the full message. Receipt uniqueness and a transaction prevent duplicate deliveries on retries. Failures return HTTP 500 so Resend can retry. Inspect failed webhook deliveries in Resend and replay them after correcting the failure.

Outgoing mail uses the authenticated mailbox's primary address. A durable outbox preserves the provider idempotency key across timeouts; retry the same unchanged draft to avoid duplicates. Unconfirmed requests older than 23 hours require operator review in Resend because its idempotency keys expire after 24 hours. `accepted` means Resend accepted the message; it is not a claim of final recipient delivery. The application limits each mailbox to 100 new outgoing messages per hour.

Mail bodies display as safe plain text; HTML-only email is converted without loading tracking pixels. Inbound attachments are downloaded through an ownership-checked endpoint using temporary Resend URLs. Attachment availability depends on Resend retention; attachments are not independently archived. Compose currently sends one recipient and plain text, with no attachment upload, CC/BCC, draft autosave, or conversation merging. Replies open a preaddressed compose view and appear as separate conversations. The inbox refresh button checks for newly received messages.

## Checks

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
pnpm peers check
```

Integration tests require a provisioned, disposable local Postgres instance at `127.0.0.1:55461`. They refuse other database addresses and do not send real email:

```sh
POSTGRES_URL=postgres://mailtest@127.0.0.1:55461/mail \
BETTER_AUTH_URL=http://localhost:3000 \
MAIL_INTEGRATION_TEST=1 pnpm test
```

They verify invite-only authentication, single-use reset links, sign-out revocation, passkey enrollment authorization and account isolation, SMTP-envelope routing, receipt deduplication, and safe concurrent/retried sends. Test fixtures remain in the disposable local database. Passkey registration and sign-in also need browser verification with a real or virtual WebAuthn authenticator.

To regenerate icons from the original artwork:

```sh
pnpm brand:icons
```

Original foundation: [leerob/next-email-client](https://github.com/leerob/next-email-client).
