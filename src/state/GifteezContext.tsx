import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Appearance, Linking, Platform } from 'react-native';
import type { AppEnv } from '../config/env';
import { keyFromString, keyToString, openString, randomId, randomKey, sealJson } from '../crypto/crypto';
import { refreshLocalIdeas, shouldRefreshIdeas } from '../domain/ideaRefresh';
import { allowsPetIdea, cloudIdeaRequestLog, ideaCacheId, mergeIdeaBatches, moreLikeIdeas, resolveAge, suggestIdeas } from '../domain/ideas';
import { deleteOccasion, deletePrivateGift, deleteSharedGift, updateOccasionDate, updatePrivateGift, updateSharedGift } from '../domain/edits';
import { nextReminderWhen, planReminders } from '../domain/reminders';
import { classifyStartupError, startupCause, type StartupFailure } from '../domain/startup';
import {
  addFeedback,
  addOccasion,
  addPerson,
  isRealMonthDay,
  recordGift,
  occurrenceYear,
  parkActive,
  parseBirthYear,
  parseBudget,
  parseImport,
  clearIdea,
  saveIdea,
  upcomingOccasion,
  updatePerson,
  upsertIdeas,
  withAccountUnlock,
  withProfile,
  type ImportedPerson,
} from '../domain/logic';
import { emptySnapshot, type AppSnapshot, type GiftIdea, type Occasion, type OccasionType, type Person } from '../domain/types';
import { formatDate, t } from '../i18n';
import { applyAppearance, loadAppearance, saveAppearance, type AppearanceChoice } from '../platform/appearance';
import { loadSkinPreview, saveSkinPreview } from '../platform/skinPreview';
import { isIncomingBackup, pickBackupText, readBackupUri, shareBackupFile } from '../platform/backupFile';
import { readCacheBlob, readSnapshotSlots, writeSnapshotSlots } from '../platform/cache';
import { deviceId } from '../platform/device';
import { activeSkinParam, callFunction, downloadSkin, ensureAnonymousUser, initFirebase } from '../platform/firebase';
import { planImported } from '../domain/contactImport';
import { importContacts, sweepBirthdays } from '../platform/importers';
import { buyUnlock, connectStore, finishOwned, listenToPurchases, loadOwned, purchaseProof, type StoreProduct } from '../platform/iap';
import { applyReminderPlan, cancelReminderPlan, requestReminderPermission } from '../platform/reminders';
import { loadSecret, saveSecret } from '../platform/secure';
import { occasionLabel, planOccasion, presetFor } from '../domain/occasions';
import { exportBackup, migrateToLocal, parseBackup, summarizeBackup, type BackupFailure } from '../domain/backup';
import { CacheStageError, decideCacheLoad, decideCommit, planSnapshotWrite, purgeDeleted, snapshotContentKey, type CacheLoadFailure } from '../domain/snapshotLoad';
import { normalizeStoredDate, parseLocalDate } from '../domain/calendarDate';
import { relationshipCircleName, relationshipLabel, storeRelationship, type RelationshipPresetKey } from '../domain/relationship';
import { applyCircleBudget } from '../domain/budget';
import { acceptSuggestion, addCircle, assignCircle, cleanCircleName, removeCircle, renameCircle as renameStoredCircle } from '../domain/circles';
import { haptic } from '../platform/haptics';
import type { CelebrateName } from '../theme/tokens';
import { colorsFor, parseSkin, resolveSkin, withColorScheme, type ResolvedColors, type SkinId, type ThemeColors } from '../theme/skins';

type CloudResult = { ideas: GiftIdea[]; counted: boolean; remaining: number };

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
  /** A saved blob exists and could not be opened. The raw bytes are still in storage. */
  dataRecovery: boolean;
  /** Which open stage failed. Debug builds may show the name. Never the key or the blob. */
  recoveryStage: CacheLoadFailure | null;
  exportRawCache: () => Promise<void>;
  resumePersonId: string | null;
  openPerson: (personId: string) => void;
  clearResumePerson: () => void;
  storeProduct: StoreProduct | null;
  storeReady: boolean;
  storeBusy: boolean;
  clearNotice: () => void;
  clearError: () => void;
  addPerson: (input: { name: string; budget: string; tags: string[]; imported?: boolean; relationship?: string; circleId?: string; birthYear?: string }) => Promise<string | null>;
  savePerson: (id: string, patch: Partial<Pick<Person, 'name' | 'budgetCents' | 'budgetCustom' | 'tags' | 'relationship' | 'notes' | 'savedIdeas'>> & { birthYear?: number | null }) => Promise<void>;
  createCircle: (name: string) => Promise<string | null>;
  renameCircle: (circleId: string, name: string) => Promise<void>;
  setCircleBudget: (circleId: string, budgetCents: number | null, mode?: 'everyone' | 'new') => Promise<void>;
  deleteCircle: (circleId: string) => Promise<void>;
  setPersonCircle: (personId: string, circleId: string | null) => Promise<void>;
  acceptCircleSuggestion: (key: RelationshipPresetKey, personIds: string[]) => Promise<void>;
  removePerson: (id: string) => Promise<void>;
  addOccasion: (
    personId: string,
    type: OccasionType,
    month?: number,
    day?: number,
    year?: number,
    extra?: { label?: string; recurs?: boolean },
  ) => Promise<string | null>;
  saveIdeaFor: (occasionId: string, idea: string) => Promise<void>;
  unsaveIdea: (occasionId: string) => Promise<void>;
  toast: (message: string) => void;
  logGift: (personId: string, occasionId: string, title: string, price: string, date: string) => Promise<boolean>;
  updateGift: (giftId: string, title: string, price: string, date: string, privateGift: boolean) => Promise<boolean>;
  deleteGift: (giftId: string, privateGift: boolean) => Promise<void>;
  updateOccasion: (occasionId: string, month: number, day: number, year?: number) => Promise<void>;
  deleteOccasion: (occasionId: string) => Promise<void>;
  vote: (personId: string, idea: string, vote: 'up' | 'down') => Promise<void>;
  moreLike: (personId: string, seed: string) => Promise<void>;
  focusPerson: (personId: string) => Promise<void>;
  refreshIdeas: (personId: string) => Promise<void>;
  cloudIdeas: (personId: string) => Promise<GiftIdea[]>;
  cloudRemaining: Record<string, number>;
  setReminders: (enabled: boolean, announce?: boolean) => Promise<void>;
  exportBackup: () => string;
  shareBackup: () => Promise<void>;
  pickBackup: () => Promise<void>;
  previewBackup: (text: string) => void;
  restoreBackup: (text: string) => Promise<BackupFailure | 'ok'>;
  incomingBackup: { preview: string } | null;
  acceptIncomingBackup: () => Promise<void>;
  clearIncomingBackup: () => void;
  paywallOpen: boolean;
  openPaywall: () => void;
  dismissPaywall: () => void;
  cancelPendingAdd: () => void;
  completedPersonId: string | null;
  clearCompletedPerson: () => void;
  appearance: AppearanceChoice;
  setAppearance: (choice: AppearanceChoice) => Promise<void>;
  skinPreview: SkinId | 'remote' | 'auto';
  previewSkin: (id: SkinId | 'remote' | 'auto') => void;
  updateProfile: (patch: Partial<AppSnapshot['profile']>) => Promise<void>;
  finishWelcome: () => Promise<void>;
  buy: () => Promise<void>;
  restorePurchases: () => Promise<void>;
  importText: (text: string) => Promise<number>;
  loadContacts: () => Promise<ImportedPerson[] | 'denied'>;
  importPeople: (rows: ImportedPerson[]) => Promise<number>;
  importFromCalendar: () => Promise<number | 'denied'>;
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
  const [dataRecovery, setDataRecovery] = useState(false);
  const [recoveryStage, setRecoveryStage] = useState<CacheLoadFailure | null>(null);
  const sealedHold = useRef<string | null>(null);
  const cacheReady = useRef(false);
  const persistedPeople = useRef(0);
  const lastContent = useRef<string | null>(null);
  const [startupDetail, setStartupDetail] = useState<string | null>(null);
  const [resumePersonId, setResumePersonId] = useState<string | null>(null);
  const clearResumePerson = useCallback(() => setResumePersonId(null), []);
  const [skinId, setSkinId] = useState<SkinId>('base');
  const [colors, setColors] = useState<ResolvedColors>(() => withColorScheme(colorsFor('base', {}).colors, Appearance.getColorScheme()));
  const offline = false;
  const [canUndo, setCanUndo] = useState(false);
  const paletteRef = useRef<ThemeColors>(colorsFor('base', {}).colors);
  const paint = useCallback((next: ThemeColors) => {
    paletteRef.current = next;
    setColors(withColorScheme(next, Appearance.getColorScheme()));
  }, []);
  const [downloaded, setDownloaded] = useState<Partial<Record<SkinId, ThemeColors>>>({});
  const [storeProduct, setStoreProduct] = useState<StoreProduct | null>(null);
  const [storeReady, setStoreReady] = useState(false);
  const [storeBusy, setStoreBusy] = useState(false);
  const [cloudRemaining, setCloudRemaining] = useState<Record<string, number>>({});
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [completedPersonId, setCompletedPersonId] = useState<string | null>(null);
  const [appearance, setAppearanceChoice] = useState<AppearanceChoice>('system');
  const skinOverride = useRef<SkinId | 'remote' | 'auto'>('remote');
  const [skinPreview, setSkinPreview] = useState<SkinId | 'remote' | 'auto'>('remote');
  const remoteSkin = useRef('auto');
  const [incomingBackup, setIncomingBackup] = useState<{ text: string; preview: string } | null>(null);
  const pendingAdd = useRef<{ person: Person; hadPeople: boolean } | null>(null);
  const finishPendingRef = useRef<() => Promise<void>>(async () => undefined);
  const downloadedRef = useRef(downloaded);
  downloadedRef.current = downloaded;

  const commit = useCallback(async (next: AppSnapshot, allowShrink = false) => {
    const nextPeople = next.people.filter(person => !person.deleted).length;
    if (decideCommit({
      hydrated: cacheReady.current,
      sealed: sealedHold.current != null,
      storedPeople: persistedPeople.current,
      nextPeople,
      allowShrink,
    }) === 'hold') {
      return;
    }
    const cleaned = purgeDeleted(next);
    const stored = parkActive(cleaned);
    snapshotRef.current = stored;
    persistedPeople.current = nextPeople;
    setSnapshot(stored);
    const nextContent = snapshotContentKey(cleaned);
    if (lastContent.current != null && lastContent.current === nextContent) {
      return;
    }
    const key = await ensureDeviceKey();
    const sealed = sealJson(cleaned, key);
    const plan = planSnapshotWrite({
      lastContent: lastContent.current,
      nextContent,
      slots: await readSnapshotSlots(),
      nextBlob: sealed,
    });
    if (!plan.write) {
      return;
    }
    await writeSnapshotSlots(plan.slots);
    lastContent.current = nextContent;
  }, []);

  const hasLivingPeople = snapshot.people.some(person => !person.deleted);
  useEffect(() => {
    if (!ready || snapshot.profile.onboarded || !hasLivingPeople) {
      return;
    }
    commit(withProfile(snapshotRef.current, { onboarded: true })).catch(() => undefined);
  }, [commit, hasLivingPeople, ready, snapshot.profile.onboarded]);

  const undoRestore = useRef<(() => Promise<void>) | null>(null);
  const remoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeStickyUntil = useRef(0);

  const showNotice = useCallback((message: string, sticky = false, art: CelebrateName | null = null) => {
    setError(null);
    setNotice(message, art);
    if (sticky) {
      noticeStickyUntil.current = Date.now() + 6000;
    }
  }, [setNotice]);

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
    }, 6000);
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
    const current = migrateToLocal(source ?? snapshotRef.current);
    try {
      await scheduleReminders(current);
    } catch {
      // Reminders are local. A failure here does not block the list.
    }
    return current;
  }, []);

  finishPendingRef.current = async () => {
    const pending = pendingAdd.current;
    if (!pending || !snapshotRef.current.entitlementPaid) {
      return;
    }
    const result = addPerson({ snapshot: snapshotRef.current, person: pending.person, freeLimit: env.freeTierMaxPeople });
    if (!result.ok) {
      return;
    }
    pendingAdd.current = null;
    setPaywallOpen(false);
    const finished = !pending.hadPeople && !result.snapshot.profile.onboarded
      ? withProfile(result.snapshot, { onboarded: true })
      : result.snapshot;
    await commit(finished);
    if (!pending.hadPeople && !pending.person.imported) {
      setConfetti(count => count + 1);
    }
    if (pending.hadPeople) {
      setCompletedPersonId(pending.person.id);
    }
    sync().catch(() => undefined);
  };

  useEffect(() => {
    let cancelled = false;
    loadAppearance().then(choice => {
      if (cancelled) {
        return;
      }
      setAppearanceChoice(choice);
      applyAppearance(choice);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    cacheReady.current = false;
    (async () => {
      try {
        const result = await loadSnapshot();
        if (cancelled) {
          return;
        }
        if (!result.ok) {
          sealedHold.current = result.blob;
          setRecoveryStage(result.reason);
          setDataRecovery(true);
          return;
        }
        const loaded = migrateToLocal(result.snapshot);
        snapshotRef.current = loaded;
        persistedPeople.current = loaded.people.filter(person => !person.deleted).length;
        sealedHold.current = null;
        lastContent.current = snapshotContentKey(result.snapshot);
        cacheReady.current = true;
        setRecoveryStage(null);
        setDataRecovery(false);
        setSnapshot(loaded);
        await commit(loaded);
        let next = loaded;
        try {
          await initFirebase(env);
          const uid = await ensureAnonymousUser();
          next = loaded.profile.uid === uid ? loaded : withProfile(loaded, { uid });
          await commit(next);
        } catch {
          // The list is already on the phone. Auth is only for cloud ideas and purchase checks.
        }
        try {
          const storedPreview = await loadSkinPreview();
          if (!cancelled && storedPreview && storedPreview !== 'remote') {
            skinOverride.current = storedPreview;
            setSkinPreview(storedPreview);
            const season = storedPreview === 'spring' || storedPreview === 'summer'
              ? parseSkin(storedPreview === 'spring' ? require('../../skins/spring.json') : require('../../skins/summer.json'))
              : null;
            const previewDownloaded = season ? { ...downloadedRef.current, [storedPreview]: season } : downloadedRef.current;
            if (season) {
              setDownloaded(previewDownloaded);
            }
            const preview = resolveSkin({
              remoteValue: storedPreview === 'auto' ? 'auto' : storedPreview,
              today: new Date(),
              downloaded: previewDownloaded,
            });
            setSkinId(preview.id);
            paint(preview.colors);
          }
          const skinValue = await activeSkinParam(env);
          remoteSkin.current = skinValue || 'auto';
          const resolved = resolveSkin({ remoteValue: skinValue, today: new Date(), downloaded: downloadedRef.current });
          if (!cancelled && skinOverride.current === 'remote') {
            setSkinId(resolved.id);
            paint(resolved.colors);
          }
          if (resolved.id === 'spring' || resolved.id === 'summer') {
            const payload = parseSkin(await downloadSkin(resolved.id));
            if (payload) {
              const withDownload = { ...downloadedRef.current, [resolved.id]: payload };
              const again = resolveSkin({ remoteValue: skinValue, today: new Date(), downloaded: withDownload });
              setDownloaded(withDownload);
              if (skinOverride.current === 'remote') {
                setSkinId(again.id);
                paint(again.colors);
              }
            }
          }
          const store = await connectStore(env.iapProductId);
          if (store.ok) {
            setStoreReady(true);
            setStoreProduct(store.product);
          }
          const entitlement = await callFunction<{ paid: boolean }>(env, 'getEntitlement', { deviceId: await deviceId() });
          if (entitlement.paid) {
            await commit(withAccountUnlock(snapshotRef.current, true));
          }
        } catch {
          // Skins, the store, and entitlement checks are optional. The list is already loaded.
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
    const schemeListener = Appearance.addChangeListener(({ colorScheme }) => {
      setColors(withColorScheme(paletteRef.current, colorScheme));
    });
    return () => {
      cancelled = true;
      schemeListener.remove();
    };
  }, [bootId, commit, env, paint]);

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
            await finishPendingRef.current();
            haptic('success');
          }
        })
        .catch(() => fail('notConfigured'));
    }, message => {
      setStoreBusy(false);
      setError(t('settings.storeUnreachable'));
      if (message) {
        haptic('error');
      }
    });
    return stop;
  }, [commit, env, fail]);

  const addImported = useCallback(async (rows: Array<{ name: string; budgetCents: number | null; month?: number; day?: number; tags: string[] }>) => {
    const created = new Map<string, string>();
    let count = 0;
    for (const step of planImported(rows, snapshotRef.current)) {
      if (step.kind === 'occasion') {
        const personId = created.get(step.personId) ?? step.personId;
        if (personId.startsWith('new:')) {
          continue;
        }
        const already = snapshotRef.current.occasions.some(occasion => (
          !occasion.deleted
          && occasion.personId === personId
          && occasion.type === 'birthday'
          && occasion.month === step.month
          && occasion.day === step.day
        ));
        if (already) {
          continue;
        }
        await commit(addOccasion(snapshotRef.current, {
          id: randomId(),
          personId,
          type: 'birthday',
          month: step.month,
          day: step.day,
          updatedAt: Date.now(),
        }));
        sync().catch(() => undefined);
        continue;
      }
      const now = Date.now();
      const person: Person = {
        id: randomId(),
        name: step.name,
        budgetCents: step.budgetCents,
        tags: step.tags,
        imported: true,
        opened: false,
        createdAt: now,
        updatedAt: now,
      };
      const result = addPerson({ snapshot: snapshotRef.current, person, freeLimit: env.freeTierMaxPeople });
      if (!result.ok) {
        if (result.error === 'cap') {
          pendingAdd.current = { person, hadPeople: snapshotRef.current.people.some(item => !item.deleted) };
          setPaywallOpen(true);
        } else {
          fail(result.error);
        }
        break;
      }
      created.set(`new:${step.name.trim().toLowerCase()}`, person.id);
      let next = result.snapshot.profile.onboarded
        ? result.snapshot
        : withProfile(result.snapshot, { onboarded: true });
      if (step.month != null && step.day != null && isRealMonthDay(step.month, step.day)) {
        next = addOccasion(next, {
          id: randomId(),
          personId: person.id,
          type: 'birthday',
          month: step.month,
          day: step.day,
          updatedAt: Date.now(),
        });
      }
      await commit(next);
      sync().catch(() => undefined);
      count += 1;
    }
    return count;
  }, [commit, env.freeTierMaxPeople, fail, sync]);

  const stageRestore = useCallback((text: string) => {
    const summary = summarizeBackup(text);
    if (!summary.ok) {
      setError(t('settings.restoreInvalid'));
      haptic('error');
      return;
    }
    setIncomingBackup({
      text,
      preview: t('settings.backupPreview', {
        people: summary.summary.people,
        occasions: summary.summary.occasions,
        ideas: summary.summary.ideas,
        date: backupWhen(summary.summary.exportedAt),
      }),
    });
  }, []);

  const applyRestore = useCallback(async (text: string): Promise<BackupFailure | 'ok'> => {
    const parsed = parseBackup(text, Date.now());
    if (!parsed.ok) {
      return parsed.reason;
    }
    const current = snapshotRef.current;
    const held = sealedHold.current;
    const restored = restoredSnapshot(current, parsed.snapshot);
    persistedPeople.current = current.people.filter(person => !person.deleted).length;
    cacheReady.current = true;
    sealedHold.current = null;
    setRecoveryStage(null);
    setDataRecovery(false);
    await commit(restored, true);
    if (!held) {
      offerUndo(t('settings.restoreDone'), async () => {
        await commit(current, true);
        sync().catch(() => undefined);
      }, () => sync());
    }
    return 'ok';
  }, [commit, offerUndo, sync]);

  useEffect(() => {
    if (!ready) {
      return undefined;
    }
    let cancelled = false;
    const take = (url: string | null) => {
      if (!url || cancelled || !isIncomingBackup(url)) {
        return;
      }
      const name = decodeURIComponent(url.split('/').pop() || 'backup.gifteez');
      readBackupUri(url, name).then(text => {
        if (!cancelled) {
          stageRestore(text);
        }
      }).catch(() => {
        if (!cancelled) {
          setError(t('settings.restoreInvalid'));
        }
      });
    };
    Linking.getInitialURL().then(url => take(url ?? null)).catch(() => undefined);
    const sub = Linking.addEventListener('url', event => take(event.url));
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [ready, stageRestore]);

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
    dataRecovery,
    recoveryStage,
    exportRawCache: async () => {
      const blob = sealedHold.current ?? await readCacheBlob();
      if (!blob) {
        return;
      }
      await shareBackupFile(blob, 'Gifteez saved data.txt');
    },
    resumePersonId,
    openPerson: setResumePersonId,
    clearResumePerson,
    storeProduct,
    storeReady,
    storeBusy,
    cloudRemaining,
    clearNotice: () => setNotice(null),
    clearError: () => setError(null),
    addPerson: async input => {
      const name = input.name.trim();
      if (!name) {
        fail('invalid');
        return null;
      }
      const hadPeople = snapshotRef.current.people.some(person => !person.deleted);
      const now = Date.now();
      const relationship = storeRelationship(input.relationship ?? '');
      if (relationship == null) {
        fail('invalid');
        return null;
      }
      if (input.circleId && !(snapshotRef.current.circles ?? []).some(circle => circle.id === input.circleId)) {
        fail('invalid');
        return null;
      }
      const birthYear = (input.birthYear ?? '').trim() ? parseBirthYear(input.birthYear ?? '') : null;
      if ((input.birthYear ?? '').trim() && birthYear == null) {
        fail('invalid');
        return null;
      }
      const person: Person = {
        id: randomId(),
        name,
        budgetCents: parseBudget(input.budget),
        ...(input.circleId && (parseBudget(input.budget) ?? null) !== ((snapshotRef.current.circles ?? []).find(circle => circle.id === input.circleId)?.budgetCents ?? null)
          ? { budgetCustom: true as const }
          : {}),
        tags: input.tags,
        imported: Boolean(input.imported),
        opened: !input.imported,
        createdAt: now,
        updatedAt: now,
        ...(relationship ? { relationship } : {}),
        ...(input.circleId ? { circleId: input.circleId } : {}),
        ...(birthYear != null ? { birthYear } : {}),
      };
      const result = addPerson({ snapshot: snapshotRef.current, person, freeLimit: env.freeTierMaxPeople });
      if (!result.ok) {
        if (result.error === 'cap') {
          pendingAdd.current = { person, hadPeople };
          setPaywallOpen(true);
          return null;
        }
        fail(result.error);
        return null;
      }
      pendingAdd.current = null;
      setPaywallOpen(false);
      const finished = !hadPeople && !result.snapshot.profile.onboarded
        ? withProfile(result.snapshot, { onboarded: true })
        : result.snapshot;
      await commit(finished);
      if (!hadPeople && !person.imported) {
        setConfetti(count => count + 1);
      }
      sync().catch(() => undefined);
      return person.id;
    },
    savePerson: async (id, patch) => {
      const existing = snapshotRef.current.people.find(item => item.id === id && !item.deleted);
      const result = updatePerson(snapshotRef.current, id, patch, Date.now());
      if (!result.ok) {
        fail(result.error);
        return;
      }
      const next = existing && shouldRefreshIdeas(existing, patch)
        ? refreshLocalIdeas(result.snapshot, id, Date.now())
        : result.snapshot;
      await commit(next);
      sync().catch(() => undefined);
    },
    createCircle: async name => {
      const cleaned = cleanCircleName(name);
      if (!cleaned) {
        fail('invalid');
        return null;
      }
      const circle = { id: randomId(), name: cleaned, createdAt: Date.now() };
      await commit(addCircle(snapshotRef.current, circle));
      sync().catch(() => undefined);
      return circle.id;
    },
    renameCircle: async (circleId, name) => {
      const cleaned = cleanCircleName(name);
      if (!cleaned) {
        fail('invalid');
        return;
      }
      const next = renameStoredCircle(snapshotRef.current, circleId, cleaned);
      if (!next) {
        return;
      }
      await commit(next);
      sync().catch(() => undefined);
    },
    setCircleBudget: async (circleId, budgetCents, mode = 'new') => {
      const next = applyCircleBudget(snapshotRef.current, circleId, budgetCents, mode);
      if (!next) {
        return;
      }
      await commit(next);
      sync().catch(() => undefined);
    },
    deleteCircle: async circleId => {
      await commit(removeCircle(snapshotRef.current, circleId));
      sync().catch(() => undefined);
    },
    setPersonCircle: async (personId, circleId) => {
      const next = assignCircle(snapshotRef.current, personId, circleId, Date.now());
      if (!next) {
        fail('invalid');
        return;
      }
      await commit(next);
      sync().catch(() => undefined);
    },
    acceptCircleSuggestion: async (key, personIds) => {
      const name = relationshipCircleName(key);
      const now = Date.now();
      const existing = (snapshotRef.current.circles ?? []).find(circle => circle.name === name);
      if (existing) {
        let next = snapshotRef.current;
        personIds.forEach(personId => {
          const assigned = assignCircle(next, personId, existing.id, now);
          if (assigned) {
            next = assigned;
          }
        });
        await commit(next);
        sync().catch(() => undefined);
        return;
      }
      const circle = { id: randomId(), name, createdAt: now };
      await commit(acceptSuggestion(snapshotRef.current, circle, personIds, now));
      sync().catch(() => undefined);
    },
    removePerson: async id => {
      const before = snapshotRef.current;
      const name = before.people.find(person => person.id === id)?.name ?? '';
      const result = updatePerson(before, id, { deleted: true }, Date.now());
      if (!result.ok) {
        return;
      }
      await commit(result.snapshot, true);
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
        return null;
      }
      if (planned === 'need-name') {
        fail('occasionName');
        return null;
      }
      if (!isRealMonthDay(planned.month, planned.day)) {
        fail('invalid');
        return null;
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
      return occasion.id;
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
    logGift: async (personId, occasionId, title, price, date) => {
      const occasion = occasionId
        ? snapshotRef.current.occasions.find(item => item.id === occasionId && !item.deleted)
        : undefined;
      if ((occasionId && !occasion) || !title.trim()) {
        fail('invalid');
        return false;
      }
      const ownerId = occasion?.personId ?? personId;
      const person = snapshotRef.current.people.find(item => item.id === ownerId && !item.deleted);
      if (!person) {
        fail('invalid');
        return false;
      }
      const priceCents = parseBudget(price);
      if (priceCents == null) {
        fail('price');
        return false;
      }
      const purchasedOn = normalizeStoredDate(date);
      const year = Number(purchasedOn.slice(0, 4)) || (occasion ? occurrenceYear(occasion, new Date()) : new Date().getFullYear());
      await commit(recordGift({
        snapshot: snapshotRef.current,
        occasion,
        gift: {
          id: randomId(),
          personId: person.id,
          occasionId: occasion?.id ?? '',
          year,
          title: title.trim(),
          priceCents,
          purchasedOn,
          updatedAt: Date.now(),
        },
      }));
      showNotice(t('purchase.saved'), false, 'purchase');
      haptic('success');
      sync().catch(() => undefined);
      return true;
    },
    vote: async (personId, idea, choice) => {
      const before = snapshotRef.current;
      await commit(addFeedback(before, {
        id: randomId(),
        personId,
        idea,
        vote: choice,
        createdAt: Date.now(),
      }));
      if (choice === 'down') {
        offerUndo(t('person.notThisDone'), async () => {
          await commit(before);
          sync().catch(() => undefined);
        }, () => sync());
      }
    },
    moreLike: async (personId, seed) => {
      const current = snapshotRef.current;
      const person = current.people.find(item => item.id === personId && !item.deleted);
      if (!person) {
        return;
      }
      const slot = ideaSlot(person, current, 'on-device');
      const incoming = moreLikeIdeas({ seed, tags: person.tags, band: slot.age.band });
      if (incoming.length === 0) {
        return;
      }
      const existing = current.ideas.find(item => item.id === slot.cacheId && !item.deleted);
      const merged = mergeIdeaBatches(existing?.ideas ?? [], incoming);
      await commit(upsertIdeas(current, {
        id: slot.cacheId,
        personId,
        occasionKey: slot.occasionKey,
        ideas: merged.ideas,
        source: 'on-device',
        salt: existing?.salt ?? 0,
        generatedAt: existing?.generatedAt ?? Date.now(),
        updatedAt: Date.now(),
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
      const slot = ideaSlot(person, next, 'on-device');
      const { occasionKey, cacheId } = slot;
      if (!next.ideas.some(item => item.id === cacheId && !item.deleted)) {
        const ideas = suggestIdeas(ideaRequest(person, next, 0));
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
      const slot = ideaSlot(person, snapshotRef.current, 'on-device');
      const { occasionKey, cacheId } = slot;
      const previous = snapshotRef.current.ideas.find(item => item.id === cacheId);
      const salt = (previous?.salt ?? 0) + 1;
      const ideas = suggestIdeas(ideaRequest(person, snapshotRef.current, salt));
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
        return [];
      }
      const slot = ideaSlot(person, snapshotRef.current, 'cloud');
      const { occasionKey, cacheId, age, occasion } = slot;
      const existing = snapshotRef.current.ideas.find(item => item.id === cacheId && !item.deleted);
      const onDevice = snapshotRef.current.ideas.find(item => item.id === ideaSlot(person, snapshotRef.current, 'on-device').cacheId && !item.deleted);
      const avoid = [...(onDevice?.ideas ?? []), ...(existing?.ideas ?? [])].map(idea => idea.title).slice(0, 24);
      try {
        const request = {
          deviceId: await deviceId(),
          personId,
          refresh: Boolean(existing),
          prompt: {
            relationship: relationshipLabel(person.relationship),
            ...(age.years == null ? {} : { age: age.years }),
            ...(age.band ? { ageBand: age.band } : {}),
            ...(avoid.length ? { avoid } : {}),
            occasion: occasion ? occasionLabel(occasion.occasion) : null,
            tags: person.tags,
            budgetCents: person.budgetCents,
            year: occasion?.date.getFullYear() ?? new Date().getFullYear(),
            likes: snapshotRef.current.feedback.filter(item => item.personId === personId && item.vote === 'up').map(item => item.idea),
            dislikes: snapshotRef.current.feedback.filter(item => item.personId === personId && item.vote === 'down').map(item => item.idea),
            notes: (person.notes ?? '').slice(0, 300),
            pastGifts: snapshotRef.current.gifts.filter(gift => gift.personId === personId && !gift.deleted).map(gift => gift.title),
          },
        };
        if (__DEV__) {
          console.log('generateGiftIdeas', cloudIdeaRequestLog(request));
        }
        const result = await withTimeout(callFunction<CloudResult>(env, 'generateGiftIdeas', request));
        setCloudRemaining(current => ({ ...current, [personId]: result.remaining }));
        const kept = result.ideas.filter(idea => allowsPetIdea(person.tags, idea));
        const merged = mergeIdeaBatches(existing?.ideas ?? [], kept);
        await commit(upsertIdeas(snapshotRef.current, {
          id: cacheId,
          personId,
          occasionKey,
          ideas: merged.ideas,
          source: 'cloud',
          salt: 0,
          generatedAt: existing?.generatedAt ?? Date.now(),
          updatedAt: Date.now(),
        }));
        return merged.added;
      } catch (caught) {
        // Every failure, including App Check, a 404, a timeout, and a network error, is shown in the sheet.
        throw caught;
      }
    },
    setReminders: async (enabled, announce = false) => {
      if (enabled) {
        const permission = await requestReminderPermission();
        const granted = permission === 'granted';
        if (!granted) {
          await commit(withProfile(snapshotRef.current, { reminders: 'off' }));
          fail(permission === 'denied' && Platform.OS === 'ios' ? 'notificationsSettings' : 'notifications');
          await scheduleReminders(snapshotRef.current);
          return;
        }
        if (announce) {
          const current = snapshotRef.current;
          const when = nextReminderWhen({
            people: current.people,
            occasions: current.occasions,
            leadDays: current.profile.reminderLeadDays,
            hour: current.profile.reminderHour,
            minute: current.profile.reminderMinute,
          });
          if (when) {
            showNotice(t('person.remindSet', { date: formatDate(when) }));
          }
        }
        await commit(withProfile(snapshotRef.current, { reminders: 'on' }));
      } else {
        await commit(withProfile(snapshotRef.current, { reminders: 'off' }));
      }
      await scheduleReminders(snapshotRef.current);
    },
    exportBackup: () => exportBackup(snapshotRef.current),
    shareBackup: async () => {
      const json = exportBackup(snapshotRef.current);
      const saved = await shareBackupFile(json);
      if (!saved) {
        return;
      }
      const count = snapshotRef.current.people.filter(person => !person.deleted).length;
      showNotice(t('settings.backupSaved', { count, date: formatDate(new Date()) }));
    },
    pickBackup: async () => {
      const text = await pickBackupText();
      if (text == null) {
        return;
      }
      stageRestore(text);
    },
    previewBackup: stageRestore,
    restoreBackup: text => applyRestore(text),
    incomingBackup: incomingBackup ? { preview: incomingBackup.preview } : null,
    acceptIncomingBackup: async () => {
      const pending = incomingBackup;
      setIncomingBackup(null);
      if (!pending) {
        return;
      }
      const result = await applyRestore(pending.text);
      if (result !== 'ok') {
        fail('invalid');
      }
    },
    clearIncomingBackup: () => setIncomingBackup(null),
    paywallOpen,
    openPaywall: () => {
      setError(null);
      setPaywallOpen(true);
    },
    dismissPaywall: () => {
      setError(null);
      setPaywallOpen(false);
    },
    cancelPendingAdd: () => {
      pendingAdd.current = null;
      setPaywallOpen(false);
    },
    completedPersonId,
    clearCompletedPerson: () => setCompletedPersonId(null),
    appearance,
    setAppearance: async choice => {
      setAppearanceChoice(choice);
      await saveAppearance(choice);
    },
    finishWelcome: async () => {
      await commit(withProfile(snapshotRef.current, { onboarded: true }));
    },
    updateProfile: async patch => {
      await commit(withProfile(snapshotRef.current, patch));
      if (patch.reminders === 'on' || patch.reminderHour != null || patch.reminderLeadDays != null || patch.reminderMinute != null) {
        scheduleReminders(snapshotRef.current).catch(() => undefined);
      }
    },
    skinPreview,
    previewSkin: id => {
      skinOverride.current = id === 'remote' ? 'remote' : id;
      setSkinPreview(id);
      saveSkinPreview(id).catch(() => undefined);
      const remoteValue = id === 'remote' ? remoteSkin.current : id === 'auto' ? 'auto' : id;
      const season = id === 'spring' || id === 'summer'
        ? parseSkin(id === 'spring' ? require('../../skins/spring.json') : require('../../skins/summer.json'))
        : null;
      const downloaded = season ? { ...downloadedRef.current, [id]: season } : downloadedRef.current;
      if (season) {
        setDownloaded(downloaded);
      }
      const resolved = resolveSkin({ remoteValue, today: new Date(), downloaded });
      setSkinId(resolved.id);
      paint(resolved.colors);
    },
    updateGift: async (giftId, title, price, date, privateGift) => {
      const priceCents = parseBudget(price);
      if (!title.trim() || priceCents == null) {
        fail(title.trim() ? 'price' : 'invalid');
        return false;
      }
      const purchasedOn = normalizeStoredDate(date);
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
    buy: async () => {
      setStoreBusy(true);
      try {
        let product = storeProduct;
        if (!product) {
          const store = await connectStore(env.iapProductId);
          if (!store.ok || !store.product) {
            setError(t('settings.storeUnreachable'));
            haptic('error');
            return;
          }
          product = store.product;
          setStoreReady(true);
          setStoreProduct(product);
        }
        await buyUnlock(env.iapProductId);
        setError(null);
      } catch {
        setError(t('settings.storeUnreachable'));
        haptic('error');
      } finally {
        setStoreBusy(false);
      }
    },
    restorePurchases: async () => {
      try {
        const owned = await loadOwned(env.iapProductId);
        if (owned.length === 0) {
          setError(t(Platform.OS === 'android' ? 'settings.noPurchaseGoogle' : 'settings.noPurchaseApple'));
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
            await finishPendingRef.current();
            haptic('success');
            return;
          }
        }
        fail('notConfigured');
      } catch {
        setError(t('settings.storeUnreachable'));
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
    loadContacts: () => importContacts(),
    importPeople: rows => addImported(rows),
    importFromCalendar: async () => {
      const rows = await sweepBirthdays();
      if (rows === 'denied') {
        return 'denied';
      }
      return addImported(rows);
    },
  }), [addImported, appearance, applyRestore, canUndo, clearResumePerson, cloudRemaining, colors, commit, completedPersonId, confetti, dataRecovery, env, error, fail, incomingBackup, notice, noticeArt, offerUndo, offline, onNavigate, paint, paywallOpen, ready, recoveryStage, resumePersonId, runUndo, setNotice, showNotice, skinId, skinPreview, snapshot, stageRestore, startupDetail, startupFailure, storeBusy, storeProduct, storeReady, sync]);

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

async function loadSnapshot() {
  const blob = await readCacheBlob();
  const key = blob ? await loadSecret('device-key') : null;
  return decideCacheLoad({
    blob,
    key,
    now: Date.now(),
    open: (payload, stored) => {
      let text: string;
      try {
        text = openString(payload, keyFromString(stored));
      } catch {
        throw new CacheStageError('decrypt');
      }
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new CacheStageError('parse');
      }
    },
  });
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
    leadDays: snapshot.profile.reminderLeadDays,
    hour: snapshot.profile.reminderHour,
    minute: snapshot.profile.reminderMinute,
  });
  await applyReminderPlan(slots);
}

function ideaSlot(person: Person, snapshot: AppSnapshot, source: 'on-device' | 'cloud') {
  const occasion = upcomingOccasion(person.id, snapshot.occasions, new Date());
  const occasionKey = occasion ? `${occasion.occasion.id}:${occasion.date.getFullYear()}` : 'general';
  const age = resolveAge({
    occasions: snapshot.occasions,
    personId: person.id,
    birthYear: person.birthYear,
    notes: person.notes,
    relationship: person.relationship,
  });
  return {
    occasion,
    occasionKey,
    age,
    cacheId: ideaCacheId(person.id, occasionKey, source, person.tags, age),
  };
}

function ideaRequest(person: Person, snapshot: AppSnapshot, salt: number) {
  const occasion = upcomingOccasion(person.id, snapshot.occasions, new Date());
  const age = resolveAge({
    occasions: snapshot.occasions,
    personId: person.id,
    birthYear: person.birthYear,
    notes: person.notes,
    relationship: person.relationship,
  });
  return {
    personId: person.id,
    name: person.name,
    tags: person.tags,
    occasion: occasion && occasion.occasion.type !== 'custom' ? occasion.occasion.type : null,
    feedback: snapshot.feedback,
    salt,
    notes: person.notes,
    years: age.years,
    band: age.band,
  };
}

function withOnDeviceIdeas(snapshot: AppSnapshot, personId: string): AppSnapshot {
  const person = snapshot.people.find(item => item.id === personId && !item.deleted);
  if (!person) {
    return snapshot;
  }
  const slot = ideaSlot(person, snapshot, 'on-device');
  const { occasionKey, cacheId } = slot;
  const previous = snapshot.ideas.find(item => item.id === cacheId);
  const ideas = suggestIdeas(ideaRequest(person, snapshot, previous?.salt ?? 0));
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


const CLOUD_TIMEOUT_MS = 20000;

function withTimeout<T>(work: Promise<T>, ms = CLOUD_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'timeout' })), ms);
    work.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function restoredSnapshot(current: AppSnapshot, parsed: AppSnapshot): AppSnapshot {
  return {
    ...parsed,
    entitlementPaid: current.entitlementPaid,
    profile: {
      ...parsed.profile,
      uid: current.profile.uid,
      reminders: current.profile.reminders,
      createdAt: current.profile.createdAt || parsed.profile.createdAt,
      displayName: current.profile.displayName,
      onboarded: true,
      ...(parsed.profile.householdName || current.profile.householdName
        ? { householdName: parsed.profile.householdName || current.profile.householdName }
        : {}),
      ...(parsed.profile.givenName || current.profile.givenName
        ? { givenName: parsed.profile.givenName || current.profile.givenName }
        : {}),
    },
  };
}

function backupWhen(value: string): string {
  const local = parseLocalDate(value);
  if (local) {
    return formatDate(local);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : formatDate(parsed);
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
