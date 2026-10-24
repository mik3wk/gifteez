import { keyFromString, keyToString, openJson, randomKey, sealJson } from '../src/crypto/crypto';
import { emptySnapshot } from '../src/domain/types';
import { migrateToLocal } from '../src/domain/backup';
import { CacheStageError, decideCacheLoad, decideCommit, normalizeStoredSnapshot, planSnapshotWrite, purgeDeleted, snapshotContentKey, type SnapshotSlots } from '../src/domain/snapshotLoad';

function round5bList() {
  return {
    version: 1,
    profile: {
      uid: 'phone',
      displayName: '',
      nameLocked: false,
      createdAt: 10,
      upgraded: false,
      upgradeBannerDismissed: false,
      onboarded: true,
      groupId: null,
      pendingEmail: null,
      pendingVerificationId: null,
      inviteId: null,
      reminders: 'on',
      currency: 'USD',
    },
    people: [
      {
        id: 'dana',
        name: 'Dana',
        budgetCents: 15000,
        tags: ['books'],
        imported: false,
        opened: true,
        createdAt: 1,
        updatedAt: 2,
        relationship: 'sister',
        circleId: 'sib',
        notes: 'Loves mysteries',
      },
      {
        id: 'sam',
        name: 'Sam',
        budgetCents: null,
        tags: [],
        imported: false,
        opened: true,
        createdAt: 1,
        updatedAt: 2,
        relationship: 'brother',
        circleId: 'sib',
      },
    ],
    circles: [{ id: 'sib', name: 'Siblings', createdAt: 4 }],
    occasions: [
      { id: 'bday', personId: 'dana', type: 'birthday', month: 11, day: 4, updatedAt: 3 },
    ],
    states: [],
    gifts: [
      {
        id: 'mug',
        personId: 'dana',
        occasionId: 'bday',
        year: 2026,
        title: 'Mug',
        priceCents: 1800,
        purchasedOn: '2026-11-04',
        updatedAt: 5,
      },
    ],
    ideas: [],
    feedback: [],
  };
}

function round6List() {
  const list = round5bList();
  return {
    ...list,
    people: [
      { ...list.people[0], birthYear: 1991 },
      list.people[1],
    ],
  };
}

test('a round 5b list keeps people, circles, occasions, and purchases without a birth year', () => {
  const loaded = normalizeStoredSnapshot(round5bList(), 9);
  expect(loaded).not.toBeNull();
  if (!loaded) {
    return;
  }
  expect(loaded.people.map(person => person.name)).toEqual(['Dana', 'Sam']);
  expect(loaded.people[0].birthYear).toBeUndefined();
  expect(loaded.people[0].budgetCents).toBe(15000);
  expect(loaded.people[0].tags).toEqual(['books']);
  expect(loaded.circles).toEqual([{ id: 'sib', name: 'Siblings', createdAt: 4 }]);
  expect(loaded.occasions[0]).toMatchObject({ id: 'bday', personId: 'dana', type: 'birthday', month: 11, day: 4 });
  expect(loaded.gifts[0]).toMatchObject({ id: 'mug', title: 'Mug', priceCents: 1800, occasionId: 'bday' });
  expect(loaded.profile.onboarded).toBe(true);
  expect(loaded.profile.householdName).toBeUndefined();
});

test('a household name and first name survive the load and stay optional', () => {
  const loaded = normalizeStoredSnapshot({
    ...round5bList(),
    profile: { ...round5bList().profile, householdName: 'Peterson Family', givenName: 'Michael' },
  }, 9);
  expect(loaded?.profile.householdName).toBe('Peterson Family');
  expect(loaded?.profile.givenName).toBe('Michael');
});

test('a round 6 list keeps the birth year and the same people, circles, occasions, and purchases', () => {
  const loaded = normalizeStoredSnapshot(round6List(), 9);
  expect(loaded).not.toBeNull();
  if (!loaded) {
    return;
  }
  expect(loaded.people.map(person => ({ name: person.name, birthYear: person.birthYear ?? null }))).toEqual([
    { name: 'Dana', birthYear: 1991 },
    { name: 'Sam', birthYear: null },
  ]);
  expect(loaded.circles).toHaveLength(1);
  expect(loaded.occasions).toHaveLength(1);
  expect(loaded.gifts).toHaveLength(1);
});

test('missing optional fields default and a bad birth year does not drop the person', () => {
  const loaded = normalizeStoredSnapshot({
    version: 1,
    profile: { onboarded: true },
    people: [{ id: 'ada', name: 'Ada', birthYear: 'nope' }],
    occasions: [{ id: 'day', personId: 'ada', type: 'christmas', month: 12, day: 25 }],
    gifts: [{ id: 'book', personId: 'ada', occasionId: '', year: 2026, title: 'Book', priceCents: 1200, purchasedOn: '2026-12-25' }],
  }, 9);
  expect(loaded).not.toBeNull();
  if (!loaded) {
    return;
  }
  expect(loaded.people[0]).toMatchObject({ name: 'Ada', tags: [], budgetCents: null });
  expect(loaded.people[0].birthYear).toBeUndefined();
  expect(loaded.circles).toEqual([]);
  expect(loaded.occasions).toHaveLength(1);
  expect(loaded.gifts[0].title).toBe('Book');
});

test('a blob that cannot be decrypted or has no key stays the raw blob', () => {
  const key = randomKey();
  const blob = sealJson(round5bList(), key);
  const opened = decideCacheLoad({
    blob,
    key: keyToString(key),
    now: 9,
    open: (payload, stored) => openJson(payload, keyFromString(stored)),
  });
  expect(opened.ok).toBe(true);
  if (opened.ok) {
    expect(opened.snapshot.people).toHaveLength(2);
    expect(opened.snapshot.gifts[0].title).toBe('Mug');
  }
  const wrong = decideCacheLoad({
    blob,
    key: keyToString(randomKey()),
    now: 9,
    open: (payload, stored) => openJson(payload, keyFromString(stored)),
  });
  expect(wrong).toEqual({ ok: false, reason: 'decrypt', blob });
  const missing = decideCacheLoad({
    blob,
    key: null,
    now: 9,
    open: () => {
      throw new Error('should not open');
    },
  });
  expect(missing).toEqual({ ok: false, reason: 'key', blob });
  expect(normalizeStoredSnapshot({ version: 1, note: 'not a list' }, 9)).toBeNull();
  expect(decideCacheLoad({ blob: null, key: null, now: 9, open: () => null }).ok).toBe(true);
  const parsed = decideCacheLoad({
    blob,
    key: keyToString(key),
    now: 9,
    open: () => {
      throw new CacheStageError('parse');
    },
  });
  expect(parsed).toEqual({ ok: false, reason: 'parse', blob });
  const validated = decideCacheLoad({
    blob,
    key: keyToString(key),
    now: 9,
    open: () => ({ version: 1, note: 'not a list' }),
  });
  expect(validated).toEqual({ ok: false, reason: 'validate', blob });
});

test('a save before hydration, or an empty list over a real one, does not write', () => {
  const beforeHydration = decideCommit({
    hydrated: false,
    sealed: false,
    storedPeople: 0,
    nextPeople: 0,
  });
  expect(beforeHydration).toBe('hold');
  const lateEmpty = decideCommit({
    hydrated: true,
    sealed: false,
    storedPeople: 1,
    nextPeople: 0,
  });
  expect(lateEmpty).toBe('hold');
  const wiped = decideCommit({
    hydrated: true,
    sealed: false,
    storedPeople: 5,
    nextPeople: 2,
  });
  expect(wiped).toBe('hold');
  const oneRemoved = decideCommit({
    hydrated: true,
    sealed: false,
    storedPeople: 5,
    nextPeople: 4,
  });
  expect(oneRemoved).toBe('write');
  const explicitDelete = decideCommit({
    hydrated: true,
    sealed: false,
    storedPeople: 1,
    nextPeople: 0,
    allowShrink: true,
  });
  expect(explicitDelete).toBe('write');
  const sealed = decideCommit({
    hydrated: true,
    sealed: true,
    storedPeople: 1,
    nextPeople: 1,
  });
  expect(sealed).toBe('hold');
});

test('a relaunch of the same list does not rotate the older copies', () => {
  const slots: SnapshotSlots = { current: 'sealed-good', prev: 'sealed-older', prev2: 'sealed-oldest', prev3: null };
  const same = planSnapshotWrite({
    lastContent: 'marie',
    nextContent: 'marie',
    slots,
    nextBlob: 'sealed-again',
  });
  expect(same.write).toBe(false);
  expect(same.slots).toEqual(slots);

  const edited = planSnapshotWrite({
    lastContent: 'marie',
    nextContent: 'marie-edited',
    slots,
    nextBlob: 'sealed-bad',
  });
  expect(edited.write).toBe(true);
  expect(edited.slots).toEqual({
    current: 'sealed-bad',
    prev: 'sealed-good',
    prev2: 'sealed-older',
    prev3: 'sealed-oldest',
  });
  const again = planSnapshotWrite({
    lastContent: 'marie-edited',
    nextContent: 'marie-edited',
    slots: edited.slots,
    nextBlob: 'sealed-relaunch',
  });
  expect(again.write).toBe(false);
  expect(again.slots.prev).toBe('sealed-good');
  expect(again.slots.prev2).toBe('sealed-older');
});

test('the content key follows the list, not the people count or the key order', () => {
  const first = emptySnapshot(1);
  first.people = [{ id: 'p', name: 'Marie', budgetCents: null, tags: [], imported: false, opened: true, createdAt: 1, updatedAt: 1 }];
  const renamed = {
    ...first,
    people: [{ ...first.people[0], name: 'Marie Claire' }],
  };
  expect(snapshotContentKey(first)).not.toBe(snapshotContentKey(renamed));
  expect(first.people).toHaveLength(renamed.people.length);
  expect(snapshotContentKey({ b: 1, a: { d: 2, c: 3 } })).toBe(snapshotContentKey({ a: { c: 3, d: 2 }, b: 1 }));
  const migrated = migrateToLocal(first);
  expect(snapshotContentKey(migrateToLocal(migrated))).toBe(snapshotContentKey(migrated));
});

test('a deleted person does not keep their occasions, purchases, or idea cache', () => {
  const snapshot = emptySnapshot(1);
  snapshot.people = [
    { id: 'marie', name: 'Marie', budgetCents: null, tags: [], imported: false, opened: true, createdAt: 1, updatedAt: 1 },
    { id: 'gone', name: 'Gone', budgetCents: null, tags: [], imported: false, opened: true, createdAt: 1, updatedAt: 1, deleted: true },
  ];
  snapshot.circles = [{ id: 'c', name: 'Siblings', createdAt: 1 }];
  snapshot.occasions = [
    { id: 'b', personId: 'marie', type: 'birthday', month: 1, day: 2, updatedAt: 1 },
    { id: 'old', personId: 'marie', type: 'christmas', month: 12, day: 25, updatedAt: 1, deleted: true },
    { id: 'theirs', personId: 'gone', type: 'birthday', month: 3, day: 4, updatedAt: 1 },
  ];
  snapshot.gifts = [
    { id: 'kept', personId: 'marie', occasionId: 'old', year: 2026, title: 'Mug', priceCents: 1, purchasedOn: '2026-01-02', updatedAt: 1 },
    { id: 'void', personId: 'marie', occasionId: 'b', year: 2026, title: 'Old', priceCents: 1, purchasedOn: '2026-01-02', updatedAt: 1, deleted: true },
    { id: 'lost', personId: 'gone', occasionId: 'theirs', year: 2026, title: 'Hat', priceCents: 1, purchasedOn: '2026-01-02', updatedAt: 1 },
  ];
  snapshot.ideas = [
    { id: 'live', personId: 'marie', occasionKey: 'k', ideas: [], source: 'on-device', salt: 0, generatedAt: 1, updatedAt: 1 },
    { id: 'stale', personId: 'marie', occasionKey: 'k2', ideas: [], source: 'cloud', salt: 0, generatedAt: 1, updatedAt: 1, deleted: true },
    { id: 'theirs-ideas', personId: 'gone', occasionKey: 'k', ideas: [], source: 'on-device', salt: 0, generatedAt: 1, updatedAt: 1 },
  ];
  const purged = purgeDeleted(snapshot);
  expect(purged.people.map(person => person.id)).toEqual(['marie']);
  expect(purged.occasions.map(item => item.id)).toEqual(['b']);
  expect(purged.gifts.map(item => item.id)).toEqual(['kept']);
  expect(purged.ideas.map(item => item.id)).toEqual(['live']);
  expect(purged.circles.map(item => item.id)).toEqual(['c']);
  expect(snapshotContentKey(purgeDeleted(purged))).toBe(snapshotContentKey(purged));
});
