import { cleanCircleName, foldKeptEven, stripKeptEven } from './circles';
import { emptySnapshot, type AppSnapshot, type Circle, type GiftRecord, type IdeaCacheEntry, type Occasion, type OccasionState, type Person } from './types';
import { cleanRelationship } from './relationship';

export const BACKUP_VERSION = 1;

export type BackupFile = {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  currency: string;
  people: Person[];
  occasions: Occasion[];
  states: OccasionState[];
  gifts: GiftRecord[];
  ideas: IdeaCacheEntry[];
  feedback: AppSnapshot['feedback'];
  /** Omitted on backups exported before circles existed. */
  circles?: Circle[];
};

export type BackupFailure = 'json' | 'version' | 'shape';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringId(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 128 && !value.includes('/');
}

function peopleOk(value: unknown): value is Person[] {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every(item => {
    if (!isRecord(item) || !stringId(item.id) || typeof item.name !== 'string' || !item.name.trim()) {
      return false;
    }
    if (item.relationship != null && (typeof item.relationship !== 'string' || cleanRelationship(item.relationship) == null)) {
      return false;
    }
    if (item.circleId != null && !stringId(item.circleId)) {
      return false;
    }
    if (item.birthYear != null && (typeof item.birthYear !== 'number' || !Number.isInteger(item.birthYear) || item.birthYear < 1900 || item.birthYear > 2100)) {
      return false;
    }
    return true;
  });
}

function circlesOk(value: unknown): value is Circle[] {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every(item => (
    isRecord(item)
    && stringId(item.id)
    && typeof item.name === 'string'
    && cleanCircleName(item.name) != null
    && typeof item.createdAt === 'number'
  ));
}

function rowsOk(value: unknown, extra?: (item: Record<string, unknown>) => boolean): boolean {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every(item => isRecord(item) && stringId(item.id) && (!extra || extra(item)));
}

/** JSON backup of the list on this phone. Purchases of the app itself are not included. */
export function exportBackup(snapshot: AppSnapshot, now = new Date()): string {
  const file: BackupFile = {
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    currency: snapshot.profile.currency || 'USD',
    people: snapshot.people.filter(person => !person.deleted).map(person => {
      const next = stripKeptEven({ ...person });
      delete next.linkedUid;
      return next;
    }),
    occasions: snapshot.occasions.filter(item => !item.deleted),
    states: snapshot.states.filter(item => !item.deleted).map(state => {
      const next = { ...state };
      delete next.claimedBy;
      delete next.claimedAt;
      delete next.hiddenFrom;
      return next;
    }),
    gifts: snapshot.gifts.filter(item => !item.deleted).map(stripGift),
    ideas: snapshot.ideas.filter(item => !item.deleted).map(idea => {
      const next = { ...idea };
      delete next.hiddenFrom;
      return next;
    }),
    feedback: snapshot.feedback,
    circles: snapshot.circles ?? [],
  };
  return JSON.stringify(file);
}

export function parseBackup(text: string, now: number): { ok: true; snapshot: AppSnapshot } | { ok: false; reason: BackupFailure } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'json' };
  }
  if (!isRecord(parsed)) {
    return { ok: false, reason: 'shape' };
  }
  if (parsed.version !== BACKUP_VERSION) {
    return { ok: false, reason: 'version' };
  }
  if (!peopleOk(parsed.people)) {
    return { ok: false, reason: 'shape' };
  }
  if (!rowsOk(parsed.occasions, item => typeof item.personId === 'string')) {
    return { ok: false, reason: 'shape' };
  }
  if (!rowsOk(parsed.states, item => typeof item.personId === 'string')) {
    return { ok: false, reason: 'shape' };
  }
  if (!rowsOk(parsed.gifts, item => typeof item.personId === 'string' && typeof item.title === 'string')) {
    return { ok: false, reason: 'shape' };
  }
  if (!rowsOk(parsed.ideas, item => typeof item.personId === 'string')) {
    return { ok: false, reason: 'shape' };
  }
  if (!Array.isArray(parsed.feedback)) {
    return { ok: false, reason: 'shape' };
  }
  if ('circles' in parsed && !circlesOk(parsed.circles)) {
    return { ok: false, reason: 'shape' };
  }
  const currency = typeof parsed.currency === 'string' && /^[A-Z]{3}$/.test(parsed.currency) ? parsed.currency : 'USD';
  const base = emptySnapshot(now);
  const built: AppSnapshot = {
    ...base,
    profile: { ...base.profile, onboarded: true, currency, createdAt: now },
    people: parsed.people as Person[],
    occasions: parsed.occasions as Occasion[],
    states: (parsed.states as OccasionState[]).map(state => {
      const next = { ...state };
      delete next.claimedBy;
      delete next.claimedAt;
      return next;
    }),
    gifts: (parsed.gifts as GiftRecord[]).map(stripGift),
    ideas: parsed.ideas as IdeaCacheEntry[],
    feedback: parsed.feedback as AppSnapshot['feedback'],
    circles: 'circles' in parsed && circlesOk(parsed.circles) ? parsed.circles : [],
  };
  return { ok: true, snapshot: foldKeptEven(built, now) };
}

function stripGift(gift: GiftRecord): GiftRecord {
  const next = { ...gift };
  delete next.boughtBy;
  delete next.hiddenFrom;
  return next;
}

/** Drop leftover group cache. People, occasions, gifts, and ideas stay on the phone. */
export function migrateToLocal(snapshot: AppSnapshot): AppSnapshot {
  const gifts = snapshot.gifts.map(stripGift);
  (snapshot.privateGifts ?? []).forEach(gift => {
    if (gifts.some(item => item.id === gift.id)) {
      return;
    }
    gifts.push(stripGift({
      id: gift.id,
      personId: gift.personId,
      occasionId: gift.occasionId,
      year: gift.year,
      title: gift.title,
      priceCents: gift.priceCents,
      purchasedOn: gift.purchasedOn,
      updatedAt: gift.updatedAt,
      deleted: gift.deleted,
    }));
  });
  const currency = snapshot.profile.currency || snapshot.group?.currency;
  const base = emptySnapshot(snapshot.profile.createdAt || Date.now());
  const local: AppSnapshot = {
    ...base,
    profile: {
      ...base.profile,
      ...snapshot.profile,
      groupId: null,
      inviteId: null,
      pendingEmail: null,
      pendingVerificationId: null,
      ...(currency ? { currency } : {}),
    },
    people: snapshot.people.map(person => {
      const next = { ...person };
      delete next.linkedUid;
      return next;
    }),
    occasions: snapshot.occasions,
    states: snapshot.states.map(state => {
      const next = { ...state };
      delete next.claimedBy;
      delete next.claimedAt;
      delete next.hiddenFrom;
      return next;
    }),
    gifts,
    ideas: snapshot.ideas.map(idea => {
      const next = { ...idea };
      delete next.hiddenFrom;
      return next;
    }),
    feedback: snapshot.feedback,
    entitlementPaid: snapshot.entitlementPaid,
    circles: snapshot.circles ?? [],
  };
  return foldKeptEven(local, Date.now());
}

export type BackupSummary = {
  people: number;
  occasions: number;
  ideas: number;
  gifts: number;
  exportedAt: string;
};

/** Counts for the restore preview. Ideas are the suggestions, not the cache rows. */
export function summarizeBackup(text: string): { ok: true; summary: BackupSummary } | { ok: false; reason: BackupFailure } {
  const parsed = parseBackup(text, Date.now());
  if (!parsed.ok) {
    return parsed;
  }
  let exportedAt = '';
  try {
    const raw = JSON.parse(text) as { exportedAt?: unknown };
    exportedAt = typeof raw.exportedAt === 'string' ? raw.exportedAt : '';
  } catch {
    exportedAt = '';
  }
  return {
    ok: true,
    summary: {
      people: parsed.snapshot.people.filter(person => !person.deleted).length,
      occasions: parsed.snapshot.occasions.filter(item => !item.deleted).length,
      ideas: parsed.snapshot.ideas.filter(item => !item.deleted).reduce((sum, item) => sum + item.ideas.length, 0),
      gifts: parsed.snapshot.gifts.filter(item => !item.deleted).length,
      exportedAt,
    },
  };
}
