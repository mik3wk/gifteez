import Contacts from 'react-native-contacts';
import { contactAddDecision, freeSlotsLeft, withDefaultBudget } from '../src/domain/contactImport';
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

test('reading contacts never writes and keeps a birthday', async () => {
  const request = Contacts.requestPermission as jest.Mock;
  const read = Contacts.getAllWithoutPhotos as jest.Mock;
  request.mockResolvedValueOnce('authorized');
  read.mockResolvedValueOnce([
    { givenName: 'Ada', familyName: 'Lovelace', birthday: { month: 11, day: 10 } },
    { givenName: ' ', familyName: '' },
  ]);
  await expect(importContacts()).resolves.toEqual([
    { name: 'Ada Lovelace', budgetCents: null, tags: [], month: 12, day: 10 },
  ]);
  expect(read).toHaveBeenCalled();
  expect('updateContact' in Contacts || 'addContact' in Contacts).toBe(false);
});
