import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { canRefresh, emptyUsage, nextUsage, type Usage } from './caps';
import { fingerprint } from './fingerprint';
import { appleTransactionGrants, googlePurchaseGrants, verifyAppleVerdict, verifyGoogleVerdict } from './iap';
import { shouldRevokeEntitlement } from './entitlement';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { promptHash, requestIdeas, type IdeaPrompt } from './ideas';

initializeApp();
setGlobalOptions({ region: 'us-central1' });

const openaiKey = defineSecret('OPENAI_API_KEY');
const pepper = defineSecret('FINGERPRINT_PEPPER');
const model = defineString('OPENAI_MODEL', { default: 'gpt-4o-mini' });
const freeRefreshes = defineString('AI_FREE_REFRESHES_PER_PERSON', { default: '5' });
const paidRefreshes = defineString('AI_PAID_REFRESHES_PER_PERSON_PER_MONTH', { default: '20' });
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
  const id = fingerprint(pepper.value(), device);
  const db = getFirestore();
  const account = await db.collection('accounts').doc(uid).get();
  const paid = account.data()?.entitled === true || await isPaid(id);
  const limits = { free: numberParam(freeRefreshes.value(), 5), paidPerMonth: numberParam(paidRefreshes.value(), 20) };
  const usageRef = db.collection('aiUsage').doc(id).collection('people').doc(personId);
  const cacheRef = db.collection('aiCache').doc(id).collection('entries').doc(hashKey(promptHash(personId, prompt)));
  const [usageSnap, cacheSnap] = await Promise.all([usageRef.get(), cacheRef.get()]);
  const usage = usageSnap.exists ? (usageSnap.data() as Usage) : emptyUsage();
  const cachedRaw = cacheSnap.exists ? cacheSnap.data()?.ideas : [];
  const cachedIdeas = Array.isArray(cachedRaw) && cachedRaw.every(item => item && typeof item === 'object' && typeof (item as { title?: unknown }).title === 'string')
    ? cachedRaw
    : [];
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

async function isPaid(id: string): Promise<boolean> {
  const snap = await getFirestore().collection('entitlements').doc(id).get();
  return snap.data()?.paid === true;
}

/** The unlock lives on the account. Lists are on the phone, so this does not write group docs. */
async function grantAccountUnlock(uid: string): Promise<void> {
  await getFirestore().collection('accounts').doc(uid).set({ entitled: true, updatedAt: Date.now() }, { merge: true });
}

async function revokeAccountUnlock(uid: string): Promise<void> {
  await getFirestore().collection('accounts').doc(uid).set({ entitled: false, updatedAt: Date.now() }, { merge: true });
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

export const iapChecks = { appleTransactionGrants, googlePurchaseGrants };
