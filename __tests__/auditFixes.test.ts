import { deleteOccasion, deleteSharedGift, updateOccasionDate, updateSharedGift } from '../src/domain/edits';
import { planReminders } from '../src/domain/reminders';
import { keyToString, openJson, randomKey, sealJson, unwrapKey, wrapKey } from '../src/crypto/crypto';
import {
  createGroup,
  dateInYear,
  exportAccount,
  groupCurrency,
  isRealMonthDay,
  mergeOccasionState,
  nextOccurrence,
  occurrenceYear,
  parseBudget,
  removeMember,
  saveIdea,
  yearSpentCents,
} from '../src/domain/logic';
import { isHiddenFromViewer, pushKind, stripSensitiveForViewer } from '../src/domain/visibility';
import { emptySnapshot as blank, type Occasion, type OccasionState, type Person } from '../src/domain/types';
import { formatMoney } from '../src/i18n';

function person(id: string, name: string): Person {
  return { id, name, budgetCents: null, tags: [], imported: false, opened: true, createdAt: 1, updatedAt: 1 };
}

function occasion(id: string, personId: string, type: Occasion['type'], month: number, day: number, year?: number): Occasion {
  return { id, personId, type, month, day, ...(year ? { year } : {}), updatedAt: 1 };
}

test('February 29 is stored and celebrated on February 28 outside a leap year', () => {
  expect(isRealMonthDay(2, 29)).toBe(true);
  expect(isRealMonthDay(4, 31)).toBe(false);
  expect(dateInYear(2, 29, 2028).getDate()).toBe(29);
  expect(dateInYear(2, 29, 2026).getMonth()).toBe(1);
  expect(dateInYear(2, 29, 2026).getDate()).toBe(28);
  expect(nextOccurrence(12, 25, new Date(2026, 11, 26)).getFullYear()).toBe(2027);
});

test('a wedding does not roll into the next year', () => {
  const wedding = occasion('w', 'a', 'wedding', 6, 1, 2024);
  expect(occurrenceYear(wedding, new Date(2026, 8, 1))).toBe(2024);
  const birthday = occasion('b', 'a', 'birthday', 6, 1);
  expect(occurrenceYear(birthday, new Date(2026, 8, 1))).toBe(2027);
});

test('saving an idea keeps a purchase, and a leaving member loses the claim', () => {
  const snapshot = createGroup({
    snapshot: blank(1),
    groupId: 'g',
    ownerId: 'owner',
    displayName: 'Owner',
    groupName: 'Family',
    now: 1,
  });
  snapshot.members.push({ id: 'sam', uid: 'sam', displayName: 'Sam', updatedAt: 1 });
  snapshot.group = snapshot.group && { ...snapshot.group, memberIds: ['owner', 'sam'] };
  snapshot.people = [person('ada', 'Ada')];
  snapshot.occasions = [occasion('bday', 'ada', 'birthday', 10, 25)];
  const state: OccasionState = {
    id: 'bday:2026',
    occasionId: 'bday',
    personId: 'ada',
    year: 2026,
    status: 'purchased',
    savedIdea: 'Book',
    claimedBy: 'sam',
    claimedAt: 2,
    updatedAt: 3,
  };
  snapshot.states = [state];
  const saved = saveIdea({ snapshot, occasion: snapshot.occasions[0], idea: 'Scarf', today: new Date(2026, 0, 1), now: 9 });
  expect(saved.states[0].status).toBe('purchased');
  expect(saved.states[0].claimedBy).toBe('sam');
  const removed = removeMember(saved, 'sam', 10);
  expect(removed.ok).toBe(true);
  if (removed.ok) {
    expect(removed.snapshot.states[0].claimedBy).toBeUndefined();
  }
  const clobber = mergeOccasionState(state, { ...state, status: 'idea-saved', savedIdea: 'Mug', claimedBy: undefined, updatedAt: 20 }, []);
  expect(clobber.status).toBe('purchased');
  expect(clobber.claimedBy).toBe('sam');
});

test('blank and negative prices are rejected and zero is allowed', () => {
  expect(parseBudget('')).toBeNull();
  expect(parseBudget('-4')).toBeNull();
  expect(parseBudget('0')).toBe(0);
});

test('missing list currency is USD and an explicit currency is used', () => {
  expect(groupCurrency(null)).toBe('USD');
  expect(groupCurrency({ currency: 'GBP' })).toBe('GBP');
  expect(formatMoney(5000, 'en-GB', 'USD')).toContain('50');
  expect(formatMoney(5000, 'en-GB', 'USD')).not.toContain('£');
});

test('headline spend ignores private gifts', () => {
  const gifts = [{ id: 'g', personId: 'a', occasionId: 'o', year: 2026, title: 'Hat', priceCents: 1000, purchasedOn: '2026-01-02', updatedAt: 1 }];
  expect(yearSpentCents('a', gifts, 2026)).toBe(1000);
});

test('export waits for an account and includes every list', () => {
  const snapshot = createGroup({
    snapshot: blank(1),
    groupId: 'g',
    ownerId: 'me',
    displayName: 'Me',
    groupName: 'Home',
    now: 1,
  });
  snapshot.people = [person('ada', 'Ada')];
  expect(exportAccount(snapshot, new Date(2026, 1, 1), cents => `$${cents / 100}`)).toBeNull();
  snapshot.profile.upgraded = true;
  snapshot.archives = {
    other: {
      group: { id: 'other', name: 'Work', ownerId: 'me', memberIds: ['me'], peopleCount: 1, entitled: false, updatedAt: 1, currency: 'USD' },
      members: snapshot.members,
      people: [person('bea', 'Bea')],
      occasions: [],
      states: [],
      gifts: [],
      ideas: [],
      dirty: {},
      inviteId: null,
    },
  };
  const text = exportAccount(snapshot, new Date(2026, 1, 1), cents => `$${cents / 100}`) ?? '';
  expect(text).toContain('Ada');
  expect(text).toContain('Bea');
});

test('a key wrap opens only with the previous key', () => {
  const previous = randomKey();
  const next = randomKey();
  const sealed = sealJson({ key: 'next-key' }, previous);
  expect(openJson<{ key: string }>(sealed, previous).key).toBe('next-key');
  expect(() => openJson(sealed, next)).toThrow();
});

test('a recovery code wraps the device key for a new phone', () => {
  const device = randomKey();
  const wrapped = wrapKey(device, 'cedar-otter-42');
  expect(keyToString(unwrapKey(wrapped, 'cedar-otter-42'))).toBe(keyToString(device));
  expect(() => unwrapKey(wrapped, 'wrong-code')).toThrow();
});

test('the linked member does not keep gifts in the visible snapshot', () => {
  const snapshot = blank(1);
  snapshot.profile.uid = 'ada';
  snapshot.people = [{ ...person('p', 'Ada'), linkedUid: 'ada' }];
  snapshot.gifts = [{ id: 'g', personId: 'p', occasionId: 'o', year: 2026, title: 'Secret', priceCents: 1, purchasedOn: '2026-01-01', updatedAt: 1 }];
  snapshot.states = [{ id: 's', occasionId: 'o', personId: 'p', year: 2026, status: 'purchased', savedIdea: null, updatedAt: 1 }];
  snapshot.ideas = [{ id: 'i', personId: 'p', occasionKey: 'k', ideas: ['x'], source: 'on-device', salt: 0, generatedAt: 1, updatedAt: 1 }];
  expect(isHiddenFromViewer(snapshot.people[0], 'ada')).toBe(true);
  const stripped = stripSensitiveForViewer(snapshot);
  expect(stripped.gifts).toHaveLength(0);
  expect(stripped.states).toHaveLength(0);
  expect(stripped.ideas).toHaveLength(0);
  expect(pushKind('gifts', 'ada')).toBe('hidden');
  expect(pushKind('people', 'ada')).toBe('person');
});

test('reminders schedule the morning of the day and a week before', () => {
  const slots = planReminders({
    people: [person('a', 'Ada')],
    occasions: [occasion('bday', 'a', 'birthday', 12, 25)],
    now: new Date(2026, 11, 1, 8, 0, 0),
    enabled: true,
  });
  expect(slots.map(slot => slot.kind).sort()).toEqual(['day', 'week']);
  expect(planReminders({ people: [], occasions: [], now: new Date(), enabled: false })).toHaveLength(0);
});

test('a buyer or the owner can correct a gift, and an occasion can be removed without its gifts', () => {
  const snapshot = createGroup({
    snapshot: blank(1),
    groupId: 'g',
    ownerId: 'owner',
    displayName: 'Owner',
    groupName: 'Family',
    now: 1,
  });
  snapshot.people = [person('ada', 'Ada')];
  snapshot.occasions = [occasion('bday', 'ada', 'birthday', 5, 2)];
  snapshot.gifts = [{ id: 'g', personId: 'ada', occasionId: 'bday', year: 2026, title: 'Mug', priceCents: 100, purchasedOn: '2026-05-02', boughtBy: 'owner', updatedAt: 1 }];
  const edited = updateSharedGift({ snapshot, giftId: 'g', uid: 'owner', title: 'Cup', priceCents: 0, purchasedOn: '2026-05-02', now: 2 });
  expect(edited.ok).toBe(true);
  const removed = deleteSharedGift({ snapshot, giftId: 'g', uid: 'sam', now: 3 });
  expect(removed.ok).toBe(false);
  const gone = deleteOccasion(snapshot, 'bday', 4);
  expect(gone.ok).toBe(true);
  if (gone.ok) {
    expect(gone.snapshot.gifts[0].deleted).toBeUndefined();
    expect(gone.snapshot.occasions[0].deleted).toBe(true);
  }
  const bad = updateOccasionDate({ snapshot, occasionId: 'bday', month: 4, day: 31, now: 5 });
  expect(bad.ok).toBe(false);
});
