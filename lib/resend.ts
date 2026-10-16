import { Resend } from 'resend';
export function getResend() {
  if (!process.env.RESEND_API_KEY)
    throw new Error('Email delivery is not configured');
  return new Resend(process.env.RESEND_API_KEY);
}
