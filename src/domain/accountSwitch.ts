import { emptySnapshot, type AppSnapshot, type GroupSummary } from './types';

/**
 * Signing into an account that already exists must not copy this phone's anonymous lists onto that uid.
 * The recovery code restores that account's keys and lists.
 */
export function adoptSignedInAccount(previous: AppSnapshot, uid: string, now: number): AppSnapshot {
  const next = emptySnapshot(now);
  return {
    ...next,
    profile: {
      ...next.profile,
      uid,
      displayName: previous.profile.displayName,
      nameLocked: previous.profile.nameLocked,
      upgraded: true,
      upgradeBannerDismissed: true,
      onboarded: false,
      reminders: previous.profile.reminders ?? 'unset',
    },
  };
}

/** A list this account belongs to, with no key on this phone, stays visible and marked not current. */
export function showStaleList(
  snapshot: AppSnapshot,
  info: { id: string; ownerId?: string; memberIds?: string[]; name?: string },
): AppSnapshot {
  const roster = snapshot.roster.map(item => (item.id === info.id ? { ...item, stale: true } : item));
  const group = snapshot.group?.id === info.id ? { ...snapshot.group, stale: true } : snapshot.group;
  const archive = snapshot.archives[info.id];
  const archives = archive
    ? { ...snapshot.archives, [info.id]: { ...archive, group: { ...archive.group, stale: true } } }
    : snapshot.archives;
  if (roster.some(item => item.id === info.id) || group?.id === info.id) {
    return { ...snapshot, roster, group, archives };
  }
  const summary: GroupSummary = {
    id: info.id,
    name: info.name || archive?.group.name || '',
    ownerId: info.ownerId || archive?.group.ownerId || '',
    memberIds: info.memberIds ?? archive?.group.memberIds ?? [],
    memberNames: [],
    updatedAt: archive?.group.updatedAt ?? 0,
    stale: true,
  };
  return { ...snapshot, group, archives, roster: [...roster, summary] };
}
