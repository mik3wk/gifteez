import { openJson, randomKey, reencryptJson, sealJson } from '../src/crypto/crypto';
import { buyerLabel, claimOccasion, claimWarningUid, isMyPurchase, otherClaim, spendByMember, unclaimOccasion, visibleGifts } from '../src/domain/claims';
import { clearIdea, logPurchase, saveIdea, stateId } from '../src/domain/logic';
import { applyMerge, findDuplicatePeople, giftsOnList, mergePrivateGifts, normalizePersonName, peopleOnOtherLists } from '../src/domain/merge';
import { emptySnapshot, type AppSnapshot, type GiftRecord, type GroupArchive, type GroupMeta, type Member, type Occasion, type OccasionState, type Person, type PrivateGift } from '../src/domain/types';

const today = new Date(2026, 9, 22);

test('claims this year, blocks a second claimer, and lets the claimer or owner unclaim', () => {
  const snapshot = withPeople(base(), [person('ada', 'Ada')], [occasion('bday', 'ada', 'birthday', 10, 25)]);
  const claimed = claimOccasion({ snapshot, occasionId: 'bday', uid: 'me', now: 10, today });
  expect(claimed.ok).toBe(true);
  if (!claimed.ok) {
    return;
  }
  expect(claimed.value.claimedBy).toBe('me');
  expect(claimed.value.claimedAt).toBe(10);
  expect(claimed.value.id).toBe(stateId('bday', 2026));
  const stolen = claimOccasion({ snapshot: claimed.snapshot, occasionId: 'bday', uid: 'sam', now: 11, today });
  expect(stolen.ok).toBe(false);
  if (!stolen.ok) {
    expect(stolen.error).toBe('claimed');
  }
  const again = claimOccasion({ snapshot: claimed.snapshot, occasionId: 'bday', uid: 'me', now: 12, today });
  expect(again.ok).toBe(true);
  if (again.ok) {
    expect(again.value.claimedAt).toBe(10);
  }
  const stranger = unclaimOccasion({ snapshot: claimed.snapshot, occasionId: 'bday', uid: 'sam', now: 13, today });
  expect(stranger.ok).toBe(false);
  if (!stranger.ok) {
    expect(stranger.error).toBe('forbidden');
  }
  const self = unclaimOccasion({ snapshot: claimed.snapshot, occasionId: 'bday', uid: 'me', now: 14, today });
  expect(self.ok).toBe(true);
  if (self.ok) {
    expect(self.value.claimedBy).toBeUndefined();
    expect(self.value.claimedAt).toBeUndefined();
    expect(self.value.status).toBe('not-started');
  }
  const owner = unclaimOccasion({ snapshot: claimed.snapshot, occasionId: 'bday', uid: 'owner', now: 15, today });
  expect(owner.ok).toBe(true);
  if (owner.ok) {
    expect(owner.value.claimedBy).toBeUndefined();
  }
});

test('clearing a saved idea keeps a purchase and drops only the idea', () => {
  const snapshot = withPeople(base(), [person('ada', 'Ada')], [occasion('bday', 'ada', 'birthday', 10, 25)]);
  const saved = saveIdea({
    snapshot,
    occasion: snapshot.occasions[0],
    idea: 'A book',
    today,
    now: 20,
  });
  const cleared = clearIdea({ snapshot: saved, occasion: saved.occasions[0], today, now: 21 });
  const state = cleared.states.find(item => item.id === stateId('bday', 2026));
  expect(state?.savedIdea).toBeNull();
  expect(state?.status).toBe('not-started');
  const purchased = logPurchase({
    snapshot: saved,
    occasion: saved.occasions[0],
    gift: makeGift('g1', 'ada', 'bday', 1800, '2026-10-22', 'me'),
  });
  const kept = clearIdea({ snapshot: purchased, occasion: purchased.occasions[0], today, now: 22 });
  const bought = kept.states.find(item => item.id === stateId('bday', 2026));
  expect(bought?.status).toBe('purchased');
  expect(bought?.savedIdea).toBeNull();
});

test('saving an idea or logging a purchase keeps the claim, and a warning does not block the gift', () => {
  const snapshot = withPeople(base(), [person('ada', 'Ada')], [occasion('bday', 'ada', 'birthday', 10, 25)]);
  const claimed = claimOccasion({ snapshot, occasionId: 'bday', uid: 'sam', now: 10, today });
  expect(claimed.ok).toBe(true);
  if (!claimed.ok) {
    return;
  }
  const saved = saveIdea({
    snapshot: claimed.snapshot,
    occasion: claimed.snapshot.occasions[0],
    idea: 'A book',
    today,
    now: 20,
  });
  const savedState = saved.states.find(state => state.id === stateId('bday', 2026));
  expect(savedState?.claimedBy).toBe('sam');
  expect(savedState?.claimedAt).toBe(10);
  expect(savedState?.status).toBe('idea-saved');
  const gift = makeGift('g1', 'ada', 'bday', 1800, '2026-10-22', 'me');
  const purchased = logPurchase({ snapshot: saved, occasion: saved.occasions[0], gift });
  const purchasedState = purchased.states.find(state => state.id === stateId('bday', 2026));
  expect(purchasedState?.status).toBe('purchased');
  expect(purchasedState?.claimedBy).toBe('sam');
  expect(purchased.gifts[0].boughtBy).toBe('me');
  expect(claimWarningUid({
    states: purchased.states,
    occasion: purchased.occasions[0],
    purchaseYear: 2026,
    today,
    uid: 'me',
  })).toBe('sam');
  expect(otherClaim(purchasedState, 'sam')).toBeNull();
  const older = makeGift('old', 'ada', 'bday', 500, '2024-01-02');
  delete older.boughtBy;
  const withOlder = logPurchase({ snapshot: purchased, occasion: purchased.occasions[0], gift: older });
  expect(withOlder.gifts.find(item => item.id === 'old')?.boughtBy).toBeUndefined();
  expect(buyerLabel(undefined, 'me', withOlder.members)).toEqual({ kind: 'none' });
  expect(buyerLabel('me', 'me', withOlder.members)).toEqual({ kind: 'you' });
  expect(buyerLabel('sam', 'me', withOlder.members)).toEqual({ kind: 'name', name: 'Sam' });
});

test('spend breakdown attributes buyers, keeps gifts with no buyer, and counts private gifts only for this user', () => {
  const members = base().members;
  const gifts = [
    makeGift('mine', 'ada', 'bday', 1000, '2026-02-01', 'me'),
    makeGift('sam', 'ada', 'bday', 2500, '2026-03-01', 'sam'),
    makeGift('old', 'ada', 'bday', 400, '2024-03-01'),
    makeGift('other-person', 'bea', 'bday', 9999, '2026-03-01', 'me'),
  ];
  const privateGifts: PrivateGift[] = [{
    id: 'secret',
    personId: 'ada',
    groupId: 'group',
    occasionId: 'bday',
    year: 2026,
    title: 'Secret',
    priceCents: 300,
    purchasedOn: '2026-04-01',
    updatedAt: 1,
  }];
  const spend = spendByMember({
    personId: 'ada',
    gifts,
    privateGifts,
    members,
    selfUid: 'me',
    year: 2026,
    groupId: 'group',
  });
  const me = spend.rows.find(row => row.uid === 'me');
  const sam = spend.rows.find(row => row.uid === 'sam');
  expect(me).toMatchObject({ self: true, yearCents: 1300, allCents: 1300 });
  expect(sam).toMatchObject({ name: 'Sam', self: false, yearCents: 2500, allCents: 2500 });
  expect(spend.unknownYearCents).toBe(0);
  expect(spend.unknownAllCents).toBe(400);
  const hidden = spendByMember({
    personId: 'ada',
    gifts,
    privateGifts,
    members,
    selfUid: 'me',
    year: 2026,
    groupId: 'other-group',
  });
  expect(hidden.rows.find(row => row.uid === 'me')?.yearCents).toBe(1000);
  const visible = visibleGifts({ personId: 'ada', gifts, privateGifts, groupId: 'group' });
  expect(visible.filter(item => isMyPurchase(item, 'me')).map(item => item.id).sort()).toEqual(['mine', 'secret']);
  expect(visible.find(item => item.id === 'old')?.boughtBy).toBeUndefined();
  expect(isMyPurchase({ boughtBy: undefined }, 'me')).toBe(false);
});

test('duplicate detection matches a normalized name or a birthday and does not merge', () => {
  const snapshot = base();
  snapshot.people = [person('ada', 'Ada Lovelace')];
  snapshot.occasions = [occasion('group-bday', 'ada', 'birthday', 3, 14), occasion('xmas', 'ada', 'christmas', 12, 25)];
  snapshot.archives = {
    group: archive(snapshot.group!, snapshot.people, snapshot.occasions, []),
    solo: archive(soloGroup(2), [
      person('wife', '  ada   lovelace '),
      person('sarah', 'Sarah'),
      person('nope', 'Nope'),
    ], [
      occasion('wife-bday', 'wife', 'birthday', 3, 14),
      occasion('sarah-bday', 'sarah', 'birthday', 3, 14),
      occasion('nope-xmas', 'nope', 'christmas', 12, 25),
    ], []),
  };
  const before = JSON.stringify(snapshot);
  const hints = findDuplicatePeople(snapshot);
  expect(JSON.stringify(snapshot)).toBe(before);
  const wife = hints.find(hint => hint.sourcePersonId === 'wife');
  const sarah = hints.find(hint => hint.sourcePersonId === 'sarah');
  expect(wife?.reason).toBe('both');
  expect(sarah?.reason).toBe('birthday');
  expect(hints.some(hint => hint.sourcePersonId === 'nope')).toBe(false);
  expect(hints.some(hint => hint.sourceGroupId === 'group')).toBe(false);
  expect(normalizePersonName('  Ada   Lovelace ')).toBe('ada lovelace');
  expect(peopleOnOtherLists(snapshot).map(item => item.personId).sort()).toEqual(['nope', 'sarah', 'wife']);
});

test('merge combines matching occasions, moves checked gifts, and keeps unchecked gifts private', () => {
  const snapshot = base();
  snapshot.group = { ...snapshot.group!, peopleCount: 5, entitled: false };
  snapshot.people = [person('ada', 'Ada'), person('b', 'B'), person('c', 'C'), person('d', 'D'), person('e', 'E')];
  snapshot.occasions = [
    occasion('group-bday', 'ada', 'birthday', 3, 14),
    occasion('group-xmas', 'ada', 'christmas', 12, 25),
  ];
  snapshot.states = [{
    id: stateId('group-bday', 2026),
    occasionId: 'group-bday',
    personId: 'ada',
    year: 2026,
    status: 'not-started',
    savedIdea: null,
    claimedBy: 'owner',
    claimedAt: 3,
    updatedAt: 3,
  }];
  snapshot.gifts = [makeGift('already', 'ada', 'group-bday', 100, '2026-01-01', 'owner')];
  const sourceGifts = [
    makeGift('share', 'wife', 'solo-bday', 2000, '2025-03-14', 'me'),
    makeGift('keep', 'wife', 'solo-bday', 900, '2024-03-14'),
  ];
  snapshot.archives.solo = archive(soloGroup(2), [person('wife', 'Ada'), person('kid', 'Kid')], [
    occasion('solo-bday', 'wife', 'birthday', 3, 14),
    occasion('solo-xmas', 'wife', 'christmas', 12, 20),
  ], sourceGifts, [{
    id: stateId('solo-bday', 2026),
    occasionId: 'solo-bday',
    personId: 'wife',
    year: 2026,
    status: 'purchased',
    savedIdea: 'Scarf',
    claimedBy: 'me',
    claimedAt: 8,
    updatedAt: 8,
  }]);
  let seq = 0;
  const merged = applyMerge({
    snapshot,
    targetPersonId: 'ada',
    targetGroupId: 'group',
    sourcePersonId: 'wife',
    sourceGroupId: 'solo',
    sharedGiftIds: ['share'],
    uid: 'me',
    now: 50,
    freeLimit: 5,
    newId: () => `new-${seq++}`,
  });
  expect(merged.ok).toBe(true);
  if (!merged.ok) {
    return;
  }
  expect(merged.value.targetPeopleCount).toBe(5);
  expect(merged.value.sourcePeopleCount).toBe(1);
  expect(merged.snapshot.people.filter(item => !item.deleted)).toHaveLength(5);
  const birthdays = merged.snapshot.occasions.filter(item => item.personId === 'ada' && !item.deleted && item.type === 'birthday');
  expect(birthdays).toHaveLength(1);
  expect(birthdays[0].id).toBe('group-bday');
  const christmas = merged.snapshot.occasions.filter(item => item.personId === 'ada' && !item.deleted && item.type === 'christmas');
  expect(christmas.map(item => item.day).sort()).toEqual([20, 25]);
  const shared = merged.snapshot.gifts.find(item => item.title === 'Gift' && item.priceCents === 2000 && !item.deleted);
  expect(shared?.personId).toBe('ada');
  expect(shared?.occasionId).toBe('group-bday');
  expect(shared?.boughtBy).toBe('me');
  expect(merged.snapshot.gifts.some(item => item.id === 'keep')).toBe(false);
  expect(merged.value.privateGiftIds).toHaveLength(1);
  const kept = merged.snapshot.privateGifts.find(item => item.id === merged.value.privateGiftIds[0]);
  expect(kept).toMatchObject({
    personId: 'ada',
    groupId: 'group',
    occasionId: 'group-bday',
    priceCents: 900,
    title: 'Gift',
  });
  expect(kept?.boughtBy).toBeUndefined();
  expect(merged.snapshot.dirty[`privateGifts:${kept?.id}`]).toBe(true);
  const state = merged.snapshot.states.find(item => item.id === stateId('group-bday', 2026));
  expect(state?.status).toBe('purchased');
  expect(state?.claimedBy).toBe('owner');
  expect(state?.savedIdea).toBe('Scarf');
  const source = merged.snapshot.archives.solo;
  expect(source.people.find(item => item.id === 'wife')?.deleted).toBe(true);
  expect(source.people.find(item => item.id === 'kid')?.deleted).toBeUndefined();
  expect(source.group.peopleCount).toBe(1);
  expect(source.occasions.find(item => item.id === 'solo-bday')?.deleted).toBe(true);
  expect(source.gifts.every(item => item.deleted)).toBe(true);
  expect(source.dirty['group:meta']).toBe(true);
  expect(snapshot.people.find(item => item.id === 'ada')?.deleted).toBeUndefined();
});

test('a merge that would add a recipient to a full free list is refused, and deleting the source frees a slot', () => {
  const snapshot = base();
  snapshot.group = { ...snapshot.group!, peopleCount: 5, entitled: false };
  snapshot.people = [person('a', 'A'), person('b', 'B'), person('c', 'C'), person('d', 'D'), person('e', 'E')];
  snapshot.archives.solo = archive(soloGroup(5), [person('wife', 'Ada'), ...['w', 'x', 'y', 'z'].map(id => person(id, id))], [], []);
  const refused = applyMerge({
    snapshot,
    targetPersonId: 'missing',
    targetGroupId: 'group',
    sourcePersonId: 'wife',
    sourceGroupId: 'solo',
    sharedGiftIds: [],
    uid: 'me',
    now: 1,
    freeLimit: 5,
    newId: () => 'new',
  });
  expect(refused.ok).toBe(false);
  if (!refused.ok) {
    expect(refused.error).toBe('cap');
  }
  expect(snapshot.archives.solo.people.find(item => item.id === 'wife')?.deleted).toBeUndefined();
  expect(snapshot.group?.peopleCount).toBe(5);
  const room = applyMerge({
    snapshot: { ...snapshot, people: snapshot.people.slice(0, 2), group: { ...snapshot.group!, peopleCount: 2 } },
    targetPersonId: 'missing',
    targetGroupId: 'group',
    sourcePersonId: 'wife',
    sourceGroupId: 'solo',
    sharedGiftIds: [],
    uid: 'me',
    now: 1,
    freeLimit: 5,
    newId: () => 'new',
  });
  expect(room.ok).toBe(false);
  if (!room.ok) {
    expect(room.error).toBe('missing');
  }
});

test('re-encrypts a moved gift onto the target group key, and a private gift does not open with that key', () => {
  const sourceKey = randomKey();
  const targetKey = randomKey();
  const deviceKey = randomKey();
  const sealed = sealJson({ title: 'Scarf', priceCents: 1200 }, sourceKey);
  expect(sealed.includes('Scarf')).toBe(false);
  const moved = reencryptJson(sealed, sourceKey, targetKey);
  expect(openJson<{ title: string }>(moved, targetKey).title).toBe('Scarf');
  expect(() => openJson(moved, sourceKey)).toThrow();
  const privateSealed = sealJson({ title: 'Secret', priceCents: 900 }, deviceKey);
  expect(() => openJson(privateSealed, targetKey)).toThrow();
  expect(openJson<{ title: string }>(privateSealed, deviceKey).title).toBe('Secret');
});

test('private gift sync keeps a newer local edit and accepts a newer remote one', () => {
  const local: PrivateGift = {
    id: 'p',
    personId: 'ada',
    groupId: 'group',
    occasionId: 'bday',
    year: 2026,
    title: 'Local',
    priceCents: 1,
    purchasedOn: '2026-01-01',
    updatedAt: 9,
  };
  const remote: PrivateGift = { ...local, title: 'Remote', updatedAt: 5 };
  const dirty = mergePrivateGifts([local], [remote], { 'privateGifts:p': true });
  expect(dirty[0].title).toBe('Local');
  const taken = mergePrivateGifts([{ ...local, updatedAt: 4 }], [{ ...remote, updatedAt: 9 }], {});
  expect(taken[0].title).toBe('Remote');
  const extra = mergePrivateGifts([local], [], {});
  expect(extra).toHaveLength(1);
  expect(giftsOnList(base(), 'missing', 'ada')).toEqual([]);
});

function base(): AppSnapshot {
  const snapshot = emptySnapshot(1);
  snapshot.profile.uid = 'me';
  snapshot.group = group('group', 'owner', ['owner', 'me', 'sam'], 1, false);
  snapshot.members = [
    member('owner', 'Olivia'),
    member('me', 'Mina'),
    member('sam', 'Sam'),
  ];
  return snapshot;
}

function withPeople(snapshot: AppSnapshot, people: Person[], occasions: Occasion[]): AppSnapshot {
  return { ...snapshot, people, occasions };
}

function group(id: string, ownerId: string, memberIds: string[], peopleCount: number, entitled: boolean): GroupMeta {
  return { id, name: id, ownerId, memberIds, peopleCount, entitled, updatedAt: 1 };
}

function soloGroup(peopleCount: number): GroupMeta {
  return group('solo', 'me', ['me'], peopleCount, false);
}

function member(uid: string, displayName: string): Member {
  return { id: uid, uid, displayName, updatedAt: 1 };
}

function person(id: string, name: string): Person {
  return { id, name, budgetCents: null, tags: [], imported: false, opened: true, createdAt: 1, updatedAt: 1 };
}

function occasion(id: string, personId: string, type: Occasion['type'], month: number, day: number): Occasion {
  return { id, personId, type, month, day, updatedAt: 1 };
}

function makeGift(id: string, personId: string, occasionId: string, priceCents: number, purchasedOn: string, boughtBy?: string): GiftRecord {
  return {
    id,
    personId,
    occasionId,
    year: Number(purchasedOn.slice(0, 4)),
    title: 'Gift',
    priceCents,
    purchasedOn,
    updatedAt: 1,
    ...(boughtBy ? { boughtBy } : {}),
  };
}

function archive(meta: GroupMeta, people: Person[], occasions: Occasion[], gifts: GiftRecord[], states: OccasionState[] = []): GroupArchive {
  return {
    group: meta,
    members: [member('me', 'Mina')],
    people,
    occasions,
    states,
    gifts,
    ideas: [],
    dirty: {},
    inviteId: null,
  };
}
