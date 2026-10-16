import { z } from 'zod/v3';
export function addressOf(value: string): string | null {
  const address = (value.match(/<([^<>]+)>\s*$/)?.[1] || value)
    .trim()
    .toLowerCase();
  return z.string().email().max(255).safeParse(address).success
    ? address
    : null;
}
export function destinationFor(address: string): string | null {
  const normalized = addressOf(address);
  if (!normalized) return null;
  if (normalized === 'ivar@sixtyoneeighty.com') return normalized;
  const [local, domain] = normalized.split('@');
  if (domain === 'sixtyoneeighty.com') return 'jake@sixtyoneeighty.com';
  if (domain === 'sixtyoneeighty.dev' && ['jake', 'jacob'].includes(local))
    return 'jake@sixtyoneeighty.com';
  return null;
}
