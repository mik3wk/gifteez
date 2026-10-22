import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { canRefresh, claimSlot, emptyUsage, nextUsage, type Usage } from './caps';
import { DEFAULT_GROUP_MAX_MEMBERS, groupHasRoom } from './members';
import { fingerprint } from './fingerprint';
import { appleTransactionGrants, googlePurchaseGrants, verifyAppleTransaction, verifyGooglePurchase } from './iap';
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
  const paid = await isPaid(id);
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

export const claimPersonSlot = onCall(callable, async request => {
  const device = requireString(request.data?.deviceId, 'deviceId');
  const action = request.data?.action === 'remove' ? 'remove' : 'add';
  const id = fingerprint(pepper.value(), device);
  const ref = getFirestore().collection('aiUsage').doc(id);
  const snap = await ref.get();
  const active = Number(snap.data()?.activePeople ?? 0);
  const paid = await isPaid(id);
  const result = claimSlot(active, paid, action, numberParam(freePeople.value(), 5));
  if (result.ok) {
    await ref.set({ activePeople: result.active }, { merge: true });
  }
  return result;
});

export const getEntitlement = onCall(callable, async request => {
  const device = requireString(request.data?.deviceId, 'deviceId');
  const id = fingerprint(pepper.value(), device);
  return { paid: await isPaid(id) };
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
  let verified = false;
  if (platform === 'ios') {
    if (!appleKey.value()) {
      return { verified: false, reason: 'not_configured' };
    }
    verified = await verifyAppleTransaction({
      transactionId,
      privateKey: appleKey.value().replace(/\\n/g, '\n'),
      keyId: appleKeyId.value(),
      issuerId: appleIssuer.value(),
      bundleId: appleBundle.value(),
      productId,
    });
  } else if (!playAccount.value()) {
    return { verified: false, reason: 'not_configured' };
  } else {
    verified = await verifyGooglePurchase({
      packageName: playPackage.value(),
      productId,
      purchaseToken,
      serviceAccountJson: playAccount.value(),
      expectedProduct: productId,
    });
  }
  if (!verified) {
    return { verified: false, reason: 'rejected' };
  }
  const id = fingerprint(pepper.value(), device);
  const db = getFirestore();
  await db.collection('entitlements').doc(id).set({
    paid: true,
    productId,
    platform,
    transactionId,
    uid,
    updatedAt: Date.now(),
  });
  const groups = await db.collection('groups').where('memberIds', 'array-contains', uid).get();
  await Promise.all(groups.docs.map(group => group.ref.set({ entitled: true }, { merge: true })));
  return { verified: true };
});

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

function numberParam(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hashKey(value: string): string {
  return Buffer.from(value).toString('base64url').slice(0, 120);
}

export const iapChecks = { appleTransactionGrants, googlePurchaseGrants };
