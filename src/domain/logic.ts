import { hashToUint } from '../crypto/crypto';
import {
  dirtyKey,
  type AppSnapshot,
  type FeedbackEntry,
  type GiftRecord,
  type GroupArchive,
  type GroupMeta,
  type GroupSummary,
  type Member,
  type Occasion,
  type OccasionState,
  type OccasionType,
  type Person,
  type RemoteRecord,
} from './types';

const ADJECTIVES = [
  'Bubbly', 'Cosmic', 'Dapper', 'Fuzzy', 'Jolly', 'Mighty', 'Nimble', 'Peppy',
  'Quirky', 'Sunny', 'Witty', 'Zesty', 'Brave', 'Calm', 'Dandy', 'Eager',
  'Fancy', 'Gentle', 'Happy', 'Jazzy', 'Kind', 'Lucky', 'Merry', 'Noble',
  'Plucky', 'Rapid', 'Silly', 'Tiny', 'Vivid', 'Wiggly',
];

const NOUNS = [
  'Aardvark', 'Badger', 'Cactus', 'Dolphin', 'Falcon', 'Gingerbread', 'Hedgehog',
  'Iguana', 'Jaguar', 'Kiwi', 'Lemur', 'Mongoose', 'Narwhal', 'Otter', 'Penguin',
  'Quokka', 'Raccoon', 'Sloth', 'Taco', 'Unicorn', 'Walrus', 'Yak', 'Biscuit',
  'Comet', 'Donut', 'Firefly', 'Gadget', 'Hazelnut', 'Jellybean', 'Muffin',
];

export function sillyName(seed: string): string {
  const hash = hashToUint(seed || 'gifteez');
  const adjective = ADJECTIVES[hash % ADJECTIVES.length];
  const noun = NOUNS[Math.floor(hash / ADJECTIVES.length) % NOUNS.length];
  return `${adjective} ${noun}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function nextOccurrence(month: number, day: number, today: Date): Date {
  const year = today.getFullYear();
  const todayStart = startOfDay(today).getTime();
  const thisYear = new Date(year, month - 1, day);
  if (thisYear.getTime() >= todayStart) {
    return thisYear;
  }
  return new Date(year + 1, month - 1, day);
}

export function occurrenceYear(occasion: Occasion, today: Date): number {
  return nextOccurrence(occasion.month, occasion.day, today).getFullYear();
}

export function stateId(occasionId: string, year: number): string {
  return `${occasionId}:${year}`;
}

export function statusFor(
  occasion: Occasion,
  states: OccasionState[],
  today: Date,
): OccasionState['status'] {
  const year = occurrenceYear(occasion, today);
  const state = states.find(item => item.id === stateId(occasion.id, year) && !item.deleted);
  return state?.status ?? 'not-started';
}

export function upcomingOccasion(
  personId: string,
  occasions: Occasion[],
  today: Date,
): { occasion: Occasion; date: Date } | null {
  const mine = occasions.filter(item => item.personId === personId && !item.deleted);
  let best: { occasion: Occasion; date: Date } | null = null;
  mine.forEach(occasion => {
    const date = nextOccurrence(occasion.month, occasion.day, today);
    if (!best || date.getTime() < best.date.getTime()) {
      best = { occasion, date };
    }
  });
  return best;
}

export function sortPeople(people: Person[], occasions: Occasion[], today: Date): Person[] {
  return people
    .filter(person => !person.deleted)
    .slice()
    .sort((a, b) => {
      const aNext = upcomingOccasion(a.id, occasions, today);
      const bNext = upcomingOccasion(b.id, occasions, today);
      if (aNext && bNext && aNext.date.getTime() !== bNext.date.getTime()) {
        return aNext.date.getTime() - bNext.date.getTime();
      }
      if (aNext && !bNext) {
        return -1;
      }
      if (!aNext && bNext) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });
}

export function yearSpentCents(personId: string, gifts: GiftRecord[], year: number): number {
  return gifts
    .filter(gift => !gift.deleted && gift.personId === personId && giftYear(gift) === year)
    .reduce((sum, gift) => sum + gift.priceCents, 0);
}

export function allTimeSpentCents(personId: string, gifts: GiftRecord[]): number {
  return gifts
    .filter(gift => !gift.deleted && gift.personId === personId)
    .reduce((sum, gift) => sum + gift.priceCents, 0);
}

export function giftYear(gift: GiftRecord): number {
  const match = /^(\d{4})/.exec(gift.purchasedOn);
  return match ? Number(match[1]) : new Date(gift.updatedAt).getFullYear();
}

export function remainingCents(budgetCents: number | null, spentCents: number): number | null {
  if (budgetCents == null) {
    return null;
  }
  return budgetCents - spentCents;
}

export type FairnessRow = {
  personId: string;
  name: string;
  giftCount: number;
  spentCents: number;
  yearSpentCents: number;
  budgetCents: number | null;
  remainingCents: number | null;
};

export function fairnessRows(snapshot: AppSnapshot, today: Date): FairnessRow[] {
  const year = today.getFullYear();
  return snapshot.people
    .filter(person => !person.deleted)
    .map(person => {
      const gifts = snapshot.gifts.filter(gift => gift.personId === person.id && !gift.deleted);
      const yearSpent = yearSpentCents(person.id, snapshot.gifts, year);
      return {
        personId: person.id,
        name: person.name,
        giftCount: gifts.length,
        spentCents: allTimeSpentCents(person.id, snapshot.gifts),
        yearSpentCents: yearSpent,
        budgetCents: person.budgetCents,
        remainingCents: remainingCents(person.budgetCents, yearSpent),
      };
    })
    .sort((a, b) => a.yearSpentCents - b.yearSpentCents || a.name.localeCompare(b.name));
}

export function activePeopleCount(snapshot: AppSnapshot): number {
  return snapshot.people.filter(person => !person.deleted).length;
}

/** True when the active list's owner is unlocked. A joiner's own purchase does not count. */
export function listOwnerEntitled(snapshot: AppSnapshot): boolean {
  const group = snapshot.group;
  if (!group) {
    return false;
  }
  if (group.entitled) {
    return true;
  }
  return Boolean(snapshot.entitlementPaid && snapshot.profile.uid && group.ownerId === snapshot.profile.uid);
}

export function accountUnlocked(snapshot: AppSnapshot): boolean {
  if (snapshot.entitlementPaid) {
    return true;
  }
  const uid = snapshot.profile.uid;
  if (!uid) {
    return false;
  }
  if (snapshot.group?.ownerId === uid && snapshot.group.entitled) {
    return true;
  }
  return Object.values(snapshot.archives ?? {}).some(archive => archive.group.ownerId === uid && archive.group.entitled);
}

export function canAddPerson(snapshot: AppSnapshot, freeLimit: number): boolean {
  if (listOwnerEntitled(snapshot)) {
    return true;
  }
  return activePeopleCount(snapshot) < freeLimit;
}

/** Free accounts start one list. Joined lists are not counted. */
export const FREE_OWNED_LIST_LIMIT = 1;

export function ownedGroupIds(snapshot: AppSnapshot, uid: string): string[] {
  if (!uid) {
    return [];
  }
  const ids = new Set<string>();
  if (snapshot.group?.ownerId === uid) {
    ids.add(snapshot.group.id);
  }
  for (const archive of Object.values(snapshot.archives ?? {})) {
    if (archive.group.ownerId === uid) {
      ids.add(archive.group.id);
    }
  }
  for (const item of snapshot.roster ?? []) {
    if (item.ownerId === uid) {
      ids.add(item.id);
    }
  }
  return [...ids];
}

export function canStartAnotherList(snapshot: AppSnapshot, uid: string): boolean {
  if (snapshot.entitlementPaid) {
    return true;
  }
  return ownedGroupIds(snapshot, uid).length < FREE_OWNED_LIST_LIMIT;
}

export function withAccountUnlock(snapshot: AppSnapshot, paid: boolean): AppSnapshot {
  if (!paid) {
    return { ...snapshot, entitlementPaid: false };
  }
  const uid = snapshot.profile.uid;
  const stamp = (group: GroupMeta): GroupMeta =>
    uid && group.ownerId === uid ? { ...group, entitled: true } : group;
  const archives: AppSnapshot['archives'] = {};
  for (const [id, archive] of Object.entries(snapshot.archives ?? {})) {
    archives[id] = { ...archive, group: stamp(archive.group) };
  }
  return {
    ...snapshot,
    entitlementPaid: true,
    group: snapshot.group ? stamp(snapshot.group) : snapshot.group,
    archives,
  };
}

/** Membership cap. Config `GROUP_MAX_MEMBERS` overrides this. Not the free gift-recipient limit. */
export const DEFAULT_GROUP_MAX_MEMBERS = 10;

export function groupHasRoom(memberCount: number, cap: number): boolean {
  return memberCount < cap;
}

export function memberIdsForGroup(snapshot: AppSnapshot, groupId: string): string[] | null {
  if (snapshot.group?.id === groupId) {
    return snapshot.group.memberIds;
  }
  const archived = snapshot.archives[groupId];
  return archived ? archived.group.memberIds : null;
}

export type Mutation<T> =
  | { ok: true; snapshot: AppSnapshot; value: T }
  | { ok: false; error: string };

function ok<T>(snapshot: AppSnapshot, value: T): Mutation<T> {
  return { ok: true, snapshot, value };
}

function fail<T>(error: string): Mutation<T> {
  return { ok: false, error };
}

export function withProfile(snapshot: AppSnapshot, patch: Partial<AppSnapshot['profile']>): AppSnapshot {
  return { ...snapshot, profile: { ...snapshot.profile, ...patch } };
}

const GROUP_EMOJIS = ['🎁', '🎀', '🌟', '🎄', '🍂', '🎂', '💐', '🧸'];
const GROUP_COLORS = ['#1F6B4A', '#C4622D', '#1E4D6B', '#8E4A8A', '#9C3B2E', '#2F6F62', '#A37B2C', '#3E5C8A'];

export function groupMarker(groupId: string): { emoji: string; color: string } {
  const index = hashToUint(groupId || 'gifteez') % GROUP_EMOJIS.length;
  return { emoji: GROUP_EMOJIS[index], color: GROUP_COLORS[index] };
}

export function memberNames(members: Member[]): string[] {
  return members
    .filter(member => !member.deleted && member.displayName.trim())
    .map(member => member.displayName.trim());
}

export function groupDisplayName(name: string, names: string[], max = 28): string {
  const custom = name.trim();
  if (custom) {
    return clipLabel(custom, max);
  }
  const first = names.map(entry => entry.split(/\s+/)[0] ?? '').filter(Boolean);
  if (first.length === 0) {
    return 'Gifteez';
  }
  return joinMemberNames(first, max);
}

function clipLabel(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

function joinMemberNames(names: string[], max: number): string {
  const cap = Math.min(3, names.length);
  for (let count = cap; count > 1; count -= 1) {
    const text = formatMemberNames(names.slice(0, count), names.length - count);
    if (text.length <= max) {
      return text;
    }
  }
  const extra = names.length - 1;
  const head = clipLabel(names[0], extra > 0 ? max - 3 : max);
  return extra > 0 ? `${head} +${extra}` : head;
}

function formatMemberNames(shown: string[], extra: number): string {
  const body = shown.length === 1
    ? shown[0]
    : shown.length === 2
      ? `${shown[0]} & ${shown[1]}`
      : `${shown.slice(0, -1).join(', ')} & ${shown[shown.length - 1]}`;
  return extra > 0 ? `${body} +${extra}` : body;
}

export function captureArchive(snapshot: AppSnapshot): GroupArchive | null {
  if (!snapshot.group) {
    return null;
  }
  return {
    group: { ...snapshot.group, memberIds: [...snapshot.group.memberIds] },
    members: snapshot.members.map(item => ({ ...item })),
    people: snapshot.people.map(item => ({ ...item })),
    occasions: snapshot.occasions.map(item => ({ ...item })),
    states: snapshot.states.map(item => ({ ...item })),
    gifts: snapshot.gifts.map(item => ({ ...item })),
    ideas: snapshot.ideas.map(item => ({ ...item })),
    dirty: { ...snapshot.dirty },
    inviteId: snapshot.profile.inviteId,
  };
}

function summaryOf(snapshot: AppSnapshot): GroupSummary | null {
  if (!snapshot.group) {
    return null;
  }
  return {
    id: snapshot.group.id,
    name: snapshot.group.name,
    ownerId: snapshot.group.ownerId,
    memberIds: [...snapshot.group.memberIds],
    memberNames: memberNames(snapshot.members),
    updatedAt: snapshot.group.updatedAt,
  };
}

function upsertSummary(roster: GroupSummary[], summary: GroupSummary) {
  const index = roster.findIndex(item => item.id === summary.id);
  if (index < 0) {
    return [...roster, summary];
  }
  const next = roster.slice();
  next[index] = summary;
  return next;
}

export function parkActive(snapshot: AppSnapshot): AppSnapshot {
  const archive = captureArchive(snapshot);
  const summary = summaryOf(snapshot);
  if (!archive || !summary) {
    return snapshot;
  }
  return {
    ...snapshot,
    roster: upsertSummary(snapshot.roster ?? [], summary),
    archives: { ...(snapshot.archives ?? {}), [summary.id]: archive },
  };
}

export function switchGroup(snapshot: AppSnapshot, groupId: string): AppSnapshot | null {
  if (snapshot.group?.id === groupId) {
    return snapshot;
  }
  const parked = parkActive(snapshot);
  const archive = parked.archives[groupId];
  if (!archive) {
    return null;
  }
  return {
    ...parked,
    group: archive.group,
    members: archive.members,
    people: archive.people,
    occasions: archive.occasions,
    states: archive.states,
    gifts: archive.gifts,
    ideas: archive.ideas,
    dirty: archive.dirty,
    profile: {
      ...parked.profile,
      groupId: archive.group.id,
      inviteId: archive.inviteId,
      onboarded: true,
    },
  };
}

export function leaveActiveGroup(snapshot: AppSnapshot): AppSnapshot {
  if (!snapshot.group) {
    return snapshot;
  }
  const leaving = snapshot.group.id;
  const parked = parkActive(snapshot);
  const archives = { ...parked.archives };
  delete archives[leaving];
  const roster = parked.roster.filter(item => item.id !== leaving);
  const cleared: AppSnapshot = {
    ...parked,
    archives,
    roster,
    group: null,
    members: [],
    people: [],
    occasions: [],
    states: [],
    gifts: [],
    ideas: [],
    dirty: {},
    profile: {
      ...parked.profile,
      groupId: null,
      inviteId: null,
      onboarded: false,
    },
  };
  const nextId = roster[0]?.id;
  if (!nextId || !archives[nextId]) {
    return cleared;
  }
  return switchGroup(cleared, nextId) ?? cleared;
}

export function createGroup(input: {
  snapshot: AppSnapshot;
  groupId: string;
  ownerId: string;
  displayName: string;
  groupName: string;
  inviteId?: string | null;
  now: number;
}): AppSnapshot {
  const parked = parkActive(input.snapshot);
  const group: GroupMeta = {
    id: input.groupId,
    name: input.groupName.trim(),
    ownerId: input.ownerId,
    memberIds: [input.ownerId],
    peopleCount: 0,
    entitled: input.snapshot.entitlementPaid,
    updatedAt: input.now,
  };
  const member: Member = {
    id: input.ownerId,
    uid: input.ownerId,
    displayName: input.displayName,
    updatedAt: input.now,
  };
  return {
    ...parked,
    profile: {
      ...parked.profile,
      uid: input.ownerId,
      displayName: input.displayName,
      nameLocked: true,
      onboarded: true,
      groupId: input.groupId,
      inviteId: input.inviteId ?? null,
    },
    group,
    members: [member],
    people: [],
    occasions: [],
    states: [],
    gifts: [],
    ideas: [],
    dirty: {
      'group:meta': true,
      [dirtyKey('members', input.ownerId)]: true,
    },
  };
}

export function addPerson(input: {
  snapshot: AppSnapshot;
  person: Person;
  freeLimit: number;
}): Mutation<Person> {
  if (!canAddPerson(input.snapshot, input.freeLimit)) {
    return fail('cap');
  }
  const peopleCount = activePeopleCount(input.snapshot) + 1;
  const group = input.snapshot.group
    ? {
        ...input.snapshot.group,
        peopleCount,
        updatedAt: input.person.updatedAt,
      }
    : null;
  return ok(
    {
      ...input.snapshot,
      people: [...input.snapshot.people, input.person],
      group,
      dirty: {
        ...input.snapshot.dirty,
        [dirtyKey('people', input.person.id)]: true,
        ...(group ? { 'group:meta': true } : {}),
      },
    },
    input.person,
  );
}

export function updatePerson(
  snapshot: AppSnapshot,
  personId: string,
  patch: Partial<Pick<Person, 'name' | 'budgetCents' | 'tags' | 'opened' | 'deleted'>>,
  now: number,
): Mutation<Person> {
  const current = snapshot.people.find(person => person.id === personId);
  if (!current) {
    return fail('missing');
  }
  const next: Person = { ...current, ...patch, updatedAt: now };
  const removing = !current.deleted && next.deleted;
  const group =
    snapshot.group && removing
      ? {
          ...snapshot.group,
          peopleCount: Math.max(0, activePeopleCount(snapshot) - 1),
          updatedAt: now,
        }
      : snapshot.group;
  return ok(
    {
      ...snapshot,
      people: snapshot.people.map(person => (person.id === personId ? next : person)),
      group,
      dirty: {
        ...snapshot.dirty,
        [dirtyKey('people', personId)]: true,
        ...(removing ? { 'group:meta': true } : {}),
      },
    },
    next,
  );
}

export function addOccasion(snapshot: AppSnapshot, occasion: Occasion): AppSnapshot {
  return {
    ...snapshot,
    occasions: [...snapshot.occasions, occasion],
    dirty: { ...snapshot.dirty, [dirtyKey('occasions', occasion.id)]: true },
  };
}

export function saveIdea(input: {
  snapshot: AppSnapshot;
  occasion: Occasion;
  idea: string;
  today: Date;
  now: number;
}): AppSnapshot {
  const year = occurrenceYear(input.occasion, input.today);
  const id = stateId(input.occasion.id, year);
  const existing = input.snapshot.states.find(state => state.id === id);
  const next: OccasionState = {
    id,
    occasionId: input.occasion.id,
    personId: input.occasion.personId,
    year,
    status: 'idea-saved',
    savedIdea: input.idea,
    updatedAt: input.now,
  };
  const states = existing
    ? input.snapshot.states.map(state => (state.id === id ? next : state))
    : [...input.snapshot.states, next];
  return {
    ...input.snapshot,
    states,
    dirty: { ...input.snapshot.dirty, [dirtyKey('states', id)]: true },
  };
}

export function logPurchase(input: {
  snapshot: AppSnapshot;
  gift: GiftRecord;
  occasion: Occasion;
}): AppSnapshot {
  const id = stateId(input.occasion.id, input.gift.year);
  const existing = input.snapshot.states.find(state => state.id === id);
  const nextState: OccasionState = {
    id,
    occasionId: input.occasion.id,
    personId: input.occasion.personId,
    year: input.gift.year,
    status: 'purchased',
    savedIdea: existing?.savedIdea ?? input.gift.title,
    updatedAt: input.gift.updatedAt,
  };
  const states = existing
    ? input.snapshot.states.map(state => (state.id === id ? nextState : state))
    : [...input.snapshot.states, nextState];
  return {
    ...input.snapshot,
    gifts: [...input.snapshot.gifts, input.gift],
    states,
    dirty: {
      ...input.snapshot.dirty,
      [dirtyKey('gifts', input.gift.id)]: true,
      [dirtyKey('states', id)]: true,
    },
  };
}

export function addFeedback(snapshot: AppSnapshot, entry: FeedbackEntry): AppSnapshot {
  const without = snapshot.feedback.filter(
    item => !(item.personId === entry.personId && item.idea === entry.idea),
  );
  return { ...snapshot, feedback: [...without, entry] };
}

export function upsertIdeas(snapshot: AppSnapshot, entry: AppSnapshot['ideas'][number]): AppSnapshot {
  const exists = snapshot.ideas.some(item => item.id === entry.id);
  const ideas = exists
    ? snapshot.ideas.map(item => (item.id === entry.id ? entry : item))
    : [...snapshot.ideas, entry];
  return {
    ...snapshot,
    ideas,
    dirty: { ...snapshot.dirty, [dirtyKey('ideas', entry.id)]: true },
  };
}

export function renameGroup(snapshot: AppSnapshot, name: string, now: number): AppSnapshot {
  if (!snapshot.group) {
    return snapshot;
  }
  return {
    ...snapshot,
    group: { ...snapshot.group, name, updatedAt: now },
    dirty: { ...snapshot.dirty, 'group:meta': true },
  };
}

export function leaveGroup(snapshot: AppSnapshot, uid: string, now: number): AppSnapshot {
  if (!snapshot.group) {
    return snapshot;
  }
  const memberIds = snapshot.group.memberIds.filter(id => id !== uid);
  return {
    ...snapshot,
    profile: {
      ...snapshot.profile,
      onboarded: false,
      groupId: null,
    },
    group: { ...snapshot.group, memberIds, updatedAt: now },
    dirty: { ...snapshot.dirty, 'group:meta': true },
  };
}

export function removeMember(snapshot: AppSnapshot, uid: string, now: number): Mutation<null> {
  if (!snapshot.group || snapshot.group.ownerId !== snapshot.profile.uid) {
    return fail('forbidden');
  }
  if (uid === snapshot.group.ownerId) {
    return fail('owner');
  }
  return ok(
    {
      ...snapshot,
      group: {
        ...snapshot.group,
        memberIds: snapshot.group.memberIds.filter(id => id !== uid),
        updatedAt: now,
      },
      members: snapshot.members.map(member =>
        member.uid === uid ? { ...member, deleted: true, updatedAt: now } : member,
      ),
      dirty: {
        ...snapshot.dirty,
        'group:meta': true,
        [dirtyKey('members', uid)]: true,
      },
    },
    null,
  );
}

export function mergeRemote(
  local: AppSnapshot,
  remote: RemoteRecord[],
): { snapshot: AppSnapshot; updatedFromOtherDevice: boolean } {
  let snapshot = local;
  let updatedFromOtherDevice = false;
  remote.forEach(record => {
    const key = dirtyKey(record.collection, record.id);
    const current = readRecord(snapshot, record.collection, record.id);
    if (current && current.updatedAt > record.updatedAt) {
      return;
    }
    if (current && current.updatedAt < record.updatedAt) {
      updatedFromOtherDevice = true;
    }
    snapshot = writeRecord(snapshot, record);
    if (snapshot.dirty[key]) {
      const dirty = { ...snapshot.dirty };
      delete dirty[key];
      snapshot = { ...snapshot, dirty };
    }
  });
  return { snapshot, updatedFromOtherDevice };
}

export function applyGroupRemote(
  local: AppSnapshot,
  remote: GroupMeta,
): { snapshot: AppSnapshot; updatedFromOtherDevice: boolean } {
  if (!local.group) {
    return {
      snapshot: { ...local, group: remote, entitlementPaid: local.entitlementPaid },
      updatedFromOtherDevice: false,
    };
  }
  if (local.dirty['group:meta'] && local.group.updatedAt > remote.updatedAt) {
    return { snapshot: local, updatedFromOtherDevice: false };
  }
  const changed = local.group.updatedAt < remote.updatedAt;
  const dirty = { ...local.dirty };
  if (!local.dirty['group:meta'] || remote.updatedAt >= local.group.updatedAt) {
    delete dirty['group:meta'];
  }
  return {
    snapshot: {
      ...local,
      group: remote,
      entitlementPaid: local.entitlementPaid,
      dirty,
    },
    updatedFromOtherDevice: changed,
  };
}

type Timed = { id: string; updatedAt: number };

function readRecord(
  snapshot: AppSnapshot,
  collection: RemoteRecord['collection'],
  id: string,
): Timed | undefined {
  const list = collectionList(snapshot, collection);
  return list.find(item => item.id === id);
}

function writeRecord(snapshot: AppSnapshot, record: RemoteRecord): AppSnapshot {
  const data = { ...record.data, id: record.id, updatedAt: record.updatedAt, deleted: record.deleted };
  switch (record.collection) {
    case 'people':
      return replace(snapshot, 'people', data as Person);
    case 'occasions':
      return replace(snapshot, 'occasions', data as Occasion);
    case 'states':
      return replace(snapshot, 'states', data as OccasionState);
    case 'gifts':
      return replace(snapshot, 'gifts', data as GiftRecord);
    case 'ideas':
      return replace(snapshot, 'ideas', data as AppSnapshot['ideas'][number]);
    case 'members':
      return replace(snapshot, 'members', {
        id: record.id,
        uid: String(record.data.uid ?? record.id),
        displayName: String(record.data.displayName ?? ''),
        updatedAt: record.updatedAt,
        deleted: record.deleted,
      });
    default:
      return snapshot;
  }
}

function collectionList(snapshot: AppSnapshot, collection: RemoteRecord['collection']): Timed[] {
  switch (collection) {
    case 'people':
      return snapshot.people;
    case 'occasions':
      return snapshot.occasions;
    case 'states':
      return snapshot.states;
    case 'gifts':
      return snapshot.gifts;
    case 'ideas':
      return snapshot.ideas;
    case 'members':
      return snapshot.members;
    default:
      return [];
  }
}

function replace<K extends 'people' | 'occasions' | 'states' | 'gifts' | 'ideas' | 'members'>(
  snapshot: AppSnapshot,
  key: K,
  item: AppSnapshot[K][number],
): AppSnapshot {
  const list = snapshot[key] as Array<{ id: string }>;
  const exists = list.some(entry => entry.id === item.id);
  const next = exists
    ? list.map(entry => (entry.id === item.id ? item : entry))
    : [...list, item];
  return { ...snapshot, [key]: next };
}

export function defaultOccasionDate(type: OccasionType, today: Date): { month: number; day: number } {
  if (type === 'christmas') {
    return { month: 12, day: 25 };
  }
  return { month: today.getMonth() + 1, day: today.getDate() };
}

export function bannerDue(profile: AppSnapshot['profile'], now: number, afterDays: number): boolean {
  if (profile.upgraded || profile.upgradeBannerDismissed || !profile.onboarded) {
    return false;
  }
  const elapsed = now - profile.createdAt;
  return elapsed >= afterDays * 24 * 60 * 60 * 1000;
}

export type ImportedPerson = {
  name: string;
  budgetCents: number | null;
  month?: number;
  day?: number;
  tags: string[];
};

export function parseImport(text: string): ImportedPerson[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return parseJsonImport(trimmed);
  }
  const lines = trimmed.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) {
    return [];
  }
  const header = splitCsvLine(lines[0]).map(cell => cell.trim().toLowerCase());
  if (header.some(cell => /name|recipient|person/.test(cell))) {
    return lines.slice(1).map(line => rowToPerson(header, splitCsvLine(line))).filter(isPerson);
  }
  return lines
    .map(line => line.trim())
    .filter(Boolean)
    .map(name => ({ name, budgetCents: null, tags: [] }));
}

function parseJsonImport(text: string): ImportedPerson[] {
  const parsed = JSON.parse(text) as unknown;
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  return rows
    .map((row): ImportedPerson | null => {
      if (!row || typeof row !== 'object') {
        return null;
      }
      const record = row as Record<string, unknown>;
      const name = stringField(record, ['name', 'recipient', 'person']);
      if (!name) {
        return null;
      }
      const birthday = stringField(record, ['birthday', 'birthdate', 'date']);
      const date = birthday ? parseLooseDate(birthday) : undefined;
      const tagsValue = record.tags ?? record.interests ?? record.notes;
      return importedPerson({
        name,
        budgetCents: parseBudget(record.budget ?? record.amount ?? record.price),
        month: date?.month,
        day: date?.day,
        tags: parseTags(tagsValue),
      });
    })
    .filter(isPerson);
}

function rowToPerson(header: string[], cells: string[]): ImportedPerson | null {
  const record: Record<string, string> = {};
  header.forEach((key, index) => {
    record[key] = cells[index] ?? '';
  });
  const name = stringField(record, ['name', 'recipient', 'person', 'recipient name']);
  if (!name) {
    return null;
  }
  const birthday = stringField(record, ['birthday', 'birthdate', 'date', 'occasion']);
  const date = birthday ? parseLooseDate(birthday) : undefined;
  return importedPerson({
    name,
    budgetCents: parseBudget(stringField(record, ['budget', 'amount', 'price', 'spent'])),
    month: date?.month,
    day: date?.day,
    tags: parseTags(stringField(record, ['tags', 'interests', 'notes', 'hobbies'])),
  });
}

function importedPerson(input: {
  name: string;
  budgetCents: number | null;
  month?: number;
  day?: number;
  tags: string[];
}): ImportedPerson {
  const person: ImportedPerson = {
    name: input.name,
    budgetCents: input.budgetCents,
    tags: input.tags,
  };
  if (input.month != null) {
    person.month = input.month;
  }
  if (input.day != null) {
    person.day = input.day;
  }
  return person;
}

function isPerson(value: ImportedPerson | null): value is ImportedPerson {
  return Boolean(value && value.name.trim());
}

function stringField(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }
  return '';
}

export function parseBudget(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100);
  }
  if (typeof value !== 'string') {
    return null;
  }
  const match = value.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!match) {
    return null;
  }
  return Math.round(Number(match[0]) * 100);
}

export function parseLooseDate(value: string): { month: number; day: number } | undefined {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value.trim());
  if (iso) {
    return { month: Number(iso[2]), day: Number(iso[3]) };
  }
  const slash = /^(\d{1,2})[/-](\d{1,2})/.exec(value.trim());
  if (slash) {
    return { month: Number(slash[1]), day: Number(slash[2]) };
  }
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const named = /([a-z]{3,})[a-z]*\s+(\d{1,2})/i.exec(value.trim());
  if (named) {
    const month = months.indexOf(named[1].slice(0, 3).toLowerCase()) + 1;
    if (month > 0) {
      return { month, day: Number(named[2]) };
    }
  }
  return undefined;
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }
  return value
    .split(/[,;|/]/)
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

export function birthdayNameFromTitle(title: string): string | null {
  const cleaned = title.trim();
  if (!cleaned) {
    return null;
  }
  const patterns = [
    /^(.*?)['’]s birthday$/i,
    /^birthday[:\s-]+(.+)$/i,
    /^(.+?) birthday$/i,
    /^birthday of (.+)$/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(cleaned);
    if (match?.[1]) {
      const name = match[1].trim();
      if (name && !/^birthday$/i.test(name)) {
        return name;
      }
    }
  }
  return null;
}

export function phoneAllowed(phone: string, regions: string[]): boolean {
  const digits = phone.replace(/[^\d+]/g, '');
  const normalized = digits.startsWith('+') ? digits : `+${digits}`;
  if (regions.includes('US') && /^\+1\d{10}$/.test(normalized)) {
    return true;
  }
  return false;
}

export function exportList(snapshot: AppSnapshot, today: Date, formatMoney: (cents: number) => string): string {
  const lines = [groupDisplayName(snapshot.group?.name ?? '', memberNames(snapshot.members))];
  sortPeople(snapshot.people, snapshot.occasions, today).forEach(person => {
    const next = upcomingOccasion(person.id, snapshot.occasions, today);
    const spent = yearSpentCents(person.id, snapshot.gifts, today.getFullYear());
    const budget = person.budgetCents == null ? 'no budget' : formatMoney(person.budgetCents);
    lines.push(`${person.name} — ${next ? next.occasion.type : 'no occasion'} — ${formatMoney(spent)} of ${budget}`);
    snapshot.gifts
      .filter(gift => gift.personId === person.id && !gift.deleted)
      .forEach(gift => {
        lines.push(`  ${gift.title} (${formatMoney(gift.priceCents)}) on ${gift.purchasedOn}`);
      });
  });
  return lines.join('\n');
}

export function normalizeUsPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  return phone.trim().startsWith('+') ? `+${digits}` : `+${digits}`;
}
