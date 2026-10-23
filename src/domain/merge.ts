import { stateId, type Mutation } from './logic';
import type {
  AppSnapshot,
  DirtyMap,
  GiftRecord,
  GiftStatus,
  GroupArchive,
  GroupMeta,
  MergeJournal,
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
  /** Refuse before any copy when the source list's key is not on this phone. */
  sourceKeyPresent?: boolean;
  /** Keep the source until the caller has pushed it. Default true matches a finished merge. */
  deleteSource?: boolean;
}): Mutation<MergeOutcome> {
  if (input.sourceKeyPresent === false) {
    return fail('sourceKey');
  }
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
  const createdOccasionIds: string[] = [];
  const createdStateIds: string[] = [];
  const createdGiftIds: string[] = [];
  const replacedStates: OccasionState[] = [];
  const sourcePersonCopy: Person = { ...sourcePerson };
  const sourceOccasions = source.occasions.filter(item => item.personId === sourcePerson.id).map(item => ({ ...item }));
  const sourceStates = source.states.filter(item => item.personId === sourcePerson.id).map(item => ({ ...item }));
  const sourceGifts = source.gifts.filter(item => item.personId === sourcePerson.id).map(item => ({ ...item }));
  const sourcePeopleCount = source.group.peopleCount;
  const deleteSource = input.deleteSource !== false;

  source.occasions
    .filter(item => item.personId === sourcePerson.id && !item.deleted)
    .forEach(occasion => {
      let host = target.occasions.find(
        item =>
          item.personId === targetPerson.id &&
          !item.deleted &&
          item.type === occasion.type &&
          item.month === occasion.month &&
          item.day === occasion.day &&
          (occasion.type !== 'custom' || item.label === occasion.label),
      );
      if (!host) {
        host = {
          id: input.newId(),
          personId: targetPerson.id,
          type: occasion.type,
          month: occasion.month,
          day: occasion.day,
          ...(occasion.year != null ? { year: occasion.year } : {}),
          ...(occasion.label ? { label: occasion.label } : {}),
          ...(typeof occasion.recurs === 'boolean' ? { recurs: occasion.recurs } : {}),
          updatedAt: input.now,
        };
        target.occasions = [...target.occasions, host];
        target.dirty = { ...target.dirty, [dirtyKey('occasions', host.id)]: true };
        createdOccasionIds.push(host.id);
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
      if (existing) {
        replacedStates.push({ ...existing });
      } else {
        createdStateIds.push(id);
      }
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
        createdGiftIds.push(id);
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

  if (deleteSource) {
    source.people = source.people.map(person =>
      person.id === sourcePerson.id ? { ...person, deleted: true, updatedAt: input.now } : person,
    );
    source.dirty = { ...source.dirty, [dirtyKey('people', sourcePerson.id)]: true, 'group:meta': true };
    source.group = { ...source.group, peopleCount: activeCount(source.people), updatedAt: input.now };
  } else {
    source.people = source.people.map(person => (person.id === sourcePersonCopy.id ? sourcePersonCopy : person));
    source.occasions = source.occasions.map(item => sourceOccasions.find(copy => copy.id === item.id) ?? item);
    source.states = source.states.map(item => sourceStates.find(copy => copy.id === item.id) ?? item);
    source.gifts = source.gifts.map(item => sourceGifts.find(copy => copy.id === item.id) ?? item);
    const dirty = { ...source.dirty };
    sourceOccasions.forEach(item => {
      delete dirty[dirtyKey('occasions', item.id)];
    });
    sourceStates.forEach(item => {
      delete dirty[dirtyKey('states', item.id)];
    });
    sourceGifts.forEach(item => {
      delete dirty[dirtyKey('gifts', item.id)];
    });
    delete dirty[dirtyKey('people', sourcePersonCopy.id)];
    source.dirty = dirty;
    source.group = { ...source.group, peopleCount: sourcePeopleCount };
  }
  const remaining = activeCount(source.people);

  const afterTarget = activeCount(target.people);
  const overCap = afterTarget > beforeTarget && afterTarget > input.freeLimit && !ownerUnlocked(input.snapshot, target.group);
  if (overCap) {
    return fail('cap');
  }

  const journal: MergeJournal = {
    sourceGroupId: input.sourceGroupId,
    sourcePersonId: sourcePersonCopy.id,
    targetGroupId: input.targetGroupId,
    targetPersonId: targetPerson.id,
    createdOccasionIds,
    createdStateIds,
    createdGiftIds,
    replacedStates,
    privateGiftIds: privateAdds.map(gift => gift.id),
    sourcePerson: sourcePersonCopy,
    sourceOccasions,
    sourceStates,
    sourceGifts,
    sourcePeopleCount,
    sourceDeleted: deleteSource,
  };
  let next = withBundle(input.snapshot, source);
  next = withBundle(next, target);
  next = {
    ...next,
    privateGifts: [...(next.privateGifts ?? []), ...privateAdds],
    dirty: { ...next.dirty, ...privateDirty },
    mergeJournal: journal,
  };
  return ok(next, {
    sourceGroupId: input.sourceGroupId,
    sourcePeopleCount: remaining,
    targetPeopleCount: target.group.peopleCount,
    privateGiftIds: privateAdds.map(gift => gift.id),
  });
}

export function commitMergeSource(snapshot: AppSnapshot, now: number): AppSnapshot {
  const journal = snapshot.mergeJournal;
  if (!journal || journal.sourceDeleted) {
    return snapshot;
  }
  const source = editableFrom(snapshot, journal.sourceGroupId);
  if (!source) {
    return snapshot;
  }
  const mark = <T extends { id: string; personId: string; deleted?: boolean; updatedAt: number }>(rows: T[]): T[] =>
    rows.map(item => (item.personId === journal.sourcePersonId && !item.deleted ? { ...item, deleted: true, updatedAt: now } : item));
  source.people = source.people.map(person =>
    person.id === journal.sourcePersonId ? { ...person, deleted: true, updatedAt: now } : person,
  );
  source.occasions = mark(source.occasions);
  source.states = mark(source.states);
  source.gifts = mark(source.gifts);
  const dirty: DirtyMap = { ...source.dirty, 'group:meta': true, [dirtyKey('people', journal.sourcePersonId)]: true };
  source.occasions.forEach(item => {
    if (item.personId === journal.sourcePersonId) {
      dirty[dirtyKey('occasions', item.id)] = true;
    }
  });
  source.states.forEach(item => {
    if (item.personId === journal.sourcePersonId) {
      dirty[dirtyKey('states', item.id)] = true;
    }
  });
  source.gifts.forEach(item => {
    if (item.personId === journal.sourcePersonId) {
      dirty[dirtyKey('gifts', item.id)] = true;
    }
  });
  source.dirty = dirty;
  source.group = { ...source.group, peopleCount: activeCount(source.people), updatedAt: now };
  return { ...withBundle(snapshot, source), mergeJournal: { ...journal, sourceDeleted: true } };
}

export function undoMerge(snapshot: AppSnapshot, now: number): AppSnapshot {
  const journal = snapshot.mergeJournal;
  if (!journal) {
    return snapshot;
  }
  const target = editableFrom(snapshot, journal.targetGroupId);
  const source = editableFrom(snapshot, journal.sourceGroupId);
  if (!target || !source) {
    return { ...snapshot, mergeJournal: null };
  }
  const dropOccasion = new Set(journal.createdOccasionIds);
  const dropState = new Set(journal.createdStateIds);
  const dropGift = new Set(journal.createdGiftIds);
  target.occasions = target.occasions.map(item => (dropOccasion.has(item.id) ? { ...item, deleted: true, updatedAt: now } : item));
  target.states = target.states.map(item => (dropState.has(item.id) ? { ...item, deleted: true, updatedAt: now } : item));
  target.gifts = target.gifts.map(item => (dropGift.has(item.id) ? { ...item, deleted: true, updatedAt: now } : item));
  journal.replacedStates.forEach(previous => {
    const restored = { ...previous, updatedAt: now };
    const exists = target.states.some(item => item.id === previous.id);
    target.states = exists
      ? target.states.map(item => (item.id === previous.id ? restored : item))
      : [...target.states, restored];
    target.dirty = { ...target.dirty, [dirtyKey('states', previous.id)]: true };
  });
  dropOccasion.forEach(id => {
    target.dirty = { ...target.dirty, [dirtyKey('occasions', id)]: true };
  });
  dropState.forEach(id => {
    target.dirty = { ...target.dirty, [dirtyKey('states', id)]: true };
  });
  dropGift.forEach(id => {
    target.dirty = { ...target.dirty, [dirtyKey('gifts', id)]: true };
  });
  const restorePerson: Person = { ...journal.sourcePerson, deleted: false, updatedAt: now };
  source.people = source.people.some(person => person.id === restorePerson.id)
    ? source.people.map(person => (person.id === restorePerson.id ? restorePerson : person))
    : [...source.people, restorePerson];
  const restoreRows = <T extends { id: string }>(current: T[], copies: T[]): T[] => {
    const map = new Map(current.map(item => [item.id, item]));
    copies.forEach(copy => {
      map.set(copy.id, { ...copy, deleted: false, updatedAt: now });
    });
    return [...map.values()];
  };
  source.occasions = restoreRows(source.occasions, journal.sourceOccasions);
  source.states = restoreRows(source.states, journal.sourceStates);
  source.gifts = restoreRows(source.gifts, journal.sourceGifts);
  source.group = { ...source.group, peopleCount: journal.sourcePeopleCount, updatedAt: now };
  source.dirty = {
    ...source.dirty,
    'group:meta': true,
    [dirtyKey('people', journal.sourcePersonId)]: true,
  };
  journal.sourceOccasions.forEach(item => {
    source.dirty[dirtyKey('occasions', item.id)] = true;
  });
  journal.sourceStates.forEach(item => {
    source.dirty[dirtyKey('states', item.id)] = true;
  });
  journal.sourceGifts.forEach(item => {
    source.dirty[dirtyKey('gifts', item.id)] = true;
  });
  let next = withBundle(snapshot, source);
  next = withBundle(next, target);
  const privateIds = new Set(journal.privateGiftIds);
  next = {
    ...next,
    privateGifts: (next.privateGifts ?? []).map(gift => (privateIds.has(gift.id) ? { ...gift, deleted: true, updatedAt: now } : gift)),
    mergeJournal: null,
  };
  privateIds.forEach(id => {
    next.dirty = { ...next.dirty, [dirtyKey('privateGifts', id)]: true };
  });
  return next;
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
