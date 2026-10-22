const test = require('node:test');
const assert = require('node:assert/strict');
const { canRefresh, claimSlot, emptyUsage, nextUsage } = require('../lib/caps');
const { fingerprint } = require('../lib/fingerprint');
const { parseIdeas } = require('../lib/ideas');
const { appleTransactionGrants, googlePurchaseGrants } = require('../lib/iap');

test('free cache hits do not count and the sixth refresh is refused', () => {
  let usage = emptyUsage();
  const limits = { free: 5, paidPerMonth: 20 };
  const now = new Date('2026-10-22T12:00:00Z');
  const first = canRefresh({ usage, paid: false, now, limits, refresh: false, cacheHit: false });
  assert.equal(first.counted, true);
  usage = nextUsage(usage, false, now);
  const cached = canRefresh({ usage, paid: false, now, limits, refresh: false, cacheHit: true });
  assert.equal(cached.counted, false);
  for (let i = 0; i < 4; i += 1) {
    usage = nextUsage(usage, false, now);
  }
  const blocked = canRefresh({ usage, paid: false, now, limits, refresh: true, cacheHit: true });
  assert.equal(blocked.ok, false);
});

test('paid refreshes reset with the month', () => {
  const limits = { free: 5, paidPerMonth: 20 };
  let usage = emptyUsage();
  const october = new Date('2026-10-22T12:00:00Z');
  for (let i = 0; i < 20; i += 1) {
    usage = nextUsage(usage, true, october);
  }
  assert.equal(canRefresh({ usage, paid: true, now: october, limits, refresh: true, cacheHit: false }).ok, false);
  const november = new Date('2026-11-01T00:00:00Z');
  assert.equal(canRefresh({ usage, paid: true, now: november, limits, refresh: true, cacheHit: false }).ok, true);
});

test('fingerprint ignores the anonymous uid', () => {
  const one = fingerprint('pepper', 'device-a');
  const two = fingerprint('pepper', 'device-a');
  const other = fingerprint('pepper', 'device-b');
  assert.equal(one, two);
  assert.notEqual(one, other);
  assert.equal(one.length, 64);
});

test('idea parser accepts JSON and lines', () => {
  assert.deepEqual(parseIdeas('{"ideas":["A book","A mug"]}'), ['A book', 'A mug']);
  assert.deepEqual(parseIdeas('1. A book\n- A mug'), ['A book', 'A mug']);
});

test('store receipts grant only a matching unrevoked purchase', () => {
  assert.equal(appleTransactionGrants({ productId: 'gifteez_unlock', bundleId: 'com.gifteez' }, 'gifteez_unlock', 'com.gifteez'), true);
  assert.equal(appleTransactionGrants({ productId: 'other', bundleId: 'com.gifteez' }, 'gifteez_unlock', 'com.gifteez'), false);
  assert.equal(appleTransactionGrants({ productId: 'gifteez_unlock', bundleId: 'com.gifteez', revocationDate: 1 }, 'gifteez_unlock', 'com.gifteez'), false);
  assert.equal(googlePurchaseGrants({ purchaseState: 0 }, 'gifteez_unlock', 'gifteez_unlock'), true);
  assert.equal(googlePurchaseGrants({ purchaseState: 1 }, 'gifteez_unlock', 'gifteez_unlock'), false);
});

test('people slots stop at the free limit', () => {
  assert.deepEqual(claimSlot(5, false, 'add', 5), { ok: false, active: 5 });
  assert.deepEqual(claimSlot(5, true, 'add', 5).ok, true);
  assert.deepEqual(claimSlot(1, false, 'remove', 5).active, 0);
});
