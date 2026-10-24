import { getApp } from '@react-native-firebase/app';
import {
  initializeAppCheck,
  ReactNativeFirebaseAppCheckProvider,
} from '@react-native-firebase/app-check';
import {
  EmailAuthProvider,
  getAuth,
  isSignInWithEmailLink,
  linkWithCredential,
  PhoneAuthProvider,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithPhoneNumber,
  connectAuthEmulator,
  deleteUser,
} from '@react-native-firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
} from '@react-native-firebase/firestore';
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from '@react-native-firebase/functions';
import {
  fetchAndActivate,
  getRemoteConfig,
  getString,
} from '@react-native-firebase/remote-config';
import {
  connectStorageEmulator,
  getDownloadURL,
  getStorage,
  ref,
} from '@react-native-firebase/storage';
import { Platform } from 'react-native';
import type { AppEnv } from '../config/env';
import { isPlaceholder } from '../config/env';

/** Remote Config key. Empty means the Amazon link stays a plain search. */
export const ASSOCIATE_TAG_PARAM = 'ASSOCIATE_TAG';

export type SealedDoc = {
  id: string;
  updatedAt: number;
  deleted: boolean;
  ciphertext: string;
  personId?: string;
};

let started = false;

export async function initFirebase(env: AppEnv): Promise<void> {
  if (started) {
    return;
  }
  const app = getApp();
  const provider = new ReactNativeFirebaseAppCheckProvider();
  const debugToken = isPlaceholder(env.appCheckDebugToken) ? undefined : env.appCheckDebugToken;
  provider.configure({
    android: {
      provider: __DEV__ ? 'debug' : 'playIntegrity',
      debugToken,
    },
    apple: {
      provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
      debugToken,
    },
    isTokenAutoRefreshEnabled: true,
  });
  initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
  if (env.useEmulators) {
    const host = Platform.OS === 'android' && env.emulatorHost === 'localhost'
      ? '10.0.2.2'
      : env.emulatorHost;
    connectAuthEmulator(getAuth(app), `http://${host}:9099`);
    connectFirestoreEmulator(getFirestore(app), host, 8080);
    connectFunctionsEmulator(getFunctions(app, env.functionsRegion), host, 5001);
    connectStorageEmulator(getStorage(app), host, 9199);
  }
  const remoteConfig = getRemoteConfig(app);
  remoteConfig.settings.minimumFetchIntervalMillis = env.remoteConfigMinFetchSeconds * 1000;
  remoteConfig.defaultConfig = {
    [env.remoteConfigSkinParam]: 'auto',
    [ASSOCIATE_TAG_PARAM]: '',
  };
  started = true;
}

export async function ensureAnonymousUser(): Promise<string> {
  const auth = getAuth();
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }
  const credential = await signInAnonymously(auth);
  return credential.user.uid;
}

export function currentUid(): string | null {
  return getAuth().currentUser?.uid ?? null;
}

export function currentUserIsAnonymous(): boolean {
  return getAuth().currentUser?.isAnonymous ?? true;
}

export async function deleteCurrentUser(): Promise<void> {
  const user = getAuth().currentUser;
  if (!user) {
    return;
  }
  await deleteUser(user);
}

export async function sendMagicLink(env: AppEnv, email: string): Promise<void> {
  await sendSignInLinkToEmail(getAuth(), email.trim(), {
    url: `https://${env.authDomain}/email-link`,
    handleCodeInApp: true,
    iOS: { bundleId: env.bundleId },
    android: { packageName: env.bundleId, installApp: true },
  });
}

export async function finishMagicLink(email: string, link: string): Promise<'linked' | 'signed-in'> {
  const auth = getAuth();
  if (!isSignInWithEmailLink(auth, link)) {
    throw Object.assign(new Error('invalid'), { code: 'invalid' });
  }
  const user = auth.currentUser;
  if (user?.isAnonymous) {
    try {
      await linkWithCredential(user, EmailAuthProvider.credentialWithLink(email, link));
      return 'linked';
    } catch (error) {
      const code = errorCode(error);
      if (code !== 'auth/credential-already-in-use' && code !== 'auth/email-already-in-use') {
        throw error;
      }
    }
  }
  await signInWithEmailLink(auth, email, link);
  return 'signed-in';
}

export async function sendSmsCode(phone: string): Promise<string> {
  const confirmation = await signInWithPhoneNumber(getAuth(), phone);
  return confirmation.verificationId;
}

export async function confirmSmsCode(verificationId: string, code: string): Promise<'linked' | 'signed-in'> {
  const auth = getAuth();
  const credential = PhoneAuthProvider.credential(verificationId, code.trim());
  const user = auth.currentUser;
  if (user?.isAnonymous) {
    try {
      await linkWithCredential(user, credential);
      return 'linked';
    } catch (error) {
      const errorName = errorCode(error);
      if (errorName !== 'auth/credential-already-in-use' && errorName !== 'auth/email-already-in-use') {
        throw error;
      }
    }
  }
  await signInWithCredential(auth, credential);
  return 'signed-in';
}

export async function updateGroupDocument(
  groupId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await setDoc(doc(getFirestore(), 'groups', groupId), fields, { merge: true });
}

export async function readGroupDocument(groupId: string): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(doc(getFirestore(), 'groups', groupId));
  return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
}

export async function writeSealed(
  groupId: string,
  collectionName: string,
  sealed: SealedDoc,
): Promise<void> {
  await setDoc(doc(getFirestore(), 'groups', groupId, collectionName, sealed.id), {
    updatedAt: sealed.updatedAt,
    deleted: sealed.deleted,
    ciphertext: sealed.ciphertext,
    ...(sealed.personId ? { personId: sealed.personId } : {}),
  });
}

export async function deleteSealed(groupId: string, collectionName: string, id: string): Promise<void> {
  await deleteDoc(doc(getFirestore(), 'groups', groupId, collectionName, id));
}

export async function writeHidden(groupId: string, excludedUid: string, collectionName: string, sealed: SealedDoc): Promise<void> {
  await setDoc(doc(getFirestore(), 'groups', groupId, 'hidden', excludedUid, collectionName, sealed.id), {
    updatedAt: sealed.updatedAt,
    deleted: sealed.deleted,
    ciphertext: sealed.ciphertext,
    ...(sealed.personId ? { personId: sealed.personId } : {}),
  });
}

export async function readHidden(groupId: string, excludedUid: string, collectionName: string): Promise<SealedDoc[]> {
  const snap = await getDocs(collection(getFirestore(), 'groups', groupId, 'hidden', excludedUid, collectionName));
  return snap.docs.map(item => sealedFrom(item.id, item.data() as Partial<SealedDoc>));
}

export async function writeKeyWrap(groupId: string, version: string, ciphertext: string): Promise<void> {
  await setDoc(doc(getFirestore(), 'groups', groupId, 'keyWraps', version), {
    updatedAt: Date.now(),
    ciphertext,
  });
}

export async function readKeyWrap(groupId: string, version: string): Promise<string | null> {
  const snap = await getDoc(doc(getFirestore(), 'groups', groupId, 'keyWraps', version));
  if (!snap.exists()) {
    return null;
  }
  const data = snap.data() as { ciphertext?: unknown };
  return typeof data.ciphertext === 'string' ? data.ciphertext : null;
}

export async function writePrivateGift(uid: string, sealed: SealedDoc): Promise<void> {
  await setDoc(doc(getFirestore(), 'users', uid, 'privateGifts', sealed.id), {
    updatedAt: sealed.updatedAt,
    deleted: sealed.deleted,
    ciphertext: sealed.ciphertext,
  });
}

export async function readPrivateGifts(uid: string): Promise<SealedDoc[]> {
  const snap = await getDocs(collection(getFirestore(), 'users', uid, 'privateGifts'));
  return snap.docs.map(item => {
    const data = item.data() as Partial<SealedDoc>;
    return {
      id: item.id,
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
      deleted: Boolean(data.deleted),
      ciphertext: typeof data.ciphertext === 'string' ? data.ciphertext : '',
    };
  });
}

export async function readSealed(groupId: string, collectionName: string): Promise<SealedDoc[]> {
  const snap = await getDocs(collection(getFirestore(), 'groups', groupId, collectionName));
  return snap.docs.map(item => sealedFrom(item.id, item.data() as Partial<SealedDoc>));
}

function sealedFrom(id: string, data: Partial<SealedDoc>): SealedDoc {
  return {
    id,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
    deleted: Boolean(data.deleted),
    ciphertext: typeof data.ciphertext === 'string' ? data.ciphertext : '',
    ...(typeof data.personId === 'string' ? { personId: data.personId } : {}),
  };
}

export async function createInvite(groupId: string, inviteId: string, uid: string, ciphertext: string): Promise<void> {
  await setDoc(doc(getFirestore(), 'invites', inviteId), {
    groupId,
    createdBy: uid,
    createdAt: Date.now(),
    active: true,
    ciphertext,
  });
}

export async function readInvite(inviteId: string): Promise<{ groupId: string; ciphertext: string } | null> {
  const snap = await getDoc(doc(getFirestore(), 'invites', inviteId));
  if (!snap.exists()) {
    return null;
  }
  const data = snap.data() as { groupId?: unknown; ciphertext?: unknown };
  return {
    groupId: typeof data.groupId === 'string' ? data.groupId : '',
    ciphertext: typeof data.ciphertext === 'string' ? data.ciphertext : '',
  };
}

export async function writeRecovery(uid: string, groupId: string, payload: Record<string, string>): Promise<void> {
  await setDoc(doc(getFirestore(), 'users', uid, 'keys', groupId), {
    ...payload,
    updatedAt: Date.now(),
  });
}

export async function readRecovery(uid: string, groupId: string): Promise<Record<string, string> | null> {
  const snap = await getDoc(doc(getFirestore(), 'users', uid, 'keys', groupId));
  if (!snap.exists()) {
    return null;
  }
  return snap.data() as Record<string, string>;
}

export async function listRecovery(uid: string): Promise<Array<{ groupId: string; salt: string; nonce: string; wrapped: string }>> {
  const snap = await getDocs(collection(getFirestore(), 'users', uid, 'keys'));
  return snap.docs
    .map(item => {
      const data = item.data() as Record<string, string>;
      return {
        groupId: item.id,
        salt: data.salt,
        nonce: data.nonce,
        wrapped: data.wrapped,
      };
    })
    .filter(item => item.salt && item.nonce && item.wrapped);
}

export async function callFunction<T>(env: AppEnv, name: string, data: Record<string, unknown>): Promise<T> {
  const callable = httpsCallable<Record<string, unknown>, T>(getFunctions(getApp(), env.functionsRegion), name);
  const result = await callable(data);
  return result.data;
}

export async function activeSkinParam(env: AppEnv): Promise<string> {
  try {
    const remoteConfig = getRemoteConfig();
    await fetchAndActivate(remoteConfig);
    return getString(remoteConfig, env.remoteConfigSkinParam) || 'auto';
  } catch {
    return 'auto';
  }
}

export async function associateTag(): Promise<string> {
  try {
    const remoteConfig = getRemoteConfig();
    await fetchAndActivate(remoteConfig);
    return getString(remoteConfig, ASSOCIATE_TAG_PARAM).trim();
  } catch {
    return '';
  }
}

export async function downloadSkin(id: string): Promise<unknown> {
  const url = await getDownloadURL(ref(getStorage(), `skins/${id}.json`));
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('skin');
  }
  return response.json();
}

function errorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code: unknown }).code);
  }
  return '';
}
