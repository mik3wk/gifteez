import { performJoin } from '../src/domain/joinFlow';
import { emptySnapshot, type Occasion, type Person } from '../src/domain/types';
import {
  bannerDue,
  birthdayNameFromTitle,
  applyGroupRemote,
  canAddPerson,
  canStartAnotherList,
  createGroup,
  fairnessRows,
  DEFAULT_GROUP_MAX_MEMBERS,
  groupDisplayName,
  groupHasRoom,
  memberIdsForGroup,
  groupMarker,
  leaveActiveGroup,
  listOwnerEntitled,
  memberNames,
  ownedGroupIds,
  mergeRemote,
  nextOccurrence,
  parseImport,
  parseLooseDate,
  phoneAllowed,
  sillyName,
  sortPeople,
  statusFor,
  switchGroup,
  withAccountUnlock,
  yearSpentCents,
} from '../src/domain/logic';
import { suggestIdeas } from '../src/domain/ideas';
import { colorsFor, parseSkin, skinForDate } from '../src/theme/skins';
import { buildInviteUrl, keyToString, openJson, parseLink, randomKey, sealJson, unwrapKey, wrapKey } from '../src/crypto/crypto';
import { formatDate, formatMoney, t } from '../src/i18n';
import { canRefresh, emptyUsage, nextUsage } from '../functions/src/caps';
import { decidePersonWrite } from '../functions/src/peopleCap';

test('encrypts user content so the payload is not the plaintext', () => {
  const key = randomKey();
  const sealed = sealJson({ name: 'Ada' }, key);
  expect(sealed.includes('Ada')).toBe(false);
  expect(openJson<{ name: string }>(sealed, key).name).toBe('Ada');
});

test('keeps the group key in the invite fragment', () => {
  const key = 'abc_def';
  const url = buildInviteUrl({ domain: 'gifteez.app', groupId: 'g1', inviteId: 'i1', groupKey: key });
  expect(url.startsWith('https://gifteez.app/join/g1?i=i1#k=')).toBe(true);
  expect(url.split('?')[0]).not.toContain(key);
  const parsed = parseLink(url);
  expect(parsed).toEqual({ kind: 'invite', groupId: 'g1', inviteId: 'i1', groupKey: key });
});

test('round-trips a recovery wrap', () => {
  const key = randomKey();
  const code = 'river maple honey otter pine';
  const wrapped = wrapKey(key, code);
  expect(Array.from(unwrapKey(wrapped, code))).toEqual(Array.from(key));
  expect(() => unwrapKey(wrapped, 'wrong code here now')).toThrow();
});

test('silly names are stable', () => {
  expect(sillyName('user-1')).toBe(sillyName('user-1'));
  expect(sillyName('user-1')).not.toBe(sillyName('user-2'));
});

test('sorts people by the next occasion and resets status each year', () => {
  const today = new Date(2026, 9, 22);
  const soon = person('a', 'Ada');
  const later = person('b', 'Bea');
  const none = person('c', 'Cy');
  const adaBirthday = occasion('o1', 'a', 10, 25);
  const beaBirthday = occasion('o2', 'b', 11, 2);
  const ordered = sortPeople([later, none, soon], [beaBirthday, adaBirthday], today).map(item => item.name);
  expect(ordered).toEqual(['Ada', 'Bea', 'Cy']);
  const states = [{
    id: 'o1:2025',
    occasionId: 'o1',
    personId: 'a',
    year: 2025,
    status: 'purchased' as const,
    savedIdea: 'Scarf',
    updatedAt: 1,
  }];
  expect(statusFor(adaBirthday, states, today)).toBe('not-started');
  expect(nextOccurrence(12, 25, new Date(2026, 11, 26)).getFullYear()).toBe(2027);
});

test('counts this year toward the budget and compares fairness', () => {
  const snapshot = emptySnapshot(Date.now());
  snapshot.people = [person('a', 'Ada', 10000), person('b', 'Bea', 10000)];
  snapshot.gifts = [
    gift('g1', 'a', 4000, '2026-01-02'),
    gift('g2', 'a', 1000, '2025-01-02'),
    gift('g3', 'b', 1000, '2026-03-02'),
  ];
  expect(yearSpentCents('a', snapshot.gifts, 2026)).toBe(4000);
  const rows = fairnessRows(snapshot, new Date(2026, 5, 1));
  expect(rows.map(row => row.name)).toEqual(['Bea', 'Ada']);
  expect(rows[1].remainingCents).toBe(6000);
});

test('last write wins and notices a newer remote edit', () => {
  const local = emptySnapshot(1);
  local.people = [person('a', 'Ada')];
  local.people[0].updatedAt = 10;
  const older = mergeRemote(local, [{
    collection: 'people',
    id: 'a',
    updatedAt: 5,
    data: { name: 'Old' },
  }]);
  expect(older.snapshot.people[0].name).toBe('Ada');
  expect(older.updatedFromOtherDevice).toBe(false);
  const newer = mergeRemote(local, [{
    collection: 'people',
    id: 'a',
    updatedAt: 20,
    data: { name: 'Ada Remote', budgetCents: null, tags: [], imported: false, opened: true, createdAt: 1 },
  }]);
  expect(newer.snapshot.people[0].name).toBe('Ada Remote');
  expect(newer.updatedFromOtherDevice).toBe(true);
});

test('on-device ideas stay on device, follow tags, and skip thumbs down', () => {
  const first = suggestIdeas({
    personId: 'p',
    name: 'Ada',
    tags: ['coffee'],
    occasion: 'birthday',
    feedback: [],
    salt: 0,
  });
  const again = suggestIdeas({
    personId: 'p',
    name: 'Ada',
    tags: ['coffee'],
    occasion: 'birthday',
    feedback: [],
    salt: 0,
  });
  expect(again).toEqual(first);
  expect(first.some(idea => /coffee|beans|mug/i.test(idea))).toBe(true);
  const blocked = suggestIdeas({
    personId: 'p',
    name: 'Ada',
    tags: ['coffee'],
    occasion: 'birthday',
    feedback: [{ id: 'f', personId: 'p', idea: first[0], vote: 'down', createdAt: 1 }],
    salt: 0,
  });
  expect(blocked).not.toContain(first[0]);
});

test('free tier stops at five people unless this phone is unlocked', () => {
  const snapshot = createGroup({
    snapshot: emptySnapshot(1),
    groupId: 'g',
    ownerId: 'owner',
    displayName: 'Mike',
    groupName: '',
    now: 1,
  });
  snapshot.people = ['a', 'b', 'c', 'd', 'e'].map(id => person(id, id));
  expect(listOwnerEntitled(snapshot)).toBe(false);
  expect(canAddPerson(snapshot, 5)).toBe(false);
  const paidJoiner = {
    ...snapshot,
    entitlementPaid: true,
    profile: { ...snapshot.profile, uid: 'joiner' },
    group: snapshot.group && { ...snapshot.group, ownerId: 'owner', entitled: false },
  };
  expect(canAddPerson(paidJoiner, 5)).toBe(true);
  expect(canAddPerson({ ...snapshot, entitlementPaid: true }, 5)).toBe(true);
  expect(canAddPerson({
    ...snapshot,
    entitlementPaid: false,
    group: snapshot.group && { ...snapshot.group, entitled: true },
  }, 5)).toBe(false);
});

test('imports Santa-style CSV and Christmas Gift List JSON', () => {
  const csv = parseImport('Recipient,Budget,Birthday\nAda,$40,5/2\n');
  expect(csv[0]).toMatchObject({ name: 'Ada', budgetCents: 4000, month: 5, day: 2 });
  const json = parseImport('[{"name":"Bea","budget":25,"birthday":"1990-11-03","tags":["books"]}]');
  expect(json[0]).toMatchObject({ name: 'Bea', budgetCents: 2500, month: 11, day: 3, tags: ['books'] });
  expect(parseLooseDate('May 2')?.month).toBe(5);
  expect(birthdayNameFromTitle("Ada's birthday")).toBe('Ada');
});

test('banner waits 30 days and SMS stays in the US', () => {
  const profile = emptySnapshot(0).profile;
  profile.onboarded = true;
  profile.createdAt = Date.parse('2026-01-01T00:00:00Z');
  expect(bannerDue(profile, Date.parse('2026-01-20T00:00:00Z'), 30)).toBe(false);
  expect(bannerDue(profile, Date.parse('2026-02-15T00:00:00Z'), 30)).toBe(true);
  profile.upgraded = true;
  expect(bannerDue(profile, Date.parse('2026-04-01T00:00:00Z'), 30)).toBe(false);
  expect(phoneAllowed('+14155550100', ['US'])).toBe(true);
  expect(phoneAllowed('+447700900123', ['US'])).toBe(false);
});

test('skins follow the date and fall back when a download is missing', () => {
  expect(skinForDate(new Date(2026, 9, 22))).toBe('fall');
  expect(skinForDate(new Date(2026, 11, 20))).toBe('winter');
  expect(skinForDate(new Date(2026, 3, 10))).toBe('spring');
  expect(colorsFor('spring', {}).id).toBe('base');
  const spring = parseSkin(require('../skins/spring.json'));
  expect(colorsFor('spring', { spring: spring! }).id).toBe('spring');
});

test('strings and money come from resources', () => {
  expect(t('firstOpen.start')).toBe('See gift ideas');
  expect(t('people.budgetLeft', { used: '$1', budget: '$2' })).toContain('$1');
  expect(formatMoney(999, 'en-US')).toBe('$9.99');
  expect(formatDate(new Date(2026, 11, 25), 'en-US')).toContain('25');
});

test('server caps are per person and per device, not per anonymous uid', () => {
  const limits = { free: 5, paidPerMonth: 20 };
  const now = new Date('2026-10-22T00:00:00Z');
  let usage = emptyUsage();
  for (let i = 0; i < 5; i += 1) {
    expect(canRefresh({ usage, paid: false, now, limits, refresh: true, cacheHit: false }).ok).toBe(true);
    usage = nextUsage(usage, false, now);
  }
  expect(canRefresh({ usage, paid: false, now, limits, refresh: true, cacheHit: false }).ok).toBe(false);
  expect(canRefresh({ usage, paid: false, now, limits, refresh: false, cacheHit: true }).counted).toBe(false);
  expect(decidePersonWrite({
    entitled: false,
    people: ['a', 'b', 'c', 'd', 'e'].map((id, index) => ({ id, createdAt: index })),
    personId: 'f',
    createdAt: 6,
    deleted: false,
    limit: 5,
  }).ok).toBe(false);
});

test('names groups from members, and switching keeps the other list', () => {
  expect(groupDisplayName('', ['Mike', 'Sam', 'Jo'])).toBe('Mike, Sam & Jo');
  expect(groupDisplayName('', ['Mike', 'Sam', 'Jo', 'Ada'])).toBe('Mike, Sam & Jo +1');
  expect(groupDisplayName('Family', ['Mike', 'Sam'])).toBe('Family');
  expect(groupDisplayName('', [])).toBe('Gifteez');
  const ten = ['Mike', 'Sam', 'Jo', 'Ada', 'Bea', 'Cal', 'Dee', 'Eli', 'Fay', 'Gio'];
  expect(groupDisplayName('', ten)).toBe('Mike, Sam & Jo +7');
  expect(groupDisplayName('', ten).length).toBeLessThanOrEqual(28);
  expect(groupMarker('same').emoji).toBe(groupMarker('same').emoji);
  const first = createGroup({
    snapshot: emptySnapshot(1),
    groupId: 'g1',
    ownerId: 'u',
    displayName: 'Mike',
    groupName: '',
    now: 1,
  });
  first.people = [person('p', 'Ada')];
  const second = createGroup({
    snapshot: first,
    groupId: 'g2',
    ownerId: 'u',
    displayName: 'Mike',
    groupName: 'Holidays',
    now: 2,
  });
  expect(second.group?.name).toBe('Holidays');
  expect(second.people).toHaveLength(0);
  expect(second.archives.g1.people.map(item => item.name)).toEqual(['Ada']);
  const back = switchGroup(second, 'g1');
  expect(back?.group?.id).toBe('g1');
  expect(back?.people.map(item => item.name)).toEqual(['Ada']);
  expect(groupDisplayName(back?.group?.name ?? '', memberNames(back?.members ?? []))).toBe('Mike');
  expect(second.group?.name.includes('Holidays')).toBe(true);
  expect(JSON.stringify(second.group).includes('Holidays')).toBe(true);
});

test('a group has room for 9 members, not 10 or 11', () => {
  expect(DEFAULT_GROUP_MAX_MEMBERS).toBe(10);
  expect(groupHasRoom(9, DEFAULT_GROUP_MAX_MEMBERS)).toBe(true);
  expect(groupHasRoom(10, DEFAULT_GROUP_MAX_MEMBERS)).toBe(false);
  expect(groupHasRoom(11, DEFAULT_GROUP_MAX_MEMBERS)).toBe(false);
  expect(t('errors.full', { count: DEFAULT_GROUP_MAX_MEMBERS })).toBe(
    'This list already has 10 members, the most a list can have.',
  );
  const snapshot = createGroup({
    snapshot: emptySnapshot(1),
    groupId: 'g',
    ownerId: 'owner',
    displayName: 'Mike',
    groupName: '',
    now: 1,
  });
  snapshot.group = snapshot.group && {
    ...snapshot.group,
    memberIds: Array.from({ length: 10 }, (_, index) => `m${index}`),
  };
  expect(memberIdsForGroup(snapshot, 'g')).toHaveLength(10);
  expect(groupHasRoom(memberIdsForGroup(snapshot, 'g')?.length ?? 0, DEFAULT_GROUP_MAX_MEMBERS)).toBe(false);
  const withPeople = {
    ...snapshot,
    people: Array.from({ length: 5 }, (_, index) => person(`p${index}`, `Person ${index}`)),
  };
  expect(canAddPerson(withPeople, 5)).toBe(false);
  expect(canAddPerson({ ...withPeople, entitlementPaid: true }, 5)).toBe(true);
  expect(canAddPerson({
    ...withPeople,
    entitlementPaid: true,
    profile: { ...withPeople.profile, uid: 'joiner' },
  }, 5)).toBe(true);
});

test('a free account starts one list, paying starts another, and joining does not count', () => {
  const first = createGroup({
    snapshot: emptySnapshot(1),
    groupId: 'g1',
    ownerId: 'me',
    displayName: 'Mike',
    groupName: '',
    now: 1,
  });
  expect(canStartAnotherList(first, 'me')).toBe(false);
  expect(ownedGroupIds(first, 'me')).toEqual(['g1']);
  expect(canStartAnotherList({ ...first, entitlementPaid: true }, 'me')).toBe(true);
  const left = leaveActiveGroup(first);
  expect(ownedGroupIds(left, 'me')).toEqual([]);
  expect(canStartAnotherList(left, 'me')).toBe(true);
  const joined = createGroup({
    snapshot: emptySnapshot(1),
    groupId: 'theirs',
    ownerId: 'friend',
    displayName: 'Sam',
    groupName: '',
    now: 1,
  });
  joined.profile = { ...joined.profile, uid: 'me' };
  expect(canStartAnotherList(joined, 'me')).toBe(true);
  expect(ownedGroupIds(joined, 'me')).toEqual([]);
  const remoteGroup = first.group;
  if (!remoteGroup) {
    throw new Error('missing group');
  }
  const remote = applyGroupRemote(first, {
    ...remoteGroup,
    entitled: true,
    ownerId: 'friend',
    updatedAt: 9,
  });
  expect(remote.snapshot.entitlementPaid).toBe(false);
  expect(remote.snapshot.group?.entitled).toBe(true);
  const unlocked = withAccountUnlock(first, true);
  expect(unlocked.group?.entitled).toBe(true);
  const second = createGroup({
    snapshot: first,
    groupId: 'g2',
    ownerId: 'friend',
    displayName: 'Sam',
    groupName: 'Theirs',
    now: 2,
  });
  second.profile = { ...second.profile, uid: 'me' };
  if (second.group) {
    second.group = { ...second.group, ownerId: 'friend', entitled: false };
  }
  const stamped = withAccountUnlock(second, true);
  expect(stamped.group?.entitled).toBe(false);
  expect(stamped.archives.g1.group.entitled).toBe(true);
  expect(t('errors.oneList')).toBe('Unlock to add more people.');
});

test('a failed join does not save the key or add the group', async () => {
  const cases: Array<{ thrown: unknown; failure: 'full' | 'invalid' | 'offline' }> = [
    { thrown: codedError('full', 'functions/resource-exhausted'), failure: 'full' },
    { thrown: codedError('invite', 'functions/not-found'), failure: 'invalid' },
    { thrown: new Error('Network request failed'), failure: 'offline' },
  ];
  for (const item of cases) {
    const { url } = inviteUrl();
    const snapshot = emptySnapshot(1);
    const saveKey = jest.fn(async () => undefined);
    const deleteKey = jest.fn(async () => undefined);
    const joinGroup = jest.fn(async () => {
      throw item.thrown;
    });
    const result = await performJoin({
      url,
      snapshot,
      cap: 10,
      ensureUid: async () => 'joiner',
      joinGroup,
      saveKey,
      deleteKey,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure).toBe(item.failure);
      expect(result.snapshot).toBe(snapshot);
    }
    expect(joinGroup).toHaveBeenCalledTimes(1);
    expect(saveKey).not.toHaveBeenCalled();
    expect(deleteKey).not.toHaveBeenCalled();
    expect(snapshot.group).toBeNull();
    expect(snapshot.members).toEqual([]);
  }
  expect(t('join.failedInvalid')).toBe('That invite is invalid or has expired.');
  expect(t('join.failedOffline')).toContain('Try again');
  expect(t('errors.full', { count: 10 })).toContain('10 members');
});

test('a successful join saves the key only after the server confirms', async () => {
  const { url, groupKey } = inviteUrl();
  const snapshot = emptySnapshot(1);
  const saveKey = jest.fn(async () => undefined);
  const deleteKey = jest.fn(async () => undefined);
  const joinGroup = jest.fn(async () => undefined);
  const result = await performJoin({
    url,
    snapshot,
    cap: 10,
    ensureUid: async () => 'joiner',
    joinGroup,
    saveKey,
    deleteKey,
  });
  expect(joinGroup).toHaveBeenCalledWith('invite-1');
  expect(saveKey).toHaveBeenCalledTimes(1);
  expect(saveKey).toHaveBeenCalledWith('group-1', groupKey);
  expect(deleteKey).not.toHaveBeenCalled();
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.snapshot.group?.id).toBe('group-1');
    expect(result.snapshot.profile.onboarded).toBe(true);
    expect(result.snapshot.profile.groupId).toBe('group-1');
    expect(result.snapshot.members.map(member => member.uid)).toEqual(['joiner']);
  }
  expect(snapshot.group).toBeNull();
});

test('a key saved during a failed join attempt is deleted', async () => {
  const { url } = inviteUrl();
  const snapshot = emptySnapshot(1);
  const deleteKey = jest.fn(async () => undefined);
  const result = await performJoin({
    url,
    snapshot,
    cap: 10,
    ensureUid: async () => 'joiner',
    joinGroup: async () => undefined,
    saveKey: async () => {
      throw new Error('keychain');
    },
    deleteKey,
  });
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.failure).toBe('unknown');
    expect(result.snapshot).toBe(snapshot);
  }
  expect(deleteKey).toHaveBeenCalledWith('group-1');
  expect(snapshot.group).toBeNull();
});

function codedError(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

function inviteUrl(): { url: string; groupKey: string } {
  const groupKey = keyToString(randomKey());
  return { groupKey, url: `gifteez://join/group-1?i=invite-1#k=${groupKey}` };
}

function person(id: string, name: string, budgetCents: number | null = null): Person {
  return {
    id,
    name,
    budgetCents,
    tags: [],
    imported: false,
    opened: true,
    createdAt: 1,
    updatedAt: 1,
  };
}

function occasion(id: string, personId: string, month: number, day: number): Occasion {
  return { id, personId, type: 'birthday', month, day, updatedAt: 1 };
}

function gift(id: string, personId: string, priceCents: number, purchasedOn: string) {
  return {
    id,
    personId,
    occasionId: 'o',
    year: Number(purchasedOn.slice(0, 4)),
    title: 'Gift',
    priceCents,
    purchasedOn,
    updatedAt: 1,
  };
}
