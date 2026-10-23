import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { canRefresh, emptyUsage, nextUsage, type Usage } from './caps';
import { DEFAULT_GROUP_MAX_MEMBERS, groupHasRoom } from './members';
import { decideOwnedCreate, normalizeOwnedGroupIds } from './lists';
import { fingerprint } from './fingerprint';
import { appleTransactionGrants, googlePurchaseGrants, verifyAppleVerdict, verifyGoogleVerdict } from './iap';
import { shouldRevokeEntitlement } from './entitlement';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import {
  applyEntitlement,
  claimRotation,
  deleteAccountGroups,
  finishRotation,
  leaveGroupServer,
  linkRecipientDocs,
  listGroupIds,
  releaseOwnedTree,
  removeMemberServer,
  transferOwner,
  writePersonDoc,
} from './groupOps';
import { promptHash, requestIdeas, type IdeaPrompt } from './ideas';

initializeApp();
setGlobalOptions({ region: 'us-central1' });

const openaiKey = defineSecret('OPENAI_API_KEY');
const pepper = defineSecret('FINGERPRINT_PEPPER');
const model = defineString('OPENAI_MODEL', { default: 'gpt-4o-mini' });
const freeRefreshes = defineString('AI_FREE_REFRESHES_PER_PERSON', { default: '5' });
const paidRefreshes = defineString('AI_PAID_REFRESHES_PER_PERSON_PER_MONTH', { default: '20' });
const freePeople = defineString('FREE_TIER_MAX_PEOPLE', { default: '5' });
const groupMax = defineString('GROUP_MAX_MEMBERS', { default: String(DEFAULT_GROUP_MAX_MEMBERS) });
const unlockProduct = defineString('IAP_UNLOCK_PRODUCT_ID', { default: 'gifteez_unlock' });
const appleKey = defineString('APPLE_IAP_PRIVATE_KEY', { default: '' });
const appleKeyId = defineString('APPLE_IAP_KEY_ID', { default: '' });
const appleIssuer = defineString('APPLE_IAP_ISSUER_ID', { default: '' });
const appleBundle = defineString('APPLE_BUNDLE_ID', { default: 'com.gifteez' });
const playPackage = defineString('GOOGLE_PLAY_PACKAGE_NAME', { default: 'com.gifteez' });
const playAccount = defineString('GOOGLE_PLAY_SERVICE_ACCOUNT', { default: '' });

const callable = { enforceAppCheck: true, secrets: [openaiKey, pepper] };

export const generateGiftIdeas = onCall(callable, async request => {
  const uid = requireUid(request.auth?.uid);
  const device = requireString(request.data?.deviceId, 'deviceId');
  const personId = requireString(request.data?.personId, 'personId');
  const refresh = Boolean(request.data?.refresh);
  const prompt = (request.data?.prompt ?? {}) as IdeaPrompt;
  await assertPerson(uid, personId);
  const id = fingerprint(pepper.value(), device);
  const db = getFirestore();
  const account = await db.collection('accounts').doc(uid).get();
  const paid = account.data()?.entitled === true || await isPaid(id);
  const limits = { free: numberParam(freeRefreshes.value(), 5), paidPerMonth: numberParam(paidRefreshes.value(), 20) };
  const usageRef = db.collection('aiUsage').doc(id).collection('people').doc(personId);
  const cacheRef = db.collection('aiCache').doc(id).collection('entries').doc(hashKey(promptHash(personId, prompt)));
  const [usageSnap, cacheSnap] = await Promise.all([usageRef.get(), cacheRef.get()]);
  const usage = usageSnap.exists ? (usageSnap.data() as Usage) : emptyUsage();
  const cachedIdeas = cacheSnap.exists ? ((cacheSnap.data()?.ideas as string[]) ?? []) : [];
  const decision = canRefresh({
    usage,
    paid,
    now: new Date(),
    limits,
    refresh,
    cacheHit: cachedIdeas.length > 0,
  });
  if (!decision.ok) {
    throw new HttpsError('resource-exhausted', 'cap');
  }
  if (!decision.counted) {
    return { ideas: cachedIdeas, counted: false, remaining: remaining(usage, paid, limits) };
  }
  const ideas = await requestIdeas(openaiKey.value(), model.value(), prompt);
  if (ideas.length === 0) {
    throw new HttpsError('internal', 'ideas');
  }
  const updated = nextUsage(usage, paid, new Date());
  await usageRef.set(updated);
  await cacheRef.set({ ideas, personId, updatedAt: Date.now() });
  return { ideas, counted: true, remaining: remaining(updated, paid, limits) };
});

export const getEntitlement = onCall(callable, async request => {
  const device = requireString(request.data?.deviceId, 'deviceId');
  const id = fingerprint(pepper.value(), device);
  const devicePaid = await isPaid(id);
  let accountPaid = false;
  if (request.auth?.uid) {
    const account = await getFirestore().collection('accounts').doc(request.auth.uid).get();
    accountPaid = account.data()?.entitled === true;
    if (devicePaid) {
      await grantAccountUnlock(request.auth.uid);
    }
  }
  return { paid: devicePaid || accountPaid };
});

export const verifyUnlock = onCall(callable, async request => {
  const uid = requireUid(request.auth?.uid);
  const device = requireString(request.data?.deviceId, 'deviceId');
  const platform = request.data?.platform === 'android' ? 'android' : 'ios';
  const productId = String(request.data?.productId ?? unlockProduct.value());
  const transactionId = String(request.data?.transactionId ?? '');
  const purchaseToken = String(request.data?.purchaseToken ?? '');
  if (productId !== unlockProduct.value()) {
    return { verified: false, reason: 'product' };
  }
  const verdict = platform === 'ios'
    ? await verifyAppleVerdict({
      transactionId,
      privateKey: appleKey.value().replace(/\\n/g, '\n'),
      keyId: appleKeyId.value(),
      issuerId: appleIssuer.value(),
      bundleId: appleBundle.value(),
      productId,
    })
    : await verifyGoogleVerdict({
      packageName: playPackage.value(),
      productId,
      purchaseToken,
      serviceAccountJson: playAccount.value(),
      expectedProduct: productId,
    });
  if (verdict === 'not_configured') {
    return { verified: false, reason: 'not_configured' };
  }
  if (shouldRevokeEntitlement(verdict)) {
    const id = fingerprint(pepper.value(), device);
    await getFirestore().collection('entitlements').doc(id).set({ paid: false, uid, updatedAt: Date.now() }, { merge: true });
    await revokeAccountUnlock(uid);
    return { verified: false, reason: 'revoked' };
  }
  if (verdict !== 'granted') {
    return { verified: false, reason: 'rejected' };
  }
  const id = fingerprint(pepper.value(), device);
  const db = getFirestore();
  await db.collection('entitlements').doc(id).set({
    paid: true,
    productId,
    platform,
    transactionId,
    purchaseToken,
    uid,
    updatedAt: Date.now(),
  });
  await grantAccountUnlock(uid);
  return { verified: true };
});

export const createOwnedGroup = onCall(callable, async request => {
  const uid = requireUid(request.auth?.uid);
  const groupId = requireGroupId(request.data?.groupId);
  const ciphertext = requireString(request.data?.ciphertext, 'ciphertext');
  const device = requireString(request.data?.deviceId, 'deviceId');
  const updatedAt = Number(request.data?.updatedAt);
  if (!Number.isFinite(updatedAt)) {
    throw new HttpsError('invalid-argument', 'updatedAt');
  }
  const db = getFirestore();
  const fp = fingerprint(pepper.value(), device);
  const accountRef = db.collection('accounts').doc(uid);
  const groupRef = db.collection('groups').doc(groupId);
  const entRef = db.collection('entitlements').doc(fp);
  let entitled = false;
  let failure: 'one-list' | 'exists' | null = null;
  await db.runTransaction(async transaction => {
    failure = null;
    const accountSnap = await transaction.get(accountRef);
    const groupSnap = await transaction.get(groupRef);
    const entSnap = await transaction.get(entRef);
    const rawOwned = normalizeOwnedGroupIds(accountSnap.data()?.ownedGroupIds);
    const extraIds = rawOwned.filter(id => id !== groupId);
    const extraSnaps = await Promise.all(extraIds.map(id => transaction.get(db.collection('groups').doc(id))));
    const liveOwned = extraIds.filter((id, index) => {
      const snap = extraSnaps[index];
      return snap?.exists === true && snap.data()?.ownerId === uid;
    });
    const decision = decideOwnedCreate({
      entitled: accountSnap.data()?.entitled === true || entSnap.data()?.paid === true,
      ownedGroupIds: liveOwned,
      groupId,
      groupExists: groupSnap.exists,
      existingOwnerId: String(groupSnap.data()?.ownerId ?? ''),
      uid,
    });
    if (!decision.ok) {
      failure = decision.reason;
      return;
    }
    entitled = decision.entitled;
    if (!groupSnap.exists) {
      transaction.set(groupRef, {
        ownerId: uid,
        memberIds: [uid],
        peopleCount: 0,
        entitled: decision.entitled,
        updatedAt,
        ciphertext,
      });
    } else if (decision.entitled && groupSnap.data()?.entitled !== true) {
      transaction.set(groupRef, { entitled: true }, { merge: true });
    }
    transaction.set(accountRef, {
      entitled: decision.entitled,
      ownedGroupIds: decision.ownedGroupIds,
      updatedAt: Date.now(),
    }, { merge: true });
  });
  if (failure === 'one-list') {
    throw new HttpsError('failed-precondition', 'one-list');
  }
  if (failure === 'exists') {
    throw new HttpsError('already-exists', 'exists');
  }
  return { groupId, entitled };
});

export const releaseOwnedGroup = onCall({ enforceAppCheck: true }, async request => {
  const uid = requireUid(request.auth?.uid);
  const groupId = requireGroupId(request.data?.groupId);
  try {
    await releaseOwnedTree(getFirestore(), uid, groupId);
  } catch (caught) {
    throw mapGroupError(caught);
  }
  return { released: true };
});

// Joining does not consume an owned-list slot and does not check the joiner's tier.
export const joinGroup = onCall({ enforceAppCheck: true }, async request => {
  const uid = requireUid(request.auth?.uid);
  const inviteId = requireString(request.data?.inviteId, 'inviteId');
  const db = getFirestore();
  const invite = await db.collection('invites').doc(inviteId).get();
  if (!invite.exists || invite.data()?.active !== true) {
    throw new HttpsError('not-found', 'invite');
  }
  const groupId = String(invite.data()?.groupId ?? '');
  const ref = db.collection('groups').doc(groupId);
  const max = numberParam(groupMax.value(), DEFAULT_GROUP_MAX_MEMBERS);
  await db.runTransaction(async transaction => {
    const group = await transaction.get(ref);
    if (!group.exists) {
      throw new HttpsError('not-found', 'group');
    }
    const memberIds = [...(group.data()?.memberIds as string[] ?? [])];
    if (memberIds.includes(uid)) {
      return;
    }
    if (!groupHasRoom(memberIds.length, max)) {
      throw new HttpsError('resource-exhausted', 'full');
    }
    memberIds.push(uid);
    transaction.update(ref, { memberIds, updatedAt: Date.now() });
  });
  return { groupId };
});

async function isPaid(id: string): Promise<boolean> {
  const snap = await getFirestore().collection('entitlements').doc(id).get();
  return snap.data()?.paid === true;
}

/** Copy a device purchase onto the signed-in account and every list that account owns. */
async function grantAccountUnlock(uid: string): Promise<void> {
  await applyEntitlement(getFirestore(), uid, true, numberParam(freePeople.value(), 5));
}

async function revokeAccountUnlock(uid: string): Promise<void> {
  await applyEntitlement(getFirestore(), uid, false, numberParam(freePeople.value(), 5));
}

async function assertPerson(uid: string, personId: string): Promise<void> {
  const groups = await getFirestore().collection('groups').where('memberIds', 'array-contains', uid).get();
  for (const group of groups.docs) {
    const person = await group.ref.collection('people').doc(personId).get();
    if (person.exists && person.data()?.deleted !== true) {
      return;
    }
  }
  throw new HttpsError('not-found', 'person');
}

function remaining(usage: Usage, paid: boolean, limits: { free: number; paidPerMonth: number }): number {
  if (paid) {
    const used = usage.paidMonth === `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`
      ? usage.paidUsed
      : 0;
    return Math.max(0, limits.paidPerMonth - used);
  }
  return Math.max(0, limits.free - usage.freeUsed);
}

function requireUid(uid: string | undefined): string {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'auth');
  }
  return uid;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpsError('invalid-argument', name);
  }
  return value.trim();
}

function requireGroupId(value: unknown): string {
  const id = requireString(value, 'groupId');
  if (id.includes('/') || id.length > 128) {
    throw new HttpsError('invalid-argument', 'groupId');
  }
  return id;
}

function numberParam(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hashKey(value: string): string {
  return Buffer.from(value).toString('base64url').slice(0, 120);
}

const guarded = { enforceAppCheck: true };

export const writePerson = onCall(guarded, async request => {
  const uid = requireUid(request.auth?.uid);
  try {
    return await writePersonDoc(getFirestore(), {
      groupId: requireGroupId(request.data?.groupId),
      uid,
      personId: requireString(request.data?.personId, 'personId'),
      ciphertext: requireString(request.data?.ciphertext, 'ciphertext'),
      updatedAt: Number(request.data?.updatedAt),
      deleted: request.data?.deleted === true,
      createdAt: Number(request.data?.createdAt ?? Date.now()),
      limit: numberParam(freePeople.value(), 5),
    });
  } catch (caught) {
    throw mapGroupError(caught);
  }
});

export const linkRecipient = onCall(guarded, async request => {
  const uid = requireUid(request.auth?.uid);
  const ids = (value: unknown): string[] => Array.isArray(value) ? value.map(item => String(item)).filter(Boolean) : [];
  try {
    await linkRecipientDocs(getFirestore(), {
      groupId: requireGroupId(request.data?.groupId),
      uid,
      personId: requireString(request.data?.personId, 'personId'),
      linkedUid: typeof request.data?.linkedUid === 'string' ? request.data.linkedUid.trim() : '',
      states: ids(request.data?.states),
      gifts: ids(request.data?.gifts),
      ideas: ids(request.data?.ideas),
    });
  } catch (caught) {
    throw mapGroupError(caught);
  }
  return { linked: true };
});

export const transferOwnership = onCall(guarded, async request => {
  const uid = requireUid(request.auth?.uid);
  try {
    await transferOwner(getFirestore(), {
      groupId: requireGroupId(request.data?.groupId),
      uid,
      nextOwnerId: requireString(request.data?.nextOwnerId, 'nextOwnerId'),
    });
  } catch (caught) {
    throw mapGroupError(caught);
  }
  return { transferred: true };
});

export const revokeMember = onCall(guarded, async request => {
  const uid = requireUid(request.auth?.uid);
  try {
    await removeMemberServer(getFirestore(), {
      groupId: requireGroupId(request.data?.groupId),
      actorUid: uid,
      targetUid: requireString(request.data?.uid, 'uid'),
    });
  } catch (caught) {
    throw mapGroupError(caught);
  }
  return { removed: true };
});

export const leaveGroup = onCall(guarded, async request => {
  const uid = requireUid(request.auth?.uid);
  try {
    const result = await leaveGroupServer(getFirestore(), { groupId: requireGroupId(request.data?.groupId), uid });
    return { result };
  } catch (caught) {
    throw mapGroupError(caught);
  }
});

export const deleteAccount = onCall(guarded, async request => {
  const uid = requireUid(request.auth?.uid);
  await deleteAccountGroups(getFirestore(), uid, numberParam(freePeople.value(), 5));
  return { deleted: true };
});

export const claimRotationTurn = onCall(guarded, async request => {
  const uid = requireUid(request.auth?.uid);
  const ok = await claimRotation(getFirestore(), requireGroupId(request.data?.groupId), uid);
  return { ok };
});

export const finishRotationTurn = onCall(guarded, async request => {
  const uid = requireUid(request.auth?.uid);
  const keyVersion = Number(request.data?.keyVersion);
  if (!Number.isFinite(keyVersion)) {
    throw new HttpsError('invalid-argument', 'keyVersion');
  }
  try {
    await finishRotation(getFirestore(), requireGroupId(request.data?.groupId), uid, keyVersion);
  } catch (caught) {
    throw mapGroupError(caught);
  }
  return { rotated: true };
});

export const listMyGroups = onCall(guarded, async request => {
  const uid = requireUid(request.auth?.uid);
  const groups = await listGroupIds(getFirestore(), uid);
  return { groupIds: groups.map(group => group.id), groups };
});

export const recheckEntitlements = onSchedule('every 24 hours', async () => {
  const db = getFirestore();
  if (!appleKey.value() && !playAccount.value()) {
    return;
  }
  const paid = await db.collection('entitlements').where('paid', '==', true).get();
  for (const doc of paid.docs) {
    const data = doc.data();
    const uid = typeof data.uid === 'string' ? data.uid : '';
    if (!uid) {
      continue;
    }
    const platform = data.platform === 'android' ? 'android' : 'ios';
    const verdict = platform === 'ios'
      ? await verifyAppleVerdict({
        transactionId: String(data.transactionId ?? ''),
        privateKey: appleKey.value().replace(/\\n/g, '\n'),
        keyId: appleKeyId.value(),
        issuerId: appleIssuer.value(),
        bundleId: appleBundle.value(),
        productId: String(data.productId ?? unlockProduct.value()),
      })
      : await verifyGoogleVerdict({
        packageName: playPackage.value(),
        productId: String(data.productId ?? unlockProduct.value()),
        purchaseToken: String(data.purchaseToken ?? ''),
        serviceAccountJson: playAccount.value(),
        expectedProduct: String(data.productId ?? unlockProduct.value()),
      });
    if (!shouldRevokeEntitlement(verdict)) {
      continue;
    }
    await doc.ref.set({ paid: false, updatedAt: Date.now() }, { merge: true });
    await revokeAccountUnlock(uid);
  }
});

function mapGroupError(caught: unknown): HttpsError {
  const code = caught && typeof caught === 'object' && 'code' in caught ? String((caught as { code?: unknown }).code) : '';
  if (code === 'cap') {
    return new HttpsError('resource-exhausted', 'cap');
  }
  if (code === 'owner-stays') {
    return new HttpsError('failed-precondition', 'owner-stays');
  }
  if (code === 'one-list') {
    return new HttpsError('failed-precondition', 'one-list');
  }
  if (code === 'owner' || code === 'member') {
    return new HttpsError('permission-denied', code);
  }
  if (caught instanceof HttpsError) {
    return caught;
  }
  return new HttpsError('failed-precondition', code || 'group');
}

export const iapChecks = { appleTransactionGrants, googlePurchaseGrants };
