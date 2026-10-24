import Contacts from 'react-native-contacts';
import { contactAddDecision, contactBirthYear, contactMonthDay, freeSlotsLeft, planImported, withDefaultBudget } from '../src/domain/contactImport';
import { importContacts } from '../src/platform/importers';

test('free slots count down from the cap and disappear once unlocked', () => {
  expect(freeSlotsLeft(2, 5, false)).toBe(3);
  expect(freeSlotsLeft(5, 5, false)).toBe(0);
  expect(freeSlotsLeft(8, 5, false)).toBe(0);
  expect(freeSlotsLeft(2, 5, true)).toBeNull();
});

test('a contact import adds the selection only when it fits the free slots', () => {
  expect(contactAddDecision(0, 3)).toBe('none');
  expect(contactAddDecision(3, 3)).toBe('add');
  expect(contactAddDecision(4, 3)).toBe('paywall');
  expect(contactAddDecision(1, 0)).toBe('paywall');
  expect(contactAddDecision(9, null)).toBe('add');
});

test('chosen contacts take the default budget', () => {
  const rows = withDefaultBudget(
    [{ name: 'Ada', budgetCents: null, tags: [], month: 12, day: 10 }],
    7500,
  );
  expect(rows).toEqual([{ name: 'Ada', budgetCents: 7500, tags: [], month: 12, day: 10 }]);
  expect(withDefaultBudget([{ name: 'Ada', budgetCents: null, tags: [] }], null)[0].budgetCents).toBeNull();
});

test('contact months stay 1-based on iOS and Android, with or without a year', () => {
  const samples = [
    { month: 1, day: 8, label: 'Jan' },
    { month: 3, day: 14, label: 'Mar' },
    { month: 7, day: 2, label: 'Jul' },
    { month: 12, day: 25, label: 'Dec' },
  ];
  for (const platform of ['ios', 'android']) {
    for (const sample of samples) {
      expect(contactMonthDay(platform, { month: sample.month, day: sample.day })).toEqual({
        month: sample.month,
        day: sample.day,
      });
      expect(contactMonthDay(platform, { year: 1990, month: sample.month, day: sample.day })).toEqual({
        month: sample.month,
        day: sample.day,
      });
    }
  }
});

test('impossible contact dates are dropped', () => {
  expect(contactMonthDay('ios', { month: 13, day: 1 })).toBeNull();
  expect(contactMonthDay('android', { month: 0, day: 1 })).toBeNull();
  expect(contactMonthDay('ios', { month: 4, day: 31 })).toBeNull();
  expect(contactMonthDay('android', { month: 2, day: 30 })).toBeNull();
  expect(contactMonthDay('ios', { year: 1990, month: 12, day: 0 })).toBeNull();
  expect(contactMonthDay('ios', { month: 3 })).toBeNull();
});

test('the same person and birthday are not imported twice', () => {
  const ada = { name: 'Ada Lovelace', budgetCents: null, tags: [] as string[], month: 3, day: 14 };
  const existing = {
    people: [{ id: 'ada', name: 'Ada Lovelace' }],
    occasions: [{ personId: 'ada', type: 'birthday', month: 3, day: 14 }],
  };
  expect(planImported([ada], existing)).toEqual([]);
  expect(planImported(
    [ada, { ...ada, name: 'ada lovelace' }],
    { people: [], occasions: [] },
  )).toEqual([{ kind: 'create', name: 'Ada Lovelace', budgetCents: null, tags: [], month: 3, day: 14 }]);
  expect(planImported(
    [{ ...ada, month: 7, day: 2 }],
    { people: [{ id: 'ada', name: 'Ada Lovelace' }], occasions: [] },
  )).toEqual([{ kind: 'occasion', personId: 'ada', month: 7, day: 2 }]);
  expect(planImported(
    [{ name: 'Bea', budgetCents: null, tags: [], month: 13, day: 1 }],
    { people: [], occasions: [] },
  )).toEqual([{ kind: 'create', name: 'Bea', budgetCents: null, tags: [] }]);
  expect(planImported(
    [{ name: 'Sam', budgetCents: null, tags: [], month: 6, day: 10, birthYear: 2020 }],
    { people: [], occasions: [] },
  )).toEqual([{ kind: 'create', name: 'Sam', budgetCents: null, tags: [], month: 6, day: 10, birthYear: 2020 }]);
  expect(planImported(
    [{ ...ada, birthYear: 2020 }],
    existing,
  )).toEqual([{ kind: 'birthYear', personId: 'ada', birthYear: 2020 }]);
  expect(planImported(
    [{ ...ada, birthYear: 2014 }],
    {
      people: [{ id: 'ada', name: 'Ada Lovelace', birthYear: 1990 }],
      occasions: [{ personId: 'ada', type: 'birthday', month: 3, day: 14 }],
    },
  )).toEqual([]);
  expect(contactBirthYear(2020, new Date(2026, 5, 10))).toBe(2020);
  expect(contactBirthYear(1899, new Date(2026, 5, 10))).toBeNull();
  expect(contactBirthYear(0)).toBeNull();
});

test('reading contacts never writes and keeps a 1-based birthday', async () => {
  const request = Contacts.requestPermission as jest.Mock;
  const read = Contacts.getAllWithoutPhotos as jest.Mock;
  request.mockResolvedValueOnce('authorized');
  read.mockResolvedValueOnce([
    { givenName: 'Ada', familyName: 'Lovelace', birthday: { year: 1990, month: 3, day: 14 } },
    { givenName: 'Sam', familyName: '', birthday: { year: 2020, month: 6, day: 10 } },
    { givenName: 'Grace', familyName: 'Hopper', birthday: { month: 12, day: 9 } },
    { givenName: 'Bad', familyName: 'Date', birthday: { month: 13, day: 2 } },
    { givenName: 'Year', familyName: 'Only', birthday: { year: 2018, month: 13, day: 2 } },
    { givenName: ' ', familyName: '' },
  ]);
  await expect(importContacts()).resolves.toEqual([
    { name: 'Ada Lovelace', budgetCents: null, tags: [], month: 3, day: 14, birthYear: 1990 },
    { name: 'Sam', budgetCents: null, tags: [], month: 6, day: 10, birthYear: 2020 },
    { name: 'Grace Hopper', budgetCents: null, tags: [], month: 12, day: 9 },
    { name: 'Bad Date', budgetCents: null, tags: [] },
    { name: 'Year Only', budgetCents: null, tags: [], birthYear: 2018 },
  ]);
  expect(read).toHaveBeenCalled();
  expect('updateContact' in Contacts || 'addContact' in Contacts).toBe(false);
});
