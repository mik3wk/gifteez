import { budgetFraction, budgetTone, formatSpentOfBudget } from '../src/domain/budgetBar';
import { contrastRatio } from '../src/theme/skins';
import { fairnessView } from '../src/domain/fairnessView';
import type { FairnessRow } from '../src/domain/logic';
import { monogramIndex, monogramLetters } from '../src/domain/monogram';
import { absorbPerson, cleanRelationship, omitRelationship } from '../src/domain/relationship';
import { personSeal, SEAL_PAINT } from '../src/domain/seal';
import type { Person } from '../src/domain/types';

function person(extra: Partial<Person> = {}): Person {
  return {
    id: 'ada',
    name: 'Ada Lovelace',
    budgetCents: 20000,
    tags: [],
    imported: false,
    opened: true,
    createdAt: 1,
    updatedAt: 1,
    ...extra,
  };
}

function row(extra: Partial<FairnessRow>): FairnessRow {
  return {
    personId: 'a',
    name: 'Ada',
    giftCount: 1,
    spentCents: 0,
    yearSpentCents: 0,
    budgetCents: null,
    remainingCents: null,
    ...extra,
  };
}

test('relationship labels stay local and reject junk', () => {
  expect(cleanRelationship('  Mom  ')).toBe('Mom');
  expect(cleanRelationship('Best friend')).toBe('Best friend');
  expect(cleanRelationship('')).toBe('');
  expect(cleanRelationship('Mom!')).toBeNull();
  expect(cleanRelationship('a'.repeat(41))).toBeNull();
  const local = person({ relationship: 'Sister' });
  expect(omitRelationship(local)).not.toHaveProperty('relationship');
  expect(absorbPerson(local, person({ relationship: 'Coworker' })).relationship).toBe('Sister');
  expect(absorbPerson(person(), person({ relationship: 'Coworker' })).relationship).toBeUndefined();
});

test('monogram letters and color follow the person, not the name length', () => {
  expect(monogramLetters('Ada Lovelace')).toBe('AL');
  expect(monogramLetters('Ada')).toBe('A');
  expect(monogramIndex('ada')).toBe(monogramIndex('ada'));
  expect(monogramIndex('ada')).not.toBe(monogramIndex('a'));
});

test('a logged gift wins the seal, and not-started stays an outline', () => {
  expect(personSeal({ status: 'idea-saved', claimed: true, logged: true })).toBe('logged');
  expect(personSeal({ status: 'purchased', claimed: true, logged: false })).toBe('purchased');
  expect(personSeal({ status: 'not-started', claimed: true, logged: false })).toBe('not-started');
  expect(personSeal({ status: 'idea-saved', claimed: false, logged: false })).toBe('idea-saved');
  const idle = SEAL_PAINT.dark['not-started'];
  const logged = SEAL_PAINT.dark.logged;
  expect(idle.fill).toBe('transparent');
  expect(idle.ring).not.toBe(logged.fill);
  expect(contrastRatio(idle.ring, '#26201D')).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(logged.ink, logged.fill)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(SEAL_PAINT.light.logged.ink, SEAL_PAINT.light.logged.fill)).toBeGreaterThanOrEqual(4.5);
});

test('fairness bars share one scale and never use a percentage', () => {
  const view = fairnessView([
    row({ personId: 'ada', name: 'Ada', yearSpentCents: 18000, budgetCents: 20000 }),
    row({ personId: 'bea', name: 'Bea', yearSpentCents: 10000, budgetCents: 20000 }),
  ]);
  expect(view.scale).toBe(20000);
  expect(view.balanced).toBe(false);
  expect(view.spread).toBe(8000);
  expect(view.bars[0].behindCents).toBe(0);
  expect(view.bars.find(bar => bar.personId === 'bea')?.behindCents).toBe(8000);
  expect(view.budgetCents).toBe(40000);
  expect(JSON.stringify(view)).not.toMatch(/%/);
  const even = fairnessView([
    row({ yearSpentCents: 5000, budgetCents: 5000 }),
    row({ personId: 'bea', name: 'Bea', yearSpentCents: 5000, budgetCents: 5000 }),
  ]);
  expect(even.balanced).toBe(true);
  expect(even.spread).toBe(0);
});

test('a budget bar stays sage, turns gold near the budget, and rose once it is past', () => {
  expect(budgetTone(0, 20000)).toBe('under');
  expect(budgetTone(17900, 20000)).toBe('under');
  expect(budgetTone(18000, 20000)).toBe('near');
  expect(budgetTone(20000, 20000)).toBe('near');
  expect(budgetTone(20001, 20000)).toBe('over');
  expect(budgetTone(5000, null)).toBe('under');
  expect(budgetFraction(25000, 20000)).toBe(1);
  expect(budgetFraction(5000, null)).toBe(0);
  const money = (cents: number) => `$${cents / 100}`;
  expect(formatSpentOfBudget(0, 15000, money)).toBe('$0 of $150');
  expect(formatSpentOfBudget(18000, 20000, money)).toBe('$180 of $200');
  expect(formatSpentOfBudget(0, null, money)).toBe('$0');
});
