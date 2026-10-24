import { keyFromString, keyToString, openJson, randomKey, sealJson } from '../src/crypto/crypto';
import { CacheStageError, decideCacheLoad, decideCommit, normalizeStoredSnapshot } from '../src/domain/snapshotLoad';

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
