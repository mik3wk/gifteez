import { FieldValue, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import { canReceiveList, decideRotationClaim, planAccountDeletion } from './groupAdmin';
import { normalizeOwnedGroupIds, releaseOwnedId } from './lists';
import { decidePersonWrite, lockedPersonIds, type PersonRow } from './peopleCap';

const HIDDEN = ['states', 'gifts', 'ideas'] as const;

function readMemberIds(data: { memberIds?: unknown } | undefined): string[] {
  const raw = data?.memberIds;
  return Array.isArray(raw) ? raw.map(item => String(item)) : [];
}

export async function deleteGroupTree(db: Firestore, groupId: string): Promise<void> {
  const invites = await db.collection('invites').where('groupId', '==', groupId).get();
  let batch = db.batch();
  let writes = 0;
  for (const invite of invites.docs) {
    batch.set(invite.ref, { active: false, updatedAt: Date.now() }, { merge: true });
    writes += 1;
    if (writes === 400) {
      await batch.commit();
      batch = db.batch();
      writes = 0;
    }
  }
  if (writes > 0) {
    await batch.commit();
  }
  await db.recursiveDelete(db.collection('groups').doc(groupId));
}

export async function deactivateInvites(db: Firestore, groupId: string): Promise<void> {
  const invites = await db.collection('invites').where('groupId', '==', groupId).get();
  await Promise.all(invites.docs.map(invite => invite.ref.set({ active: false, updatedAt: Date.now() }, { merge: true })));
}

async function peopleRows(db: Firestore, groupId: string): Promise<PersonRow[]> {
  const snap = await db.collection('groups').doc(groupId).collection('people').get();
  return snap.docs.map(item => ({
    id: item.id,
    createdAt: Number(item.data().createdAt ?? item.data().updatedAt ?? 0),
    deleted: item.data().deleted === true,
  }));
}

export async function applyEntitlement(db: Firestore, uid: string, entitled: boolean, limit: number): Promise<void> {
  await db.collection('accounts').doc(uid).set({ entitled, updatedAt: Date.now() }, { merge: true });
  const groups = await db.collection('groups').where('ownerId', '==', uid).get();
  await Promise.all(groups.docs.map(async group => {
    const rows = await peopleRows(db, group.id);
    await group.ref.set({
      entitled,
      lockedPersonIds: lockedPersonIds(rows, entitled, limit),
    }, { merge: true });
  }));
}

export async function writePersonDoc(db: Firestore, input: {
  groupId: string;
  uid: string;
  personId: string;
  ciphertext: string;
  updatedAt: number;
  deleted: boolean;
  createdAt: number;
  limit: number;
}): Promise<{ peopleCount: number; lockedPersonIds: string[] }> {
  const groupRef = db.collection('groups').doc(input.groupId);
  const personRef = groupRef.collection('people').doc(input.personId);
  let failure: 'cap' | 'missing' | 'member' | null = null;
  let peopleCount = 0;
  let locked: string[] = [];
  await db.runTransaction(async transaction => {
    failure = null;
    const group = await transaction.get(groupRef);
    if (!group.exists) {
      failure = 'missing';
      return;
    }
    const memberIds = readMemberIds(group.data());
    if (!memberIds.includes(input.uid)) {
      failure = 'member';
      return;
    }
    const peopleSnap = await transaction.get(groupRef.collection('people'));
    const rows: PersonRow[] = peopleSnap.docs.map(item => ({
      id: item.id,
      createdAt: Number(item.data().createdAt ?? item.data().updatedAt ?? 0),
      deleted: item.data().deleted === true,
    }));
    const decision = decidePersonWrite({
      entitled: group.data()?.entitled === true,
      people: rows,
      personId: input.personId,
      createdAt: input.createdAt,
      deleted: input.deleted,
      limit: input.limit,
    });
    if (!decision.ok) {
      failure = 'cap';
      peopleCount = decision.peopleCount;
      locked = decision.lockedPersonIds;
      return;
    }
    const existing = peopleSnap.docs.find(item => item.id === input.personId);
    const linkedUid = typeof existing?.data()?.linkedUid === 'string' ? existing.data()?.linkedUid : '';
    transaction.set(personRef, {
      ciphertext: input.ciphertext,
      updatedAt: input.updatedAt,
      deleted: input.deleted,
      createdAt: Number(existing?.data()?.createdAt ?? input.createdAt),
      linkedUid,
      personId: input.personId,
    }, { merge: true });
    transaction.set(groupRef, {
      peopleCount: decision.peopleCount,
      lockedPersonIds: decision.lockedPersonIds,
    }, { merge: true });
    peopleCount = decision.peopleCount;
    locked = decision.lockedPersonIds;
  });
  if (failure === 'cap') {
    throw Object.assign(new Error('cap'), { code: 'cap' });
  }
  if (failure === 'missing') {
    throw Object.assign(new Error('missing'), { code: 'missing' });
  }
  if (failure === 'member') {
    throw Object.assign(new Error('member'), { code: 'member' });
  }
  return { peopleCount, lockedPersonIds: locked };
}

async function moveDoc(
  db: Firestore,
  groupId: string,
  from: DocumentReference,
  to: DocumentReference,
  personId: string,
): Promise<void> {
  const snap = await from.get();
  if (!snap.exists) {
    return;
  }
  const data = snap.data() ?? {};
  await to.set({ ...data, personId });
  await from.delete();
}

export async function linkRecipientDocs(db: Firestore, input: {
  groupId: string;
  uid: string;
  personId: string;
  linkedUid: string;
  states: string[];
  gifts: string[];
  ideas: string[];
}): Promise<void> {
  const groupRef = db.collection('groups').doc(input.groupId);
  const group = await groupRef.get();
  if (!group.exists || group.data()?.ownerId !== input.uid) {
    throw Object.assign(new Error('owner'), { code: 'owner' });
  }
  const memberIds = readMemberIds(group.data());
  if (input.linkedUid && !memberIds.includes(input.linkedUid)) {
    throw Object.assign(new Error('member'), { code: 'member' });
  }
  const personRef = groupRef.collection('people').doc(input.personId);
  const person = await personRef.get();
  if (!person.exists) {
    throw Object.assign(new Error('missing'), { code: 'missing' });
  }
  const previous = typeof person.data()?.linkedUid === 'string' ? String(person.data()?.linkedUid) : '';
  await personRef.set({ linkedUid: input.linkedUid }, { merge: true });
  const collections = { states: input.states, gifts: input.gifts, ideas: input.ideas };
  if (input.linkedUid) {
    for (const name of HIDDEN) {
      for (const id of collections[name]) {
        await moveDoc(
          db,
          input.groupId,
          groupRef.collection(name).doc(id),
          groupRef.collection('hidden').doc(input.linkedUid).collection(name).doc(id),
          input.personId,
        );
      }
    }
    return;
  }
  if (!previous) {
    return;
  }
  for (const name of HIDDEN) {
    const hidden = await groupRef.collection('hidden').doc(previous).collection(name).get();
    for (const doc of hidden.docs) {
      if (String(doc.data().personId ?? '') !== input.personId && !collections[name].includes(doc.id)) {
        continue;
      }
      await moveDoc(db, input.groupId, doc.ref, groupRef.collection(name).doc(doc.id), input.personId);
    }
  }
}

export async function transferOwner(db: Firestore, input: { groupId: string; uid: string; nextOwnerId: string }): Promise<void> {
  const groupRef = db.collection('groups').doc(input.groupId);
  const accountRef = db.collection('accounts').doc(input.nextOwnerId);
  const oldAccountRef = db.collection('accounts').doc(input.uid);
  await db.runTransaction(async transaction => {
    const group = await transaction.get(groupRef);
    if (!group.exists || group.data()?.ownerId !== input.uid) {
      throw Object.assign(new Error('owner'), { code: 'owner' });
    }
    const memberIds = readMemberIds(group.data());
    if (!memberIds.includes(input.nextOwnerId) || input.nextOwnerId === input.uid) {
      throw Object.assign(new Error('member'), { code: 'member' });
    }
    const nextAccount = await transaction.get(accountRef);
    const entitled = nextAccount.data()?.entitled === true;
    const owned = normalizeOwnedGroupIds(nextAccount.data()?.ownedGroupIds);
    if (!canReceiveList({ entitled, ownedGroupIds: owned, groupId: input.groupId })) {
      throw Object.assign(new Error('one-list'), { code: 'one-list' });
    }
    const oldAccount = await transaction.get(oldAccountRef);
    transaction.set(groupRef, { ownerId: input.nextOwnerId, entitled, updatedAt: Date.now() }, { merge: true });
    transaction.set(accountRef, {
      ownedGroupIds: [...owned.filter(id => id !== input.groupId), input.groupId],
      updatedAt: Date.now(),
    }, { merge: true });
    transaction.set(oldAccountRef, {
      ownedGroupIds: releaseOwnedId(normalizeOwnedGroupIds(oldAccount.data()?.ownedGroupIds), input.groupId),
      updatedAt: Date.now(),
    }, { merge: true });
  });
  const group = await groupRef.get();
  const rows = await peopleRows(db, input.groupId);
  await groupRef.set({
    lockedPersonIds: lockedPersonIds(rows, group.data()?.entitled === true, 5),
  }, { merge: true });
}

export async function removeMemberServer(db: Firestore, input: { groupId: string; actorUid: string; targetUid: string }): Promise<void> {
  const groupRef = db.collection('groups').doc(input.groupId);
  await db.runTransaction(async transaction => {
    const group = await transaction.get(groupRef);
    if (!group.exists || group.data()?.ownerId !== input.actorUid) {
      throw Object.assign(new Error('owner'), { code: 'owner' });
    }
    if (input.targetUid === input.actorUid) {
      throw Object.assign(new Error('owner'), { code: 'owner' });
    }
    const memberIds = readMemberIds(group.data()).filter(id => id !== input.targetUid);
    transaction.update(groupRef, { memberIds, needsRotation: true, updatedAt: Date.now() });
  });
  await deactivateInvites(db, input.groupId);
}

export async function leaveGroupServer(db: Firestore, input: { groupId: string; uid: string }): Promise<'deleted' | 'left'> {
  const groupRef = db.collection('groups').doc(input.groupId);
  const accountRef = db.collection('accounts').doc(input.uid);
  const mode = await db.runTransaction(async (transaction): Promise<'deleted' | 'left' | 'absent'> => {
    const group = await transaction.get(groupRef);
    if (!group.exists) {
      return 'deleted';
    }
    const memberIds = readMemberIds(group.data());
    if (!memberIds.includes(input.uid)) {
      return 'absent';
    }
    const others = memberIds.filter(id => id !== input.uid);
    if (group.data()?.ownerId === input.uid && others.length > 0) {
      throw Object.assign(new Error('owner-stays'), { code: 'owner-stays' });
    }
    if (others.length === 0) {
      const account = await transaction.get(accountRef);
      transaction.set(accountRef, {
        ownedGroupIds: releaseOwnedId(normalizeOwnedGroupIds(account.data()?.ownedGroupIds), input.groupId),
        updatedAt: Date.now(),
      }, { merge: true });
      return 'deleted';
    }
    transaction.update(groupRef, {
      memberIds: others,
      needsRotation: true,
      updatedAt: Date.now(),
    });
    return 'left';
  });
  if (mode === 'deleted') {
    await deleteGroupTree(db, input.groupId);
    return 'deleted';
  }
  if (mode === 'left') {
    await deactivateInvites(db, input.groupId);
  }
  return 'left';
}

export async function releaseOwnedTree(db: Firestore, uid: string, groupId: string): Promise<void> {
  const groupRef = db.collection('groups').doc(groupId);
  const accountRef = db.collection('accounts').doc(uid);
  const group = await groupRef.get();
  if (group.exists) {
    if (group.data()?.ownerId !== uid) {
      throw Object.assign(new Error('owner'), { code: 'owner' });
    }
    const memberIds = readMemberIds(group.data());
    if (memberIds.some(id => id !== uid)) {
      throw Object.assign(new Error('owner-stays'), { code: 'owner-stays' });
    }
    await deleteGroupTree(db, groupId);
  }
  await db.runTransaction(async transaction => {
    const account = await transaction.get(accountRef);
    transaction.set(accountRef, {
      ownedGroupIds: releaseOwnedId(normalizeOwnedGroupIds(account.data()?.ownedGroupIds), groupId),
      updatedAt: Date.now(),
    }, { merge: true });
  });
}

export async function claimRotation(db: Firestore, groupId: string, uid: string): Promise<boolean> {
  const ref = db.collection('groups').doc(groupId);
  let ok = false;
  await db.runTransaction(async transaction => {
    const group = await transaction.get(ref);
    if (!group.exists) {
      return;
    }
    const memberIds = readMemberIds(group.data());
    const allowed = decideRotationClaim({
      needsRotation: group.data()?.needsRotation === true,
      rotatingBy: String(group.data()?.rotatingBy ?? ''),
      uid,
      member: memberIds.includes(uid),
    });
    if (!allowed) {
      return;
    }
    transaction.update(ref, { rotatingBy: uid });
    ok = true;
  });
  return ok;
}

export async function finishRotation(db: Firestore, groupId: string, uid: string, keyVersion: number): Promise<void> {
  const ref = db.collection('groups').doc(groupId);
  await db.runTransaction(async transaction => {
    const group = await transaction.get(ref);
    if (!group.exists) {
      throw Object.assign(new Error('missing'), { code: 'missing' });
    }
    const memberIds = readMemberIds(group.data());
    if (!memberIds.includes(uid) || String(group.data()?.rotatingBy ?? '') !== uid) {
      throw Object.assign(new Error('member'), { code: 'member' });
    }
    const current = Number(group.data()?.keyVersion ?? 0);
    if (keyVersion !== current + 1) {
      throw Object.assign(new Error('version'), { code: 'version' });
    }
    transaction.update(ref, {
      keyVersion,
      needsRotation: false,
      rotatingBy: FieldValue.delete(),
      updatedAt: Date.now(),
    });
  });
}

export async function listGroupIds(
  db: Firestore,
  uid: string,
): Promise<Array<{ id: string; ownerId: string; memberIds: string[] }>> {
  const snap = await db.collection('groups').where('memberIds', 'array-contains', uid).get();
  return snap.docs.map(item => ({
    id: item.id,
    ownerId: String(item.data().ownerId ?? ''),
    memberIds: readMemberIds(item.data()),
  }));
}

export async function deleteAccountGroups(db: Firestore, uid: string, limit: number): Promise<void> {
  const snap = await db.collection('groups').where('memberIds', 'array-contains', uid).get();
  const plan = planAccountDeletion(snap.docs.map(item => ({
    id: item.id,
    ownerId: String(item.data().ownerId ?? ''),
    memberIds: readMemberIds(item.data()),
  })), uid);
  for (const step of plan) {
    if (step.action === 'delete') {
      await releaseOwnedTree(db, uid, step.groupId);
      continue;
    }
    if (step.action === 'transfer-and-remove') {
      const groupRef = db.collection('groups').doc(step.groupId);
      const nextAccount = await db.collection('accounts').doc(step.nextOwnerId).get();
      const entitled = nextAccount.data()?.entitled === true;
      const owned = normalizeOwnedGroupIds(nextAccount.data()?.ownedGroupIds);
      await groupRef.set({
        ownerId: step.nextOwnerId,
        entitled,
        memberIds: FieldValue.arrayRemove(uid),
        needsRotation: true,
        updatedAt: Date.now(),
      }, { merge: true });
      await db.collection('accounts').doc(step.nextOwnerId).set({
        ownedGroupIds: [...owned.filter(id => id !== step.groupId), step.groupId],
        updatedAt: Date.now(),
      }, { merge: true });
      await db.collection('accounts').doc(uid).set({
        ownedGroupIds: releaseOwnedId(normalizeOwnedGroupIds((await db.collection('accounts').doc(uid).get()).data()?.ownedGroupIds), step.groupId),
        updatedAt: Date.now(),
      }, { merge: true });
      const rows = await peopleRows(db, step.groupId);
      await groupRef.set({ lockedPersonIds: lockedPersonIds(rows, entitled, limit) }, { merge: true });
      await deactivateInvites(db, step.groupId);
      continue;
    }
    await db.collection('groups').doc(step.groupId).set({
      memberIds: FieldValue.arrayRemove(uid),
      needsRotation: true,
      updatedAt: Date.now(),
    }, { merge: true });
    await deactivateInvites(db, step.groupId);
  }
}
