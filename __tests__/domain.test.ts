import { emptySnapshot, type Occasion, type Person } from '../src/domain/types';
import {
  bannerDue,
  birthdayNameFromTitle,
  canAddPerson,
  createGroup,
  fairnessRows,
  groupDisplayName,
  groupMarker,
  memberNames,
  mergeRemote,
  nextOccurrence,
  parseImport,
  parseLooseDate,
  phoneAllowed,
  sillyName,
  sortPeople,
  statusFor,
  switchGroup,
  yearSpentCents,
} from '../src/domain/logic';
import { suggestIdeas } from '../src/domain/ideas';
import { colorsFor, parseSkin, skinForDate } from '../src/theme/skins';
import { buildInviteUrl, openJson, parseLink, randomKey, sealJson, unwrapKey, wrapKey } from '../src/crypto/crypto';
import { formatDate, formatMoney, t } from '../src/i18n';
import { canRefresh, claimSlot, emptyUsage, nextUsage } from '../functions/src/caps';

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

test('free tier stops at five people', () => {
  const snapshot = emptySnapshot(1);
  snapshot.people = ['a', 'b', 'c', 'd', 'e'].map(id => person(id, id));
  expect(canAddPerson(snapshot, 5)).toBe(false);
  snapshot.entitlementPaid = true;
  expect(canAddPerson(snapshot, 5)).toBe(true);
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
  expect(t('firstOpen.start')).toBe('Start');
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
  expect(claimSlot(5, false, 'add', 5).ok).toBe(false);
});

test('names groups from members, and switching keeps the other list', () => {
  expect(groupDisplayName('', ['Mike', 'Sam', 'Jo'])).toBe('Mike, Sam & Jo');
  expect(groupDisplayName('', ['Mike', 'Sam', 'Jo', 'Ada'])).toBe('Mike, Sam & Jo +1');
  expect(groupDisplayName('Family', ['Mike', 'Sam'])).toBe('Family');
  expect(groupDisplayName('', [])).toBe('Gifteez');
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
