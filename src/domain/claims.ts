import { giftYear, occurrenceYear, stateId, type Mutation } from './logic';
import type { AppSnapshot, GiftRecord, Member, Occasion, OccasionState, PrivateGift } from './types';
import { dirtyKey } from './types';

function ok<T>(snapshot: AppSnapshot, value: T): Mutation<T> {
  return { ok: true, snapshot, value };
}

function fail<T>(error: string): Mutation<T> {
  return { ok: false, error };
}

export function claimerName(uid: string, members: Member[]): string {
  const member = members.find(item => item.uid === uid && !item.deleted);
  if (!member) {
    return '';
  }
  return member.displayName.trim() || uid;
}

function claimStillHeld(snapshot: AppSnapshot, claimedBy: string): boolean {
  if (snapshot.group && !snapshot.group.memberIds.includes(claimedBy)) {
    return false;
  }
  const member = snapshot.members.find(item => item.uid === claimedBy);
  if (member?.deleted) {
    return false;
  }
  return true;
}

export type BuyerLabel = { kind: 'none' } | { kind: 'you' } | { kind: 'name'; name: string };

export function buyerLabel(boughtBy: string | undefined, selfUid: string | null, members: Member[]): BuyerLabel {
  if (!boughtBy) {
    return { kind: 'none' };
  }
  if (selfUid && boughtBy === selfUid) {
    return { kind: 'you' };
  }
  return { kind: 'name', name: claimerName(boughtBy, members) };
}

/** Another member already claimed this state. The purchase is still allowed. */
export function otherClaim(state: OccasionState | undefined, uid: string | null): string | null {
  if (!state || state.deleted || !state.claimedBy) {
    return null;
  }
  if (uid && state.claimedBy === uid) {
    return null;
  }
  return state.claimedBy;
}

export function claimWarningUid(input: {
  states: OccasionState[];
  occasion: Occasion;
  purchaseYear: number;
  today: Date;
  uid: string | null;
}): string | null {
  const years = new Set<number>([input.purchaseYear, occurrenceYear(input.occasion, input.today)]);
  for (const year of years) {
    const state = input.states.find(item => item.id === stateId(input.occasion.id, year) && !item.deleted);
    const other = otherClaim(state, input.uid);
    if (other) {
      return other;
    }
  }
  return null;
}

export function claimOccasion(input: {
  snapshot: AppSnapshot;
  occasionId: string;
  uid: string;
  now: number;
  today: Date;
}): Mutation<OccasionState> {
  if (!input.uid) {
    return fail('auth');
  }
  const occasion = input.snapshot.occasions.find(item => item.id === input.occasionId && !item.deleted);
  if (!occasion) {
    return fail('missing');
  }
  const year = occurrenceYear(occasion, input.today);
  const id = stateId(occasion.id, year);
  const existing = input.snapshot.states.find(state => state.id === id && !state.deleted);
  if (existing?.claimedBy && existing.claimedBy !== input.uid && claimStillHeld(input.snapshot, existing.claimedBy)) {
    return fail('claimed');
  }
  if (existing?.claimedBy === input.uid) {
    return ok(input.snapshot, existing);
  }
  const next: OccasionState = existing
    ? { ...existing, claimedBy: input.uid, claimedAt: input.now, updatedAt: input.now }
    : {
        id,
        occasionId: occasion.id,
        personId: occasion.personId,
        year,
        status: 'not-started',
        savedIdea: null,
        claimedBy: input.uid,
        claimedAt: input.now,
        updatedAt: input.now,
      };
  const states = existing
    ? input.snapshot.states.map(state => (state.id === id ? next : state))
    : [...input.snapshot.states, next];
  return ok(
    {
      ...input.snapshot,
      states,
      dirty: { ...input.snapshot.dirty, [dirtyKey('states', id)]: true },
    },
    next,
  );
}

export function unclaimOccasion(input: {
  snapshot: AppSnapshot;
  occasionId: string;
  uid: string;
  now: number;
  today: Date;
}): Mutation<OccasionState> {
  if (!input.uid) {
    return fail('auth');
  }
  const occasion = input.snapshot.occasions.find(item => item.id === input.occasionId && !item.deleted);
  if (!occasion) {
    return fail('missing');
  }
  const year = occurrenceYear(occasion, input.today);
  const id = stateId(occasion.id, year);
  const existing = input.snapshot.states.find(state => state.id === id && !state.deleted);
  if (!existing?.claimedBy) {
    return fail('missing');
  }
  const owner = input.snapshot.group?.ownerId === input.uid;
  if (existing.claimedBy !== input.uid && !owner) {
    return fail('forbidden');
  }
  const next: OccasionState = {
    id: existing.id,
    occasionId: existing.occasionId,
    personId: existing.personId,
    year: existing.year,
    status: existing.status,
    savedIdea: existing.savedIdea,
    updatedAt: input.now,
  };
  return ok(
    {
      ...input.snapshot,
      states: input.snapshot.states.map(state => (state.id === id ? next : state)),
      dirty: { ...input.snapshot.dirty, [dirtyKey('states', id)]: true },
    },
    next,
  );
}

export type VisibleGift = GiftRecord & { privateGift: boolean };

export function visibleGifts(input: {
  personId: string;
  gifts: GiftRecord[];
  privateGifts: PrivateGift[];
  groupId: string | null;
}): VisibleGift[] {
  const shared = input.gifts
    .filter(gift => !gift.deleted && gift.personId === input.personId)
    .map(gift => ({ ...gift, privateGift: false as const }));
  const priv = input.privateGifts
    .filter(gift => !gift.deleted && gift.personId === input.personId && gift.groupId === input.groupId)
    .map(gift => ({
      id: gift.id,
      personId: gift.personId,
      occasionId: gift.occasionId,
      year: gift.year,
      title: gift.title,
      priceCents: gift.priceCents,
      purchasedOn: gift.purchasedOn,
      updatedAt: gift.updatedAt,
      ...(gift.boughtBy ? { boughtBy: gift.boughtBy } : {}),
      privateGift: true as const,
    }));
  return [...shared, ...priv];
}

export function isMyPurchase(gift: { boughtBy?: string; privateGift?: boolean }, uid: string | null): boolean {
  if (gift.privateGift) {
    return true;
  }
  return Boolean(uid && gift.boughtBy === uid);
}

export type MemberSpend = {
  uid: string;
  yearCents: number;
  allCents: number;
  self: boolean;
  name: string;
};

export function spendByMember(input: {
  personId: string;
  gifts: GiftRecord[];
  privateGifts: PrivateGift[];
  members: Member[];
  selfUid: string | null;
  year: number;
  groupId: string | null;
}): { rows: MemberSpend[]; unknownYearCents: number; unknownAllCents: number } {
  const buckets = new Map<string, { yearCents: number; allCents: number }>();
  let unknownYearCents = 0;
  let unknownAllCents = 0;
  const add = (uid: string | undefined, gift: { priceCents: number; purchasedOn: string; updatedAt: number }) => {
    const yearHit = giftYear(gift) === input.year;
    if (!uid) {
      unknownAllCents += gift.priceCents;
      if (yearHit) {
        unknownYearCents += gift.priceCents;
      }
      return;
    }
    const row = buckets.get(uid) ?? { yearCents: 0, allCents: 0 };
    row.allCents += gift.priceCents;
    if (yearHit) {
      row.yearCents += gift.priceCents;
    }
    buckets.set(uid, row);
  };
  input.gifts.forEach(gift => {
    if (gift.deleted || gift.personId !== input.personId) {
      return;
    }
    add(gift.boughtBy, gift);
  });
  input.privateGifts.forEach(gift => {
    if (gift.deleted || gift.personId !== input.personId || gift.groupId !== input.groupId) {
      return;
    }
    add(gift.boughtBy || input.selfUid || undefined, gift);
  });
  const rows: MemberSpend[] = [...buckets.entries()].map(([uid, amounts]) => ({
    uid,
    yearCents: amounts.yearCents,
    allCents: amounts.allCents,
    self: uid === input.selfUid,
    name: uid === input.selfUid ? '' : claimerName(uid, input.members),
  }));
  rows.sort((a, b) => b.yearCents - a.yearCents || a.uid.localeCompare(b.uid));
  return { rows, unknownYearCents, unknownAllCents };
}
