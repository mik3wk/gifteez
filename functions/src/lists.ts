/** A free account may start this many lists. Joining lists does not count. */
export const FREE_OWNED_LIST_LIMIT = 1;

export type OwnedCreateDecision =
  | { ok: true; ownedGroupIds: string[]; entitled: boolean }
  | { ok: false; reason: 'one-list' | 'exists' };

export function normalizeOwnedGroupIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const ids: string[] = [];
  for (const id of value) {
    if (typeof id === 'string' && id && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

/**
 * Decide whether this account may create `groupId`.
 * `ownedGroupIds` must already be the live lists this account owns, not counting `groupId`.
 * A replay of a list this account already owns is allowed. Joining is not this function.
 */
export function decideOwnedCreate(input: {
  entitled: boolean;
  ownedGroupIds: string[];
  groupId: string;
  groupExists: boolean;
  existingOwnerId: string;
  uid: string;
}): OwnedCreateDecision {
  const others = normalizeOwnedGroupIds(input.ownedGroupIds).filter(id => id !== input.groupId);
  if (input.groupExists) {
    if (input.existingOwnerId !== input.uid) {
      return { ok: false, reason: 'exists' };
    }
    return { ok: true, ownedGroupIds: [...others, input.groupId], entitled: input.entitled };
  }
  if (!input.entitled && others.length >= FREE_OWNED_LIST_LIMIT) {
    return { ok: false, reason: 'one-list' };
  }
  return { ok: true, ownedGroupIds: [...others, input.groupId], entitled: input.entitled };
}

export function releaseOwnedId(ownedGroupIds: string[], groupId: string): string[] {
  return normalizeOwnedGroupIds(ownedGroupIds).filter(id => id !== groupId);
}

/** Recipient cap follows the list owner. A member's own purchase does not count here. */
export function ownerEntitledForMember(input: {
  memberIds: string[];
  uid: string;
  groupEntitled: boolean;
}): boolean {
  return input.groupEntitled === true && input.memberIds.includes(input.uid);
}
