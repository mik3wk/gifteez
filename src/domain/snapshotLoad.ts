import { migrateToLocal } from './backup';
import { emptySnapshot, type AppSnapshot, type Circle, type FeedbackEntry, type GiftRecord, type IdeaCacheEntry, type Occasion, type OccasionState, type Person, type PrivateGift, type Profile } from './types';

export type CacheLoadFailure = 'key' | 'decrypt' | 'parse' | 'validate';

/** A load failure with no payload. The message is only the stage name. */
export class CacheStageError extends Error {
  readonly stage: 'decrypt' | 'parse';

  constructor(stage: 'decrypt' | 'parse') {
    super(stage);
    this.stage = stage;
  }
}

export type CacheLoadResult =
  | { ok: true; snapshot: AppSnapshot }
  | { ok: false; reason: CacheLoadFailure; blob: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 128 && !value.includes('/');
}

/** Missing collection means none. A present non-array is a broken blob, not an empty list. */
function rowsOf<T>(value: unknown, map: (item: unknown) => T | null): T[] | null {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    return null;
  }
  return value.map(map).filter((item): item is T => item != null);
}

function normalizePerson(value: unknown): Person | null {
  if (!isRecord(value) || !stringId(value.id) || typeof value.name !== 'string' || !value.name.trim()) {
    return null;
  }
  const person: Person = {
    ...(value as unknown as Person),
    id: value.id,
    name: value.name.trim(),
    budgetCents: typeof value.budgetCents === 'number' && Number.isFinite(value.budgetCents) ? Math.round(value.budgetCents) : null,
    tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    imported: value.imported === true,
    opened: value.opened !== false,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : 0,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : 0,
  };
  if (person.birthYear != null && (typeof person.birthYear !== 'number' || !Number.isInteger(person.birthYear) || person.birthYear < 1900 || person.birthYear > 2100)) {
    delete person.birthYear;
  }
  if (person.circleId != null && !stringId(person.circleId)) {
    delete person.circleId;
  }
  if (typeof person.notes === 'string') {
    const notes = person.notes.trim().slice(0, 300);
    if (notes) {
      person.notes = notes;
    } else {
      delete person.notes;
    }
  }
  return person;
}

function normalizeOccasion(value: unknown): Occasion | null {
  if (!isRecord(value) || !stringId(value.id) || !stringId(value.personId)) {
    return null;
  }
  if (typeof value.month !== 'number' || typeof value.day !== 'number') {
    return null;
  }
  return {
    ...(value as unknown as Occasion),
    id: value.id,
    personId: value.personId,
    type: typeof value.type === 'string' && value.type ? value.type : 'custom',
    month: value.month,
    day: value.day,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : 0,
  };
}

function normalizeGift(value: unknown): GiftRecord | null {
  if (!isRecord(value) || !stringId(value.id) || !stringId(value.personId) || typeof value.title !== 'string' || !value.title.trim()) {
    return null;
  }
  return {
    ...(value as unknown as GiftRecord),
    id: value.id,
    personId: value.personId,
    occasionId: typeof value.occasionId === 'string' ? value.occasionId : '',
    year: typeof value.year === 'number' ? value.year : 0,
    title: value.title,
    priceCents: typeof value.priceCents === 'number' && Number.isFinite(value.priceCents) ? Math.round(value.priceCents) : 0,
    purchasedOn: typeof value.purchasedOn === 'string' ? value.purchasedOn : '',
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : 0,
  };
}

function normalizeCircle(value: unknown): Circle | null {
  if (!isRecord(value) || !stringId(value.id) || typeof value.name !== 'string' || !value.name.trim()) {
    return null;
  }
  return {
    id: value.id,
    name: value.name.trim(),
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : 0,
  };
}

function normalizeState(value: unknown): OccasionState | null {
  if (!isRecord(value) || !stringId(value.id) || !stringId(value.occasionId) || !stringId(value.personId)) {
    return null;
  }
  const status = value.status === 'idea-saved' || value.status === 'purchased' || value.status === 'not-started'
    ? value.status
    : 'not-started';
  return {
    ...(value as unknown as OccasionState),
    id: value.id,
    occasionId: value.occasionId,
    personId: value.personId,
    year: typeof value.year === 'number' ? value.year : 0,
    status,
    savedIdea: typeof value.savedIdea === 'string' ? value.savedIdea : null,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : 0,
  };
}

function normalizeIdea(value: unknown): IdeaCacheEntry | null {
  if (!isRecord(value) || !stringId(value.id) || !stringId(value.personId) || !Array.isArray(value.ideas)) {
    return null;
  }
  return {
    ...(value as unknown as IdeaCacheEntry),
    id: value.id,
    personId: value.personId,
    occasionKey: typeof value.occasionKey === 'string' ? value.occasionKey : 'general',
    ideas: value.ideas.filter(isRecord).map(idea => ({
      title: typeof idea.title === 'string' ? idea.title : '',
      priceMin: typeof idea.priceMin === 'number' ? idea.priceMin : 0,
      priceMax: typeof idea.priceMax === 'number' ? idea.priceMax : 0,
      reason: typeof idea.reason === 'string' ? idea.reason : '',
      searchQuery: typeof idea.searchQuery === 'string' ? idea.searchQuery : '',
    })),
    source: value.source === 'cloud' ? 'cloud' : 'on-device',
    salt: typeof value.salt === 'number' ? value.salt : 0,
    generatedAt: typeof value.generatedAt === 'number' ? value.generatedAt : 0,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : 0,
  };
}

function normalizeFeedback(value: unknown): FeedbackEntry | null {
  if (!isRecord(value) || !stringId(value.id) || !stringId(value.personId) || typeof value.idea !== 'string') {
    return null;
  }
  if (value.vote !== 'up' && value.vote !== 'down') {
    return null;
  }
  return {
    id: value.id,
    personId: value.personId,
    idea: value.idea,
    vote: value.vote,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : 0,
  };
}

function normalizePrivateGift(value: unknown): PrivateGift | null {
  if (!isRecord(value) || !stringId(value.id) || !stringId(value.personId) || typeof value.title !== 'string') {
    return null;
  }
  return {
    ...(value as unknown as PrivateGift),
    id: value.id,
    personId: value.personId,
    groupId: typeof value.groupId === 'string' ? value.groupId : '',
    occasionId: typeof value.occasionId === 'string' ? value.occasionId : '',
    year: typeof value.year === 'number' ? value.year : 0,
    title: value.title,
    priceCents: typeof value.priceCents === 'number' ? value.priceCents : 0,
    purchasedOn: typeof value.purchasedOn === 'string' ? value.purchasedOn : '',
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : 0,
  };
}

function normalizeProfile(value: unknown, base: Profile, hasPeople: boolean): Profile {
  const raw = isRecord(value) ? value : {};
  const reminders = raw.reminders === 'on' || raw.reminders === 'off' || raw.reminders === 'unset' ? raw.reminders : 'unset';
  const currency = typeof raw.currency === 'string' && /^[A-Z]{3}$/.test(raw.currency) ? raw.currency : undefined;
  const householdName = typeof raw.householdName === 'string' ? raw.householdName.trim().slice(0, 40) : '';
  const givenName = typeof raw.givenName === 'string' ? raw.givenName.trim().slice(0, 40) : '';
  return {
    ...base,
    uid: typeof raw.uid === 'string' ? raw.uid : null,
    displayName: typeof raw.displayName === 'string' ? raw.displayName : '',
    nameLocked: raw.nameLocked === true,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : base.createdAt,
    upgraded: raw.upgraded === true,
    upgradeBannerDismissed: raw.upgradeBannerDismissed === true,
    onboarded: raw.onboarded === true || hasPeople,
    groupId: null,
    pendingEmail: null,
    pendingVerificationId: null,
    inviteId: null,
    reminders,
    ...(currency ? { currency } : {}),
    ...(householdName ? { householdName } : {}),
    ...(givenName ? { givenName } : {}),
  };
}

/**
 * Read an already-decrypted cache object. Missing optional fields get defaults.
 * Returns null when the blob is not a list, so the caller can keep the raw bytes.
 */
export function normalizeStoredSnapshot(value: unknown, now: number): AppSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }
  const people = rowsOf(value.people, normalizePerson);
  const occasions = rowsOf(value.occasions, normalizeOccasion);
  const gifts = rowsOf(value.gifts, normalizeGift);
  const circles = rowsOf(value.circles, normalizeCircle);
  const states = rowsOf(value.states, normalizeState);
  const ideas = rowsOf(value.ideas, normalizeIdea);
  const feedback = rowsOf(value.feedback, normalizeFeedback);
  const privateGifts = rowsOf(value.privateGifts, normalizePrivateGift);
  if (!people || !occasions || !gifts || !circles || !states || !ideas || !feedback || !privateGifts) {
    return null;
  }
  const rawPeople = Array.isArray(value.people) ? value.people : [];
  if (rawPeople.length > 0 && people.length === 0) {
    return null;
  }
  const hasList = Array.isArray(value.people) || Array.isArray(value.occasions) || Array.isArray(value.gifts) || Array.isArray(value.circles);
  if (!hasList) {
    return null;
  }
  const base = emptySnapshot(now);
  const snapshot: AppSnapshot = {
    ...base,
    profile: normalizeProfile(value.profile, base.profile, people.length > 0),
    people,
    circles,
    occasions,
    states,
    gifts,
    privateGifts,
    feedback,
    ideas,
    entitlementPaid: value.entitlementPaid === true,
  };
  return migrateToLocal(snapshot);
}

/**
 * Decide what a stored blob means. A missing blob is a first launch.
 * A blob that cannot be opened stays a failure and is never turned into an empty list.
 */
export function decideCacheLoad(input: {
  blob: string | null;
  key: string | null;
  now: number;
  open: (blob: string, key: string) => unknown;
}): CacheLoadResult {
  if (!input.blob) {
    return { ok: true, snapshot: emptySnapshot(input.now) };
  }
  if (!input.key) {
    return { ok: false, reason: 'key', blob: input.blob };
  }
  try {
    const value = input.open(input.blob, input.key);
    const snapshot = normalizeStoredSnapshot(value, input.now);
    if (!snapshot) {
      return { ok: false, reason: 'validate', blob: input.blob };
    }
    return { ok: true, snapshot };
  } catch (caught) {
    const reason = caught instanceof CacheStageError ? caught.stage : 'decrypt';
    return { ok: false, reason, blob: input.blob };
  }
}

/**
 * A save that empties the list, or drops it below half, is refused.
 * One person removed from a longer list is small enough to keep.
 * An explicit delete or restore sets allowShrink.
 */
export function peopleShrinkBlocked(storedPeople: number, nextPeople: number, allowShrink: boolean): boolean {
  if (allowShrink || storedPeople <= 0 || nextPeople >= storedPeople) {
    return false;
  }
  if (nextPeople === 0) {
    return true;
  }
  return nextPeople * 2 < storedPeople;
}

/** No disk write until hydration has finished, and no empty overwrite of a real list. */
export function decideCommit(input: {
  hydrated: boolean;
  sealed: boolean;
  storedPeople: number;
  nextPeople: number;
  allowShrink?: boolean;
}): 'write' | 'hold' {
  if (input.sealed || !input.hydrated) {
    return 'hold';
  }
  if (peopleShrinkBlocked(input.storedPeople, input.nextPeople, input.allowShrink === true)) {
    return 'hold';
  }
  return 'write';
}
