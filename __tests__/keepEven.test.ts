import { exportBackup, parseBackup } from '../src/domain/backup';
import { evenGapCents, isEvenSpend } from '../src/domain/circles';
import { keptEvenHome, keptEvenView } from '../src/domain/keepEven';
import { updatePerson } from '../src/domain/logic';
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

function gift(personId: string, priceCents: number, year = 2026): GiftRecord {
  return {
    id: `${personId}-${priceCents}-${year}`,
    personId,
    occasionId: 'o',
    year,
    title: 'Gift',
    priceCents,
    purchasedOn: `${year}-06-01`,
    updatedAt: 1,
  };
}

function marked(names: Array<[string, number]>, extra: Partial<Person> = {}) {
  const snapshot = emptySnapshot(1);
  snapshot.people = names.map(([id]) => person(id, id[0].toUpperCase() + id.slice(1), { keepEven: true, ...extra }));
  snapshot.gifts = names.filter(([, cents]) => cents > 0).map(([id, cents]) => gift(id, cents));
  return snapshot;
}

test('tolerance edges stay even through $10 and through exactly 5%', () => {
  expect(evenGapCents(10000)).toBe(1000);
  expect(evenGapCents(0)).toBe(1000);
  expect(isEvenSpend(10000, 10001)).toBe(true);
  expect(isEvenSpend(9999, 10000)).toBe(true);
  expect(isEvenSpend(9000, 10000)).toBe(true);
  expect(isEvenSpend(8999, 10000)).toBe(false);
  expect(isEvenSpend(9700, 10000)).toBe(true);
  expect(isEvenSpend(190000, 200000)).toBe(true);
  expect(isEvenSpend(189999, 200000)).toBe(false);
});

test('$120 vs $80 names the larger gap, and a tie or zero spend is even', () => {
  const gap = keptEvenView(marked([['ada', 12000], ['jack', 8000]]), 2026);
  expect(gap.status).toBe('behind');
  expect(gap.behind).toEqual([expect.objectContaining({ name: 'Jack', behindCents: 4000 })]);
  expect(keptEvenHome(gap)).toEqual({ kind: 'gap', name: 'Jack', behindCents: 4000 });
  expect(gap.marked.find(item => item.name === 'Ada')?.behindCents).toBe(0);

  const tied = keptEvenView(marked([['ada', 5000], ['ben', 5000], ['cam', 5000]]), 2026);
  expect(tied.status).toBe('even');
  expect(tied.behind).toEqual([]);
  expect(keptEvenHome(tied)).toEqual({ kind: 'even' });

  const zero = keptEvenView(marked([['ada', 0], ['ben', 0]]), 2026);
  expect(zero.status).toBe('even');
  expect(zero.behind).toEqual([]);

  const noneSpent = keptEvenView(marked([['ada', 0], ['ben', 10000]]), 2026);
  expect(noneSpent.behind).toEqual([expect.objectContaining({ name: 'Ada', behindCents: 10000 })]);
});

test('one marked person is not a comparison, and last year does not count', () => {
  const snapshot = marked([['ada', 100]], { budgetCents: 20000 });
  snapshot.people.push(person('ben', 'Ben', { budgetCents: 20000 }));
  snapshot.gifts.push(gift('ben', 4500), gift('ada', 99999, 2025));
  const view = keptEvenView(snapshot, 2026);
  expect(view.status).toBe('need-more');
  expect(view.behind).toEqual([]);
  expect(view.others.map(item => item.name)).toEqual(['Ben']);
  expect(view.others[0].yearSpentCents).toBe(4500);
  expect(view.marked[0].yearSpentCents).toBe(100);
  expect(keptEvenHome(view)).toEqual({ kind: 'prompt' });
});

test('keepEven round-trips in a v1 backup and older files still open', () => {
  const snapshot = emptySnapshot(1);
  snapshot.people = [person('ada', 'Ada', { keepEven: true }), person('ben', 'Ben')];
  const turnedOff = updatePerson(snapshot, 'ben', { keepEven: false }, 2);
  expect(turnedOff.ok).toBe(true);
  if (!turnedOff.ok) {
    return;
  }
  expect(turnedOff.snapshot.people[1].keepEven).toBeUndefined();
  const text = exportBackup(turnedOff.snapshot, new Date('2026-10-24T00:00:00Z'));
  const parsed = parseBackup(text, 9);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    return;
  }
  expect(parsed.snapshot.people.find(item => item.id === 'ada')?.keepEven).toBe(true);
  expect(parsed.snapshot.people.find(item => item.id === 'ben')?.keepEven).toBeUndefined();
  expect(JSON.parse(text).version).toBe(1);

  const legacy = JSON.parse(text) as { people: Array<Record<string, unknown>> };
  legacy.people.forEach(item => {
    delete item.keepEven;
  });
  const old = parseBackup(JSON.stringify(legacy), 9);
  expect(old.ok).toBe(true);
  if (!old.ok) {
    return;
  }
  expect(old.snapshot.people.every(item => item.keepEven == null)).toBe(true);

  legacy.people[0].keepEven = 'yes';
  expect(parseBackup(JSON.stringify(legacy), 9)).toEqual({ ok: false, reason: 'shape' });
});
