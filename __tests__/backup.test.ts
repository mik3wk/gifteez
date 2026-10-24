import { exportBackup, migrateToLocal, parseBackup, summarizeBackup } from '../src/domain/backup';
import { emptySnapshot, type GiftRecord, type IdeaCacheEntry, type Occasion, type OccasionState, type Person } from '../src/domain/types';

function person(): Person {
  return {
    id: 'ada',
    name: 'Ada',
    budgetCents: 20000,
    tags: ['books'],
    imported: false,
    opened: true,
    createdAt: 1,
    updatedAt: 1,
    relationship: 'Mom',
    linkedUid: 'secret',
  };
}

function occasion(): Occasion {
  return { id: 'bday', personId: 'ada', type: 'birthday', month: 5, day: 2, updatedAt: 1 };
}

function state(): OccasionState {
  return {
    id: 'state',
    occasionId: 'bday',
    personId: 'ada',
    year: 2026,
    status: 'idea-saved',
    savedIdea: 'A novel',
    claimedBy: 'sam',
    claimedAt: 3,
    updatedAt: 2,
  };
}

function gift(): GiftRecord {
  return {
    id: 'mug',
    personId: 'ada',
    occasionId: 'bday',
    year: 2026,
    title: 'Mug',
    priceCents: 1200,
    purchasedOn: '2026-05-02',
    boughtBy: 'sam',
    updatedAt: 4,
  };
}

function idea(): IdeaCacheEntry {
  return {
    id: 'ideas',
    personId: 'ada',
    occasionKey: 'bday:2026',
    ideas: [{ title: 'A novel', priceMin: 15, priceMax: 40, reason: 'A book they can keep.', searchQuery: 'hardcover novel gift' }],
    source: 'on-device',
    salt: 0,
    generatedAt: 1,
    updatedAt: 1,
  };
}

test('a backup round trip keeps people, occasions, ideas, gifts, budgets, and relationship labels', () => {
  const snapshot = emptySnapshot(1);
  snapshot.profile.currency = 'USD';
  snapshot.entitlementPaid = true;
  snapshot.people = [person()];
  snapshot.occasions = [occasion()];
  snapshot.states = [state()];
  snapshot.gifts = [gift()];
  snapshot.ideas = [idea()];
  snapshot.feedback = [{ id: 'f', personId: 'ada', idea: 'A novel', vote: 'up', createdAt: 1 }];
  const text = exportBackup(snapshot, new Date('2026-10-24T00:00:00Z'));
  const file = JSON.parse(text);
  expect(file.version).toBe(1);
  expect(file.people[0].relationship).toBe('Mom');
  expect(file.people[0].budgetCents).toBe(20000);
  expect(file.people[0].linkedUid).toBeUndefined();
  expect(file.gifts[0].title).toBe('Mug');
  expect(file.gifts[0].boughtBy).toBeUndefined();
  expect(file.states[0].claimedBy).toBeUndefined();
  expect(file.entitlementPaid).toBeUndefined();
  const parsed = parseBackup(text, 9);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    return;
  }
  expect(parsed.snapshot.people[0]).toMatchObject({ name: 'Ada', relationship: 'Mom', budgetCents: 20000 });
  expect(parsed.snapshot.occasions[0].month).toBe(5);
  expect(parsed.snapshot.ideas[0].ideas[0]).toMatchObject({ title: 'A novel' });
  expect(parsed.snapshot.gifts[0]).toMatchObject({ title: 'Mug', priceCents: 1200 });
  expect(parsed.snapshot.profile.currency).toBe('USD');
  expect(parsed.snapshot.entitlementPaid).toBe(false);
  expect(parsed.snapshot.feedback).toHaveLength(1);
});

test('a backup is rejected when the file, version, shape, or relationship is wrong', () => {
  expect(parseBackup('not json', 1)).toEqual({ ok: false, reason: 'json' });
  expect(parseBackup('null', 1)).toEqual({ ok: false, reason: 'shape' });
  const base = {
    version: 1,
    currency: 'USD',
    people: [],
    occasions: [],
    states: [],
    gifts: [],
    ideas: [],
    feedback: [],
  };
  expect(parseBackup(JSON.stringify({ ...base, version: 2 }), 1)).toEqual({ ok: false, reason: 'version' });
  expect(parseBackup(JSON.stringify({ ...base, people: 'Ada' }), 1)).toEqual({ ok: false, reason: 'shape' });
  expect(parseBackup(JSON.stringify({ ...base, gifts: [{ id: 'x' }] }), 1)).toEqual({ ok: false, reason: 'shape' });
  expect(parseBackup(JSON.stringify({
    ...base,
    people: [{ id: 'ada', name: 'Ada', relationship: 'Mom!' }],
  }), 1)).toEqual({ ok: false, reason: 'shape' });
});

test('a restore preview counts people, occasions, ideas, and the backup date', () => {
  const snapshot = emptySnapshot(1);
  snapshot.people = [person(), { ...person(), id: 'gone', name: 'Gone', deleted: true }];
  snapshot.occasions = [occasion()];
  snapshot.ideas = [{ ...idea(), ideas: [
    { title: 'A novel', priceMin: 15, priceMax: 40, reason: 'A book they can keep.', searchQuery: 'hardcover novel gift' },
    { title: 'A mug', priceMin: 15, priceMax: 40, reason: 'A mug they will use.', searchQuery: 'everyday ceramic mug' },
  ] }];
  snapshot.gifts = [gift()];
  const text = exportBackup(snapshot, new Date('2026-10-24T15:00:00Z'));
  const summary = summarizeBackup(text);
  expect(summary.ok).toBe(true);
  if (!summary.ok) {
    return;
  }
  expect(summary.summary).toMatchObject({
    people: 1,
    occasions: 1,
    ideas: 2,
    gifts: 1,
    exportedAt: '2026-10-24T15:00:00.000Z',
  });
  expect(summarizeBackup('{').ok).toBe(false);
});

test('the first local launch folds a private gift in and drops group claims', () => {
  const snapshot = emptySnapshot(1);
  snapshot.group = {
    id: 'g',
    name: 'Family',
    ownerId: 'me',
    memberIds: ['me'],
    peopleCount: 1,
    entitled: true,
    updatedAt: 1,
    currency: 'EUR',
  };
  snapshot.profile.groupId = 'g';
  snapshot.people = [person()];
  snapshot.states = [state()];
  snapshot.privateGifts = [{
    id: 'scarf',
    personId: 'ada',
    groupId: 'g',
    occasionId: 'bday',
    year: 2026,
    title: 'Scarf',
    priceCents: 800,
    purchasedOn: '2026-01-02',
    boughtBy: 'me',
    updatedAt: 5,
  }];
  snapshot.releasedGroupIds = ['old'];
  snapshot.roster = [{ id: 'g', name: 'Family', ownerId: 'me', memberIds: ['me'], memberNames: [], updatedAt: 1 }];
  const next = migrateToLocal(snapshot);
  expect(next.group).toBeNull();
  expect(next.roster).toEqual([]);
  expect(next.releasedGroupIds).toEqual([]);
  expect(next.people[0].linkedUid).toBeUndefined();
  expect(next.people[0].relationship).toBe('Mom');
  expect(next.states[0].claimedBy).toBeUndefined();
  expect(next.gifts.map(item => item.title)).toEqual(['Scarf']);
  expect(next.gifts[0].boughtBy).toBeUndefined();
  expect(next.profile.currency).toBe('EUR');
  expect(next.entitlementPaid).toBe(false);
});
