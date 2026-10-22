import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { AppEnv } from '../config/env';
import {
  buildAppInviteUrl,
  buildInviteUrl,
  generateRecoveryCode,
  keyFromString,
  keyToString,
  openJson,
  parseLink,
  randomId,
  randomKey,
  sealJson,
  unwrapKey,
  wrapKey,
} from '../crypto/crypto';
import { ideaCacheId, suggestIdeas } from '../domain/ideas';
import {
  addFeedback,
  addOccasion,
  addPerson,
  applyGroupRemote,
  bannerDue,
  createGroup,
  defaultOccasionDate,
  exportList,
  logPurchase,
  mergeRemote,
  normalizeUsPhone,
  occurrenceYear,
  parseBudget,
  parseImport,
  phoneAllowed,
  removeMember,
  renameGroup,
  saveIdea,
  sillyName,
  upcomingOccasion,
  updatePerson,
  upsertIdeas,
  withProfile,
} from '../domain/logic';
import {
  emptySnapshot,
  dirtyKey,
  type AppSnapshot,
  type Occasion,
  type OccasionType,
  type Person,
  type RemoteRecord,
} from '../domain/types';
import { formatMoney } from '../i18n';
import { t } from '../i18n';
import { readCacheBlob, writeCacheBlob } from '../platform/cache';
import { deviceId } from '../platform/device';
import {
  activeSkinParam,
  callFunction,
  confirmSmsCode,
  createGroupDocument,
  createInvite,
  deleteGroupDocument,
  currentUid,
  downloadSkin,
  ensureAnonymousUser,
  finishMagicLink,
  initFirebase,
  listRecovery,
  readGroupDocument,
  readSealed,
  sendMagicLink,
  sendSmsCode,
  updateGroupDocument,
  writeRecovery,
  writeSealed,
  type SealedDoc,
} from '../platform/firebase';
import { importContacts, sweepBirthdays } from '../platform/importers';
import { buyUnlock, connectStore, finishOwned, listenToPurchases, loadOwned, purchaseProof, type StoreProduct } from '../platform/iap';
import { loadSecret, saveSecret } from '../platform/secure';
import { colorsFor, parseSkin, resolveSkin, type SkinId, type ThemeColors } from '../theme/skins';

const COLLECTIONS = ['people', 'occasions', 'states', 'gifts', 'ideas', 'members'] as const;

type CloudResult = { ideas: string[]; counted: boolean; remaining: number };

type GifteezApi = {
  ready: boolean;
  snapshot: AppSnapshot;
  colors: ThemeColors;
  skinId: string;
  notice: string | null;
  error: string | null;
  recoveryCode: string | null;
  storeProduct: StoreProduct | null;
  storeReady: boolean;
  clearNotice: () => void;
  clearError: () => void;
  acknowledgeRecovery: () => void;
  startGroup: (displayName: string) => Promise<void>;
  sendEmail: (email: string) => Promise<void>;
  finishEmail: (link: string) => Promise<void>;
  sendPhone: (phone: string) => Promise<void>;
  confirmPhone: (code: string) => Promise<void>;
  joinFromLink: (url: string) => Promise<boolean>;
  restoreWithCode: (code: string) => Promise<void>;
  addPerson: (input: { name: string; budget: string; tags: string[]; imported?: boolean }) => Promise<string | null>;
  savePerson: (id: string, patch: Partial<Pick<Person, 'name' | 'budgetCents' | 'tags'>>) => Promise<void>;
  removePerson: (id: string) => Promise<void>;
  addOccasion: (personId: string, type: OccasionType, month?: number, day?: number, year?: number) => Promise<void>;
  saveIdeaFor: (occasionId: string, idea: string) => Promise<void>;
  logGift: (occasionId: string, title: string, price: string, date: string) => Promise<void>;
  vote: (personId: string, idea: string, vote: 'up' | 'down') => Promise<void>;
  focusPerson: (personId: string) => Promise<void>;
  refreshIdeas: (personId: string) => Promise<void>;
  cloudIdeas: (personId: string) => Promise<void>;
  cloudRemaining: Record<string, number>;
  shareInvite: () => Promise<string>;
  leave: () => Promise<void>;
  removeGroupMember: (uid: string) => Promise<void>;
  renameList: (name: string) => Promise<void>;
  showRecovery: () => Promise<string | null>;
  exportText: () => string;
  dismissBanner: () => Promise<void>;
  buy: () => Promise<void>;
  restorePurchases: () => Promise<void>;
  importText: (text: string) => Promise<number>;
  importFromContacts: () => Promise<number | 'denied'>;
  importFromCalendar: () => Promise<number | 'denied'>;
  showBanner: boolean;
};

const GifteezContext = createContext<GifteezApi | null>(null);

export function useGifteez(): GifteezApi {
  const value = useContext(GifteezContext);
  if (!value) {
    throw new Error('Gifteez is not ready.');
  }
  return value;
}

export function GifteezProvider({ env, children }: { env: AppEnv; children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(() => emptySnapshot(Date.now()));
  const snapshotRef = useRef(snapshot);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [skinId, setSkinId] = useState<SkinId>('base');
  const [colors, setColors] = useState<ThemeColors>(colorsFor('base', {}).colors);
  const [downloaded, setDownloaded] = useState<Partial<Record<SkinId, ThemeColors>>>({});
  const [storeProduct, setStoreProduct] = useState<StoreProduct | null>(null);
  const [storeReady, setStoreReady] = useState(false);
  const [cloudRemaining, setCloudRemaining] = useState<Record<string, number>>({});
  const downloadedRef = useRef(downloaded);
  downloadedRef.current = downloaded;

  const commit = useCallback(async (next: AppSnapshot) => {
    snapshotRef.current = next;
    setSnapshot(next);
    const key = await ensureDeviceKey();
    await writeCacheBlob(sealJson(next, key));
  }, []);

  const fail = useCallback((code: string) => {
    const key = `errors.${code}`;
    const message = t(key);
    setError(message === key ? t('errors.generic') : message);
  }, []);

  const sync = useCallback(async (source?: AppSnapshot) => {
    const current = source ?? snapshotRef.current;
    if (!current.group || !current.profile.uid) {
      return current;
    }
    const groupKey = await loadSecret('group-key');
    if (!groupKey) {
      return current;
    }
    const groupId = current.group.id;
    const key = keyFromString(groupKey);
    let next = current;
    try {
      await pushSnapshot(next, key);
      const cleared = { ...next.dirty };
      Object.keys(cleared).forEach(dirty => {
        delete cleared[dirty];
      });
      next = { ...next, dirty: cleared };
      const remoteGroup = await readGroupDocument(groupId);
      const localGroup = next.group;
      if (remoteGroup && localGroup) {
        const sealedName = openJson<{ name?: string }>(String(remoteGroup.ciphertext ?? ''), key);
        const mergedGroup = applyGroupRemote(next, {
          id: groupId,
          name: sealedName.name || localGroup.name,
          ownerId: String(remoteGroup.ownerId ?? localGroup.ownerId),
          memberIds: Array.isArray(remoteGroup.memberIds) ? remoteGroup.memberIds.map(String) : localGroup.memberIds,
          peopleCount: Number(remoteGroup.peopleCount ?? localGroup.peopleCount),
          entitled: Boolean(remoteGroup.entitled),
          updatedAt: Number(remoteGroup.updatedAt ?? localGroup.updatedAt),
        });
        next = mergedGroup.snapshot;
        if (mergedGroup.updatedFromOtherDevice) {
          setNotice(t('sync.otherDevice'));
        }
      }
      const remoteRecords: RemoteRecord[] = [];
      for (const name of COLLECTIONS) {
        const docs = await readSealed(groupId, name);
        docs.forEach(item => {
          if (!item.ciphertext) {
            return;
          }
          try {
            remoteRecords.push({
              collection: name,
              id: item.id,
              updatedAt: item.updatedAt,
              deleted: item.deleted,
              data: openJson<Record<string, unknown>>(item.ciphertext, key),
            });
          } catch {
            // Skip a record this phone cannot decrypt.
          }
        });
      }
      const merged = mergeRemote(next, remoteRecords);
      next = merged.snapshot;
      if (merged.updatedFromOtherDevice) {
        setNotice(t('sync.otherDevice'));
      }
      await commit(next);
    } catch {
      setNotice(t('sync.offline'));
    }
    return snapshotRef.current;
  }, [commit]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadSnapshot();
        if (cancelled) {
          return;
        }
        snapshotRef.current = loaded;
        setSnapshot(loaded);
        await initFirebase(env);
        const uid = await ensureAnonymousUser();
        let next = loaded.profile.uid === uid ? loaded : withProfile(loaded, { uid });
        if (!next.profile.displayName) {
          next = withProfile(next, { displayName: sillyName(uid) });
        }
        if (!next.profile.upgraded) {
          next = withProfile(next, { upgraded: false });
        }
        await commit(next);
        await sync(next);
        const skinValue = await activeSkinParam(env);
        const resolved = resolveSkin({ remoteValue: skinValue, today: new Date(), downloaded: downloadedRef.current });
        if (!cancelled) {
          setSkinId(resolved.id);
          setColors(resolved.colors);
        }
        if (resolved.id === 'spring' || resolved.id === 'summer') {
          try {
            const payload = parseSkin(await downloadSkin(resolved.id));
            if (payload) {
              const withDownload = { ...downloadedRef.current, [resolved.id]: payload };
              const again = resolveSkin({ remoteValue: skinValue, today: new Date(), downloaded: withDownload });
              setDownloaded(withDownload);
              setSkinId(again.id);
              setColors(again.colors);
            }
          } catch {
            setSkinId('base');
            setColors(colorsFor('base', {}).colors);
          }
        }
        const store = await connectStore(env.iapProductId);
        if (store.ok) {
          setStoreReady(true);
          setStoreProduct(store.product);
        }
        try {
          const entitlement = await callFunction<{ paid: boolean }>(env, 'getEntitlement', { deviceId: await deviceId() });
          if (entitlement.paid) {
            await commit(withPaid(snapshotRef.current, true));
          }
        } catch {
          // Entitlement stays local until the function is deployed.
        }
      } catch {
        setError(t('errors.generic'));
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    })();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        sync().catch(() => undefined);
      }
    });
    const timer = setInterval(() => {
      sync().catch(() => undefined);
    }, 30000);
    return () => {
      cancelled = true;
      sub.remove();
      clearInterval(timer);
    };
  }, [commit, env, sync]);

  useEffect(() => {
    const stop = listenToPurchases(purchase => {
      verifyPurchase(env, purchaseProof(purchase))
        .then(async paid => {
          if (paid) {
            await commit(withPaid(snapshotRef.current, true));
            await finishOwned(purchase);
          }
        })
        .catch(() => fail('notConfigured'));
    }, message => setError(message));
    return stop;
  }, [commit, env, fail]);

  const addImported = useCallback(async (rows: Array<{ name: string; budgetCents: number | null; month?: number; day?: number; tags: string[] }>) => {
    let count = 0;
    for (const row of rows) {
      const name = row.name.trim();
      if (!name) {
        continue;
      }
      const now = Date.now();
      const person: Person = {
        id: randomId(),
        name,
        budgetCents: row.budgetCents,
        tags: row.tags,
        imported: true,
        opened: false,
        createdAt: now,
        updatedAt: now,
      };
      const result = addPerson({ snapshot: snapshotRef.current, person, freeLimit: env.freeTierMaxPeople });
      if (!result.ok) {
        fail(result.error);
        break;
      }
      let next = result.snapshot;
      if (row.month && row.day) {
        next = addOccasion(next, {
          id: randomId(),
          personId: person.id,
          type: 'birthday',
          month: row.month,
          day: row.day,
          updatedAt: Date.now(),
        });
      }
      await commit(next);
      sync().catch(() => undefined);
      count += 1;
    }
    return count;
  }, [commit, env.freeTierMaxPeople, fail, sync]);

  const api = useMemo<GifteezApi>(() => ({
    ready,
    snapshot,
    colors,
    skinId,
    notice,
    error,
    recoveryCode,
    storeProduct,
    storeReady,
    cloudRemaining,
    clearNotice: () => setNotice(null),
    clearError: () => setError(null),
    acknowledgeRecovery: () => setRecoveryCode(null),
    showBanner: bannerDue(snapshot.profile, Date.now(), env.bannerAfterDays),
    startGroup: async displayName => {
      const uid = snapshotRef.current.profile.uid || (await ensureAnonymousUser());
      const name = displayName.trim() || snapshotRef.current.profile.displayName || sillyName(uid);
      const groupId = randomId();
      const groupKey = randomKey();
      const code = generateRecoveryCode();
      const inviteId = randomId();
      await saveSecret('group-key', keyToString(groupKey));
      await saveSecret('recovery-code', code);
      let next = createGroup({
        snapshot: withProfile(snapshotRef.current, { inviteId, uid }),
        groupId,
        ownerId: uid,
        displayName: name,
        groupName: `${name}'s list`,
        now: Date.now(),
      });
      await commit(next);
      setRecoveryCode(code);
      try {
        await createGroupDocument({
          groupId,
          ownerId: uid,
          ciphertext: sealJson({ name: next.group?.name }, groupKey),
          updatedAt: next.group?.updatedAt ?? Date.now(),
        });
        await writeSealed(groupId, 'members', sealMember(uid, name, groupKey, Date.now()));
        await createInvite(groupId, inviteId, uid);
        await writeRecovery(uid, groupId, wrapKey(groupKey, code));
        next = { ...snapshotRef.current, dirty: {} };
        await commit(next);
      } catch {
        setNotice(t('sync.offline'));
      }
    },
    sendEmail: async email => {
      await sendMagicLink(env, email.trim());
      await commit(withProfile(snapshotRef.current, { pendingEmail: email.trim() }));
    },
    finishEmail: async link => {
      const email = snapshotRef.current.profile.pendingEmail;
      if (!email) {
        fail('auth');
        return;
      }
      try {
        const mode = await finishMagicLink(email, link.trim());
        const uid = currentUid();
        await commit(withProfile(snapshotRef.current, {
          uid,
          upgraded: true,
          pendingEmail: null,
          upgradeBannerDismissed: true,
        }));
        if (mode === 'signed-in') {
          setNotice(t('join.needAccount'));
        }
      } catch {
        fail('auth');
      }
    },
    sendPhone: async phone => {
      const normalized = normalizeUsPhone(phone);
      if (!phoneAllowed(normalized, env.phoneRegions)) {
        setError(t('groupCreate.smsRegion'));
        return;
      }
      try {
        const verificationId = await sendSmsCode(normalized);
        await commit(withProfile(snapshotRef.current, { pendingVerificationId: verificationId }));
      } catch {
        fail('auth');
      }
    },
    confirmPhone: async code => {
      const verificationId = snapshotRef.current.profile.pendingVerificationId;
      if (!verificationId) {
        fail('auth');
        return;
      }
      try {
        await confirmSmsCode(verificationId, code);
        await commit(withProfile(snapshotRef.current, {
          uid: currentUid(),
          upgraded: true,
          pendingVerificationId: null,
          upgradeBannerDismissed: true,
        }));
      } catch {
        fail('auth');
      }
    },
    joinFromLink: async url => {
      const parsed = parseLink(url);
      if (!parsed || parsed.kind !== 'invite') {
        setError(t('join.invalid'));
        return false;
      }
      try {
        keyFromString(parsed.groupKey);
      } catch {
        setError(t('join.invalid'));
        return false;
      }
      await saveSecret('group-key', parsed.groupKey);
      const uid = snapshotRef.current.profile.uid || (await ensureAnonymousUser());
      try {
        await callFunction(env, 'joinGroup', { inviteId: parsed.inviteId });
      } catch (caught) {
        const code = caught instanceof Error && 'code' in caught ? String((caught as { code?: string }).code) : '';
        if (code.includes('resource-exhausted')) {
          fail('full');
          return false;
        }
        setNotice(t('sync.offline'));
      }
      const name = snapshotRef.current.profile.displayName || sillyName(uid);
      const next = withProfile(snapshotRef.current, {
        uid,
        inviteId: parsed.inviteId,
        onboarded: true,
        groupId: parsed.groupId,
        displayName: name,
        nameLocked: snapshotRef.current.profile.nameLocked,
      });
      await commit({
        ...next,
        group: {
          id: parsed.groupId,
          name: 'Shared list',
          ownerId: '',
          memberIds: [uid],
          peopleCount: 0,
          entitled: false,
          updatedAt: 0,
        },
        dirty: {},
      });
      try {
        await writeSealed(parsed.groupId, 'members', sealMember(uid, name, keyFromString(parsed.groupKey), Date.now()));
      } catch {
        setNotice(t('sync.offline'));
      }
      await sync(snapshotRef.current);
      return true;
    },
    restoreWithCode: async code => {
      const uid = currentUid();
      if (!uid) {
        fail('auth');
        return;
      }
      try {
        const wraps = await listRecovery(uid);
        for (const wrap of wraps) {
          try {
            const key = unwrapKey(wrap, code);
            await saveSecret('group-key', keyToString(key));
            const next = withProfile(snapshotRef.current, { uid, groupId: wrap.groupId, onboarded: true, upgraded: true });
            await commit({
              ...next,
              group: {
                id: wrap.groupId,
                name: 'Shared list',
                ownerId: uid,
                memberIds: [uid],
                peopleCount: 0,
                entitled: false,
                updatedAt: Date.now(),
              },
            });
            await sync(snapshotRef.current);
            return;
          } catch {
            // Try the next wrapped key.
          }
        }
        fail('invalid');
      } catch {
        fail('auth');
      }
    },
    addPerson: async input => {
      const name = input.name.trim();
      if (!name) {
        fail('invalid');
        return null;
      }
      if (!input.imported) {
        try {
          const claim = await callFunction<{ ok: boolean }>(env, 'claimPersonSlot', {
            deviceId: await deviceId(),
            action: 'add',
          });
          if (!claim.ok && !snapshotRef.current.entitlementPaid) {
            fail('cap');
            return null;
          }
        } catch {
          // Offline or functions not deployed: the local cap still applies.
        }
      }
      const now = Date.now();
      const person: Person = {
        id: randomId(),
        name,
        budgetCents: parseBudget(input.budget),
        tags: input.tags,
        imported: Boolean(input.imported),
        opened: !input.imported,
        createdAt: now,
        updatedAt: now,
      };
      const result = addPerson({ snapshot: snapshotRef.current, person, freeLimit: env.freeTierMaxPeople });
      if (!result.ok) {
        fail(result.error);
        return null;
      }
      await commit(result.snapshot);
      sync().catch(() => undefined);
      return person.id;
    },
    savePerson: async (id, patch) => {
      const result = updatePerson(snapshotRef.current, id, patch, Date.now());
      if (!result.ok) {
        fail(result.error);
        return;
      }
      await commit(result.snapshot);
      sync().catch(() => undefined);
    },
    removePerson: async id => {
      const result = updatePerson(snapshotRef.current, id, { deleted: true }, Date.now());
      if (!result.ok) {
        return;
      }
      await commit(result.snapshot);
      callFunction(env, 'claimPersonSlot', { deviceId: await deviceId(), action: 'remove' }).catch(() => undefined);
      sync().catch(() => undefined);
    },
    addOccasion: async (personId, type, month, day, year) => {
      const today = new Date();
      const fallback = defaultOccasionDate(type, today);
      const occasion: Occasion = {
        id: randomId(),
        personId,
        type,
        month: month || fallback.month,
        day: day || fallback.day,
        year,
        updatedAt: Date.now(),
      };
      if (occasion.month < 1 || occasion.month > 12 || occasion.day < 1 || occasion.day > 31) {
        fail('invalid');
        return;
      }
      await commit(addOccasion(snapshotRef.current, occasion));
      sync().catch(() => undefined);
    },
    saveIdeaFor: async (occasionId, idea) => {
      const occasion = snapshotRef.current.occasions.find(item => item.id === occasionId);
      if (!occasion) {
        return;
      }
      await commit(saveIdea({ snapshot: snapshotRef.current, occasion, idea, today: new Date(), now: Date.now() }));
      sync().catch(() => undefined);
    },
    logGift: async (occasionId, title, price, date) => {
      const occasion = snapshotRef.current.occasions.find(item => item.id === occasionId);
      if (!occasion || !title.trim()) {
        fail('invalid');
        return;
      }
      const priceCents = parseBudget(price) ?? 0;
      const purchasedOn = date || new Date().toISOString().slice(0, 10);
      const year = Number(purchasedOn.slice(0, 4)) || occurrenceYear(occasion, new Date());
      await commit(logPurchase({
        snapshot: snapshotRef.current,
        occasion,
        gift: {
          id: randomId(),
          personId: occasion.personId,
          occasionId: occasion.id,
          year,
          title: title.trim(),
          priceCents,
          purchasedOn,
          updatedAt: Date.now(),
        },
      }));
      sync().catch(() => undefined);
    },
    vote: async (personId, idea, choice) => {
      await commit(addFeedback(snapshotRef.current, {
        id: randomId(),
        personId,
        idea,
        vote: choice,
        createdAt: Date.now(),
      }));
    },
    focusPerson: async personId => {
      const person = snapshotRef.current.people.find(item => item.id === personId && !item.deleted);
      if (!person) {
        return;
      }
      let next = snapshotRef.current;
      if (!person.opened) {
        const opened = updatePerson(next, personId, { opened: true }, Date.now());
        if (opened.ok) {
          next = opened.snapshot;
        }
      }
      const occasion = upcomingOccasion(personId, next.occasions, new Date());
      const occasionKey = occasion ? `${occasion.occasion.id}:${occasion.date.getFullYear()}` : 'general';
      const cacheId = ideaCacheId(personId, occasionKey, 'on-device');
      if (!next.ideas.some(item => item.id === cacheId && !item.deleted)) {
        const ideas = suggestIdeas({
          personId,
          name: person.name,
          tags: person.tags,
          occasion: occasion?.occasion.type ?? null,
          feedback: next.feedback,
          salt: 0,
        });
        next = upsertIdeas(next, {
          id: cacheId,
          personId,
          occasionKey,
          ideas,
          source: 'on-device',
          salt: 0,
          generatedAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      await commit(next);
      sync().catch(() => undefined);
    },
    refreshIdeas: async personId => {
      const person = snapshotRef.current.people.find(item => item.id === personId);
      if (!person) {
        return;
      }
      const occasion = upcomingOccasion(personId, snapshotRef.current.occasions, new Date());
      const occasionKey = occasion ? `${occasion.occasion.id}:${occasion.date.getFullYear()}` : 'general';
      const cacheId = ideaCacheId(personId, occasionKey, 'on-device');
      const previous = snapshotRef.current.ideas.find(item => item.id === cacheId);
      const salt = (previous?.salt ?? 0) + 1;
      const ideas = suggestIdeas({
        personId,
        name: person.name,
        tags: person.tags,
        occasion: occasion?.occasion.type ?? null,
        feedback: snapshotRef.current.feedback,
        salt,
      });
      await commit(upsertIdeas(snapshotRef.current, {
        id: cacheId,
        personId,
        occasionKey,
        ideas,
        source: 'on-device',
        salt,
        generatedAt: Date.now(),
        updatedAt: Date.now(),
      }));
    },
    cloudIdeas: async personId => {
      const person = snapshotRef.current.people.find(item => item.id === personId);
      if (!person?.opened) {
        return;
      }
      const occasion = upcomingOccasion(personId, snapshotRef.current.occasions, new Date());
      const occasionKey = occasion ? `${occasion.occasion.id}:${occasion.date.getFullYear()}` : 'general';
      const cacheId = ideaCacheId(personId, occasionKey, 'cloud');
      const existing = snapshotRef.current.ideas.find(item => item.id === cacheId && !item.deleted);
      try {
        const result = await callFunction<CloudResult>(env, 'generateGiftIdeas', {
          deviceId: await deviceId(),
          personId,
          refresh: Boolean(existing),
          prompt: {
            name: person.name,
            occasion: occasion?.occasion.type ?? null,
            tags: person.tags,
            budgetCents: person.budgetCents,
            year: occasion?.date.getFullYear() ?? new Date().getFullYear(),
            likes: snapshotRef.current.feedback.filter(item => item.personId === personId && item.vote === 'up').map(item => item.idea),
            dislikes: snapshotRef.current.feedback.filter(item => item.personId === personId && item.vote === 'down').map(item => item.idea),
          },
        });
        setCloudRemaining(current => ({ ...current, [personId]: result.remaining }));
        await commit(upsertIdeas(snapshotRef.current, {
          id: cacheId,
          personId,
          occasionKey,
          ideas: result.ideas,
          source: 'cloud',
          salt: 0,
          generatedAt: Date.now(),
          updatedAt: Date.now(),
        }));
      } catch (caught) {
        const code = caught instanceof Error && 'code' in caught ? String((caught as { code?: string }).code) : '';
        fail(code.includes('resource-exhausted') ? 'capReached' : 'functions');
      }
    },
    shareInvite: async () => {
      const current = snapshotRef.current;
      if (!current.group || !current.profile.uid) {
        return '';
      }
      let inviteId = current.profile.inviteId;
      if (!inviteId) {
        inviteId = randomId();
        await commit(withProfile(current, { inviteId }));
      }
      try {
        await createInvite(current.group.id, inviteId, current.profile.uid);
      } catch {
        setNotice(t('sync.offline'));
      }
      const groupKey = (await loadSecret('group-key')) ?? '';
      const httpsLink = buildInviteUrl({
        domain: env.inviteDomain,
        groupId: current.group.id,
        inviteId,
        groupKey,
      });
      const appLink = buildAppInviteUrl({ groupId: current.group.id, inviteId, groupKey });
      return `${httpsLink}\n${appLink}`;
    },
    leave: async () => {
      const current = snapshotRef.current;
      const uid = current.profile.uid;
      if (!uid || !current.group) {
        return;
      }
      const remaining = current.group.memberIds.filter(id => id !== uid);
      if (current.group.ownerId === uid && remaining.length > 0) {
        setError(t('groupScreen.ownerStays'));
        return;
      }
      try {
        if (remaining.length === 0) {
          await deleteGroupDocument(current.group.id);
        } else {
          await updateGroupDocument(current.group.id, { memberIds: remaining, updatedAt: Date.now() });
        }
      } catch {
        setNotice(t('sync.offline'));
      }
      const profile = current.profile;
      await commit({
        ...emptySnapshot(Date.now()),
        profile: {
          ...emptySnapshot(Date.now()).profile,
          uid,
          displayName: profile.displayName,
          nameLocked: profile.nameLocked,
          createdAt: profile.createdAt,
          upgraded: profile.upgraded,
        },
      });
    },
    removeGroupMember: async uid => {
      const result = removeMember(snapshotRef.current, uid, Date.now());
      if (!result.ok) {
        fail(result.error);
        return;
      }
      await commit(result.snapshot);
      sync().catch(() => undefined);
    },
    renameList: async name => {
      await commit(renameGroup(snapshotRef.current, name.trim(), Date.now()));
      sync().catch(() => undefined);
    },
    showRecovery: async () => loadSecret('recovery-code'),
    exportText: () => exportList(snapshotRef.current, new Date(), formatMoney),
    dismissBanner: async () => {
      await commit(withProfile(snapshotRef.current, { upgradeBannerDismissed: true }));
    },
    buy: async () => {
      try {
        await buyUnlock(env.iapProductId);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t('settings.storeMissing'));
      }
    },
    restorePurchases: async () => {
      try {
        const owned = await loadOwned(env.iapProductId);
        if (owned.length === 0) {
          setError(t('settings.storeMissing'));
          return;
        }
        for (const purchase of owned) {
          const paid = await verifyPurchase(env, purchaseProof(purchase));
          if (paid) {
            await commit(withPaid(snapshotRef.current, true));
            await finishOwned(purchase);
            return;
          }
        }
        fail('notConfigured');
      } catch {
        setError(t('settings.storeMissing'));
      }
    },
    importText: async text => {
      let rows;
      try {
        rows = parseImport(text);
      } catch {
        fail('invalid');
        return 0;
      }
      return addImported(rows);
    },
    importFromContacts: async () => {
      const rows = await importContacts();
      if (rows === 'denied') {
        return 'denied';
      }
      return addImported(rows);
    },
    importFromCalendar: async () => {
      const rows = await sweepBirthdays();
      if (rows === 'denied') {
        return 'denied';
      }
      return addImported(rows);
    },
  }), [addImported, cloudRemaining, colors, commit, env, error, fail, notice, ready, recoveryCode, skinId, snapshot, storeProduct, storeReady, sync]);

  return <GifteezContext.Provider value={api}>{children}</GifteezContext.Provider>;
}

async function ensureDeviceKey(): Promise<Uint8Array> {
  const existing = await loadSecret('device-key');
  if (existing) {
    return keyFromString(existing);
  }
  const key = randomKey();
  await saveSecret('device-key', keyToString(key));
  return key;
}

async function loadSnapshot(): Promise<AppSnapshot> {
  const key = await ensureDeviceKey();
  const blob = await readCacheBlob();
  if (!blob) {
    return emptySnapshot(Date.now());
  }
  try {
    const parsed = openJson<AppSnapshot>(blob, key);
    if (parsed?.version !== 1 || !parsed.profile) {
      return emptySnapshot(Date.now());
    }
    return { ...emptySnapshot(Date.now()), ...parsed, profile: { ...emptySnapshot(Date.now()).profile, ...parsed.profile } };
  } catch {
    return emptySnapshot(Date.now());
  }
}

function withPaid(snapshot: AppSnapshot, paid: boolean): AppSnapshot {
  return {
    ...snapshot,
    entitlementPaid: paid,
    group: snapshot.group ? { ...snapshot.group, entitled: snapshot.group.entitled || paid } : snapshot.group,
  };
}

function sealMember(uid: string, displayName: string, key: Uint8Array, now: number): SealedDoc {
  return {
    id: uid,
    updatedAt: now,
    deleted: false,
    ciphertext: sealJson({ uid, displayName }, key),
  };
}

async function pushSnapshot(snapshot: AppSnapshot, key: Uint8Array): Promise<void> {
  if (!snapshot.group) {
    return;
  }
  const groupId = snapshot.group.id;
  if (snapshot.dirty['group:meta'] || snapshot.dirty['group:members']) {
    const existing = await readGroupDocument(groupId);
    if (!existing) {
      await createGroupDocument({
        groupId,
        ownerId: snapshot.group.ownerId,
        ciphertext: sealJson({ name: snapshot.group.name }, key),
        updatedAt: snapshot.group.updatedAt,
      });
    }
    let currentCount = existing ? Number(existing.peopleCount ?? 0) : 0;
    const target = snapshot.group.peopleCount;
    while (currentCount < target) {
      currentCount += 1;
      await updateGroupDocument(groupId, { peopleCount: currentCount, updatedAt: Date.now() });
    }
    while (currentCount > target) {
      currentCount -= 1;
      await updateGroupDocument(groupId, { peopleCount: currentCount, updatedAt: Date.now() });
    }
    const fields: Record<string, unknown> = {
      ciphertext: sealJson({ name: snapshot.group.name }, key),
      updatedAt: snapshot.group.updatedAt,
    };
    if (snapshot.dirty['group:members']) {
      fields.memberIds = snapshot.group.memberIds;
    }
    await updateGroupDocument(groupId, fields);
  }
  for (const name of COLLECTIONS) {
    const records = recordsFor(snapshot, name);
    for (const record of records) {
      if (!snapshot.dirty[dirtyKey(name, record.id)]) {
        continue;
      }
      await writeSealed(groupId, name, {
        id: record.id,
        updatedAt: record.updatedAt,
        deleted: Boolean(record.deleted),
        ciphertext: sealJson(record.body, key),
      });
    }
  }
}

function recordsFor(snapshot: AppSnapshot, name: (typeof COLLECTIONS)[number]): Array<{ id: string; updatedAt: number; deleted?: boolean; body: Record<string, unknown> }> {
  const source = snapshot[name] as Array<{ id: string; updatedAt: number; deleted?: boolean }>;
  return source.map(item => {
    const { id, updatedAt, deleted, ...body } = item;
    return { id, updatedAt, deleted, body: body as Record<string, unknown> };
  });
}

async function verifyPurchase(env: AppEnv, proof: { transactionId: string; token: string; platform: 'ios' | 'android' }): Promise<boolean> {
  const result = await callFunction<{ verified: boolean }>(env, 'verifyUnlock', {
    deviceId: await deviceId(),
    productId: env.iapProductId,
    platform: proof.platform,
    transactionId: proof.transactionId,
    purchaseToken: proof.token,
  });
  return result.verified;
}
