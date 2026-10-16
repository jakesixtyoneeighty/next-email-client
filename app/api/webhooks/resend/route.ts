import { receiveEmail } from '@/lib/mail/receive';
import { getResend } from '@/lib/resend';
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret)
    return new Response('Receiving is not configured', { status: 503 });
  const payload = await request.text();
  if (payload.length > 1_000_000)
    return new Response('Payload too large', { status: 413 });
  let event;
  try {
    event = getResend().webhooks.verify({
      payload,
      webhookSecret: secret,
      headers: {
        id: request.headers.get('svix-id') || '',
        timestamp: request.headers.get('svix-timestamp') || '',
        signature: request.headers.get('svix-signature') || '',
      },
    });
  } catch {
    return new Response('Invalid signature', { status: 401 });
  }
  if (event.type !== 'email.received') return Response.json({ received: true });
  try {
    const result = await getResend().emails.receiving.get(event.data.email_id, {
      html_format: 'cid',
    });
    if (result.error || !result.data)
      throw new Error('Received message could not be retrieved');
    await receiveEmail(result.data);
    return Response.json({ received: true });
  } catch {
    // A non-2xx response asks Resend to retry. Receipt rows make replays safe.
    console.error('Inbound email processing failed', {
      eventId: request.headers.get('svix-id'),
    });
    return new Response('Please retry', { status: 500 });
  }
}
