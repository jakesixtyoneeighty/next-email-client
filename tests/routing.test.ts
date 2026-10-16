import assert from 'node:assert/strict';
import test from 'node:test';
import { addressOf, destinationFor } from '../lib/mail/routing';
test('routes aliases and the .com catch-all without swallowing Ivar’s mailbox', () => {
  for (const address of [
    'jake@sixtyoneeighty.com',
    'jacob@sixtyoneeighty.com',
    'jake@sixtyoneeighty.dev',
    'jacob@sixtyoneeighty.dev',
    'other@sixtyoneeighty.com',
  ])
    assert.equal(destinationFor(address), 'jake@sixtyoneeighty.com');
  assert.equal(
    destinationFor('Ivar <IVAR@sixtyoneeighty.com>'),
    'ivar@sixtyoneeighty.com',
  );
  for (const address of [
    'ivar@sixtyoneeighty.dev',
    'other@sixtyoneeighty.dev',
    'jake@sixtyoneeighty.com.evil.test',
    'bad-address',
  ])
    assert.equal(destinationFor(address), null);
  assert.equal(
    addressOf('Example Person <example@example.com>'),
    'example@example.com',
  );
});
