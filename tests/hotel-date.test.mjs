import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hotelToday } from '../lib/hotel-date.ts';
test('booking calendar switches at midnight in Myanmar', () => {
  assert.equal(hotelToday(new Date('2026-10-29T17:29:59Z')), '2026-10-29');
  assert.equal(hotelToday(new Date('2026-10-29T17:30:00Z')), '2026-10-30');
});
