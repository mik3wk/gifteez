import { stateId, type Mutation } from './logic';
import type {
  AppSnapshot,
  DirtyMap,
  GiftRecord,
  GiftStatus,
  GroupArchive,
  GroupMeta,
  Occasion,
  OccasionState,
  Person,
  PrivateGift,
} from './types';
import { dirtyKey } from './types';

function ok<T>(snapshot: AppSnapshot, value: T): Mutation<T> {
  return { ok: true, snapshot, value };
}

function fail<T>(error: string): Mutation<T> {
  return { ok: false, error };
}

export function normalizePersonName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export type DuplicateReason = 'name' | 'birthday' | 'both';

export type DuplicateHint = {
  targetPersonId: string;
  targetGroupId: string;
  sourcePersonId: string;
  sourceGroupId: string;
  sourceName: string;
  targetName: string;
  sourceListName: string;
  reason: DuplicateReason;
};

function birthdayKeys(personId: string, occasions: Occasion[]): string[] {
  return occasions
    .filter(item => item.personId === personId && !item.deleted && item.type === 'birthday')
    .map(item => `${item.month}-${item.day}`);
}

/** Hints only. Callers offer a merge; this never changes the snapshot. */
export function findDuplicatePeople(snapshot: AppSnapshot): DuplicateHint[] {
  const activeId = snapshot.group?.id;
  if (!activeId) {
    return [];
  }
  const hints: DuplicateHint[] = [];
  const activePeople = snapshot.people.filter(person => !person.deleted);
  Object.values(snapshot.archives ?? {}).forEach(archive => {
    if (!archive?.group || archive.group.id === activeId) {
      return;
    }
    archive.people.filter(person => !person.deleted).forEach(source => {
      const sourceName = normalizePersonName(source.name);
      const sourceBirthdays = new Set(birthdayKeys(source.id, archive.occasions));
      activePeople.forEach(target => {
        const targetName = normalizePersonName(target.name);
        const nameMatch = sourceName.length > 0 && sourceName === targetName;
        const birthdayMatch = birthdayKeys(target.id, snapshot.occasions).some(key => sourceBirthdays.has(key));
        if (!nameMatch && !birthdayMatch) {
          return;
        }
        let reason: DuplicateReason = 'birthday';
        if (nameMatch && birthdayMatch) {
          reason = 'both';
        } else if (nameMatch) {
          reason = 'name';
        }
        hints.push({
          targetPersonId: target.id,
          targetGroupId: activeId,
          sourcePersonId: source.id,
          sourceGroupId: archive.group.id,
          sourceName: source.name,
          targetName: target.name,
          sourceListName: archive.group.name,
          reason,
        });
      });
    });
  });
  return hints;
}

export type OtherPerson = {
  personId: string;
  name: string;
  groupId: string;
  listName: string;
};

export function peopleOnOtherLists(snapshot: AppSnapshot): OtherPerson[] {
  const active = snapshot.group?.id;
  const rows: OtherPerson[] = [];
  Object.values(snapshot.archives ?? {}).forEach(archive => {
    if (!archive?.group || archive.group.id === active) {
      return;
    }
    archive.people.forEach(person => {
      if (person.deleted) {
        return;
      }
      rows.push({
        personId: person.id,
        name: person.name,
        groupId: archive.group.id,
        listName: archive.group.name,
      });
    });
  });
  return rows.sort((a, b) => a.name.localeCompare(b.name) || a.listName.localeCompare(b.listName));
}

export function giftsOnList(snapshot: AppSnapshot, groupId: string, personId: string): GiftRecord[] {
  const gifts = snapshot.group?.id === groupId ? snapshot.gifts : snapshot.archives[groupId]?.gifts ?? [];
  return gifts.filter(gift => gift.personId === personId && !gift.deleted);
}

type Editable = {
  kind: 'active' | 'archive';
  group: GroupMeta;
  people: Person[];
  occasions: Occasion[];
  states: OccasionState[];
  gifts: GiftRecord[];
  dirty: DirtyMap;
};

function editableFrom(snapshot: AppSnapshot, groupId: string): Editable | null {
  if (snapshot.group?.id === groupId) {
    return {
      kind: 'active',
      group: { ...snapshot.group, memberIds: [...snapshot.group.memberIds] },
      people: snapshot.people.map(item => ({ ...item })),
      occasions: snapshot.occasions.map(item => ({ ...item })),
      states: snapshot.states.map(item => ({ ...item })),
      gifts: snapshot.gifts.map(item => ({ ...item })),
      dirty: { ...snapshot.dirty },
    };
  }
  const archive = snapshot.archives[groupId];
  if (!archive) {
    return null;
  }
  return {
    kind: 'archive',
    group: { ...archive.group, memberIds: [...archive.group.memberIds] },
    people: archive.people.map(item => ({ ...item })),
    occasions: archive.occasions.map(item => ({ ...item })),
    states: archive.states.map(item => ({ ...item })),
    gifts: archive.gifts.map(item => ({ ...item })),
    dirty: { ...archive.dirty },
  };
}

function withBundle(snapshot: AppSnapshot, bundle: Editable): AppSnapshot {
  if (bundle.kind === 'active') {
    const kept: DirtyMap = {};
    Object.entries(snapshot.dirty).forEach(([key, value]) => {
      if (key.startsWith('privateGifts:')) {
        kept[key] = value;
      }
    });
    return {
      ...snapshot,
      group: bundle.group,
      people: bundle.people,
      occasions: bundle.occasions,
      states: bundle.states,
      gifts: bundle.gifts,
      dirty: { ...bundle.dirty, ...kept },
    };
  }
  const previous = snapshot.archives[bundle.group.id];
  const archive: GroupArchive = {
    ...previous,
    group: bundle.group,
    people: bundle.people,
    occasions: bundle.occasions,
    states: bundle.states,
    gifts: bundle.gifts,
    dirty: bundle.dirty,
  };
  return {
    ...snapshot,
    archives: { ...snapshot.archives, [bundle.group.id]: archive },
  };
}

function ownerUnlocked(snapshot: AppSnapshot, group: GroupMeta): boolean {
  if (group.entitled) {
    return true;
  }
  return Boolean(snapshot.entitlementPaid && snapshot.profile.uid && group.ownerId === snapshot.profile.uid);
}

function activeCount(people: Person[]): number {
  return people.filter(person => !person.deleted).length;
}

function rank(status: GiftStatus): number {
  if (status === 'purchased') {
    return 2;
  }
  if (status === 'idea-saved') {
    return 1;
  }
  return 0;
}

function combineStates(
  current: OccasionState,
  incoming: OccasionState,
  personId: string,
  occasionId: string,
  now: number,
): OccasionState {
  const status = rank(current.status) >= rank(incoming.status) ? current.status : incoming.status;
  const savedIdea = current.savedIdea ?? incoming.savedIdea;
  let claim: Partial<Pick<OccasionState, 'claimedBy' | 'claimedAt'>> = {};
  let winner: OccasionState | null = null;
  if (current.claimedBy) {
    winner = current;
  } else if (incoming.claimedBy) {
    winner = incoming;
  }
  if (winner?.claimedBy) {
    claim = { claimedBy: winner.claimedBy };
    if (winner.claimedAt != null) {
      claim.claimedAt = winner.claimedAt;
    }
  }
  return {
    id: current.id,
    occasionId,
    personId,
    year: current.year,
    status,
    savedIdea,
    updatedAt: now,
    ...claim,
  };
}

export type MergeOutcome = {
  sourceGroupId: string;
  sourcePeopleCount: number;
  targetPeopleCount: number;
  privateGiftIds: string[];
};

/**
 * Moves the source recipient into an existing group recipient.
 * The target list does not gain a person. The source person is soft-deleted, which frees that list's slot.
 * Checked gifts are copied onto the target (sealed later with the target group key).
 * Unchecked gifts become private gifts for `uid` (sealed later with the device key).
 */
export function applyMerge(input: {
  snapshot: AppSnapshot;
  targetPersonId: string;
  targetGroupId: string;
  sourcePersonId: string;
  sourceGroupId: string;
  sharedGiftIds: string[];
  uid: string;
  now: number;
  freeLimit: number;
  newId: () => string;
}): Mutation<MergeOutcome> {
  if (!input.uid) {
    return fail('auth');
  }
  if (input.targetGroupId === input.sourceGroupId) {
    return fail('invalid');
  }
  const target = editableFrom(input.snapshot, input.targetGroupId);
  const source = editableFrom(input.snapshot, input.sourceGroupId);
  if (!target || !source) {
    return fail('missing');
  }
  const sourcePerson = source.people.find(person => person.id === input.sourcePersonId && !person.deleted);
  if (!sourcePerson) {
    return fail('missing');
  }
  const targetPerson = target.people.find(person => person.id === input.targetPersonId && !person.deleted);
  if (!targetPerson) {
    if (!ownerUnlocked(input.snapshot, target.group) && activeCount(target.people) >= input.freeLimit) {
      return fail('cap');
    }
    return fail('missing');
  }
  const beforeTarget = activeCount(target.people);
  const shared = new Set(input.sharedGiftIds);
  const occasionMap = new Map<string, string>();
  const privateAdds: PrivateGift[] = [];
  const privateDirty: DirtyMap = {};

  source.occasions
    .filter(item => item.personId === sourcePerson.id && !item.deleted)
    .forEach(occasion => {
      let host = target.occasions.find(
        item =>
          item.personId === targetPerson.id &&
          !item.deleted &&
          item.type === occasion.type &&
          item.month === occasion.month &&
          item.day === occasion.day,
      );
      if (!host) {
        host = {
          id: input.newId(),
          personId: targetPerson.id,
          type: occasion.type,
          month: occasion.month,
          day: occasion.day,
          ...(occasion.year != null ? { year: occasion.year } : {}),
          updatedAt: input.now,
        };
        target.occasions = [...target.occasions, host];
        target.dirty = { ...target.dirty, [dirtyKey('occasions', host.id)]: true };
      }
      occasionMap.set(occasion.id, host.id);
      source.occasions = source.occasions.map(item =>
        item.id === occasion.id ? { ...item, deleted: true, updatedAt: input.now } : item,
      );
      source.dirty = { ...source.dirty, [dirtyKey('occasions', occasion.id)]: true };
    });

  source.states
    .filter(state => occasionMap.has(state.occasionId) && !state.deleted)
    .forEach(state => {
      const occasionId = occasionMap.get(state.occasionId) ?? state.occasionId;
      const id = stateId(occasionId, state.year);
      const existing = target.states.find(item => item.id === id && !item.deleted);
      const rest: OccasionState = { ...state, id, occasionId, personId: targetPerson.id, updatedAt: input.now };
      delete rest.deleted;
      const nextState = existing ? combineStates(existing, state, targetPerson.id, occasionId, input.now) : rest;
      target.states = existing
        ? target.states.map(item => (item.id === id ? nextState : item))
        : [...target.states, nextState];
      target.dirty = { ...target.dirty, [dirtyKey('states', id)]: true };
      source.states = source.states.map(item =>
        item.id === state.id ? { ...item, deleted: true, updatedAt: input.now } : item,
      );
      source.dirty = { ...source.dirty, [dirtyKey('states', state.id)]: true };
    });

  source.gifts
    .filter(gift => gift.personId === sourcePerson.id && !gift.deleted)
    .forEach(gift => {
      const occasionId = occasionMap.get(gift.occasionId) ?? gift.occasionId;
      if (shared.has(gift.id)) {
        const id = input.newId();
        const moved: GiftRecord = {
          id,
          personId: targetPerson.id,
          occasionId,
          year: gift.year,
          title: gift.title,
          priceCents: gift.priceCents,
          purchasedOn: gift.purchasedOn,
          updatedAt: input.now,
          ...(gift.boughtBy ? { boughtBy: gift.boughtBy } : {}),
        };
        target.gifts = [...target.gifts, moved];
        target.dirty = { ...target.dirty, [dirtyKey('gifts', id)]: true };
      } else {
        const id = input.newId();
        privateAdds.push({
          id,
          personId: targetPerson.id,
          groupId: input.targetGroupId,
          occasionId,
          year: gift.year,
          title: gift.title,
          priceCents: gift.priceCents,
          purchasedOn: gift.purchasedOn,
          updatedAt: input.now,
          ...(gift.boughtBy ? { boughtBy: gift.boughtBy } : {}),
        });
        privateDirty[dirtyKey('privateGifts', id)] = true;
      }
      source.gifts = source.gifts.map(item =>
        item.id === gift.id ? { ...item, deleted: true, updatedAt: input.now } : item,
      );
      source.dirty = { ...source.dirty, [dirtyKey('gifts', gift.id)]: true };
    });

  source.people = source.people.map(person =>
    person.id === sourcePerson.id ? { ...person, deleted: true, updatedAt: input.now } : person,
  );
  source.dirty = { ...source.dirty, [dirtyKey('people', sourcePerson.id)]: true, 'group:meta': true };
  const remaining = activeCount(source.people);
  source.group = { ...source.group, peopleCount: remaining, updatedAt: input.now };

  const afterTarget = activeCount(target.people);
  const overCap = afterTarget > beforeTarget && afterTarget > input.freeLimit && !ownerUnlocked(input.snapshot, target.group);
  if (overCap) {
    return fail('cap');
  }

  let next = withBundle(input.snapshot, source);
  next = withBundle(next, target);
  next = {
    ...next,
    privateGifts: [...(next.privateGifts ?? []), ...privateAdds],
    dirty: { ...next.dirty, ...privateDirty },
  };
  return ok(next, {
    sourceGroupId: input.sourceGroupId,
    sourcePeopleCount: remaining,
    targetPeopleCount: target.group.peopleCount,
    privateGiftIds: privateAdds.map(gift => gift.id),
  });
}

export function mergePrivateGifts(local: PrivateGift[], remote: PrivateGift[], dirty: DirtyMap): PrivateGift[] {
  const map = new Map(local.map(item => [item.id, item]));
  remote.forEach(item => {
    const current = map.get(item.id);
    const key = dirtyKey('privateGifts', item.id);
    if (current && dirty[key] && current.updatedAt >= item.updatedAt) {
      return;
    }
    if (current && current.updatedAt > item.updatedAt) {
      return;
    }
    map.set(item.id, item);
  });
  return [...map.values()];
}
