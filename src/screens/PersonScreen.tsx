import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, usePreventRemove, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStack } from '../app/navigation';
import { amazonSearchUrl } from '../domain/amazon';
import { INTEREST_TAGS } from '../domain/catalog';
import { asGiftIdea, ideaCacheId, ideaKey, ideasTooSimilar, normalizeIdeaTitle, sentenceCaseTitle } from '../domain/ideas';
import type { GiftIdea } from '../domain/types';
import { canEditSharedGift } from '../domain/edits';
import { allTimeSpentCents, daysUntil, isRealMonthDay, listCurrency, occurrenceYear, parseBirthYear, parseBudget, parseLooseDate, statusFor, upcomingOccasion, yearSpentCents } from '../domain/logic';
import { dateIsEstimated, isOneTimeOccasion, nextOccasionDate, occasionLabel, occasionNeedsDate, presetFor } from '../domain/occasions';
import type { Occasion, OccasionState } from '../domain/types';
import { relationshipLabel, storeRelationship } from '../domain/relationship';
import { deviceLocale, formatDate, formatLongDate, formatMoney, formatStoredDate, t, todayIso } from '../i18n';
import { openInApp } from '../platform/browser';
import { useGifteez } from '../state/GifteezContext';
import { occasionLook, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { DateField, MonthDayField } from '../ui/DateField';
import { Icon } from '../ui/icons';
import { HeartPop, Moment, Shimmer } from '../ui/motion';
import { OccasionPicker } from '../ui/OccasionPicker';
import { CircleField } from '../ui/CircleField';
import { RelationshipField } from '../ui/RelationshipField';
import { MonogramAvatar } from '../ui/stationery';
import {
  ArtSlot,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Cluster,
  confirmDestructive,
  EmptyState,
  Field,
  GhostRow,
  Heading,
  IconButton,
  Screen,
  Segment,
  Sheet,
  TabBar,
  Title,
} from '../ui/ui';

type Menu =
  | { kind: 'idea'; idea: string }
  | { kind: 'occasion'; id: string }
  | { kind: 'gift'; id: string; privateGift: boolean; title: string };

type Queue =
  | { kind: 'purchase'; id: string; idea: string }
  | { kind: 'edit'; id: string; privateGift: boolean };

export function AddPersonScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const { addPerson, completedPersonId, clearCompletedPerson, cancelPendingAdd } = useGifteez();
  const cancelAdd = useRef(cancelPendingAdd);
  cancelAdd.current = cancelPendingAdd;
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [relationship, setRelationship] = useState('');
  const [relationshipError, setRelationshipError] = useState('');
  const [circleId, setCircleId] = useState('');
  const [budget, setBudget] = useState('');
  const [budgetError, setBudgetError] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthError, setBirthError] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [allowLeave, setAllowLeave] = useState(false);
  const nextId = useRef<string | null>(null);
  const dirty = Boolean(name.trim() || relationship.trim() || circleId || budget.trim() || birthYear.trim() || tags.length);
  usePreventRemove(dirty && !allowLeave, ({ data }) => {
    confirmDestructive(
      t('firstOpen.discardTitle'),
      t('firstOpen.discardBody'),
      t('firstOpen.discard'),
    ).then(ok => {
      if (!ok) {
        return;
      }
      navigation.dispatch(data.action);
    }).catch(() => undefined);
  });
  useEffect(() => {
    if (!allowLeave || !nextId.current) {
      return;
    }
    const personId = nextId.current;
    nextId.current = null;
    if (navigation.getState()?.routeNames?.includes('Person')) {
      navigation.replace('Person', { personId, section: 'ideas' });
    }
  }, [allowLeave, navigation]);
  useEffect(() => {
    if (!completedPersonId) {
      return;
    }
    nextId.current = completedPersonId;
    setAllowLeave(true);
    clearCompletedPerson();
  }, [clearCompletedPerson, completedPersonId]);
  useEffect(() => () => {
    cancelAdd.current();
  }, []);
  return (
    <Screen
      footer={(
        <View style={styles.footerStack}>
          <Button
            label={t('person.save')}
            onPress={async () => {
              if (!name.trim()) {
                setNameError(t('errors.name'));
                return;
              }
              const cleaned = storeRelationship(relationship);
              if (cleaned == null) {
                setRelationshipError(t('relationship.invalid'));
                return;
              }
              if (budget.trim() && parseBudget(budget) == null) {
                setBudgetError(t('errors.price'));
                return;
              }
              if (birthYear.trim() && parseBirthYear(birthYear) == null) {
                setBirthError(t('person.birthYearInvalid'));
                return;
              }
              const id = await addPerson({
                name,
                budget,
                tags,
                relationship: cleaned,
                birthYear,
                ...(circleId ? { circleId } : {}),
              });
              if (id) {
                nextId.current = id;
                setAllowLeave(true);
                return;
              }
            }}
          />
          <TabBar active="people" />
        </View>
      )}
    >
      <Title>{t('firstOpen.title')}</Title>
      <Body>{t('firstOpen.lead')}</Body>
      <Field
        label={t('firstOpen.theirName')}
        value={name}
        error={nameError}
        textContentType="name"
        autoComplete="name"
        onChangeText={value => {
          setName(value);
          setNameError('');
        }}
      />
      <RelationshipField
        value={relationship}
        error={relationshipError}
        onChange={value => {
          setRelationship(value);
          setRelationshipError('');
        }}
      />
      <Caption>{t('person.interests')}</Caption>
      <TagPicker tags={tags} onChange={setTags} />
      <CircleField value={circleId} onChange={setCircleId} />
      <Field
        label={t('person.budget')}
        value={budget}
        error={budgetError}
        onChangeText={value => {
          setBudget(value);
          setBudgetError('');
        }}
        keyboardType="decimal-pad"
      />
      <Caption>{t('person.perYear')}</Caption>
      <Field
        label={t('person.birthYear')}
        value={birthYear}
        error={birthError}
        onChangeText={value => {
          setBirthYear(value);
          setBirthError('');
        }}
        keyboardType="number-pad"
      />
    </Screen>
  );
}

export function PersonScreen() {
  const route = useRoute<RouteProp<RootStack, 'Person'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const { colors, type } = useTheme();
  const {
    snapshot,
    focusPerson,
    savePerson,
    removePerson,
    saveIdeaFor,
    unsaveIdea,
    toast,
    logGift,
    vote,
    refreshIdeas,
    cloudIdeas,
    cloudRemaining,
    updateGift,
    deleteGift,
    setPersonCircle,
  } = useGifteez();
  const person = snapshot.people.find(item => item.id === route.params.personId && !item.deleted);
  const today = new Date();
  const [budget, setBudget] = useState(person?.budgetCents == null ? '' : String(person.budgetCents / 100));
  const [birthYear, setBirthYear] = useState(person?.birthYear ? String(person.birthYear) : '');
  const [birthError, setBirthError] = useState('');
  const [name, setName] = useState(person?.name ?? '');
  const [relationship, setRelationship] = useState(person?.relationship ?? '');
  const [notes, setNotes] = useState(person?.notes ?? '');
  const [relationshipError, setRelationshipError] = useState('');
  const [gift, setGift] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(todayIso());
  const [buying, setBuying] = useState<string | null>(null);
  const [editingGift, setEditingGift] = useState<{ id: string; privateGift: boolean } | null>(null);
  const [findingIdeas, setFindingIdeas] = useState(true);
  const [showAllIdeas, setShowAllIdeas] = useState(false);
  const [interestTags, setInterestTags] = useState<string[]>(person?.tags ?? []);
  const [nameError, setNameError] = useState('');
  const [budgetError, setBudgetError] = useState('');
  const [giftError, setGiftError] = useState('');
  const [priceError, setPriceError] = useState('');
  const [dateError, setDateError] = useState('');
  const [pickingCircle, setPickingCircle] = useState(false);
  const [section, setSection] = useState<'ideas' | 'occasions' | 'history'>(route.params.section ?? 'ideas');
  const [ideaFilter, setIdeaFilter] = useState<'forYou' | 'saved'>('forYou');
  useEffect(() => {
    if (route.params.section) {
      setSection(route.params.section);
    }
  }, [route.params.personId, route.params.section]);
  const [editingDetails, setEditingDetails] = useState(false);
  const [editCircleId, setEditCircleId] = useState(person?.circleId ?? '');
  const [addingOccasion, setAddingOccasion] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudError, setCloudError] = useState(false);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [moment, setMoment] = useState<'wrap' | null>(null);
  const [buyAsk, setBuyAsk] = useState<GiftIdea | null>(null);
  const queued = useRef<Queue | null>(null);
  const pendingBuy = useRef<GiftIdea | null>(null);
  const shopping = useRef(false);

  useEffect(() => {
    setInterestTags(person?.tags ?? []);
  }, [person?.id, person?.tags]);

  useEffect(() => {
    let cancelled = false;
    setFindingIdeas(true);
    if (person) {
      focusPerson(person.id).finally(() => {
        if (!cancelled) {
          setFindingIdeas(false);
        }
      });
    } else {
      setFindingIdeas(false);
    }
    // Focus once when the screen opens. Later edits should not regenerate ideas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params.personId]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false, title: '' });
  }, [navigation]);

  const savedBudget = person?.budgetCents == null ? '' : String(person.budgetCents / 100);
  const detailsDirty = Boolean(
    person
    && editingDetails
    && (
      name.trim() !== person.name
      || budget !== savedBudget
      || birthYear !== (person.birthYear ? String(person.birthYear) : '')
      || relationship !== (person.relationship ?? '')
      || notes !== (person.notes ?? '')
      || (editCircleId || '') !== (person.circleId ?? '')
      || interestTags.join('|') !== (person.tags ?? []).join('|')
    ),
  );
  usePreventRemove(detailsDirty, ({ data }) => {
    confirmDestructive(
      t('firstOpen.discardTitle'),
      t('firstOpen.discardBody'),
      t('firstOpen.discard'),
    ).then(ok => {
      if (ok) {
        navigation.dispatch(data.action);
      }
    }).catch(() => undefined);
  });

  if (!person) {
    return (
      <Screen>
        <ArtSlot name="error" size={160} />
        <Body>{t('errors.generic')}</Body>
        <Button label={t('common.back')} onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  const money = (cents: number) => formatMoney(cents, deviceLocale(), listCurrency(snapshot), true);
  const hidden = false;
  const locked = false;
  const next = upcomingOccasion(person.id, snapshot.occasions, today);
  const occasionKey = next ? `${next.occasion.id}:${next.date.getFullYear()}` : 'general';
  const onDevice = snapshot.ideas.find(item => item.id === ideaCacheId(person.id, occasionKey, 'on-device') && !item.deleted);
  const cloud = snapshot.ideas.find(item => item.id === ideaCacheId(person.id, occasionKey, 'cloud') && !item.deleted);
  const history = snapshot.gifts.filter(item => item.personId === person.id && !item.deleted);
  const showSpend = person.budgetCents != null || history.length > 0;
  const ideas = onDevice?.ideas ?? [];
  const cloudList = cloud?.ideas ?? [];
  const hiddenIdeas = new Set(snapshot.feedback.filter(item => item.personId === person.id && item.vote === 'down').map(item => item.idea));
  const visibleDevice = ideas.filter(idea => !hiddenIdeas.has(ideaKey(idea)));
  const visibleCloud = cloudList.filter(idea => (
    !hiddenIdeas.has(ideaKey(idea))
    && !visibleDevice.some(other => normalizeIdeaTitle(other.title) === normalizeIdeaTitle(asGiftIdea(idea).title) || ideasTooSimilar(asGiftIdea(idea).title, asGiftIdea(other).title))
  ));
  const shownIdeas = showAllIdeas ? visibleDevice : visibleDevice.slice(0, 3);
  const hiddenIdeaCount = Math.max(0, visibleDevice.length - shownIdeas.length);
  const artName = next ? occasionLook(next.occasion.type).art : 'gift';
  const year = today.getFullYear();
  const spent = yearSpentCents(person.id, snapshot.gifts, year);
  const nextState = next
    ? snapshot.states.find(item => item.occasionId === next.occasion.id && item.year === occurrenceYear(next.occasion, today) && !item.deleted)
    : undefined;
  const occasions = snapshot.occasions.filter(item => item.personId === person.id && !item.deleted);
  const menuOccasion = menu?.kind === 'occasion' ? occasions.find(item => item.id === menu.id) : undefined;

  function savedFor(idea: string): boolean {
    return Boolean(next && nextState?.savedIdea === idea);
  }

  const savedList = [...visibleDevice, ...visibleCloud].filter(idea => savedFor(ideaKey(idea)));

  function openPurchase(occasionId: string, idea: string, priceDollars?: number) {
    setBuying(occasionId);
    setGift(idea);
    setPrice(priceDollars != null && priceDollars > 0 ? String(priceDollars) : '');
    setDate(todayIso());
    setGiftError('');
    setPriceError('');
    setDateError('');
    setEditingGift(null);
  }

  async function shopIdea(idea: GiftIdea | string) {
    if (shopping.current) {
      return;
    }
    shopping.current = true;
    const gift = asGiftIdea(idea);
    try {
      const { associateTag } = await import('../platform/firebase');
      const returned = await openInApp(amazonSearchUrl(gift.searchQuery || gift.title, await associateTag()));
      if (returned) {
        setBuyAsk(gift);
      }
    } catch {
      // The store did not open. The idea stays here and can still be logged by hand.
    } finally {
      shopping.current = false;
    }
  }

  function acceptBuy(idea: GiftIdea) {
    setBuyAsk(null);
    const occasion = next?.occasion ?? occasions[0];
    openPurchase(occasion?.id ?? '', idea.title, idea.priceMin);
  }

  function flushQueue() {
    const nextQueue = queued.current;
    queued.current = null;
    if (!nextQueue) {
      return;
    }
    if (nextQueue.kind === 'purchase') {
      openPurchase(nextQueue.id, nextQueue.idea);
      return;
    }
    const record = [...snapshot.gifts, ...(snapshot.privateGifts ?? [])].find(item => item.id === nextQueue.id);
    if (!record) {
      return;
    }
    setEditingGift({ id: record.id, privateGift: nextQueue.privateGift });
    setGift(record.title);
    setPrice(String(record.priceCents / 100));
    setDate(record.purchasedOn);
    setGiftError('');
    setPriceError('');
    setDateError('');
    setBuying(null);
  }

  function onSaveIdea(idea: string) {
    if (!next) {
      toast(t('person.saveIdeaNeedsDate'));
      return undefined;
    }
    if (savedFor(idea)) {
      return unsaveIdea(next.occasion.id);
    }
    return saveIdeaFor(next.occasion.id, idea);
  }

  function openDetails() {
    if (!person) {
      return;
    }
    setEditCircleId(person.circleId ?? '');
    setBirthYear(person.birthYear ? String(person.birthYear) : '');
    setBirthError('');
    setEditingDetails(true);
  }

  return (
    <Screen
      tab="people"
      tight
      pinned={(
        <View style={styles.pinnedTight}>
          {hidden ? <Body>{t('person.hiddenRecipient')}</Body> : null}
          {locked ? <Body>{t('person.readOnly')}</Body> : null}
          {person.imported ? <Caption>{t('person.openedImported')}</Caption> : null}
          <View style={styles.navRow}>
            <BackLink label={backLabelFor(navigation)} onPress={() => navigation.goBack()} />
            <Pressable accessibilityRole="button" accessibilityLabel={t('person.editDetails')} onPress={openDetails} style={styles.backLink}>
              <Text maxFontSizeMultiplier={1.4} style={[type.body, { color: colors.pink }]}>{t('person.editShort')}</Text>
            </Pressable>
          </View>
          <View style={styles.personRow}>
            <MonogramAvatar name={person.name} personId={person.id} size={36} crest />
            <View style={styles.personCopy}>
              <Text numberOfLines={1} style={[styles.personName, { color: colors.text, fontFamily: type.display.fontFamily }]}>{person.name}</Text>
              <Pressable accessibilityRole="button" onPress={() => setPickingCircle(true)}>
                <Caption tone="text">{personMeta(person, snapshot.circles)}</Caption>
              </Pressable>
              <BudgetLine
                spent={spent}
                budgetCents={person.budgetCents}
                money={money}
                onSetBudget={openDetails}
              />
            </View>
            {next ? (
              <Text numberOfLines={1} style={[styles.nextOccasion, { color: colors.muted }]}>
                {`${occasionLabel(next.occasion)} · ${formatDate(next.date)}`}
              </Text>
            ) : null}
          </View>
          {person.tags.length > 0 ? (
            <Text numberOfLines={1} style={[type.caption, { color: colors.muted }]}>
              {person.tags.map(tag => t(`tags.${tag}`)).join(' · ')}
            </Text>
          ) : null}
          {moment ? <Moment kind="wrap" name="purchase" onDone={() => setMoment(null)} /> : null}
          <Segment
            value={section}
            onChange={id => setSection(id as 'ideas' | 'occasions' | 'history')}
            options={[
              { id: 'ideas', label: t('person.ideas') },
              { id: 'occasions', label: t('person.occasions') },
              { id: 'history', label: t('person.history') },
            ]}
          />
        </View>
      )}
    >
      {section === 'ideas' && !hidden && !locked ? (
        <>
          <Segment
            value={ideaFilter}
            onChange={id => setIdeaFilter(id as 'forYou' | 'saved')}
            options={[
              { id: 'forYou', label: t('person.forYou') },
              { id: 'saved', label: t('person.savedTab') },
            ]}
          />
          <Pressable accessibilityRole="button" onPress={openDetails}>
            <Caption tone="text">{`${person.tags.length ? t('person.interestsLine', { list: person.tags.map(tag => t(`tags.${tag}`)).join(', ') }) : t('person.addInterests')} · ${t('person.editShort')}`}</Caption>
          </Pressable>
          {buyAsk ? <BuyPrompt idea={buyAsk} onYes={() => acceptBuy(buyAsk)} onNo={() => setBuyAsk(null)} /> : null}
          {findingIdeas && ideas.length === 0 ? <Shimmer label={t('person.ideasLoading')} /> : null}
          {ideaFilter === 'saved' ? (
            savedList.length === 0 ? <EmptyState kind="ideas" text={t('person.savedEmpty')} /> : savedList.map(idea => (
              <IdeaCard
                key={`saved-${ideaKey(idea)}`}
                idea={idea}
                art={artName}
                saved
                onSave={() => onSaveIdea(ideaKey(idea))}
                onMore={() => setMenu({ kind: 'idea', idea: ideaKey(idea) })}
                onShop={() => { shopIdea(idea).catch(() => undefined); }}
              />
            ))
          ) : (
            <>
              {!findingIdeas && visibleDevice.length === 0 && visibleCloud.length === 0 ? (
                <EmptyState
                  kind="ideas"
                  text={person.tags.length ? t('person.ideasEmpty') : t('person.ideasNeedInterests')}
                  action={person.tags.length ? undefined : t('person.editShort')}
                  onAction={person.tags.length ? undefined : openDetails}
                />
              ) : null}
              {shownIdeas.map(idea => (
                <IdeaCard
                  key={`device-${ideaKey(idea)}`}
                  idea={idea}
                  art={artName}
                  saved={savedFor(ideaKey(idea))}
                  onSave={() => onSaveIdea(ideaKey(idea))}
                  onMore={() => setMenu({ kind: 'idea', idea: ideaKey(idea) })}
                  onShop={() => { shopIdea(idea).catch(() => undefined); }}
                />
              ))}
              {visibleCloud.map(idea => (
                <IdeaCard
                  key={`cloud-${ideaKey(idea)}`}
                  idea={idea}
                  art={artName}
                  saved={savedFor(ideaKey(idea))}
                  onSave={() => onSaveIdea(ideaKey(idea))}
                  onMore={() => setMenu({ kind: 'idea', idea: ideaKey(idea) })}
                  onShop={() => { shopIdea(idea).catch(() => undefined); }}
                />
              ))}
            </>
          )}
          <Cluster>
            {ideaFilter === 'forYou' && hiddenIdeaCount > 0 ? (
              <Button label={t('person.showMore', { count: hiddenIdeaCount })} tone="ghost" onPress={() => setShowAllIdeas(true)} />
            ) : null}
            {ideaFilter === 'forYou' && showAllIdeas && ideas.length > 3 ? (
              <Button label={t('person.showFewer')} tone="ghost" onPress={() => setShowAllIdeas(false)} />
            ) : null}
          </Cluster>
          {cloudError ? <Body>{t('person.ideasError')}</Body> : null}
          <Button
            label={cloudError ? t('person.ideasRetry') : t('person.cloud')}
            tone="ghost"
            busy={cloudBusy}
            onPress={async () => {
              setCloudBusy(true);
              setCloudError(false);
              try {
                await cloudIdeas(person.id);
              } catch {
                setCloudError(true);
              } finally {
                setCloudBusy(false);
              }
            }}
          />
          {cloudRemaining[person.id] != null ? (
            <Caption tone="text">{t('person.refreshesLeft', { count: cloudRemaining[person.id], name: person.name })}</Caption>
          ) : null}
          <Caption tone="text">{t('shop.disclosure')}</Caption>
        </>
      ) : null}
      {section === 'occasions' ? (
        <>
          {occasions.length === 0 ? (
            <EmptyState
              kind="occasions"
              text={t('person.occasionsEmpty')}
              action={locked ? undefined : t('person.addOccasion')}
              onAction={locked ? undefined : () => setAddingOccasion(true)}
            />
          ) : occasions.map(occasion => (
            <OccasionRow
              key={occasion.id}
              occasion={occasion}
              today={today}
              state={snapshot.states.find(item => item.occasionId === occasion.id && item.year === occurrenceYear(occasion, today) && !item.deleted)}
              onMenu={() => setMenu({ kind: 'occasion', id: occasion.id })}
            />
          ))}
          {!locked && occasions.length > 0 ? <GhostRow label={t('person.addOccasion')} onPress={() => setAddingOccasion(true)} /> : null}
          <ReminderOffer />
        </>
      ) : null}
      {section === 'history' && !hidden ? (
        <>
          {showSpend ? <SpendBreakdown personId={person.id} budgetCents={person.budgetCents} money={money} onSetBudget={openDetails} /> : null}
          {history.length === 0 ? (
            <EmptyState
              kind="ideas"
              text={t('person.historyEmpty')}
              action={locked ? undefined : t('person.logGift')}
              onAction={locked ? undefined : () => {
                const occasion = next?.occasion ?? occasions[0];
                openPurchase(occasion?.id ?? '', nextState?.savedIdea ?? '');
              }}
            />
          ) : locked ? null : (
            <Button
              label={t('person.logGift')}
              tone="secondary"
              onPress={() => {
                const occasion = next?.occasion ?? occasions[0];
                openPurchase(occasion?.id ?? '', nextState?.savedIdea ?? '');
              }}
            />
          )}
          {history.map(item => {
            const editable = canEditSharedGift(snapshot, item, snapshot.profile.uid);
            return (
              <Card key={item.id}>
                <View style={styles.ideaRow}>
                  <View style={styles.ideaCopy}>
                    <Body>{item.title}</Body>
                    <Caption tone="text">{`${money(item.priceCents)} · ${formatStoredDate(item.purchasedOn)}`}</Caption>
                  </View>
                  {editable && !locked ? (
                    <IconButton
                      label={t('person.giftMenu')}
                      name="more"
                      word={t('common.more')}
                      onPress={() => setMenu({ kind: 'gift', id: item.id, privateGift: false, title: item.title })}
                    />
                  ) : null}
                </View>
              </Card>
            );
          })}
        </>
      ) : null}

      <Sheet
        visible={addingOccasion}
        title={t('person.addOccasionHeading')}
        onClose={() => {
          setAddingOccasion(false);
          pendingBuy.current = null;
        }}
      >
        <OccasionPicker
          personId={person.id}
          onAdded={id => {
            const pending = pendingBuy.current;
            pendingBuy.current = null;
            setAddingOccasion(false);
            if (pending && id) {
              openPurchase(id, pending.title, pending.priceMin);
            }
          }}
        />
      </Sheet>
      <Sheet visible={pickingCircle} title={t('fairness.pickCircle')} onClose={() => setPickingCircle(false)}>
        <CircleField
          value={person.circleId ?? ''}
          onChange={id => {
            setPickingCircle(false);
            setPersonCircle(person.id, id || null).catch(() => undefined);
          }}
        />
      </Sheet>
      <Sheet visible={editingDetails} title={t('person.details')} doneLabel={t('common.done')} onClose={() => setEditingDetails(false)}>
        <Field
          label={t('person.name')}
          value={name}
          error={nameError}
          textContentType="name"
          autoComplete="name"
          onChangeText={value => {
            setName(value);
            setNameError('');
          }}
        />
        <Caption>{t('person.interests')}</Caption>
        <TagPicker tags={interestTags} onChange={setInterestTags} />
        <Field
          label={t('person.budget')}
          value={budget}
          error={budgetError}
          onChangeText={value => {
            setBudget(value);
            setBudgetError('');
          }}
          keyboardType="decimal-pad"
        />
        <Caption>{t('person.perYear')}</Caption>
        <Field
          label={t('person.birthYear')}
          value={birthYear}
          error={birthError}
          onChangeText={value => {
            setBirthYear(value);
            setBirthError('');
          }}
          keyboardType="number-pad"
        />
        <RelationshipField
          value={relationship}
          error={relationshipError}
          onChange={value => {
            setRelationship(value);
            setRelationshipError('');
          }}
        />
        <CircleField value={editCircleId} onChange={setEditCircleId} />
        <Field
          label={t('person.notes')}
          value={notes}
          onChangeText={value => setNotes(value.slice(0, 300))}
        />
        <Caption>{t('person.notesHint')}</Caption>
        <Button
          label={t('person.save')}
          onPress={() => {
            const trimmed = name.trim();
            const nextNameError = trimmed ? '' : t('errors.name');
            const nextBudgetError = budget.trim() && parseBudget(budget) == null ? t('errors.price') : '';
            const parsedYear = birthYear.trim() ? parseBirthYear(birthYear) : null;
            const nextBirthError = birthYear.trim() && parsedYear == null ? t('person.birthYearInvalid') : '';
            const cleaned = storeRelationship(relationship);
            const nextRelationshipError = cleaned == null ? t('relationship.invalid') : '';
            setNameError(nextNameError);
            setBudgetError(nextBudgetError);
            setBirthError(nextBirthError);
            setRelationshipError(nextRelationshipError);
            if (nextNameError || nextBudgetError || nextBirthError || nextRelationshipError) {
              return;
            }
            toast(t('person.saved'));
            setEditingDetails(false);
            const nextCircle = editCircleId || null;
            return savePerson(person.id, {
              name: trimmed,
              budgetCents: budget.trim() ? parseBudget(budget) : null,
              tags: interestTags,
              relationship: cleaned ?? '',
              notes,
              birthYear: parsedYear,
            }).then(() => {
              if ((person.circleId ?? null) !== nextCircle) {
                return setPersonCircle(person.id, nextCircle);
              }
              return undefined;
            });
          }}
        />
        <Button
          label={t('person.removePerson', { name: person.name })}
          tone="danger"
          onPress={async () => {
            const ok = await confirmDestructive(
              t('person.deleteConfirm', { name: person.name }),
              t('person.deleteConfirmBody'),
              t('person.delete'),
            );
            if (!ok) {
              return;
            }
            setEditingDetails(false);
            navigation.goBack();
            await removePerson(person.id);
          }}
        />
      </Sheet>
      <Sheet visible={menu?.kind === 'idea'} title={menu?.kind === 'idea' ? menu.idea : ''} onClose={() => setMenu(null)} onDismiss={flushQueue}>
        {menu?.kind === 'idea' ? (
          <>
            <Button
              label={t('person.moreLike')}
              tone="secondary"
              onPress={() => {
                vote(person.id, menu.idea, 'up').catch(() => undefined);
                refreshIdeas(person.id).catch(() => undefined);
                setMenu(null);
              }}
            />
            <Button label={t('person.notAFit')} tone="secondary" onPress={() => { vote(person.id, menu.idea, 'down').catch(() => undefined); setMenu(null); }} />
          </>
        ) : null}
      </Sheet>
      <Sheet visible={Boolean(menuOccasion)} title={menuOccasion ? occasionLabel(menuOccasion) : ''} onClose={() => setMenu(null)} onDismiss={flushQueue}>
        {menuOccasion ? (
          <OccasionMenu
            occasion={menuOccasion}
            hidden={hidden}
            locked={locked}
            onClose={() => setMenu(null)}
            onPurchase={idea => {
              queued.current = { kind: 'purchase', id: menuOccasion.id, idea };
              setMenu(null);
            }}
          />
        ) : null}
      </Sheet>
      <Sheet visible={menu?.kind === 'gift'} title={menu?.kind === 'gift' ? menu.title : ''} onClose={() => setMenu(null)} onDismiss={flushQueue}>
        {menu?.kind === 'gift' ? (
          <>
            <Button
              label={t('person.editGift')}
              accessibilityLabel={t('person.editGiftLabel', { title: menu.title })}
              tone="secondary"
              onPress={() => {
                queued.current = { kind: 'edit', id: menu.id, privateGift: menu.privateGift };
                setMenu(null);
              }}
            />
            <Button
              label={t('person.deleteGift')}
              accessibilityLabel={t('person.deleteGiftLabel', { title: menu.title })}
              tone="danger-quiet"
              onPress={async () => {
                const ok = await confirmDestructive(
                  t('person.deleteGiftConfirm'),
                  t('person.deleteGiftBody'),
                  t('person.deleteGift'),
                );
                if (ok) {
                  const target = menu;
                  setMenu(null);
                  await deleteGift(target.id, target.privateGift);
                }
              }}
            />
          </>
        ) : null}
      </Sheet>
      {buying != null ? (
        <GiftSheet
          title={t('purchase.title')}
          gift={gift}
          price={price}
          date={date}
          giftError={giftError}
          priceError={priceError}
          dateError={dateError}
          saveLabel={t('purchase.save')}
          occasions={occasions}
          occasionId={buying}
          personId={person.id}
          onOccasion={setBuying}
          onGift={value => {
            setGift(value);
            setGiftError('');
          }}
          onPrice={value => {
            setPrice(value);
            setPriceError('');
          }}
          onDate={value => {
            setDate(value);
            setDateError('');
          }}
          onClose={() => setBuying(null)}
          onSave={async () => {
            const fields = giftFieldErrors(gift, price, date);
            setGiftError(fields.gift);
            setPriceError(fields.price);
            setDateError(fields.date);
            if (fields.gift || fields.price || fields.date) {
              return;
            }
            const ok = await logGift(person.id, buying, gift, price, date);
            if (ok) {
              setMoment('wrap');
              setBuying(null);
            }
          }}
        />
      ) : null}
      {editingGift ? (
        <GiftSheet
          title={t('person.editGift')}
          gift={gift}
          price={price}
          date={date}
          giftError={giftError}
          priceError={priceError}
          dateError={dateError}
          saveLabel={t('person.save')}
          saveAccessibilityLabel={t('person.editGiftLabel', { title: gift || t('person.editGift') })}
          onGift={value => {
            setGift(value);
            setGiftError('');
          }}
          onPrice={value => {
            setPrice(value);
            setPriceError('');
          }}
          onDate={value => {
            setDate(value);
            setDateError('');
          }}
          onClose={() => setEditingGift(null)}
          onSave={async () => {
            const fields = giftFieldErrors(gift, price, date);
            setGiftError(fields.gift);
            setPriceError(fields.price);
            setDateError(fields.date);
            if (fields.gift || fields.price || fields.date || !editingGift) {
              return;
            }
            const ok = await updateGift(editingGift.id, gift, price, date, editingGift.privateGift);
            if (ok) {
              setEditingGift(null);
            }
          }}
        />
      ) : null}
    </Screen>
  );
}

function OccasionRow({
  occasion,
  today,
  state,
  onMenu,
}: {
  occasion: Occasion;
  today: Date;
  state: OccasionState | undefined;
  onMenu: () => void;
}) {
  const label = occasionLabel(occasion);
  const next = nextOccasionDate(occasion, today);
  const when = next
    ? (isOneTimeOccasion(occasion) ? formatLongDate(next) : formatDate(next))
    : `${occasion.month}/${occasion.day}`;
  const days = next ? daysUntil(next, today) : null;
  const trailing = days == null ? '' : days === 0 ? t('people.today') : t('people.inDays', { count: days });
  const status = t(state?.status === 'purchased' ? 'person.statusPurchased' : state?.status === 'idea-saved' ? 'person.statusIdea' : 'person.statusNotStarted');
  const row = (
    <Card>
      <View style={styles.occasionRow}>
        <ArtSlot name={occasionLook(occasion.type).art} size={40} />
        <View style={styles.ideaCopy}>
          <Body strong>{label}</Body>
          <Caption tone="text">{trailing ? `${when} · ${trailing}` : when}</Caption>
          {status ? <Caption>{status}</Caption> : null}
        </View>
        <IconButton label={t('person.occasionMenu')} name="more" word={t('common.more')} onPress={onMenu} />
      </View>
    </Card>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[label, trailing ? `${when}, ${trailing}` : when, status].filter(Boolean).join('. ')}
      accessibilityHint={t('person.occasionMenuHint')}
      accessibilityActions={[{ name: 'open-menu', label: t('person.occasionMenu') }]}
      onAccessibilityAction={event => {
        if (event.nativeEvent.actionName === 'activate' || event.nativeEvent.actionName === 'open-menu') {
          onMenu();
        }
      }}
      onPress={onMenu}>
      {row}
    </Pressable>
  );
}

function OccasionMenu({
  occasion,
  hidden,
  locked,
  onClose,
  onPurchase,
}: {
  occasion: Occasion;
  hidden: boolean;
  locked: boolean;
  onClose: () => void;
  onPurchase: (idea: string) => void;
}) {
  const { snapshot, updateOccasion, deleteOccasion } = useGifteez();
  const [editing, setEditing] = useState(false);
  const [month, setMonth] = useState(occasion.month ? String(occasion.month) : '');
  const [day, setDay] = useState(occasion.day ? String(occasion.day) : '');
  const [year, setYear] = useState(occasion.year ? String(occasion.year) : '');
  const [knowYear, setKnowYear] = useState(Boolean(occasion.year));
  const [dateError, setDateError] = useState('');
  const label = occasionLabel(occasion);
  const today = new Date();
  const next = nextOccasionDate(occasion, today);
  const status = statusFor(occasion, snapshot.states, today);
  const state = snapshot.states.find(item => item.occasionId === occasion.id && item.year === occurrenceYear(occasion, today) && !item.deleted);
  const estimated = dateIsEstimated(occasion, (next ?? today).getFullYear());
  const canEdit = !hidden && !locked && (occasionNeedsDate(occasion.type) || estimated);
  const note = presetFor(occasion.type)?.note;
  if (editing) {
    return (
      <>
        <Heading>{t('person.updateOccasion')}</Heading>
        <MonthDayField
          label={t('person.date')}
          month={month}
          day={day}
          year={year}
          knowYear={knowYear}
          error={dateError}
          onKnowYear={value => {
            setKnowYear(value);
            if (!value) {
              setYear('');
            }
            setDateError('');
          }}
          onChange={nextDate => {
            setMonth(nextDate.month);
            setDay(nextDate.day);
            setYear(nextDate.year);
            setDateError('');
          }}
        />
        <Button
          label={t('person.updateOccasion')}
          accessibilityLabel={t('person.updateOccasionLabel', { occasion: label })}
          onPress={() => {
            const monthNum = Number(month);
            const dayNum = Number(day);
            const yearNum = Number(year);
            if (!isRealMonthDay(monthNum, dayNum)) {
              setDateError(t('errors.date'));
              return;
            }
            if (knowYear && !(yearNum > 0)) {
              setDateError(t('person.yearMissing'));
              return;
            }
            updateOccasion(occasion.id, monthNum, dayNum, knowYear ? yearNum : undefined).catch(() => undefined);
            onClose();
          }}
        />
      </>
    );
  }
  return (
    <>
      {note ? <Caption>{t(note)}</Caption> : null}
      {estimated ? <Caption>{t('person.dateEstimated')}</Caption> : null}
      {hidden || !state?.savedIdea ? null : <Body>{state.savedIdea}</Body>}
      {hidden ? null : <Caption tone="text">{t(status === 'idea-saved' ? 'person.statusIdea' : status === 'purchased' ? 'person.statusPurchased' : 'person.statusNotStarted')}</Caption>}
      {canEdit ? (
        <Button
          label={t('person.updateOccasion')}
          accessibilityLabel={t('person.updateOccasionLabel', { occasion: label })}
          tone="secondary"
          onPress={() => setEditing(true)}
        />
      ) : null}
      {hidden || locked ? null : (
        <Button label={t('person.purchase')} tone="secondary" onPress={() => onPurchase(state?.savedIdea ?? '')} />
      )}
      {!hidden && !locked ? (
        <Button
          label={t('person.deleteOccasion')}
          accessibilityLabel={t('person.deleteOccasionLabel', { occasion: label })}
          tone="danger-quiet"
          onPress={async () => {
            const ok = await confirmDestructive(
              t('person.deleteOccasionConfirm'),
              t('person.deleteGiftBody'),
              t('person.deleteOccasion'),
            );
            if (ok) {
              onClose();
              await deleteOccasion(occasion.id);
            }
          }}
        />
      ) : null}
    </>
  );
}

function SpendBreakdown({
  personId,
  budgetCents,
  money,
  onSetBudget,
}: {
  personId: string;
  budgetCents: number | null;
  money: (cents: number) => string;
  onSetBudget: () => void;
}) {
  const { snapshot } = useGifteez();
  const year = new Date().getFullYear();
  const yearTotal = yearSpentCents(personId, snapshot.gifts, year);
  const allTotal = allTimeSpentCents(personId, snapshot.gifts);
  return (
    <Card>
      <Body>{t('person.yearTotal', { amount: money(yearTotal) })}</Body>
      <Body>{t('person.allTotal', { amount: money(allTotal) })}</Body>
      {budgetCents == null ? (
        <Pressable accessibilityRole="button" onPress={onSetBudget}>
          <Body>{t('person.noBudget')}</Body>
        </Pressable>
      ) : (
        <Body>{t('person.budgetLine', { amount: money(budgetCents) })}</Body>
      )}
    </Card>
  );
}

function ReminderOffer() {
  const { snapshot, setReminders } = useGifteez();
  const waiting = (snapshot.profile.reminders ?? 'unset') === 'unset';
  const hasDate = snapshot.occasions.some(item => !item.deleted);
  if (!waiting || !hasDate) {
    return null;
  }
  return (
    <Card>
      <Heading>{t('people.remindersA11y')}</Heading>
      <Body>{t('person.remindBody')}</Body>
      <Button label={t('person.remindYes')} tone="secondary" onPress={() => setReminders(true)} />
      <Button label={t('person.remindNo')} tone="ghost" onPress={() => setReminders(false)} />
    </Card>
  );
}

function backLabelFor(navigation: NativeStackNavigationProp<RootStack>): string {
  const state = navigation.getState?.();
  const previous = state?.routes[state.index - 1];
  return previous?.name === 'Home' ? t('people.home') : t('people.title');
}

function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, type, typeScale } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.backLink}>
      <Text maxFontSizeMultiplier={typeScale.body} style={[type.body, { color: colors.pink }]}>{`‹ ${label}`}</Text>
    </Pressable>
  );
}

function TagPicker({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void | Promise<unknown> }) {
  return (
    <Cluster>
      {INTEREST_TAGS.map(tag => {
        const selected = tags.includes(tag);
        return (
          <Chip
            key={tag}
            label={t(`tags.${tag}`)}
            selected={selected}
            onPress={() => onChange(selected ? tags.filter(item => item !== tag) : [...tags, tag])}
          />
        );
      })}
    </Cluster>
  );
}

function BuyPrompt({ idea, onYes, onNo }: { idea: GiftIdea; onYes: () => void; onNo: () => void }) {
  return (
    <Card>
      <Heading>{t('person.didYouBuy')}</Heading>
      <Body>{idea.title}</Body>
      <Button label={t('person.didYouBuyYes')} onPress={onYes} />
      <Button label={t('person.didYouBuyNo')} tone="ghost" onPress={onNo} />
    </Card>
  );
}

function IdeaCard({
  idea,
  art,
  saved,
  onSave,
  onMore,
  onShop,
}: {
  idea: GiftIdea | string;
  art: ReturnType<typeof occasionLook>['art'];
  saved: boolean;
  onSave: () => void | Promise<unknown> | undefined;
  onMore: () => void;
  onShop: () => void;
}) {
  const gift = asGiftIdea(idea);
  const { colors, type, typeScale } = useTheme();
  const title = sentenceCaseTitle(gift.title);
  return (
    <Card compact>
      <View style={styles.ideaRow}>
        <ArtSlot name={art} size={36} />
        <View style={styles.ideaCopy}>
          <View style={styles.titlePrice}>
            <Text numberOfLines={2} style={[styles.ideaTitle, { color: colors.text, fontFamily: type.heading.fontFamily }]}>{title}</Text>
            <Text style={[type.caption, { color: colors.muted }]}>{`$${gift.priceMin}–${gift.priceMax}`}</Text>
          </View>
          <Text numberOfLines={2} style={[type.caption, { color: colors.text }]}>{gift.reason}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Button flex tone="soft" label={t('person.shopIdea')} onPress={onShop} />
        <HeartPop saved={saved}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? t('person.unsaveIdea') : t('person.saveIdea')}
            onPress={() => { onSave(); }}
            style={styles.saveWord}>
            <Icon name="heart" size={18} color={saved ? colors.pink : colors.text} filled={saved} />
            <Text maxFontSizeMultiplier={typeScale.button} style={[type.button, { color: colors.text }]}>{saved ? t('person.saved') : t('person.save')}</Text>
          </Pressable>
        </HeartPop>
        <Pressable accessibilityRole="button" accessibilityLabel={t('person.moreLike')} onPress={onMore} style={styles.moreBtn}>
          <Text maxFontSizeMultiplier={typeScale.button} style={[type.button, { color: colors.muted }]}>•••</Text>
        </Pressable>
      </View>
    </Card>
  );
}

function BudgetLine({
  spent,
  budgetCents,
  money,
  onSetBudget,
}: {
  spent: number;
  budgetCents: number | null;
  money: (cents: number) => string;
  onSetBudget: () => void;
}) {
  const { colors, type } = useTheme();
  if (budgetCents == null) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={t('person.noBudget')} onPress={onSetBudget}>
        <Caption tone="text">{t('person.noBudget')}</Caption>
      </Pressable>
    );
  }
  const ratio = budgetCents > 0 ? Math.min(1, spent / budgetCents) : 0;
  return (
    <View style={styles.budgetBlock}>
      <View style={[styles.budgetTrack, { backgroundColor: colors.surfaceAlt }]}>
        <View style={[styles.budgetFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: colors.pink }]} />
      </View>
      <Text style={[type.caption, { color: colors.text }]}>
        <Text style={styles.budgetStrong}>{money(spent)}</Text>
        {` of ${money(budgetCents)} ${t('person.perYear')}`}
      </Text>
    </View>
  );
}

function GiftSheet({
  title,
  gift,
  price,
  date,
  giftError,
  priceError,
  dateError,
  saveLabel,
  saveAccessibilityLabel,
  occasions,
  occasionId,
  personId,
  onOccasion,
  onGift,
  onPrice,
  onDate,
  onSave,
  onClose,
}: {
  title: string;
  gift: string;
  price: string;
  date: string;
  giftError: string;
  priceError: string;
  dateError: string;
  saveLabel: string;
  saveAccessibilityLabel?: string;
  occasions?: Occasion[];
  occasionId?: string;
  personId?: string;
  onOccasion?: (occasionId: string) => void;
  onGift: (value: string) => void;
  onPrice: (value: string) => void;
  onDate: (value: string) => void;
  onSave: () => void | Promise<unknown>;
  onClose: () => void;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <Sheet
      visible
      title={adding ? t('person.addOccasionHeading') : title}
      doneLabel={adding ? undefined : t('common.done')}
      onClose={() => { setAdding(false); onClose(); }}
    >
      {adding && personId ? (
        <>
          <Button label={t('common.back')} tone="ghost" onPress={() => setAdding(false)} />
          <OccasionPicker
            personId={personId}
            onAdded={id => {
              setAdding(false);
              if (id) {
                onOccasion?.(id);
              }
            }}
          />
        </>
      ) : (
        <>
          {occasions && onOccasion ? (
            <>
              <Caption>{t('purchase.occasionOptional')}</Caption>
              <Cluster>
                <Chip label={t('purchase.noOccasion')} selected={!occasionId} onPress={() => onOccasion('')} />
                {occasions.map(occasion => (
                  <Chip
                    key={occasion.id}
                    label={occasionLabel(occasion)}
                    selected={occasionId === occasion.id}
                    onPress={() => onOccasion(occasion.id)}
                  />
                ))}
              </Cluster>
              <Button label={t('person.addOccasion')} tone="secondary" onPress={() => setAdding(true)} />
            </>
          ) : null}
          <Field label={t('purchase.gift')} value={gift} error={giftError} onChangeText={onGift} />
          <Field label={t('purchase.price')} value={price} error={priceError} onChangeText={onPrice} keyboardType="decimal-pad" />
          <DateField label={t('purchase.date')} value={date} error={dateError} maximumDate={new Date()} onChange={onDate} />
          <Button label={saveLabel} accessibilityLabel={saveAccessibilityLabel} onPress={onSave} />
        </>
      )}
    </Sheet>
  );
}

function giftFieldErrors(gift: string, price: string, date: string): { gift: string; price: string; date: string } {
  return {
    gift: gift.trim() ? '' : t('errors.invalid'),
    price: parseBudget(price) == null ? t('errors.price') : '',
    date: date.trim() && (!validPurchaseDate(date) || date.trim() > todayIso()) ? t('errors.purchaseDate') : '',
  };
}

function validPurchaseDate(value: string): boolean {
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (iso) {
    return isRealMonthDay(Number(iso[2]), Number(iso[3]));
  }
  const loose = parseLooseDate(trimmed);
  return Boolean(loose && isRealMonthDay(loose.month, loose.day));
}

function personMeta(person: { relationship?: string; circleId?: string }, circles: { id: string; name: string }[]): string {
  const relationship = relationshipLabel(person.relationship);
  const circle = circles.find(item => item.id === person.circleId)?.name;
  const parts = [relationship, circle ? t('person.circleMeta', { name: circle }) : ''].filter(Boolean);
  return parts.join(' · ') || t('fairness.noCircle');
}

const styles = StyleSheet.create({
  footerStack: { gap: space.xs },
  pinnedTight: { gap: 6 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backLink: { minHeight: 44, justifyContent: 'center' },
  saveWord: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  moreBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 64 },
  personName: { fontSize: 25, lineHeight: 28 },
  nextOccasion: { fontSize: 12, lineHeight: 16, maxWidth: 108, textAlign: 'right' },
  budgetBlock: { gap: 4 },
  budgetTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  budgetFill: { height: 4, borderRadius: 2 },
  budgetStrong: { fontWeight: '700' },
  summaryName: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.xs },
  avatarName: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flex: 1 },
  personCopy: { flex: 1, gap: 2 },
  ideaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  ideaCopy: { flex: 1, gap: 2 },
  titlePrice: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  ideaTitle: { flex: 1, fontSize: 17.5, lineHeight: 22 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.xxs },
  occasionRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  logged: { alignSelf: 'flex-start' },
});
