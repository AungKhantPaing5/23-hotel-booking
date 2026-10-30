import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../lib/db/password.ts';
test('staff password hashes use unique salts and reject incorrect passwords', async () => {
  const first = await hashPassword('BookingTest!123');
  const second = await hashPassword('BookingTest!123');
  assert.notEqual(first, second);
  assert.equal(await verifyPassword('BookingTest!123', first), true);
  assert.equal(await verifyPassword('incorrect', first), false);
});
test('malformed and missing password hashes fail closed', async () => {
  for (const value of [null, '', 'scrypt$aa$zz', 'scrypt$aa$ff', 'scrypt$00$00$extra']) {
    assert.equal(await verifyPassword('BookingTest!123', value), false);
  }
  await assert.rejects(hashPassword('short'));
});
