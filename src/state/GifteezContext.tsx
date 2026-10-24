import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Appearance } from 'react-native';
import type { AppEnv } from '../config/env';
import { keyFromString, keyToString, openJson, randomId, randomKey, sealJson } from '../crypto/crypto';
import { ideaCacheId, suggestIdeas } from '../domain/ideas';
import { deleteOccasion, deletePrivateGift, deleteSharedGift, updateOccasionDate, updatePrivateGift, updateSharedGift } from '../domain/edits';
import { planReminders } from '../domain/reminders';
import { classifyStartupError, startupCause, type StartupFailure } from '../domain/startup';
import {
  addFeedback,
  addOccasion,
  addPerson,
  isRealMonthDay,
  logPurchase,
  occurrenceYear,
  parkActive,
  parseBudget,
  parseImport,
  clearIdea,
  saveIdea,
  sillyName,
  upcomingOccasion,
  updatePerson,
  upsertIdeas,
  withAccountUnlock,
  withProfile,
} from '../domain/logic';
import { emptySnapshot, type AppSnapshot, type Occasion, type OccasionType, type Person } from '../domain/types';
import { t, todayIso } from '../i18n';
import { readCacheBlob, writeCacheBlob } from '../platform/cache';
import { deviceId } from '../platform/device';
import { activeSkinParam, callFunction, downloadSkin, ensureAnonymousUser, initFirebase } from '../platform/firebase';
import { importContacts, sweepBirthdays } from '../platform/importers';
import { buyUnlock, connectStore, finishOwned, listenToPurchases, loadOwned, purchaseProof, type StoreProduct } from '../platform/iap';
import { applyReminderPlan, cancelReminderPlan, requestReminderPermission } from '../platform/reminders';
import { loadSecret, saveSecret } from '../platform/secure';
import { occasionLabel, planOccasion, presetFor } from '../domain/occasions';
import { exportBackup, migrateToLocal, parseBackup, type BackupFailure } from '../domain/backup';
import { cleanRelationship } from '../domain/relationship';
import { haptic } from '../platform/haptics';
import type { CelebrateName } from '../theme/tokens';
import { colorsFor, parseSkin, resolveSkin, withColorScheme, type ResolvedColors, type SkinId, type ThemeColors } from '../theme/skins';

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
  resumePersonId: string | null;
  openPerson: (personId: string) => void;
  clearResumePerson: () => void;
  storeProduct: StoreProduct | null;
  storeReady: boolean;
  clearNotice: () => void;
  clearError: () => void;
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
  vote: (personId: string, idea: string, vote: 'up' | 'down') => Promise<void>;
  focusPerson: (personId: string) => Promise<void>;
  refreshIdeas: (personId: string) => Promise<void>;
  cloudIdeas: (personId: string) => Promise<void>;
  cloudRemaining: Record<string, number>;
  setReminders: (enabled: boolean) => Promise<void>;
  exportBackup: () => string;
  restoreBackup: (text: string) => Promise<BackupFailure | 'ok'>;
  finishWelcome: () => Promise<void>;
  buy: () => Promise<void>;
  restorePurchases: () => Promise<void>;
  importText: (text: string) => Promise<number>;
  importFromContacts: () => Promise<number | 'denied'>;
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
  const [cloudRemaining, setCloudRemaining] = useState<Record<string, number>>({});
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
    const current = migrateToLocal(source ?? snapshotRef.current);
    try {
      await scheduleReminders(current);
    } catch {
      // Reminders are local. A failure here does not block the list.
    }
    return current;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = migrateToLocal(await loadSnapshot());
        if (cancelled) {
          return;
        }
        snapshotRef.current = loaded;
        setSnapshot(loaded);
        await commit(loaded);
        let next = loaded;
        try {
          await initFirebase(env);
          const uid = await ensureAnonymousUser();
          next = loaded.profile.uid === uid ? loaded : withProfile(loaded, { uid });
          if (!next.profile.displayName) {
            next = withProfile(next, { displayName: sillyName(uid) });
          }
          await commit(next);
        } catch {
          // The list is already on the phone. Auth is only for cloud ideas and purchase checks.
        }
        try {
          const skinValue = await activeSkinParam(env);
          const resolved = resolveSkin({ remoteValue: skinValue, today: new Date(), downloaded: downloadedRef.current });
          if (!cancelled) {
            setSkinId(resolved.id);
            paint(resolved.colors);
          }
          if (resolved.id === 'spring' || resolved.id === 'summer') {
            const payload = parseSkin(await downloadSkin(resolved.id));
            if (payload) {
              const withDownload = { ...downloadedRef.current, [resolved.id]: payload };
              const again = resolveSkin({ remoteValue: skinValue, today: new Date(), downloaded: withDownload });
              setDownloaded(withDownload);
              setSkinId(again.id);
              paint(again.colors);
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
    const appearance = Appearance.addChangeListener(({ colorScheme }) => {
      setColors(withColorScheme(paletteRef.current, colorScheme));
    });
    return () => {
      cancelled = true;
      appearance.remove();
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
    resumePersonId,
    openPerson: setResumePersonId,
    clearResumePerson,
    storeProduct,
    storeReady,
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
      showNotice(t('purchase.saved'), false, 'purchase');
      haptic('success');
      sync().catch(() => undefined);
      return true;
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
    exportBackup: () => exportBackup(snapshotRef.current),
    restoreBackup: async text => {
      const parsed = parseBackup(text, Date.now());
      if (!parsed.ok) {
        return parsed.reason;
      }
      const current = snapshotRef.current;
      await commit({
        ...parsed.snapshot,
        entitlementPaid: current.entitlementPaid,
        profile: {
          ...parsed.snapshot.profile,
          uid: current.profile.uid,
          reminders: current.profile.reminders,
          createdAt: current.profile.createdAt || parsed.snapshot.profile.createdAt,
          displayName: current.profile.displayName,
          onboarded: true,
        },
      });
      return 'ok';
    },
    finishWelcome: async () => {
      await commit(withProfile(snapshotRef.current, { onboarded: true }));
    },
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
  }), [addImported, canUndo, clearResumePerson, cloudRemaining, colors, commit, confetti, env, error, fail, notice, noticeArt, offerUndo, offline, onNavigate, ready, resumePersonId, runUndo, setNotice, showNotice, skinId, snapshot, startupDetail, startupFailure, storeProduct, storeReady, sync]);

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


async function verifyPurchase(env: AppEnv, proof: { transactionId: string; token: string; platform: 'ios' | 'android' }): Promise<{ verified: boolean; reason?: string }> {
  return callFunction<{ verified: boolean; reason?: string }>(env, 'verifyUnlock', {
    deviceId: await deviceId(),
    productId: env.iapProductId,
    platform: proof.platform,
    transactionId: proof.transactionId,
    purchaseToken: proof.token,
  });
}
