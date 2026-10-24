import { isRealMonthDay, type Mutation } from './logic';
import { dirtyKey, type AppSnapshot, type DirtyMap, type GiftRecord, type Occasion, type PrivateGift } from './types';

function ok<T>(snapshot: AppSnapshot, value: T): Mutation<T> {
  return { ok: true, snapshot, value };
}

function fail<T>(error: string): Mutation<T> {
  return { ok: false, error };
}

export function canEditSharedGift(snapshot: AppSnapshot, gift: Pick<GiftRecord, 'boughtBy'>, uid: string | null): boolean {
  if (!snapshot.group) {
    return true;
  }
  if (!uid) {
    return false;
  }
  if (snapshot.group.ownerId === uid) {
    return true;
  }
  return gift.boughtBy === uid;
}

export function updateSharedGift(input: {
  snapshot: AppSnapshot;
  giftId: string;
  uid: string | null;
  title: string;
  priceCents: number;
  purchasedOn: string;
  now: number;
}): Mutation<GiftRecord> {
  const gift = input.snapshot.gifts.find(item => item.id === input.giftId && !item.deleted);
  if (!gift) {
    return fail('missing');
  }
  if (!canEditSharedGift(input.snapshot, gift, input.uid)) {
    return fail('forbidden');
  }
  if (!input.title.trim() || input.priceCents < 0) {
    return fail('invalid');
  }
  const next: GiftRecord = {
    ...gift,
    title: input.title.trim(),
    priceCents: input.priceCents,
    purchasedOn: input.purchasedOn,
    updatedAt: input.now,
  };
  return ok(
    {
      ...input.snapshot,
      gifts: input.snapshot.gifts.map(item => (item.id === gift.id ? next : item)),
      dirty: { ...input.snapshot.dirty, [dirtyKey('gifts', gift.id)]: true },
    },
    next,
  );
}

export function deleteSharedGift(input: {
  snapshot: AppSnapshot;
  giftId: string;
  uid: string | null;
  now: number;
}): Mutation<GiftRecord> {
  const gift = input.snapshot.gifts.find(item => item.id === input.giftId && !item.deleted);
  if (!gift) {
    return fail('missing');
  }
  if (!canEditSharedGift(input.snapshot, gift, input.uid)) {
    return fail('forbidden');
  }
  const next: GiftRecord = { ...gift, deleted: true, updatedAt: input.now };
  const remaining = !gift.occasionId || input.snapshot.gifts.some(
    item => item.id !== gift.id && !item.deleted && item.occasionId === gift.occasionId && item.year === gift.year,
  );
  const states = input.snapshot.states.map(state => {
    if (remaining || state.deleted || state.occasionId !== gift.occasionId || state.year !== gift.year || state.status !== 'purchased') {
      return state;
    }
    return {
      ...state,
      status: state.savedIdea ? 'idea-saved' as const : 'not-started' as const,
      updatedAt: input.now,
    };
  });
  const dirty: DirtyMap = { ...input.snapshot.dirty, [dirtyKey('gifts', gift.id)]: true };
  states.forEach(state => {
    if (state.updatedAt === input.now && state.occasionId === gift.occasionId) {
      dirty[dirtyKey('states', state.id)] = true;
    }
  });
  return ok(
    {
      ...input.snapshot,
      gifts: input.snapshot.gifts.map(item => (item.id === gift.id ? next : item)),
      states,
      dirty,
    },
    next,
  );
}

export function updatePrivateGift(input: {
  snapshot: AppSnapshot;
  giftId: string;
  title: string;
  priceCents: number;
  purchasedOn: string;
  now: number;
}): Mutation<PrivateGift> {
  const gift = (input.snapshot.privateGifts ?? []).find(item => item.id === input.giftId && !item.deleted);
  if (!gift) {
    return fail('missing');
  }
  if (!input.title.trim() || input.priceCents < 0) {
    return fail('invalid');
  }
  const next: PrivateGift = {
    ...gift,
    title: input.title.trim(),
    priceCents: input.priceCents,
    purchasedOn: input.purchasedOn,
    updatedAt: input.now,
  };
  return ok(
    {
      ...input.snapshot,
      privateGifts: input.snapshot.privateGifts.map(item => (item.id === gift.id ? next : item)),
      dirty: { ...input.snapshot.dirty, [dirtyKey('privateGifts', gift.id)]: true },
    },
    next,
  );
}

export function deletePrivateGift(snapshot: AppSnapshot, giftId: string, now: number): Mutation<PrivateGift> {
  const gift = (snapshot.privateGifts ?? []).find(item => item.id === giftId && !item.deleted);
  if (!gift) {
    return fail('missing');
  }
  const next: PrivateGift = { ...gift, deleted: true, updatedAt: now };
  return ok(
    {
      ...snapshot,
      privateGifts: snapshot.privateGifts.map(item => (item.id === gift.id ? next : item)),
      dirty: { ...snapshot.dirty, [dirtyKey('privateGifts', gift.id)]: true },
    },
    next,
  );
}

export function updateOccasionDate(input: {
  snapshot: AppSnapshot;
  occasionId: string;
  month: number;
  day: number;
  year?: number;
  now: number;
}): Mutation<Occasion> {
  const occasion = input.snapshot.occasions.find(item => item.id === input.occasionId && !item.deleted);
  if (!occasion) {
    return fail('missing');
  }
  if (!isRealMonthDay(input.month, input.day)) {
    return fail('invalid');
  }
  const next: Occasion = {
    ...occasion,
    month: input.month,
    day: input.day,
    updatedAt: input.now,
  };
  if (input.year && input.year > 0) {
    next.year = input.year;
  } else {
    delete next.year;
  }
  return ok(
    {
      ...input.snapshot,
      occasions: input.snapshot.occasions.map(item => (item.id === occasion.id ? next : item)),
      dirty: { ...input.snapshot.dirty, [dirtyKey('occasions', occasion.id)]: true },
    },
    next,
  );
}

/** Soft-deletes the occasion. Gifts stay on the person. */
export function deleteOccasion(snapshot: AppSnapshot, occasionId: string, now: number): Mutation<Occasion> {
  const occasion = snapshot.occasions.find(item => item.id === occasionId && !item.deleted);
  if (!occasion) {
    return fail('missing');
  }
  const next: Occasion = { ...occasion, deleted: true, updatedAt: now };
  return ok(
    {
      ...snapshot,
      occasions: snapshot.occasions.map(item => (item.id === occasion.id ? next : item)),
      dirty: { ...snapshot.dirty, [dirtyKey('occasions', occasion.id)]: true },
    },
    next,
  );
}
