import { exportBackup, migrateToLocal, parseBackup } from '../src/domain/backup';
import {
  circleHomeLine,
  circleSections,
  circleSuggestions,
  evenGapCents,
  isEvenSpend,
  joinNames,
  removeCircle,
} from '../src/domain/circles';
import {
  DEFAULT_RELATIONSHIP_KEYS,
  relationshipKey,
  relationshipLabel,
  storeRelationship,
} from '../src/domain/relationship';
import { emptySnapshot, type GiftRecord, type Person } from '../src/domain/types';

function person(id: string, name: string, extra: Partial<Person> = {}): Person {
  return {
    id,
    name,
    budgetCents: null,
    tags: [],
    imported: false,
    opened: true,
    createdAt: 1,
    updatedAt: 1,
    ...extra,
  };
}

function gift(personId: string, priceCents: number): GiftRecord {
  return {
    id: `${personId}-${priceCents}`,
    personId,
    occasionId: 'o',
    year: 2026,
    title: 'Gift',
    priceCents,
    purchasedOn: '2026-06-01',
    updatedAt: 1,
  };
}

test('tolerance is the larger of $10 and 5% of the top spend', () => {
  expect(evenGapCents(10000)).toBe(1000);
  expect(evenGapCents(100000)).toBe(5000);
  expect(isEvenSpend(9999, 10000)).toBe(true);
  expect(isEvenSpend(9000, 10000)).toBe(true);
  expect(isEvenSpend(8999, 10000)).toBe(false);
  expect(isEvenSpend(190000, 200000)).toBe(true);
  expect(isEvenSpend(189999, 200000)).toBe(false);
});

test('a circle of one person is even and an empty circle stays empty', () => {
  const snapshot = emptySnapshot(1);
  snapshot.circles = [
    { id: 'one', name: 'Siblings', createdAt: 1 },
    { id: 'none', name: 'Cousins', createdAt: 2 },
  ];
  snapshot.people = [person('ada', 'Ada', { circleId: 'one' })];
  snapshot.gifts = [gift('ada', 1)];
  const sections = circleSections(snapshot, 2026);
  expect(sections[0]).toMatchObject({ status: 'even', behind: [] });
  expect(sections[1]).toMatchObject({ status: 'empty', members: [], behind: [] });
  expect(circleHomeLine(sections[0])).toEqual({ status: 'even' });
  expect(circleHomeLine(sections[1])).toBeNull();
});

test('suggestions group a stored key with the older label', () => {
  const people = [
    person('sam', 'Sam', { relationship: 'Cousin' }),
    person('lee', 'Lee', { relationship: 'cousin' }),
    person('ana', 'Ana', { relationship: 'Cousin' }),
    person('jo', 'Jo', { relationship: 'Friend' }),
    person('max', 'Max', { relationship: 'cousin', circleId: 'already' }),
  ];
  const suggestions = circleSuggestions(people);
  expect(suggestions).toEqual([
    { key: 'cousin', personIds: ['sam', 'lee', 'ana'], names: ['Sam', 'Lee', 'Ana'] },
  ]);
  expect(joinNames(['Sam', 'Lee', 'Ana'])).toBe('Sam, Lee and Ana');
});

test('preset keys survive and old labels still read as the same preset', () => {
  expect(DEFAULT_RELATIONSHIP_KEYS).toEqual(['mom', 'dad', 'sister', 'brother', 'partner', 'child', 'cousin', 'friend']);
  expect(relationshipKey('Cousin')).toBe('cousin');
  expect(relationshipKey('cousin')).toBe('cousin');
  expect(relationshipLabel('cousin')).toBe('Cousin');
  expect(storeRelationship('Cousin')).toBe('cousin');
  expect(storeRelationship('Piano teacher')).toBe('Piano teacher');
  expect(relationshipKey('Piano teacher')).toBeNull();
});

test('deleting a circle unassigns people and keeps them', () => {
  const snapshot = emptySnapshot(1);
  snapshot.circles = [{ id: 'sib', name: 'Siblings', createdAt: 1 }];
  snapshot.people = [person('ada', 'Ada', { circleId: 'sib' })];
  const next = removeCircle(snapshot, 'sib');
  expect(next.circles).toEqual([]);
  expect(next.people[0].name).toBe('Ada');
  expect(next.people[0].circleId).toBeUndefined();
});

test('backups keep circles and older files without them still open', () => {
  const snapshot = emptySnapshot(1);
  snapshot.people = [person('ada', 'Ada', { relationship: 'cousin', circleId: 'sib' })];
  snapshot.circles = [{ id: 'sib', name: 'Siblings', createdAt: 4 }];
  const text = exportBackup(snapshot, new Date('2026-10-24T00:00:00Z'));
  const parsed = parseBackup(text, 9);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    return;
  }
  expect(parsed.snapshot.circles).toEqual([{ id: 'sib', name: 'Siblings', createdAt: 4 }]);
  expect(parsed.snapshot.people[0].circleId).toBe('sib');
  const legacy = JSON.parse(text) as Record<string, unknown>;
  delete legacy.circles;
  const old = parseBackup(JSON.stringify(legacy), 9);
  expect(old.ok).toBe(true);
  if (!old.ok) {
    return;
  }
  expect(old.snapshot.circles).toEqual([]);
  expect(old.snapshot.people[0].circleId).toBe('sib');
  const migrated = migrateToLocal({ ...snapshot, circles: snapshot.circles });
  expect(migrated.circles).toEqual(snapshot.circles);
  expect(migrated.people[0].circleId).toBe('sib');
  const missing = migrateToLocal({ ...emptySnapshot(1), circles: undefined as never });
  expect(missing.circles).toEqual([]);
});
