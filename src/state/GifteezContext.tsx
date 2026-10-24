import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Appearance, AppState } from 'react-native';
import type { AppEnv } from '../config/env';
import {
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
import { claimOccasion as claimOccasionSnapshot, claimWarningUid, claimerName, unclaimOccasion as unclaimOccasionSnapshot } from '../domain/claims';
import { adoptSignedInAccount, showStaleList } from '../domain/accountSwitch';
import { deleteOccasion, deletePrivateGift, deleteSharedGift, updateOccasionDate, updatePrivateGift, updateSharedGift } from '../domain/edits';
import { applyMerge, commitMergeSource, findDuplicatePeople, mergePrivateGifts, undoMerge, type DuplicateHint } from '../domain/merge';
import { planReminders } from '../domain/reminders';
import { bodyWithoutHidden, pushKind, stripSensitiveForViewer } from '../domain/visibility';
import { classifyStartupError, startupCause, type StartupFailure } from '../domain/startup';
import { performJoin } from '../domain/joinFlow';
import {
  addFeedback,
  addOccasion,
  addPerson,
  applyGroupRemote,
  bannerDue,
  canStartAnotherList,
  createGroup,
  clearClaimsForUid,
  exportAccount,
  groupCurrency,
  groupDisplayName,
  isRealMonthDay,
  groupMarker,
  leaveActiveGroup,
  logPurchase,
  memberNames,
  parkActive,
  mergeRemote,
  normalizeUsPhone,
  occurrenceYear,
  parseBudget,
  parseImport,
  phoneAllowed,
  removeMember,
  renameGroup,
  clearIdea,
  saveIdea,
  setGroupCurrency,
  switchGroup as switchGroupSnapshot,
  sillyName,
  upcomingOccasion,
  updatePerson,
  upsertIdeas,
  withAccountUnlock,
  withProfile,
} from '../domain/logic';
import {
  emptySnapshot,
  dirtyKey,
  type AppSnapshot,
  type GroupArchive,
  type Occasion,
  type OccasionType,
  type Person,
  type PrivateGift,
  type RemoteRecord,
} from '../domain/types';
import { currencyForLocale, deviceLocale, formatMoney, t, todayIso } from '../i18n';
import { readCacheBlob, writeCacheBlob } from '../platform/cache';
import { deviceId } from '../platform/device';
import {
  activeSkinParam,
  callFunction,
  confirmSmsCode,
  createInvite,
  readInvite,
  currentUid,
  deleteCurrentUser,
  deleteSealed,
  downloadSkin,
  ensureAnonymousUser,
  finishMagicLink,
  initFirebase,
  listRecovery,
  readGroupDocument,
  readHidden,
  readKeyWrap,
  readPrivateGifts,
  readRecovery,
  readSealed,
  sendMagicLink,
  sendSmsCode,
  updateGroupDocument,
  writeHidden,
  writeKeyWrap,
  writePrivateGift,
  writeRecovery,
  writeSealed,
  type SealedDoc,
} from '../platform/firebase';
import { importContacts, sweepBirthdays } from '../platform/importers';
import { buyUnlock, connectStore, finishOwned, listenToPurchases, loadOwned, purchaseProof, type StoreProduct } from '../platform/iap';
import { applyReminderPlan, cancelReminderPlan, requestReminderPermission } from '../platform/reminders';
import { deleteSecret, loadSecret, saveSecret } from '../platform/secure';
import { occasionLabel, planOccasion, presetFor } from '../domain/occasions';
import { cleanRelationship, omitRelationship } from '../domain/relationship';
import { classifySyncError } from '../domain/syncStatus';
import { haptic } from '../platform/haptics';
import type { CelebrateName } from '../theme/tokens';
import { colorsFor, parseSkin, resolveSkin, withColorScheme, type ResolvedColors, type SkinId, type ThemeColors } from '../theme/skins';

const COLLECTIONS = ['people', 'occasions', 'states', 'gifts', 'ideas', 'members'] as const;

type CloudResult = { ideas: string[]; counted: boolean; remaining: number };

type GifteezApi = {
  ready: boolean;
  snapshot: AppSnapshot;
  colors: ResolvedColors;
  offline: boolean;
  canUndo: boolean;
  runUndo: () => Promise<void>;
  onNavigate: () => void;
  skinId: string;
  notice: string | null;
  noticeArt: CelebrateName | null;
  confetti: number;
  error: string | null;
  startupFailure: StartupFailure | null;
  startupDetail: string | null;
  retryStartup: () => void;
  recoveryCode: string | null;
  resumePersonId: string | null;
  openPerson: (personId: string) => void;
  clearResumePerson: () => void;
  storeProduct: StoreProduct | null;
  storeReady: boolean;
  clearNotice: () => void;
  clearError: () => void;
  acknowledgeRecovery: () => void;
  startGroup: (displayName: string, groupName: string) => Promise<boolean>;
  switchGroup: (groupId: string) => Promise<void>;
  previewInvite: (url: string) => Promise<{ label: string; emoji: string; color: string } | null>;
  sendEmail: (email: string) => Promise<void>;
  finishEmail: (link: string) => Promise<void>;
  sendPhone: (phone: string) => Promise<void>;
  confirmPhone: (code: string) => Promise<void>;
  joinFromLink: (url: string) => Promise<boolean>;
  restoreWithCode: (code: string) => Promise<boolean>;
  addPerson: (input: { name: string; budget: string; tags: string[]; imported?: boolean; relationship?: string }) => Promise<string | null>;
  savePerson: (id: string, patch: Partial<Pick<Person, 'name' | 'budgetCents' | 'tags' | 'relationship'>>) => Promise<void>;
  removePerson: (id: string) => Promise<void>;
  addOccasion: (
    personId: string,
    type: OccasionType,
    month?: number,
    day?: number,
    year?: number,
    extra?: { label?: string; recurs?: boolean },
  ) => Promise<void>;
  saveIdeaFor: (occasionId: string, idea: string) => Promise<void>;
  unsaveIdea: (occasionId: string) => Promise<void>;
  toast: (message: string) => void;
  logGift: (occasionId: string, title: string, price: string, date: string) => Promise<boolean>;
  updateGift: (giftId: string, title: string, price: string, date: string, privateGift: boolean) => Promise<boolean>;
  deleteGift: (giftId: string, privateGift: boolean) => Promise<void>;
  updateOccasion: (occasionId: string, month: number, day: number, year?: number) => Promise<void>;
  deleteOccasion: (occasionId: string) => Promise<void>;
  linkRecipient: (personId: string, linkedUid: string) => Promise<void>;
  undoMerge: () => Promise<void>;
  claimOccasion: (occasionId: string) => Promise<boolean>;
  unclaimOccasion: (occasionId: string) => Promise<void>;
  mergePeople: (input: {
    targetPersonId: string;
    sourcePersonId: string;
    sourceGroupId: string;
    sharedGiftIds: string[];
  }) => Promise<boolean>;
  duplicateOffers: DuplicateHint[];
  dismissDuplicateOffer: (sourcePersonId: string, sourceGroupId: string, targetPersonId: string) => void;
  vote: (personId: string, idea: string, vote: 'up' | 'down') => Promise<void>;
  focusPerson: (personId: string) => Promise<void>;
  refreshIdeas: (personId: string) => Promise<void>;
  cloudIdeas: (personId: string) => Promise<void>;
  cloudRemaining: Record<string, number>;
  shareInvite: () => Promise<string>;
  leave: () => Promise<void>;
  removeGroupMember: (uid: string) => Promise<void>;
  transferOwnership: (uid: string) => Promise<void>;
  setListCurrency: (currency: string) => Promise<void>;
  setReminders: (enabled: boolean) => Promise<void>;
  deleteAccount: () => Promise<void>;
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
  const [bootId, setBootId] = useState(0);
  const [notice, setNoticeState] = useState<string | null>(null);
  const [noticeArt, setNoticeArt] = useState<CelebrateName | null>(null);
  const [confetti, setConfetti] = useState(0);
  const setNotice = useCallback((message: string | null, art: CelebrateName | null = null) => {
    setNoticeArt(message ? art : null);
    setNoticeState(message);
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [startupFailure, setStartupFailure] = useState<StartupFailure | null>(null);
  const [startupDetail, setStartupDetail] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [resumePersonId, setResumePersonId] = useState<string | null>(null);
  const clearResumePerson = useCallback(() => setResumePersonId(null), []);
  const [skinId, setSkinId] = useState<SkinId>('base');
  const [colors, setColors] = useState<ResolvedColors>(() => withColorScheme(colorsFor('base', {}).colors, Appearance.getColorScheme()));
  const [offline, setOffline] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const paletteRef = useRef<ThemeColors>(colorsFor('base', {}).colors);
  const paint = useCallback((next: ThemeColors) => {
    paletteRef.current = next;
    setColors(withColorScheme(next, Appearance.getColorScheme()));
  }, []);
  const [downloaded, setDownloaded] = useState<Partial<Record<SkinId, ThemeColors>>>({});
  const [storeProduct, setStoreProduct] = useState<StoreProduct | null>(null);
  const [storeReady, setStoreReady] = useState(false);
  const [cloudRemaining, setCloudRemaining] = useState<Record<string, number>>({});
  const [duplicateOffers, setDuplicateOffers] = useState<DuplicateHint[]>([]);
  const downloadedRef = useRef(downloaded);
  downloadedRef.current = downloaded;

  const commit = useCallback(async (next: AppSnapshot) => {
    const stored = parkActive(next);
    snapshotRef.current = stored;
    setSnapshot(stored);
    const key = await ensureDeviceKey();
    await writeCacheBlob(sealJson(next, key));
  }, []);

  const undoRestore = useRef<(() => Promise<void>) | null>(null);
  const remoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncReported = useRef<string | null>(null);
  const noticeStickyUntil = useRef(0);

  const showNotice = useCallback((message: string, sticky = false, art: CelebrateName | null = null) => {
    setError(null);
    setNotice(message, art);
    if (sticky) {
      noticeStickyUntil.current = Date.now() + 6000;
    }
  }, [setNotice]);

  const noteSync = useCallback((caught: unknown) => {
    const kind = classifySyncError(caught);
    if (kind === 'offline') {
      setOffline(true);
      return;
    }
    if (syncReported.current === kind) {
      return;
    }
    syncReported.current = kind;
    showNotice(t(kind === 'permission' ? 'sync.permission' : 'sync.failed'));
  }, [showNotice]);

  const markSynced = useCallback(() => {
    setOffline(false);
    syncReported.current = null;
  }, []);

  const offerUndo = useCallback((message: string, restore: () => Promise<void>, commitRemote?: () => Promise<unknown>) => {
    if (remoteTimer.current) {
      clearTimeout(remoteTimer.current);
    }
    undoRestore.current = restore;
    setCanUndo(true);
    showNotice(message, true);
    remoteTimer.current = setTimeout(() => {
      setCanUndo(false);
      undoRestore.current = null;
      remoteTimer.current = null;
      commitRemote?.().catch(() => undefined);
    }, 5200);
  }, [showNotice]);

  const runUndo = useCallback(async () => {
    if (remoteTimer.current) {
      clearTimeout(remoteTimer.current);
    }
    remoteTimer.current = null;
    const restore = undoRestore.current;
    undoRestore.current = null;
    setCanUndo(false);
    setNotice(null);
    if (restore) {
      await restore();
    }
  }, [setNotice]);

  const onNavigate = useCallback(() => {
    if (Date.now() < noticeStickyUntil.current) {
      return;
    }
    setNotice(null);
    setError(null);
  }, [setNotice]);

  const fail = useCallback((code: string, vars?: Record<string, string | number>) => {
    const key = `errors.${code}`;
    const message = t(key, vars);
    setNotice(null);
    setCanUndo(false);
    undoRestore.current = null;
    setError(message === key ? t('errors.generic') : message);
    haptic('error');
  }, [setNotice]);

  const sync = useCallback(async (source?: AppSnapshot) => {
    let current = source ?? snapshotRef.current;
    const flushed = await flushReleases(current, env);
    if (flushed !== current) {
      await commit(flushed);
      current = snapshotRef.current;
    }
    if (!current.profile.uid) {
      return current;
    }
    current = await flushPendingMembership(current, env);
    if (!current.group) {
      current = await pullOtherGroups(current, env);
      await commit(current);
      return snapshotRef.current;
    }
    const groupKey = await loadGroupKeyString(current.group.id);
    if (!groupKey) {
      current = markGroupStale(current, current.group.id, true);
      current = await pullOtherGroups(current, env);
      await commit(current);
      return snapshotRef.current;
    }
    const groupId = current.group.id;
    let key = keyFromString(groupKey);
    let next = current;
    try {
      const rotated = await rotateIfNeeded(next, key, env);
      next = rotated.snapshot;
      key = rotated.key;
      await pushSnapshot(next, key, env);
      next = await flushDirtyArchives(next, env);
      next = await flushPrivateGifts(next);
      const cleared = { ...next.dirty };
      Object.keys(cleared).forEach(name => {
        if (name.startsWith('privateGifts:')) {
          return;
        }
        delete cleared[name];
      });
      next = { ...next, dirty: cleared };
      next = await absorbGroup(next, groupId, key, true);
      next = stripSensitiveForViewer(next);
      next = await pullOtherGroups(next, env);
      await migrateDeviceRecovery(next);
      await scheduleReminders(next);
      await commit(next);
      markSynced();
    } catch (caught) {
      if (caught instanceof CapError) {
        fail('cap');
        const dropped = dropPerson(snapshotRef.current, caught.personId);
        await commit(dropped);
        return snapshotRef.current;
      }
      if (isOneListError(caught) && (snapshotRef.current.releasedGroupIds ?? []).length === 0) {
        fail('oneList');
        await commit(leaveActiveGroup(snapshotRef.current));
        return snapshotRef.current;
      }
      noteSync(caught);
    }
    return snapshotRef.current;
  }, [commit, env, fail, markSynced, noteSync]);

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
          paint(resolved.colors);
        }
        if (resolved.id === 'spring' || resolved.id === 'summer') {
          try {
            const payload = parseSkin(await downloadSkin(resolved.id));
            if (payload) {
              const withDownload = { ...downloadedRef.current, [resolved.id]: payload };
              const again = resolveSkin({ remoteValue: skinValue, today: new Date(), downloaded: withDownload });
              setDownloaded(withDownload);
              setSkinId(again.id);
              paint(again.colors);
            }
          } catch {
            setSkinId('base');
            paint(colorsFor('base', {}).colors);
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
            await commit(withAccountUnlock(snapshotRef.current, true));
          }
        } catch {
          // Entitlement stays local until the function is deployed.
        }
        if (!cancelled) {
          setStartupFailure(null);
          setStartupDetail(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(null);
          setStartupFailure(classifyStartupError(caught));
          setStartupDetail(startupCause(caught));
        }
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
    const appearance = Appearance.addChangeListener(({ colorScheme }) => {
      setColors(withColorScheme(paletteRef.current, colorScheme));
    });
    return () => {
      cancelled = true;
      sub.remove();
      appearance.remove();
      clearInterval(timer);
    };
  }, [bootId, commit, env, paint, sync]);

  useEffect(() => {
    const stop = listenToPurchases(purchase => {
      verifyPurchase(env, purchaseProof(purchase))
        .then(async result => {
          if (result.reason === 'revoked') {
            await commit(withAccountUnlock(snapshotRef.current, false));
            return;
          }
          if (result.verified) {
            await commit(withAccountUnlock(snapshotRef.current, true));
            await finishOwned(purchase);
            haptic('success');
          }
        })
        .catch(() => fail('notConfigured'));
    }, message => {
      setError(message);
      if (message) {
        haptic('error');
      }
    });
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
    noticeArt,
    confetti,
    error,
    offline,
    canUndo,
    runUndo,
    onNavigate,
    startupFailure,
    startupDetail,
    retryStartup: () => {
      setReady(false);
      setBootId(value => value + 1);
    },
    recoveryCode,
    resumePersonId,
    openPerson: setResumePersonId,
    clearResumePerson,
    storeProduct,
    storeReady,
    cloudRemaining,
    clearNotice: () => setNotice(null),
    clearError: () => setError(null),
    acknowledgeRecovery: () => setRecoveryCode(null),
    showBanner: bannerDue(snapshot.profile, Date.now(), env.bannerAfterDays),
    startGroup: async (displayName, groupName) => {
      const flushed = await flushReleases(snapshotRef.current, env);
      if (flushed !== snapshotRef.current) {
        await commit(flushed);
      }
      const uid = snapshotRef.current.profile.uid || (await ensureAnonymousUser());
      const base = snapshotRef.current.profile.uid === uid
        ? snapshotRef.current
        : withProfile(snapshotRef.current, { uid });
      if (!canStartAnotherList(base, uid)) {
        fail('oneList');
        return false;
      }
      const previous = base;
      const name = displayName.trim() || base.profile.displayName || sillyName(uid);
      const groupId = randomId();
      const groupKey = randomKey();
      const code = generateRecoveryCode();
      const inviteId = randomId();
      await saveSecret(groupKeyAccount(groupId), keyToString(groupKey));
      await saveSecret(recoveryAccount(groupId), code);
      let next = createGroup({
        snapshot: withProfile(base, { uid }),
        groupId,
        ownerId: uid,
        displayName: name,
        groupName,
        inviteId,
        currency: currencyForLocale(deviceLocale()),
        now: Date.now(),
      });
      await commit(next);
      try {
        const created = await callFunction<{ groupId: string; entitled: boolean }>(env, 'createOwnedGroup', {
          groupId,
          ciphertext: sealJson({ name: next.group?.name ?? '', currency: groupCurrency(next.group) }, groupKey),
          updatedAt: next.group?.updatedAt ?? Date.now(),
          deviceId: await deviceId(),
        });
        if (created.entitled) {
          await commit(withAccountUnlock(snapshotRef.current, true));
        }
        await writeSealed(groupId, 'members', sealMember(uid, name, groupKey, Date.now()));
        await publishPreview(snapshotRef.current, groupKey);
        await writeRecovery(uid, groupId, wrapKey(groupKey, code));
        await writeRecovery(uid, 'device', wrapKey(await ensureDeviceKey(), code));
        next = { ...snapshotRef.current, dirty: {} };
        await commit(next);
      } catch (caught) {
        if (isOneListError(caught) && (snapshotRef.current.releasedGroupIds ?? []).length === 0) {
          setRecoveryCode(null);
          await commit(previous);
          fail('oneList');
          return false;
        }
        noteSync(caught);
      }
      return snapshotRef.current.group?.id === groupId;
    },
    switchGroup: async groupId => {
      const next = switchGroupSnapshot(snapshotRef.current, groupId);
      if (!next) {
        return;
      }
      await commit(next);
      sync().catch(() => undefined);
    },
    previewInvite: async url => {
      const parsed = parseLink(url);
      if (!parsed || parsed.kind !== 'invite') {
        return null;
      }
      const marker = groupMarker(parsed.groupId);
      try {
        keyFromString(parsed.groupKey);
        const invite = await readInvite(parsed.inviteId);
        if (!invite?.ciphertext) {
          return { ...marker, label: t('join.previewPending') };
        }
        const opened = openJson<{ name?: string; memberNames?: string[] }>(invite.ciphertext, keyFromString(parsed.groupKey));
        return {
          ...marker,
          label: groupDisplayName(opened.name ?? '', opened.memberNames ?? []),
        };
      } catch {
        return { ...marker, label: t('join.previewPending') };
      }
    },
    sendEmail: async email => {
      await sendMagicLink(env, email.trim());
      await commit(withProfile(snapshotRef.current, { pendingEmail: email.trim() }));
      showNotice(t('groupCreate.linkSent'));
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
        if (mode === 'signed-in' && uid) {
          await commit(adoptSignedInAccount(snapshotRef.current, uid, Date.now()));
          await sync();
          if (!snapshotRef.current.group) {
            setNotice(t('join.needAccount'));
          }
          return;
        }
        await commit(withProfile(snapshotRef.current, {
          uid,
          upgraded: true,
          pendingEmail: null,
          upgradeBannerDismissed: true,
        }));
        setNotice(t('groupCreate.savedAccount'));
      } catch {
        fail('auth');
      }
    },
    sendPhone: async phone => {
      const normalized = normalizeUsPhone(phone);
      if (!phoneAllowed(normalized, env.phoneRegions)) {
        setError(t('groupCreate.smsRegion'));
        haptic('error');
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
        const mode = await confirmSmsCode(verificationId, code);
        const uid = currentUid();
        if (mode === 'signed-in' && uid) {
          await commit(adoptSignedInAccount(snapshotRef.current, uid, Date.now()));
          await sync();
          if (!snapshotRef.current.group) {
            setNotice(t('join.needAccount'));
          }
          return;
        }
        await commit(withProfile(snapshotRef.current, {
          uid,
          upgraded: true,
          pendingVerificationId: null,
          upgradeBannerDismissed: true,
        }));
        setNotice(t('groupCreate.savedAccount'));
      } catch {
        fail('auth');
      }
    },
    joinFromLink: async url => {
      const outcome = await performJoin({
        url,
        snapshot: snapshotRef.current,
        cap: env.groupMaxMembers,
        ensureUid: ensureAnonymousUser,
        joinGroup: inviteId => callFunction(env, 'joinGroup', { inviteId }),
        saveKey: (groupId, groupKey) => saveSecret(groupKeyAccount(groupId), groupKey),
        deleteKey: groupId => deleteSecret(groupKeyAccount(groupId)),
      });
      if (!outcome.ok) {
        if (outcome.failure === 'invalid-link') {
          setError(t('join.invalid'));
          haptic('error');
        } else if (outcome.failure === 'full') {
          fail('full', { count: env.groupMaxMembers });
        } else if (outcome.failure === 'invalid') {
          setError(t('join.failedInvalid'));
          haptic('error');
        } else if (outcome.failure === 'offline') {
          setError(t('join.failedOffline'));
          haptic('error');
        } else {
          setError(t('join.failedUnknown'));
          haptic('error');
        }
        return false;
      }
      try {
        await commit(outcome.snapshot);
      } catch {
        await deleteSecret(groupKeyAccount(outcome.groupId));
        setError(t('join.failedUnknown'));
        haptic('error');
        return false;
      }
      try {
        await writeSealed(
          outcome.groupId,
          'members',
          sealMember(outcome.uid, outcome.displayName, keyFromString(outcome.groupKey), Date.now()),
        );
      } catch (caught) {
        noteSync(caught);
      }
      await sync(snapshotRef.current);
      setDuplicateOffers(findDuplicatePeople(snapshotRef.current));
      return true;
    },
    restoreWithCode: async code => {
      const uid = currentUid();
      if (!uid) {
        fail('auth');
        return false;
      }
      try {
        const wraps = await listRecovery(uid);
        let opened = 0;
        for (const wrap of wraps) {
          try {
            const key = unwrapKey(wrap, code);
            if (wrap.groupId === 'device') {
              await saveSecret('device-key', keyToString(key));
            } else {
              await saveSecret(groupKeyAccount(wrap.groupId), keyToString(key));
            }
            opened += 1;
          } catch {
            // Try the next wrapped key.
          }
        }
        if (opened === 0) {
          return false;
        }
        const restored = adoptSignedInAccount(snapshotRef.current, uid, Date.now());
        await commit({ ...restored, profile: { ...restored.profile, upgraded: true, onboarded: true } });
        await sync(snapshotRef.current);
        return true;
      } catch {
        fail('auth');
        return false;
      }
    },
    addPerson: async input => {
      const name = input.name.trim();
      if (!name) {
        fail('invalid');
        return null;
      }
      const hadPeople = snapshotRef.current.people.some(person => !person.deleted);
      const now = Date.now();
      const relationship = cleanRelationship(input.relationship ?? '');
      if (relationship == null) {
        fail('invalid');
        return null;
      }
      const person: Person = {
        id: randomId(),
        name,
        budgetCents: parseBudget(input.budget),
        tags: input.tags,
        imported: Boolean(input.imported),
        opened: !input.imported,
        createdAt: now,
        updatedAt: now,
        ...(relationship ? { relationship } : {}),
      };
      const result = addPerson({ snapshot: snapshotRef.current, person, freeLimit: env.freeTierMaxPeople });
      if (!result.ok) {
        fail(result.error);
        return null;
      }
      await commit(result.snapshot);
      if (!hadPeople && !person.imported) {
        setConfetti(count => count + 1);
      }
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
      const before = snapshotRef.current;
      const name = before.people.find(person => person.id === id)?.name ?? '';
      const result = updatePerson(before, id, { deleted: true }, Date.now());
      if (!result.ok) {
        return;
      }
      await commit(result.snapshot);
      haptic('warning');
      offerUndo(t('person.removed', { name }), async () => {
        await commit(before);
        sync().catch(() => undefined);
      }, () => sync());
    },
    addOccasion: async (personId, type, month, day, year, extra) => {
      const planned = planOccasion({
        type,
        month,
        day,
        year,
        label: extra?.label,
        recurs: extra?.recurs,
        today: new Date(),
      });
      if (planned === 'need-date') {
        fail('date');
        return;
      }
      if (planned === 'need-name') {
        fail('occasionName');
        return;
      }
      if (!isRealMonthDay(planned.month, planned.day)) {
        fail('invalid');
        return;
      }
      const occasion: Occasion = {
        id: randomId(),
        personId,
        type: type === 'custom' || !presetFor(type) ? 'custom' : type,
        month: planned.month,
        day: planned.day,
        ...(planned.year ? { year: planned.year } : {}),
        ...(planned.label ? { label: planned.label } : {}),
        recurs: planned.recurs,
        updatedAt: Date.now(),
      };
      const next = withOnDeviceIdeas(addOccasion(snapshotRef.current, occasion), personId);
      await commit(next);
      haptic('success');
      scheduleReminders(snapshotRef.current).catch(() => undefined);
      sync().catch(() => undefined);
    },
    saveIdeaFor: async (occasionId, idea) => {
      const occasion = snapshotRef.current.occasions.find(item => item.id === occasionId);
      if (!occasion) {
        return;
      }
      await commit(saveIdea({ snapshot: snapshotRef.current, occasion, idea, today: new Date(), now: Date.now() }));
      showNotice(t('person.ideaKept'), false, 'save-idea');
      haptic('success');
      sync().catch(() => undefined);
    },
    unsaveIdea: async occasionId => {
      const occasion = snapshotRef.current.occasions.find(item => item.id === occasionId);
      if (!occasion) {
        return;
      }
      await commit(clearIdea({ snapshot: snapshotRef.current, occasion, today: new Date(), now: Date.now() }));
      showNotice(t('person.ideaCleared'));
      sync().catch(() => undefined);
    },
    toast: message => showNotice(message),
    logGift: async (occasionId, title, price, date) => {
      const occasion = snapshotRef.current.occasions.find(item => item.id === occasionId);
      if (!occasion || !title.trim()) {
        fail('invalid');
        return false;
      }
      const priceCents = parseBudget(price);
      if (priceCents == null) {
        fail('price');
        return false;
      }
      const purchasedOn = date.trim() ? date.trim() : todayIso();
      const year = Number(purchasedOn.slice(0, 4)) || occurrenceYear(occasion, new Date());
      const uid = snapshotRef.current.profile.uid;
      const warningUid = claimWarningUid({
        states: snapshotRef.current.states,
        occasion,
        purchaseYear: year,
        today: new Date(),
        uid,
      });
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
          ...(uid ? { boughtBy: uid } : {}),
        },
      }));
      if (warningUid) {
        showNotice(t('purchase.claimedWarning', { name: claimerName(warningUid, snapshotRef.current.members) }), false, 'purchase');
      } else {
        showNotice(t('purchase.saved'), false, 'purchase');
      }
      haptic('success');
      sync().catch(() => undefined);
      return true;
    },
    claimOccasion: async occasionId => {
      const uid = snapshotRef.current.profile.uid;
      if (!uid) {
        fail('auth');
        return false;
      }
      const result = claimOccasionSnapshot({
        snapshot: snapshotRef.current,
        occasionId,
        uid,
        now: Date.now(),
        today: new Date(),
      });
      if (!result.ok) {
        fail(result.error);
        return false;
      }
      await commit(result.snapshot);
      showNotice(t('person.claimedToast'), false, 'claim');
      haptic('success');
      sync().catch(() => undefined);
      return true;
    },
    unclaimOccasion: async occasionId => {
      const uid = snapshotRef.current.profile.uid;
      if (!uid) {
        fail('auth');
        return;
      }
      const result = unclaimOccasionSnapshot({
        snapshot: snapshotRef.current,
        occasionId,
        uid,
        now: Date.now(),
        today: new Date(),
      });
      if (!result.ok) {
        fail(result.error);
        return;
      }
      await commit(result.snapshot);
      sync().catch(() => undefined);
    },
    mergePeople: async input => {
      const uid = snapshotRef.current.profile.uid;
      if (!uid) {
        fail('auth');
        return false;
      }
      const sourceKey = await loadGroupKeyString(input.sourceGroupId);
      const result = applyMerge({
        snapshot: snapshotRef.current,
        targetPersonId: input.targetPersonId,
        targetGroupId: snapshotRef.current.group?.id ?? '',
        sourcePersonId: input.sourcePersonId,
        sourceGroupId: input.sourceGroupId,
        sharedGiftIds: input.sharedGiftIds,
        uid,
        now: Date.now(),
        freeLimit: env.freeTierMaxPeople,
        newId: randomId,
        sourceKeyPresent: Boolean(sourceKey),
        deleteSource: false,
      });
      if (!result.ok) {
        fail(result.error);
        return false;
      }
      await commit(result.snapshot);
      try {
        await pushCurrent(snapshotRef.current, env);
        const committed = commitMergeSource(snapshotRef.current, Date.now());
        await commit(committed);
        await pushCurrent(snapshotRef.current, env);
        setDuplicateOffers(current =>
          current.filter(offer => offer.sourcePersonId !== input.sourcePersonId || offer.sourceGroupId !== input.sourceGroupId),
        );
        setNotice(t('merge.done'));
        return true;
      } catch {
        await commit(undoMerge(snapshotRef.current, Date.now()));
        fail('mergePush');
        return false;
      }
    },
    duplicateOffers,
    dismissDuplicateOffer: (sourcePersonId, sourceGroupId, targetPersonId) => {
      setDuplicateOffers(current =>
        current.filter(
          offer =>
            offer.sourcePersonId !== sourcePersonId ||
            offer.sourceGroupId !== sourceGroupId ||
            offer.targetPersonId !== targetPersonId,
        ),
      );
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
          occasion: occasion && occasion.occasion.type !== 'custom' ? occasion.occasion.type : null,
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
        occasion: occasion && occasion.occasion.type !== 'custom' ? occasion.occasion.type : null,
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
            occasion: occasion ? occasionLabel(occasion.occasion) : null,
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
      const groupKey = (await loadGroupKeyString(current.group.id)) ?? '';
      try {
        if (groupKey) {
          await publishPreview(snapshotRef.current, keyFromString(groupKey));
        }
      } catch (caught) {
        noteSync(caught);
      }
      const httpsLink = buildInviteUrl({
        domain: env.inviteDomain,
        groupId: current.group.id,
        inviteId,
        groupKey,
      });
      const label = groupDisplayName(current.group.name, memberNames(snapshotRef.current.members));
      return t('groupScreen.shareText', { name: label, link: httpsLink });
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
        haptic('error');
        return;
      }
      const groupId = current.group.id;
      const ownerClosing = current.group.ownerId === uid && remaining.length === 0;
      const before = current;
      await commit(leaveActiveGroup(clearClaimsForUid(current, uid, Date.now())));
      haptic('warning');
      offerUndo(t('groupScreen.leftList'), async () => {
        await commit(before);
      }, async () => {
        let released = true;
        try {
          if (ownerClosing) {
            await callFunction(env, 'releaseOwnedGroup', { groupId });
          } else {
            await callFunction(env, 'leaveGroup', { groupId });
          }
        } catch (caught) {
          released = false;
          noteSync(caught);
        }
        if (!released) {
          const latest = snapshotRef.current;
          await commit({
            ...latest,
            pendingMembership: [...(latest.pendingMembership ?? []), { action: 'leave', groupId, uid }],
            ...(ownerClosing ? { releasedGroupIds: [...(before.releasedGroupIds ?? []), groupId] } : {}),
          });
        }
        sync().catch(() => undefined);
      });
    },
    removeGroupMember: async uid => {
      const current = snapshotRef.current;
      const result = removeMember(current, uid, Date.now());
      if (!result.ok) {
        fail(result.error);
        return;
      }
      const groupId = current.group?.id;
      const name = current.members.find(member => member.uid === uid)?.displayName ?? '';
      await commit(result.snapshot);
      haptic('warning');
      offerUndo(t('groupScreen.memberRemoved', { name }), async () => {
        await commit(current);
      }, async () => {
        if (!groupId) {
          return;
        }
        try {
          await callFunction(env, 'revokeMember', { groupId, uid });
        } catch (caught) {
          const latest = snapshotRef.current;
          await commit({
            ...latest,
            pendingMembership: [...(latest.pendingMembership ?? []), { action: 'remove', groupId, uid }],
          });
          noteSync(caught);
        }
        sync().catch(() => undefined);
      });
    },
    transferOwnership: async uid => {
      const groupId = snapshotRef.current.group?.id;
      if (!groupId) {
        return;
      }
      try {
        await callFunction(env, 'transferOwnership', { groupId, nextOwnerId: uid });
        await sync();
      } catch (caught) {
        fail(isOneListError(caught) ? 'oneList' : 'forbidden');
      }
    },
    setListCurrency: async currency => {
      await commit(setGroupCurrency(snapshotRef.current, currency, Date.now()));
      sync().catch(() => undefined);
    },
    setReminders: async enabled => {
      if (enabled) {
        const granted = await requestReminderPermission();
        await commit(withProfile(snapshotRef.current, { reminders: granted ? 'on' : 'off' }));
        if (!granted) {
          fail('notifications');
        }
      } else {
        await commit(withProfile(snapshotRef.current, { reminders: 'off' }));
      }
      await scheduleReminders(snapshotRef.current);
    },
    deleteAccount: async () => {
      const uid = snapshotRef.current.profile.uid;
      if (!uid) {
        fail('auth');
        return;
      }
      try {
        await callFunction(env, 'deleteAccount', {});
        await deleteCurrentUser();
        await commit(emptySnapshot(Date.now()));
        haptic('warning');
      } catch {
        fail('auth');
      }
    },
    renameList: async name => {
      await commit(renameGroup(snapshotRef.current, name.trim(), Date.now()));
      const secret = snapshotRef.current.group
        ? await loadGroupKeyString(snapshotRef.current.group.id)
        : null;
      if (secret) {
        publishPreview(snapshotRef.current, keyFromString(secret)).catch(() => undefined);
      }
      sync().catch(() => undefined);
    },
    showRecovery: async () => {
      const id = snapshotRef.current.group?.id;
      if (!id) {
        return null;
      }
      return loadSecret(recoveryAccount(id));
    },
    exportText: () => exportAccount(snapshotRef.current, new Date(), (cents, currency) => formatMoney(cents, deviceLocale(), currency)) ?? '',
    updateGift: async (giftId, title, price, date, privateGift) => {
      const priceCents = parseBudget(price);
      if (!title.trim() || priceCents == null) {
        fail(title.trim() ? 'price' : 'invalid');
        return false;
      }
      const purchasedOn = date.trim() ? date.trim() : todayIso();
      const result = privateGift
        ? updatePrivateGift({ snapshot: snapshotRef.current, giftId, title, priceCents, purchasedOn, now: Date.now() })
        : updateSharedGift({ snapshot: snapshotRef.current, giftId, uid: snapshotRef.current.profile.uid, title, priceCents, purchasedOn, now: Date.now() });
      if (!result.ok) {
        fail(result.error);
        return false;
      }
      await commit(result.snapshot);
      sync().catch(() => undefined);
      return true;
    },
    deleteGift: async (giftId, privateGift) => {
      const before = snapshotRef.current;
      const result = privateGift
        ? deletePrivateGift(before, giftId, Date.now())
        : deleteSharedGift({ snapshot: before, giftId, uid: before.profile.uid, now: Date.now() });
      if (!result.ok) {
        fail(result.error);
        return;
      }
      await commit(result.snapshot);
      haptic('warning');
      offerUndo(t('person.giftRemoved'), async () => {
        await commit(before);
        sync().catch(() => undefined);
      }, () => sync());
    },
    updateOccasion: async (occasionId, month, day, year) => {
      const result = updateOccasionDate({ snapshot: snapshotRef.current, occasionId, month, day, year, now: Date.now() });
      if (!result.ok) {
        fail(result.error);
        return;
      }
      await commit(result.snapshot);
      haptic('success');
      scheduleReminders(snapshotRef.current).catch(() => undefined);
      sync().catch(() => undefined);
    },
    deleteOccasion: async occasionId => {
      const before = snapshotRef.current;
      const result = deleteOccasion(before, occasionId, Date.now());
      if (!result.ok) {
        fail(result.error);
        return;
      }
      await commit(result.snapshot);
      haptic('warning');
      scheduleReminders(snapshotRef.current).catch(() => undefined);
      offerUndo(t('person.occasionRemoved'), async () => {
        await commit(before);
        scheduleReminders(snapshotRef.current).catch(() => undefined);
        sync().catch(() => undefined);
      }, () => sync());
    },
    linkRecipient: async (personId, linkedUid) => {
      const current = snapshotRef.current;
      const groupId = current.group?.id;
      if (!groupId || current.group?.ownerId !== current.profile.uid) {
        fail('forbidden');
        return;
      }
      try {
        await callFunction(env, 'linkRecipient', {
          groupId,
          personId,
          linkedUid,
          states: current.states.filter(item => item.personId === personId).map(item => item.id),
          gifts: current.gifts.filter(item => item.personId === personId).map(item => item.id),
          ideas: current.ideas.filter(item => item.personId === personId).map(item => item.id),
        });
      } catch (caught) {
        noteSync(caught);
        return;
      }
      const now = Date.now();
      const linked = updatePerson(current, personId, { linkedUid }, now);
      if (!linked.ok) {
        return;
      }
      const hidden = linkedUid || '';
      const dirty = { ...linked.snapshot.dirty };
      const stamp = <T extends { id: string; personId: string; hiddenFrom?: string; updatedAt: number }>(rows: T[], collection: string): T[] =>
        rows.map(item => {
          if (item.personId !== personId) {
            return item;
          }
          const next = { ...item, updatedAt: now };
          if (hidden) {
            next.hiddenFrom = hidden;
          } else {
            delete next.hiddenFrom;
          }
          dirty[dirtyKey(collection, item.id)] = true;
          return next;
        });
      await commit({
        ...linked.snapshot,
        states: stamp(linked.snapshot.states, 'states'),
        gifts: stamp(linked.snapshot.gifts, 'gifts'),
        ideas: stamp(linked.snapshot.ideas, 'ideas'),
        dirty,
      });
      sync().catch(() => undefined);
    },
    undoMerge: async () => {
      await commit(undoMerge(snapshotRef.current, Date.now()));
      sync().catch(() => undefined);
    },
    dismissBanner: async () => {
      await commit(withProfile(snapshotRef.current, { upgradeBannerDismissed: true }));
    },
    buy: async () => {
      try {
        await buyUnlock(env.iapProductId);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t('settings.storeMissing'));
        haptic('error');
      }
    },
    restorePurchases: async () => {
      try {
        const owned = await loadOwned(env.iapProductId);
        if (owned.length === 0) {
          setError(t('settings.storeMissing'));
          haptic('error');
          return;
        }
        for (const purchase of owned) {
          const paid = await verifyPurchase(env, purchaseProof(purchase));
          if (paid.reason === 'revoked') {
            await commit(withAccountUnlock(snapshotRef.current, false));
            return;
          }
          if (paid.verified) {
            await commit(withAccountUnlock(snapshotRef.current, true));
            await finishOwned(purchase);
            haptic('success');
            return;
          }
        }
        fail('notConfigured');
      } catch {
        setError(t('settings.storeMissing'));
        haptic('error');
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
  }), [addImported, canUndo, clearResumePerson, cloudRemaining, colors, commit, confetti, duplicateOffers, env, error, fail, noteSync, notice, noticeArt, offerUndo, offline, onNavigate, ready, recoveryCode, resumePersonId, runUndo, setNotice, showNotice, skinId, snapshot, startupDetail, startupFailure, storeProduct, storeReady, sync]);

  return <GifteezContext.Provider value={api}>{children}</GifteezContext.Provider>;
}

function groupKeyAccount(groupId: string): string {
  return `group-key:${groupId}`;
}

function recoveryAccount(groupId: string): string {
  return `recovery-code:${groupId}`;
}

async function loadGroupKeyString(groupId: string): Promise<string | null> {
  const saved = await loadSecret(groupKeyAccount(groupId));
  if (saved) {
    return saved;
  }
  const legacy = await loadSecret('group-key');
  if (!legacy) {
    return null;
  }
  await saveSecret(groupKeyAccount(groupId), legacy);
  return legacy;
}

async function publishPreview(snapshot: AppSnapshot, key: Uint8Array): Promise<void> {
  if (!snapshot.group || !snapshot.profile.inviteId || !snapshot.profile.uid) {
    return;
  }
  await createInvite(
    snapshot.group.id,
    snapshot.profile.inviteId,
    snapshot.profile.uid,
    sealJson({ name: snapshot.group.name, memberNames: memberNames(snapshot.members) }, key),
  );
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
    const base = emptySnapshot(Date.now());
    return {
      ...base,
      ...parsed,
      releasedGroupIds: Array.isArray(parsed.releasedGroupIds) ? parsed.releasedGroupIds : [],
      privateGifts: Array.isArray(parsed.privateGifts) ? parsed.privateGifts : [],
      mergeJournal: parsed.mergeJournal ?? null,
      pendingMembership: Array.isArray(parsed.pendingMembership) ? parsed.pendingMembership : [],
      profile: { ...base.profile, ...parsed.profile, reminders: parsed.profile.reminders ?? 'unset' },
    };
  } catch {
    return emptySnapshot(Date.now());
  }
}

async function flushReleases(snapshot: AppSnapshot, env: AppEnv): Promise<AppSnapshot> {
  const pending = snapshot.releasedGroupIds ?? [];
  if (pending.length === 0) {
    return snapshot;
  }
  const left: string[] = [];
  for (const groupId of pending) {
    try {
      await callFunction(env, 'releaseOwnedGroup', { groupId });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      const code = caught && typeof caught === 'object' && 'code' in caught ? String((caught as { code?: unknown }).code) : '';
      if (message.includes('owner-stays') || code.includes('permission-denied')) {
        continue;
      }
      left.push(groupId);
    }
  }
  if (left.length === pending.length) {
    return snapshot;
  }
  return { ...snapshot, releasedGroupIds: left };
}

function isOneListError(caught: unknown): boolean {
  const message = caught instanceof Error ? caught.message : '';
  return message.includes('one-list');
}

function sealMember(uid: string, displayName: string, key: Uint8Array, now: number): SealedDoc {
  return {
    id: uid,
    updatedAt: now,
    deleted: false,
    ciphertext: sealJson({ uid, displayName }, key),
  };
}

class CapError extends Error {
  personId: string;
  constructor(personId: string) {
    super('cap');
    this.personId = personId;
  }
}

async function pushSnapshot(snapshot: AppSnapshot, key: Uint8Array, env: AppEnv): Promise<boolean> {
  if (!snapshot.group) {
    return false;
  }
  const groupId = snapshot.group.id;
  if (snapshot.dirty['group:meta'] || snapshot.dirty['group:members']) {
    const existing = await readGroupDocument(groupId);
    if (!existing) {
      if (snapshot.group.ownerId !== snapshot.profile.uid) {
        return false;
      }
      await callFunction(env, 'createOwnedGroup', {
        groupId,
        ciphertext: sealJson({ name: snapshot.group.name, currency: groupCurrency(snapshot.group) }, key),
        updatedAt: snapshot.group.updatedAt,
        deviceId: await deviceId(),
      });
    }
    // Membership, rotation, and the recipient count are server-owned. A client write cannot drop a member.
    await updateGroupDocument(groupId, {
      ciphertext: sealJson({ name: snapshot.group.name, currency: groupCurrency(snapshot.group) }, key),
      updatedAt: snapshot.group.updatedAt,
    });
  }
  for (const name of COLLECTIONS) {
    const records = recordsFor(snapshot, name);
    for (const record of records) {
      if (!snapshot.dirty[dirtyKey(name, record.id)]) {
        continue;
      }
      const personId = typeof record.body.personId === 'string' ? record.body.personId : undefined;
      const sealed: SealedDoc = {
        id: record.id,
        updatedAt: record.updatedAt,
        deleted: Boolean(record.deleted),
        ciphertext: sealJson(bodyWithoutHidden(record.body), key),
        ...(personId ? { personId } : {}),
      };
      if (name === 'people') {
        try {
          await callFunction(env, 'writePerson', {
            groupId,
            personId: record.id,
            ciphertext: sealed.ciphertext,
            updatedAt: record.updatedAt,
            deleted: Boolean(record.deleted),
            createdAt: Number(record.body.createdAt ?? record.updatedAt),
          });
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : '';
          if (message.includes('cap') && !record.deleted) {
            throw new CapError(record.id);
          }
          throw caught;
        }
        continue;
      }
      const kind = pushKind(name, record.hiddenFrom);
      if (kind === 'hidden' && record.hiddenFrom) {
        await writeHidden(groupId, record.hiddenFrom, name, sealed);
        deleteSealed(groupId, name, record.id).catch(() => undefined);
      } else {
        await writeSealed(groupId, name, sealed);
      }
    }
  }
  return true;
}

async function pushCurrent(snapshot: AppSnapshot, env: AppEnv): Promise<void> {
  if (snapshot.group) {
    const secret = await loadGroupKeyString(snapshot.group.id);
    if (secret) {
      await pushSnapshot(snapshot, keyFromString(secret), env);
    }
  }
  await flushDirtyArchives(snapshot, env);
  await flushPrivateGifts(snapshot);
}

function snapshotForArchive(base: AppSnapshot, archive: GroupArchive): AppSnapshot {
  return {
    ...base,
    group: archive.group,
    members: archive.members,
    people: archive.people,
    occasions: archive.occasions,
    states: archive.states,
    gifts: archive.gifts,
    ideas: archive.ideas,
    dirty: archive.dirty,
  };
}

/** Soft-deletes on a list that is not open are sealed with that list's key, not the active group's key. */
async function flushDirtyArchives(snapshot: AppSnapshot, env: AppEnv): Promise<AppSnapshot> {
  let next = snapshot;
  for (const id of Object.keys(next.archives ?? {})) {
    if (id === next.group?.id) {
      continue;
    }
    const archive = next.archives[id];
    if (!archive || Object.keys(archive.dirty).length === 0) {
      continue;
    }
    const groupKey = await loadGroupKeyString(archive.group.id);
    if (!groupKey) {
      continue;
    }
    const wrote = await pushSnapshot(snapshotForArchive(next, archive), keyFromString(groupKey), env);
    if (!wrote) {
      continue;
    }
    next = {
      ...next,
      archives: {
        ...next.archives,
        [id]: { ...next.archives[id], dirty: {} },
      },
    };
  }
  return next;
}

function privateGiftBody(gift: PrivateGift): Record<string, unknown> {
  return {
    personId: gift.personId,
    groupId: gift.groupId,
    occasionId: gift.occasionId,
    year: gift.year,
    title: gift.title,
    priceCents: gift.priceCents,
    purchasedOn: gift.purchasedOn,
    ...(gift.boughtBy ? { boughtBy: gift.boughtBy } : {}),
  };
}

/** Private gifts are sealed with the device key. The group key cannot read them. */
async function flushPrivateGifts(snapshot: AppSnapshot): Promise<AppSnapshot> {
  const uid = snapshot.profile.uid;
  if (!uid) {
    return snapshot;
  }
  const deviceKey = await ensureDeviceKey();
  const dirty = { ...snapshot.dirty };
  const pending = (snapshot.privateGifts ?? []).filter(gift => dirty[dirtyKey('privateGifts', gift.id)]);
  for (const gift of pending) {
    await writePrivateGift(uid, {
      id: gift.id,
      updatedAt: gift.updatedAt,
      deleted: Boolean(gift.deleted),
      ciphertext: sealJson(privateGiftBody(gift), deviceKey),
    });
    delete dirty[dirtyKey('privateGifts', gift.id)];
  }
  let privateGifts = snapshot.privateGifts ?? [];
  try {
    const docs = await readPrivateGifts(uid);
    const remote: PrivateGift[] = [];
    docs.forEach(item => {
      if (!item.ciphertext) {
        return;
      }
      try {
        const data = openJson<PrivateGift>(item.ciphertext, deviceKey);
        remote.push({
          ...data,
          id: item.id,
          updatedAt: item.updatedAt,
          deleted: item.deleted || Boolean(data.deleted),
        });
      } catch {
        // Sealed with a key this phone does not hold.
      }
    });
    privateGifts = mergePrivateGifts(snapshot.privateGifts ?? [], remote, snapshot.dirty);
  } catch {
    privateGifts = snapshot.privateGifts ?? [];
  }
  return { ...snapshot, privateGifts, dirty };
}

function recordsFor(snapshot: AppSnapshot, name: (typeof COLLECTIONS)[number]): Array<{ id: string; updatedAt: number; deleted?: boolean; hiddenFrom?: string; body: Record<string, unknown> }> {
  const source = snapshot[name] as Array<{ id: string; updatedAt: number; deleted?: boolean; hiddenFrom?: string }>;
  return source.map(item => {
    const { id, updatedAt, deleted, hiddenFrom, ...body } = item;
    const shared = name === 'people' ? omitRelationship(body as Person) : body;
    return { id, updatedAt, deleted, hiddenFrom, body: shared as Record<string, unknown> };
  });
}

function markGroupStale(snapshot: AppSnapshot, groupId: string, stale: boolean): AppSnapshot {
  const roster = snapshot.roster.map(item => (item.id === groupId ? { ...item, stale } : item));
  if (snapshot.group?.id === groupId) {
    return { ...snapshot, roster, group: { ...snapshot.group, stale } };
  }
  const archive = snapshot.archives[groupId];
  if (!archive) {
    return { ...snapshot, roster };
  }
  return {
    ...snapshot,
    roster,
    archives: { ...snapshot.archives, [groupId]: { ...archive, group: { ...archive.group, stale } } },
  };
}

function dropPerson(snapshot: AppSnapshot, personId: string): AppSnapshot {
  const people = snapshot.people.filter(person => person.id !== personId);
  const group = snapshot.group
    ? { ...snapshot.group, peopleCount: people.filter(person => !person.deleted).length }
    : snapshot.group;
  const dirty = { ...snapshot.dirty };
  delete dirty[dirtyKey('people', personId)];
  return { ...snapshot, people, group, dirty };
}

async function flushPendingMembership(snapshot: AppSnapshot, env: AppEnv): Promise<AppSnapshot> {
  const pending = snapshot.pendingMembership ?? [];
  if (pending.length === 0) {
    return snapshot;
  }
  const left = [];
  for (const item of pending) {
    try {
      if (item.action === 'leave') {
        await callFunction(env, 'leaveGroup', { groupId: item.groupId });
      } else {
        await callFunction(env, 'revokeMember', { groupId: item.groupId, uid: item.uid });
      }
    } catch {
      left.push(item);
    }
  }
  return { ...snapshot, pendingMembership: left };
}

async function migrateDeviceRecovery(snapshot: AppSnapshot): Promise<void> {
  const uid = snapshot.profile.uid;
  if (!uid) {
    return;
  }
  const existing = await readRecovery(uid, 'device').catch(() => null);
  if (existing?.wrapped && existing.salt) {
    return;
  }
  const ids = [snapshot.group?.id, ...Object.keys(snapshot.archives ?? {})].filter((id): id is string => Boolean(id));
  const deviceKey = await ensureDeviceKey();
  for (const groupId of ids) {
    const code = await loadSecret(recoveryAccount(groupId));
    if (!code) {
      continue;
    }
    await writeRecovery(uid, 'device', wrapKey(deviceKey, code));
    return;
  }
}

async function scheduleReminders(snapshot: AppSnapshot): Promise<void> {
  if (snapshot.profile.reminders !== 'on') {
    if (snapshot.profile.reminders === 'off') {
      await cancelReminderPlan();
    }
    return;
  }
  const slots = planReminders({
    people: snapshot.people,
    occasions: snapshot.occasions,
    now: new Date(),
    enabled: true,
  });
  await applyReminderPlan(slots);
}

function withOnDeviceIdeas(snapshot: AppSnapshot, personId: string): AppSnapshot {
  const person = snapshot.people.find(item => item.id === personId && !item.deleted);
  if (!person) {
    return snapshot;
  }
  const occasion = upcomingOccasion(personId, snapshot.occasions, new Date());
  const occasionKey = occasion ? `${occasion.occasion.id}:${occasion.date.getFullYear()}` : 'general';
  const cacheId = ideaCacheId(personId, occasionKey, 'on-device');
  const previous = snapshot.ideas.find(item => item.id === cacheId);
  const ideas = suggestIdeas({
    personId,
    name: person.name,
    tags: person.tags,
    occasion: occasion && occasion.occasion.type !== 'custom' ? occasion.occasion.type : null,
    feedback: snapshot.feedback,
    salt: previous?.salt ?? 0,
  });
  return upsertIdeas(snapshot, {
    id: cacheId,
    personId,
    occasionKey,
    ideas,
    source: 'on-device',
    salt: previous?.salt ?? 0,
    generatedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

function groupFromRemote(groupId: string, remote: Record<string, unknown>, key: Uint8Array, fallback: AppSnapshot['group']): AppSnapshot['group'] {
  let name = fallback?.name ?? '';
  let currency = groupCurrency(fallback);
  try {
    const sealed = openJson<{ name?: string; currency?: string }>(String(remote.ciphertext ?? ''), key);
    name = sealed.name || name;
    currency = sealed.currency || currency;
  } catch {
    name = fallback?.name ?? name;
  }
  return {
    id: groupId,
    name,
    ownerId: String(remote.ownerId ?? fallback?.ownerId ?? ''),
    memberIds: Array.isArray(remote.memberIds) ? remote.memberIds.map(String) : fallback?.memberIds ?? [],
    peopleCount: Number(remote.peopleCount ?? fallback?.peopleCount ?? 0),
    entitled: Boolean(remote.entitled),
    updatedAt: Number(remote.updatedAt ?? fallback?.updatedAt ?? 0),
    currency,
    keyVersion: Number(remote.keyVersion ?? fallback?.keyVersion ?? 0),
    needsRotation: remote.needsRotation === true,
    lockedPersonIds: Array.isArray(remote.lockedPersonIds) ? remote.lockedPersonIds.map(String) : [],
    stale: false,
  };
}

async function readGroupRecords(groupId: string, key: Uint8Array, selfUid: string | null, memberIds: string[]): Promise<RemoteRecord[]> {
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
  for (const memberId of memberIds) {
    if (memberId === selfUid) {
      continue;
    }
    for (const name of ['states', 'gifts', 'ideas'] as const) {
      try {
        const docs = await readHidden(groupId, memberId, name);
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
              data: { ...openJson<Record<string, unknown>>(item.ciphertext, key), hiddenFrom: memberId },
            });
          } catch {
            // Hidden ciphertext this key cannot open yet.
          }
        });
      } catch {
        // Not allowed, or the path is empty.
      }
    }
  }
  return remoteRecords;
}

async function absorbGroup(snapshot: AppSnapshot, groupId: string, key: Uint8Array, active: boolean): Promise<AppSnapshot> {
  const remote = await readGroupDocument(groupId);
  if (!remote) {
    return snapshot;
  }
  const baseGroup = snapshot.group?.id === groupId ? snapshot.group : snapshot.archives[groupId]?.group ?? null;
  let nextKey = key;
  const remoteVersion = Number(remote.keyVersion ?? 0);
  if (remoteVersion > (baseGroup?.keyVersion ?? 0)) {
    const wrapped = await readKeyWrap(groupId, String(remoteVersion));
    if (wrapped) {
      try {
        const opened = openJson<{ key: string }>(wrapped, key);
        nextKey = keyFromString(opened.key);
        await saveSecret(groupKeyAccount(groupId), keyToString(nextKey));
      } catch {
        return markGroupStale(snapshot, groupId, true);
      }
    }
  }
  const meta = groupFromRemote(groupId, remote, nextKey, baseGroup);
  if (!meta) {
    return snapshot;
  }
  const shell = snapshot.group?.id === groupId
    ? snapshot
    : snapshotForArchive(snapshot, snapshot.archives[groupId] ?? {
      group: meta,
      members: [],
      people: [],
      occasions: [],
      states: [],
      gifts: [],
      ideas: [],
      dirty: {},
      inviteId: null,
    });
  const mergedGroup = applyGroupRemote({ ...shell, group: shell.group ?? meta }, meta);
  const records = await readGroupRecords(groupId, nextKey, snapshot.profile.uid, meta.memberIds);
  const merged = mergeRemote(mergedGroup.snapshot, records);
  const cleaned = stripSensitiveForViewer(merged.snapshot);
  if (active && snapshot.group?.id === groupId) {
    return { ...cleaned, group: cleaned.group ? { ...cleaned.group, stale: false } : cleaned.group };
  }
  const parked = parkActive({ ...snapshot, group: snapshot.group });
  const archive = captureFrom(cleaned, meta);
  const roster = upsertRoster(parked, meta, cleaned.members);
  if (!parked.group) {
    return switchGroupSnapshot({ ...parked, archives: { ...parked.archives, [groupId]: archive }, roster }, groupId) ?? parked;
  }
  return { ...parked, archives: { ...parked.archives, [groupId]: archive }, roster };
}

function captureFrom(snapshot: AppSnapshot, group: NonNullable<AppSnapshot['group']>): GroupArchive {
  return {
    group,
    members: snapshot.members,
    people: snapshot.people,
    occasions: snapshot.occasions,
    states: snapshot.states,
    gifts: snapshot.gifts,
    ideas: snapshot.ideas,
    dirty: snapshot.dirty,
    inviteId: snapshot.profile.inviteId,
  };
}

function upsertRoster(snapshot: AppSnapshot, group: NonNullable<AppSnapshot['group']>, members: AppSnapshot['members']): AppSnapshot['roster'] {
  const summary = {
    id: group.id,
    name: group.name,
    ownerId: group.ownerId,
    memberIds: group.memberIds,
    memberNames: memberNames(members),
    updatedAt: group.updatedAt,
    stale: Boolean(group.stale),
  };
  const exists = snapshot.roster.some(item => item.id === group.id);
  return exists ? snapshot.roster.map(item => (item.id === group.id ? summary : item)) : [...snapshot.roster, summary];
}

async function pullOtherGroups(snapshot: AppSnapshot, env: AppEnv): Promise<AppSnapshot> {
  const ids = new Set<string>([...Object.keys(snapshot.archives ?? {}), ...snapshot.roster.map(item => item.id)]);
  const listed = new Map<string, { id: string; ownerId?: string; memberIds?: string[] }>();
  if (snapshot.profile.uid) {
    try {
      const response = await callFunction<{ groupIds?: string[]; groups?: Array<{ id: string; ownerId?: string; memberIds?: string[] }> }>(env, 'listMyGroups', {});
      (response.groups ?? (response.groupIds ?? []).map(id => ({ id }))).forEach(group => {
        ids.add(group.id);
        listed.set(group.id, group);
      });
    } catch {
      // The phone still pulls the lists it already knows.
    }
  }
  if (snapshot.group) {
    ids.delete(snapshot.group.id);
  }
  let next = snapshot;
  for (const id of ids) {
    const secret = await loadGroupKeyString(id);
    const info = listed.get(id) ?? { id };
    if (!secret) {
      next = showStaleList(next, info);
      continue;
    }
    try {
      next = await absorbGroup(next, id, keyFromString(secret), false);
    } catch {
      next = showStaleList(next, info);
    }
  }
  return next;
}

async function rotateIfNeeded(snapshot: AppSnapshot, key: Uint8Array, env: AppEnv): Promise<{ snapshot: AppSnapshot; key: Uint8Array }> {
  const group = snapshot.group;
  const uid = snapshot.profile.uid;
  if (!group || !uid) {
    return { snapshot, key };
  }
  const remote = await readGroupDocument(group.id);
  if (!remote || remote.needsRotation !== true || !Array.isArray(remote.memberIds) || !remote.memberIds.map(String).includes(uid)) {
    return { snapshot, key };
  }
  const claim = await callFunction<{ ok: boolean }>(env, 'claimRotationTurn', { groupId: group.id });
  if (!claim.ok) {
    return { snapshot, key };
  }
  const version = Number(remote.keyVersion ?? 0) + 1;
  const existingWrap = await readKeyWrap(group.id, String(version));
  let nextKey = key;
  if (existingWrap) {
    nextKey = keyFromString(openJson<{ key: string }>(existingWrap, key).key);
  } else {
    nextKey = randomKey();
    await writeKeyWrap(group.id, String(version), sealJson({ key: keyToString(nextKey) }, key));
  }
  await rewriteSealed(snapshot, group.id, key, nextKey, uid, env);
  await callFunction(env, 'finishRotationTurn', { groupId: group.id, keyVersion: version });
  await saveSecret(groupKeyAccount(group.id), keyToString(nextKey));
  const code = await loadSecret(recoveryAccount(group.id));
  if (code) {
    await writeRecovery(uid, group.id, wrapKey(nextKey, code));
  }
  return {
    snapshot: { ...snapshot, group: { ...group, keyVersion: version, needsRotation: false } },
    key: nextKey,
  };
}

async function rewriteSealed(snapshot: AppSnapshot, groupId: string, oldKey: Uint8Array, newKey: Uint8Array, selfUid: string, env: AppEnv): Promise<void> {
  const memberIds = snapshot.group?.memberIds ?? [];
  for (const name of COLLECTIONS) {
    if (name === 'people') {
      continue;
    }
    const docs = await readSealed(groupId, name);
    for (const item of docs) {
      if (!item.ciphertext) {
        continue;
      }
      const opened = openEither(item.ciphertext, oldKey, newKey);
      if (!opened) {
        continue;
      }
      await writeSealed(groupId, name, {
        ...item,
        ciphertext: sealJson(opened, newKey),
      });
    }
  }
  const people = await readSealed(groupId, 'people');
  for (const item of people) {
    if (!item.ciphertext) {
      continue;
    }
    const opened = openEither(item.ciphertext, oldKey, newKey);
    if (!opened) {
      continue;
    }
    await callFunction(env, 'writePerson', {
      groupId,
      personId: item.id,
      ciphertext: sealJson(opened, newKey),
      updatedAt: item.updatedAt,
      deleted: item.deleted,
      createdAt: Number((opened as { createdAt?: number }).createdAt ?? item.updatedAt),
    }).catch(() => undefined);
  }
  for (const memberId of memberIds) {
    if (memberId === selfUid) {
      continue;
    }
    for (const name of ['states', 'gifts', 'ideas'] as const) {
      const docs = await readHidden(groupId, memberId, name).catch(() => []);
      for (const item of docs) {
        const opened = openEither(item.ciphertext, oldKey, newKey);
        if (!opened) {
          continue;
        }
        await writeHidden(groupId, memberId, name, { ...item, ciphertext: sealJson(opened, newKey) });
      }
    }
  }
}

function openEither(payload: string, oldKey: Uint8Array, newKey: Uint8Array): Record<string, unknown> | null {
  try {
    return openJson<Record<string, unknown>>(payload, oldKey);
  } catch {
    try {
      return openJson<Record<string, unknown>>(payload, newKey);
    } catch {
      return null;
    }
  }
}

async function verifyPurchase(env: AppEnv, proof: { transactionId: string; token: string; platform: 'ios' | 'android' }): Promise<{ verified: boolean; reason?: string }> {
  return callFunction<{ verified: boolean; reason?: string }>(env, 'verifyUnlock', {
    deviceId: await deviceId(),
    productId: env.iapProductId,
    platform: proof.platform,
    transactionId: proof.transactionId,
    purchaseToken: proof.token,
  });
}
