import { eq } from 'drizzle-orm';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type { GetReceivingEmailResponseSuccess, Resend } from 'resend';

const enabled = process.env.MAIL_INTEGRATION_TEST === '1';
test(
  'receipt replay, envelope routing, isolation and safe send retries',
  { skip: !enabled },
  async () => {
    if (!process.env.POSTGRES_URL?.includes('127.0.0.1:55461'))
      throw new Error('Integration tests require the isolated local database');
    const { db, client } = await import('../lib/db/drizzle');
    const { mailboxes, receipts, outbox, threads } =
      await import('../lib/db/schema');
    const { receiveEmail } = await import('../lib/mail/receive');
    const { sendMessage } = await import('../lib/mail/send');
    try {
      const [jake] = await db
        .select()
        .from(mailboxes)
        .where(eq(mailboxes.email, 'jake@sixtyoneeighty.com'));
      const [ivar] = await db
        .select()
        .from(mailboxes)
        .where(eq(mailboxes.email, 'ivar@sixtyoneeighty.com'));
      const message: GetReceivingEmailResponseSuccess = {
        object: 'email',
        id: randomUUID(),
        from: 'Test Sender <sender@example.test>',
        to: ['ivar@sixtyoneeighty.com'],
        received_for: ['jake@sixtyoneeighty.com', 'jacob@sixtyoneeighty.dev'],
        created_at: new Date().toISOString(),
        subject: 'Jake private fixture',
        text: 'Only Jake can read this fixture',
        html: null,
        bcc: [],
        cc: [],
        reply_to: [],
        headers: {},
        message_id: randomUUID(),
        attachments: [],
      };
      await Promise.all([receiveEmail(message), receiveEmail(message)]);
      const saved = await db
        .select()
        .from(receipts)
        .where(eq(receipts.providerId, message.id));
      assert.equal(saved.length, 1);
      assert.equal(saved[0].mailboxId, jake.id);
      await assert.rejects(
        receiveEmail({ ...message, id: randomUUID(), received_for: [] }),
        /envelope/,
      );
      await receiveEmail({
        ...message,
        id: randomUUID(),
        subject: 'Ivar private fixture',
        text: 'Only Ivar can read this fixture',
        received_for: ['ivar@sixtyoneeighty.com'],
      });
      let calls = 0;
      const providerIds = new Map<string, string>();
      const provider = {
        emails: {
          send: async (
            body: { from: string },
            options: { idempotencyKey: string },
          ) => {
            calls++;
            assert.equal(body.from, jake.email);
            const id = providerIds.get(options.idempotencyKey) || randomUUID();
            providerIds.set(options.idempotencyKey, id);
            return { data: { id }, error: null };
          },
        },
      } as unknown as Resend;
      const request = {
        id: randomUUID(),
        subject: 'Outbound fixture',
        body: 'Local fake provider only',
        recipientEmail: 'recipient@example.test',
      };
      const ids = await Promise.all([
        sendMessage(jake, request, provider),
        sendMessage(jake, request, provider),
      ]);
      assert.equal(ids[0], ids[1]);
      assert.equal(calls, 1);
      await assert.rejects(sendMessage(ivar, request, provider), /changed/);
      await assert.rejects(
        sendMessage(jake, { ...request, body: 'Changed payload' }, provider),
        /changed/,
      );
      const timeoutRequest = { ...request, id: randomUUID() };
      const failing = {
        emails: {
          send: async () => {
            throw new Error('simulated timeout');
          },
        },
      } as unknown as Resend;
      await assert.rejects(
        sendMessage(jake, timeoutRequest, failing),
        /timeout/,
      );
      const [pending] = await db
        .select()
        .from(outbox)
        .where(eq(outbox.id, timeoutRequest.id));
      assert.equal(pending.status, 'pending');
      await sendMessage(jake, timeoutRequest, provider);
      const [sent] = await db
        .select()
        .from(outbox)
        .where(eq(outbox.id, timeoutRequest.id));
      assert.equal(sent.status, 'accepted');
      const [thread] = await db
        .select()
        .from(threads)
        .where(eq(threads.id, sent.threadId!));
      assert.equal(thread.mailboxId, jake.id);
    } finally {
      await client.end();
    }
  },
);
