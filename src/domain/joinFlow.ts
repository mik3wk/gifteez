import { keyFromString, parseLink } from '../crypto/crypto';
import { groupHasRoom, memberIdsForGroup, parkActive, sillyName, withProfile } from './logic';
import type { AppSnapshot } from './types';

/** Why a join stopped. `invalid-link` is a bad URL; `invalid` is a server invite miss. */
export type JoinFailure = 'full' | 'invalid' | 'offline' | 'unknown' | 'invalid-link';

export type JoinResult =
  | {
      ok: true;
      snapshot: AppSnapshot;
      groupId: string;
      groupKey: string;
      uid: string;
      displayName: string;
    }
  | { ok: false; failure: JoinFailure; snapshot: AppSnapshot };

export function classifyJoinError(caught: unknown): Exclude<JoinFailure, 'invalid-link'> {
  const code =
    caught && typeof caught === 'object' && 'code' in caught
      ? String((caught as { code?: unknown }).code ?? '')
      : '';
  const message = caught instanceof Error ? caught.message : typeof caught === 'string' ? caught : '';
  const haystack = `${code} ${message}`.toLowerCase();
  if (haystack.includes('resource-exhausted') || message === 'full') {
    return 'full';
  }
  if (haystack.includes('not-found') || message === 'invite' || message === 'group') {
    return 'invalid';
  }
  if (
    haystack.includes('unavailable') ||
    haystack.includes('deadline-exceeded') ||
    haystack.includes('network-request-failed') ||
    haystack.includes('network request failed') ||
    haystack.includes('offline') ||
    haystack.includes('failed to fetch') ||
    haystack.includes('timeout')
  ) {
    return 'offline';
  }
  return 'unknown';
}

/**
 * Confirms membership with `joinGroup` before any local group, member, or key write.
 * A failed callable leaves the snapshot untouched and does not save the group key.
 * If the key write itself fails, the key from this attempt is deleted.
 */
export async function performJoin(input: {
  url: string;
  snapshot: AppSnapshot;
  cap: number;
  ensureUid: () => Promise<string>;
  joinGroup: (inviteId: string) => Promise<unknown>;
  saveKey: (groupId: string, groupKey: string) => Promise<void>;
  deleteKey: (groupId: string) => Promise<void>;
}): Promise<JoinResult> {
  const parsed = parseLink(input.url);
  if (!parsed || parsed.kind !== 'invite') {
    return { ok: false, failure: 'invalid-link', snapshot: input.snapshot };
  }
  try {
    keyFromString(parsed.groupKey);
  } catch {
    return { ok: false, failure: 'invalid-link', snapshot: input.snapshot };
  }
  const uid = input.snapshot.profile.uid || (await input.ensureUid());
  const knownIds = memberIdsForGroup(input.snapshot, parsed.groupId);
  if (knownIds && !knownIds.includes(uid) && !groupHasRoom(knownIds.length, input.cap)) {
    return { ok: false, failure: 'full', snapshot: input.snapshot };
  }
  try {
    await input.joinGroup(parsed.inviteId);
  } catch (caught) {
    return { ok: false, failure: classifyJoinError(caught), snapshot: input.snapshot };
  }
  try {
    await input.saveKey(parsed.groupId, parsed.groupKey);
  } catch {
    await input.deleteKey(parsed.groupId).catch(() => undefined);
    return { ok: false, failure: 'unknown', snapshot: input.snapshot };
  }
  const name = input.snapshot.profile.displayName || sillyName(uid);
  const parked = parkActive(
    withProfile(input.snapshot, {
      uid,
      displayName: name,
      nameLocked: input.snapshot.profile.nameLocked,
    }),
  );
  return {
    ok: true,
    groupId: parsed.groupId,
    groupKey: parsed.groupKey,
    uid,
    displayName: name,
    snapshot: {
      ...parked,
      profile: {
        ...parked.profile,
        inviteId: parsed.inviteId,
        onboarded: true,
        groupId: parsed.groupId,
      },
      group: {
        id: parsed.groupId,
        name: '',
        ownerId: '',
        memberIds: [uid],
        peopleCount: 0,
        entitled: false,
        updatedAt: 0,
      },
      members: [{ id: uid, uid, displayName: name, updatedAt: Date.now() }],
      people: [],
      occasions: [],
      states: [],
      gifts: [],
      ideas: [],
      dirty: {},
    },
  };
}
