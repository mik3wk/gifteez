import type { GiftRecord, IdeaCacheEntry, OccasionState, Person } from './types';

export const HIDDEN_COLLECTIONS = ['states', 'gifts', 'ideas'] as const;
export type HiddenCollection = (typeof HIDDEN_COLLECTIONS)[number];

export function isHiddenFromViewer(person: Pick<Person, 'linkedUid'> | undefined, uid: string | null): boolean {
  return Boolean(uid && person?.linkedUid && person.linkedUid === uid);
}

export function isPersonLocked(lockedPersonIds: string[] | undefined, personId: string): boolean {
  return Boolean(lockedPersonIds?.includes(personId));
}

/** Shared gifts, states, and ideas for a linked person are stored under this member. */
export function hiddenFromForPerson(person: Pick<Person, 'linkedUid'> | undefined): string | undefined {
  const linked = person?.linkedUid?.trim();
  return linked || undefined;
}

export function pushKind(collection: string, hiddenFrom?: string): 'person' | 'hidden' | 'shared' {
  if (collection === 'people') {
    return 'person';
  }
  if (hiddenFrom && (HIDDEN_COLLECTIONS as readonly string[]).includes(collection)) {
    return 'hidden';
  }
  return 'shared';
}

/** Drop path metadata so it is not required inside the group ciphertext. */
export function bodyWithoutHidden<T extends { hiddenFrom?: string }>(record: T): Omit<T, 'hiddenFrom'> {
  const rest = { ...record };
  delete rest.hiddenFrom;
  return rest;
}

export function stripSensitiveForViewer<T extends { people: Person[]; states: OccasionState[]; gifts: GiftRecord[]; ideas: IdeaCacheEntry[]; profile: { uid: string | null } }>(
  snapshot: T,
): T {
  const uid = snapshot.profile.uid;
  if (!uid) {
    return snapshot;
  }
  const hidden = new Set(snapshot.people.filter(person => person.linkedUid === uid).map(person => person.id));
  if (hidden.size === 0) {
    return snapshot;
  }
  return {
    ...snapshot,
    states: snapshot.states.filter(state => !hidden.has(state.personId)),
    gifts: snapshot.gifts.filter(gift => !hidden.has(gift.personId)),
    ideas: snapshot.ideas.filter(idea => !hidden.has(idea.personId)),
  };
}
