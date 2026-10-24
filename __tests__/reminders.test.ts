import { nextReminderWhen } from '../src/domain/reminders';
import type { Occasion, Person } from '../src/domain/types';
import { formatClock, formatDate, t } from '../src/i18n';

function person(id: string, name: string): Person {
  return {
    id,
    name,
    budgetCents: null,
    tags: [],
    imported: false,
    opened: true,
    createdAt: 1,
    updatedAt: 1,
  };
}

function birthday(personId: string, month: number, day: number): Occasion {
  return { id: `${personId}-day`, personId, type: 'birthday', month, day, updatedAt: 1 };
}

test('the next reminder is the lead time before the occasion', () => {
  const when = nextReminderWhen({
    people: [person('maya', 'Maya')],
    occasions: [birthday('maya', 10, 31)],
    now: new Date(2026, 9, 1, 8, 0),
    leadDays: 7,
    hour: 9,
    minute: 0,
  });
  expect(when?.getFullYear()).toBe(2026);
  expect(when?.getMonth()).toBe(9);
  expect(when?.getDate()).toBe(24);
  expect(when?.getHours()).toBe(9);
  expect(t('person.remindSet', { date: formatDate(when!) })).toBe("You're set. We'll remind you Oct 24.");
});

test('an enabled bell names the real lead and time', () => {
  expect(formatClock(9, 0)).toBe('9:00 AM');
  expect(t('people.remindersOnDetail', { count: 7, time: formatClock(9, 0) })).toBe(
    'Reminders are on · 7 days before at 9:00 AM',
  );
  expect(t('people.remindersOnDetail', { count: 1, time: '9:00 AM' })).toBe(
    'Reminders are on · 1 day before at 9:00 AM',
  );
});
