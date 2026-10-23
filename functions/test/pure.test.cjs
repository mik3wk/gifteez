const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { canRefresh, claimSlot, emptyUsage, nextUsage } = require('../lib/caps');
const { DEFAULT_GROUP_MAX_MEMBERS, groupHasRoom } = require('../lib/members');
const { FREE_OWNED_LIST_LIMIT, decideOwnedCreate, ownerEntitledForMember, releaseOwnedId } = require('../lib/lists');
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

test('a group accepts a 9th member and refuses the 10th and 11th', () => {
  assert.equal(DEFAULT_GROUP_MAX_MEMBERS, 10);
  assert.equal(groupHasRoom(9, DEFAULT_GROUP_MAX_MEMBERS), true);
  assert.equal(groupHasRoom(10, DEFAULT_GROUP_MAX_MEMBERS), false);
  assert.equal(groupHasRoom(11, DEFAULT_GROUP_MAX_MEMBERS), false);
  const root = path.join(__dirname, '..', '..');
  const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
  assert.match(rules, /request\.resource\.data\.memberIds\.size\(\) <= 10/);
  assert.match(rules, /request\.resource\.data\.peopleCount <= 5/);
  assert.match(fs.readFileSync(path.join(root, '.env.example'), 'utf8'), /GROUP_MAX_MEMBERS=10/);
  const fnEnv = fs.readFileSync(path.join(root, 'functions', '.env.example'), 'utf8');
  assert.match(fnEnv, /GROUP_MAX_MEMBERS=10/);
  assert.match(fnEnv, /FREE_TIER_MAX_PEOPLE=5/);
});

test('a free account cannot start a second list, a paid account can, and joining is not limited', () => {
  assert.equal(FREE_OWNED_LIST_LIMIT, 1);
  const first = decideOwnedCreate({
    entitled: false,
    ownedGroupIds: [],
    groupId: 'g1',
    groupExists: false,
    existingOwnerId: '',
    uid: 'me',
  });
  assert.equal(first.ok, true);
  const second = decideOwnedCreate({
    entitled: false,
    ownedGroupIds: ['g1'],
    groupId: 'g2',
    groupExists: false,
    existingOwnerId: '',
    uid: 'me',
  });
  assert.equal(second.ok, false);
  if (!second.ok) {
    assert.equal(second.reason, 'one-list');
  }
  const paid = decideOwnedCreate({
    entitled: true,
    ownedGroupIds: ['g1'],
    groupId: 'g2',
    groupExists: false,
    existingOwnerId: '',
    uid: 'me',
  });
  assert.equal(paid.ok, true);
  if (paid.ok) {
    assert.deepEqual(paid.ownedGroupIds, ['g1', 'g2']);
  }
  const freed = releaseOwnedId(['g1'], 'g1');
  assert.deepEqual(freed, []);
  const again = decideOwnedCreate({
    entitled: false,
    ownedGroupIds: freed,
    groupId: 'g2',
    groupExists: false,
    existingOwnerId: '',
    uid: 'me',
  });
  assert.equal(again.ok, true);
  const root = path.join(__dirname, '..', '..');
  const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
  assert.match(rules, /Direct creates are denied/);
  assert.match(rules, /allow create: if false/);
  assert.match(rules, /Owner deletes go through releaseOwnedGroup/);
  assert.match(rules, /match \/accounts\/\{uid\}/);
  const accounts = rules.slice(rules.indexOf('match /accounts/{uid}'));
  assert.match(accounts, /allow write: if false/);
  const index = fs.readFileSync(path.join(root, 'functions', 'src', 'index.ts'), 'utf8');
  const joinStart = index.indexOf('export const joinGroup');
  const joinEnd = index.indexOf('async function isPaid');
  const join = index.slice(joinStart, joinEnd);
  assert.equal(join.includes('one-list'), false);
  assert.equal(join.includes('ownedGroupIds'), false);
  assert.equal(ownerEntitledForMember({ memberIds: ['owner', 'joiner'], uid: 'joiner', groupEntitled: false }), false);
  assert.equal(ownerEntitledForMember({ memberIds: ['owner', 'joiner'], uid: 'joiner', groupEntitled: true }), true);
  assert.equal(ownerEntitledForMember({ memberIds: ['owner'], uid: 'stranger', groupEntitled: true }), false);
  assert.equal(claimSlot(5, false, 'add', 5).ok, false);
  assert.equal(claimSlot(5, true, 'add', 5).ok, true);
  assert.match(rules, /claimedBy, claimedAt, and boughtBy live inside ciphertext/);
  const privateGifts = rules.slice(rules.indexOf('match /privateGifts/{giftId}'));
  assert.notEqual(privateGifts, '');
  const privateBlock = privateGifts.slice(0, privateGifts.indexOf('match /aiUsage'));
  assert.match(privateBlock, /request\.auth\.uid == uid/);
  assert.match(privateBlock, /ciphertext is string/);
  assert.match(privateBlock, /updatedAt is number/);
  assert.match(privateBlock, /allow delete: if signedIn\(\) && request\.auth\.uid == uid/);
  const groupDocs = rules.slice(rules.indexOf('match /{collection}/{docId}'), rules.indexOf('match /invites/{inviteId}'));
  assert.match(groupDocs, /ciphertext is string/);
  assert.match(groupDocs, /updatedAt is number/);
});
