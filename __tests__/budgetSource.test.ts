import { applyCircleBudget, budgetOrigin, migrateBudgetSources } from '../src/domain/budget';
import { assignCircle } from '../src/domain/circles';
import { emptySnapshot, type Person } from '../src/domain/types';
import { t } from '../src/i18n';

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

function list() {
  const snapshot = emptySnapshot(1);
  snapshot.circles = [{ id: 'kids', name: 'Kids', createdAt: 1, budgetCents: 20000 }];
  snapshot.people = [
    person('leo', 'Leo', { circleId: 'kids', budgetCents: 20000 }),
    person('maya', 'Maya', { circleId: 'kids', budgetCents: 25000 }),
  ];
  return snapshot;
}

test('a per-person budget that differs from the circle becomes custom', () => {
  const next = migrateBudgetSources(list());
  expect(next.people.find(item => item.id === 'leo')?.budgetCustom).toBeUndefined();
  expect(budgetOrigin(next.people[0], next.circles).kind).toBe('circle');
  expect(next.people.find(item => item.id === 'maya')?.budgetCustom).toBe(true);
  expect(budgetOrigin(next.people[1], next.circles)).toMatchObject({ kind: 'custom', cents: 25000, circleName: 'Kids' });
  expect(t('person.budgetFromCircle', { amount: '$200', name: 'Kids' })).toBe('$200 · from Kids circle');
  expect(t('person.budgetCustom', { amount: '$250' })).toBe('$250 · custom');
  expect(t('person.override')).toBe('Override');
  expect(t('person.useCircleBudget')).toBe('Use circle budget');
  expect(t('settings.defaultBudget')).toBe('Starting budget');
  expect(t('settings.startingBudgetFooter')).toBe("Used when you add someone who isn't in a circle.");
  expect(t('settings.none')).toBe('None');
  expect(t('fairness.applyBudget', { amount: '$200', names: 'Leo and Maya' })).toBe('Apply $200 to Leo and Maya?');
  expect(t('fairness.applyEveryone')).toBe('Apply to everyone');
  expect(t('fairness.applyNew')).toBe('Only new people');
});

test('applying a circle budget can update everyone or leave current people custom', () => {
  const snapshot = list();
  const everyone = applyCircleBudget(snapshot, 'kids', 30000, 'everyone');
  expect(everyone?.circles[0].budgetCents).toBe(30000);
  expect(everyone?.people.map(item => [item.name, item.budgetCents, item.budgetCustom])).toEqual([
    ['Leo', 30000, undefined],
    ['Maya', 30000, undefined],
  ]);
  const kept = applyCircleBudget(snapshot, 'kids', 30000, 'new');
  expect(kept?.circles[0].budgetCents).toBe(30000);
  expect(kept?.people.map(item => [item.name, item.budgetCents, item.budgetCustom])).toEqual([
    ['Leo', 20000, true],
    ['Maya', 25000, true],
  ]);
  const joined = assignCircle(snapshot, 'leo', 'kids', 2);
  expect(joined?.people.find(item => item.id === 'leo')?.budgetCustom).toBeUndefined();
});
