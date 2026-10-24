import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStack } from '../app/navigation';
import { INTEREST_TAGS } from '../domain/catalog';
import { asGiftIdea, ideaCacheId, ideaKey } from '../domain/ideas';
import type { GiftIdea } from '../domain/types';
import { canEditSharedGift } from '../domain/edits';
import { allTimeSpentCents, daysUntil, isRealMonthDay, listCurrency, occurrenceYear, parseBudget, parseLooseDate, statusFor, upcomingOccasion, yearSpentCents } from '../domain/logic';
import { dateIsEstimated, isOneTimeOccasion, nextOccasionDate, occasionLabel, occasionNeedsDate, presetFor } from '../domain/occasions';
import type { Occasion, OccasionState } from '../domain/types';
import { relationshipLabel, storeRelationship } from '../domain/relationship';
import { deviceLocale, formatDate, formatLongDate, formatMoney, formatStoredDate, t, todayIso } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { occasionLook, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { DateField, MonthDayField } from '../ui/DateField';
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
  Display,
  Heading,
  IconButton,
  Screen,
  Segment,
  Sheet,
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
  useEffect(() => {
    if (!completedPersonId) {
      return;
    }
    const personId = completedPersonId;
    clearCompletedPerson();
    navigation.replace('Person', { personId });
  }, [clearCompletedPerson, completedPersonId, navigation]);
  useEffect(() => () => {
    cancelAdd.current();
  }, []);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [relationship, setRelationship] = useState('');
  const [relationshipError, setRelationshipError] = useState('');
  const [circleId, setCircleId] = useState('');
  return (
    <Screen>
      <Title>{t('firstOpen.title')}</Title>
      <Body>{t('firstOpen.lead')}</Body>
      <Field
        label={t('firstOpen.theirName')}
        value={name}
        error={nameError}
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
      <CircleField value={circleId} onChange={setCircleId} />
      <Button
        label={t('firstOpen.start')}
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
          const id = await addPerson({
            name,
            budget: '',
            tags: [],
            relationship: cleaned,
            ...(circleId ? { circleId } : {}),
          });
          if (id) {
            navigation.replace('Person', { personId: id });
          }
        }}
      />
    </Screen>
  );
}

export function PersonScreen() {
  const route = useRoute<RouteProp<RootStack, 'Person'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
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
  const [name, setName] = useState(person?.name ?? '');
  const [relationship, setRelationship] = useState(person?.relationship ?? '');
  const [notes, setNotes] = useState(person?.notes ?? '');
  const [freshCloud, setFreshCloud] = useState<GiftIdea[]>([]);
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
  useEffect(() => {
    if (route.params.section) {
      setSection(route.params.section);
    }
  }, [route.params.personId, route.params.section]);
  const [editingDetails, setEditingDetails] = useState(false);
  const [addingOccasion, setAddingOccasion] = useState(false);
  const [tuning, setTuning] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudError, setCloudError] = useState(false);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [moment, setMoment] = useState<'wrap' | null>(null);
  const queued = useRef<Queue | null>(null);
  const queuedMenu = useRef<Menu | null>(null);

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
    navigation.setOptions({ title: '', headerRight: undefined });
  }, [navigation]);

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
  const visibleCloud = cloudList.filter(idea => !hiddenIdeas.has(ideaKey(idea)));
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
  const budgetLabel = hidden
    ? ''
    : person.budgetCents == null
      ? t('people.spent', { used: money(spent) })
      : t('people.budgetYear', { used: money(spent), budget: money(person.budgetCents) });

  function savedFor(idea: string): boolean {
    return Boolean(next && nextState?.savedIdea === idea);
  }

  const personId = person.id;
  function hearted(idea: string): boolean {
    return savedFor(idea) || snapshot.feedback.some(item => item.personId === personId && item.idea === idea && item.vote === 'up');
  }

  function openPurchase(occasionId: string, idea: string) {
    setBuying(occasionId);
    setGift(idea);
    setPrice('');
    setDate(todayIso());
    setGiftError('');
    setPriceError('');
    setDateError('');
    setEditingGift(null);
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

  return (
    <Screen
      pinned={(
        <>
          {hidden ? <Body>{t('person.hiddenRecipient')}</Body> : null}
          {locked ? <Body>{t('person.readOnly')}</Body> : null}
          {person.imported ? <Caption>{t('person.openedImported')}</Caption> : null}
          <View style={styles.personHead}>
            <View style={styles.personMenu}>
              <IconButton label={t('person.editDetails')} name="more" filled onPress={() => setEditingDetails(true)} />
            </View>
            <MonogramAvatar name={person.name} personId={person.id} size={72} crest />
            <Display lines={2}>{person.name}</Display>
            <Pressable accessibilityRole="button" onPress={() => setPickingCircle(true)}>
              <Caption tone="text">{personMeta(person, snapshot.circles)}</Caption>
            </Pressable>
            {budgetLabel ? <Caption tone="text">{budgetLabel}</Caption> : null}
            {moment ? <Moment kind="wrap" name="purchase" onDone={() => setMoment(null)} /> : null}
          </View>
          <Segment
            value={section}
            onChange={id => setSection(id as 'ideas' | 'occasions' | 'history')}
            options={[
              { id: 'ideas', label: t('person.ideas') },
              { id: 'occasions', label: t('person.occasions') },
              { id: 'history', label: t('person.history') },
            ]}
          />
        </>
      )}
    >
      {section === 'ideas' && !hidden && !locked ? (
        <>
          {findingIdeas && ideas.length === 0 ? <Shimmer label={t('person.ideasLoading')} /> : null}
          {!findingIdeas && visibleDevice.length === 0 && visibleCloud.length === 0 ? <EmptyState kind="ideas" text={t('person.ideasEmpty')} /> : null}
          {shownIdeas.map(idea => (
            <IdeaCard
              key={`device-${ideaKey(idea)}`}
              idea={idea}
              art={artName}
              saved={savedFor(ideaKey(idea))}
              onSave={() => onSaveIdea(ideaKey(idea))}
              onUp={() => { vote(person.id, ideaKey(idea), 'up').catch(() => undefined); }}
              onDown={() => { vote(person.id, ideaKey(idea), 'down').catch(() => undefined); }}
              onShop={() => undefined}
            />
          ))}
          {visibleCloud.map(idea => (
            <IdeaCard
              key={`cloud-${ideaKey(idea)}`}
              idea={idea}
              art={artName}
              saved={savedFor(ideaKey(idea))}
              onSave={() => onSaveIdea(ideaKey(idea))}
              onUp={() => { vote(person.id, ideaKey(idea), 'up').catch(() => undefined); }}
              onDown={() => { vote(person.id, ideaKey(idea), 'down').catch(() => undefined); }}
              onShop={() => undefined}
            />
          ))}
          <Cluster>
            {hiddenIdeaCount > 0 ? (
              <Button label={t('person.showMore', { count: hiddenIdeaCount })} tone="ghost" onPress={() => setShowAllIdeas(true)} />
            ) : null}
            {showAllIdeas && ideas.length > 3 ? (
              <Button label={t('person.showFewer')} tone="ghost" onPress={() => setShowAllIdeas(false)} />
            ) : null}
            <Button label={t('person.tuneIdeas')} tone="ghost" onPress={() => setTuning(true)} />
          </Cluster>
        </>
      ) : null}
      {section === 'occasions' ? (
        <>
          {occasions.length === 0 ? <EmptyState kind="occasions" text={t('person.occasionsEmpty')} /> : null}
          {occasions.map(occasion => (
            <OccasionRow
              key={occasion.id}
              occasion={occasion}
              today={today}
              state={snapshot.states.find(item => item.occasionId === occasion.id && item.year === occurrenceYear(occasion, today) && !item.deleted)}
              onMenu={() => setMenu({ kind: 'occasion', id: occasion.id })}
            />
          ))}
          {locked ? null : <GhostRow label={t('person.addOccasion')} onPress={() => setAddingOccasion(true)} />}
          <ReminderOffer />
        </>
      ) : null}
      {section === 'history' && !hidden ? (
        <>
          {showSpend ? <SpendBreakdown personId={person.id} budgetCents={person.budgetCents} money={money} /> : null}
          {history.length === 0 ? <EmptyState kind="ideas" text={t('person.historyEmpty')} /> : null}
          {locked ? null : (
            <Button
              label={t('person.logGift')}
              tone="secondary"
              onPress={() => {
                const occasion = next?.occasion ?? occasions[0];
                if (!occasion) {
                  setAddingOccasion(true);
                  return;
                }
                openPurchase(occasion.id, nextState?.savedIdea ?? '');
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
                      filled
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
        visible={tuning}
        onClose={() => {
          setFreshCloud(current => current.filter(idea => hearted(idea.title)));
          setTuning(false);
        }}
        onDismiss={() => {
          const nextMenu = queuedMenu.current;
          queuedMenu.current = null;
          if (nextMenu) {
            setMenu(nextMenu);
          }
        }}
      >
        <Heading>{t('person.tuneIdeas')}</Heading>
        <Body>{t('person.tagsHint')}</Body>
        <TagPicker
          tags={interestTags}
          onChange={tags => {
            setInterestTags(tags);
            return savePerson(person.id, { tags }).then(() => refreshIdeas(person.id));
          }}
        />
        <Button label={t('person.refresh')} tone="secondary" onPress={() => refreshIdeas(person.id)} />
        {cloudBusy ? <Shimmer label={t('person.ideasLoading')} /> : null}
        {cloudError ? <Body>{t('person.ideasError')}</Body> : null}
        <Button
          label={cloudError ? t('person.ideasRetry') : t('person.cloud')}
          tone="secondary"
          onPress={async () => {
            setCloudBusy(true);
            setCloudError(false);
            try {
              setFreshCloud(await cloudIdeas(person.id));
            } catch {
              setCloudError(true);
            } finally {
              setCloudBusy(false);
            }
          }}
        />
        {freshCloud.filter(idea => !hiddenIdeas.has(idea.title)).map(idea => (
          <IdeaCard
            key={`fresh-${idea.title}`}
            idea={idea}
            art={artName}
            saved={savedFor(idea.title)}
            onSave={() => onSaveIdea(idea.title)}
            onUp={() => { vote(person.id, idea.title, 'up').catch(() => undefined); }}
            onDown={() => { vote(person.id, idea.title, 'down').catch(() => undefined); }}
            onShop={() => undefined}
          />
        ))}
        {cloudRemaining[person.id] != null ? <Body>{t('person.cloudLeft', { count: cloudRemaining[person.id] })}</Body> : null}
        <Body>{t('person.cloudHint')}</Body>
      </Sheet>
      <Sheet visible={addingOccasion} onClose={() => setAddingOccasion(false)}>
        <OccasionPicker personId={person.id} onAdded={() => setAddingOccasion(false)} />
      </Sheet>
      <Sheet visible={pickingCircle} onClose={() => setPickingCircle(false)}>
        <Heading>{t('fairness.pickCircle')}</Heading>
        <Cluster>
          <Chip
            label={t('fairness.noCircle')}
            selected={!person.circleId}
            onPress={() => {
              setPickingCircle(false);
              setPersonCircle(person.id, null).catch(() => undefined);
            }}
          />
          {snapshot.circles.map(circle => (
            <Chip
              key={circle.id}
              label={circle.name}
              selected={person.circleId === circle.id}
              onPress={() => {
                setPickingCircle(false);
                setPersonCircle(person.id, circle.id).catch(() => undefined);
              }}
            />
          ))}
        </Cluster>
      </Sheet>
      <Sheet visible={editingDetails} onClose={() => setEditingDetails(false)}>
        <Heading>{t('person.details')}</Heading>
        <Field
          label={t('person.name')}
          value={name}
          error={nameError}
          onChangeText={value => {
            setName(value);
            setNameError('');
          }}
        />
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
        <RelationshipField
          value={relationship}
          error={relationshipError}
          onChange={value => {
            setRelationship(value);
            setRelationshipError('');
          }}
        />
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
            const cleaned = storeRelationship(relationship);
            const nextRelationshipError = cleaned == null ? t('relationship.invalid') : '';
            setNameError(nextNameError);
            setBudgetError(nextBudgetError);
            setRelationshipError(nextRelationshipError);
            if (nextNameError || nextBudgetError || nextRelationshipError) {
              return;
            }
            toast(t('person.saved'));
            setEditingDetails(false);
            return savePerson(person.id, {
              name: trimmed,
              budgetCents: budget.trim() ? parseBudget(budget) : null,
              tags: interestTags,
              relationship: cleaned ?? '',
              notes,
            });
          }}
        />
        <Button
          label={t('person.delete')}
          tone="danger-quiet"
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
      <Sheet visible={menu?.kind === 'idea'} onClose={() => setMenu(null)} onDismiss={flushQueue}>
        {menu?.kind === 'idea' ? (
          <>
            <Heading>{menu.idea}</Heading>
            <Button
              label={savedFor(menu.idea) ? t('person.unsaveIdea') : t('person.saveIdea')}
              tone="secondary"
              onPress={() => {
                onSaveIdea(menu.idea);
                setMenu(null);
              }}
            />
            <Button label={t('person.thumbsUp')} tone="secondary" onPress={() => { vote(person.id, menu.idea, 'up').catch(() => undefined); setMenu(null); }} />
            <Button label={t('person.thumbsDown')} tone="secondary" onPress={() => { vote(person.id, menu.idea, 'down').catch(() => undefined); setMenu(null); }} />
          </>
        ) : null}
      </Sheet>
      <Sheet visible={Boolean(menuOccasion)} onClose={() => setMenu(null)} onDismiss={flushQueue}>
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
      <Sheet visible={menu?.kind === 'gift'} onClose={() => setMenu(null)} onDismiss={flushQueue}>
        {menu?.kind === 'gift' ? (
          <>
            <Heading>{menu.title}</Heading>
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
      {buying ? (
        <GiftSheet
          title={t('purchase.title')}
          gift={gift}
          price={price}
          date={date}
          giftError={giftError}
          priceError={priceError}
          dateError={dateError}
          saveLabel={t('purchase.save')}
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
            const ok = await logGift(buying, gift, price, date);
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
        <IconButton label={t('person.occasionMenu')} name="more" filled onPress={onMenu} />
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
      <Heading>{label}</Heading>
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

function SpendBreakdown({ personId, budgetCents, money }: { personId: string; budgetCents: number | null; money: (cents: number) => string }) {
  const { snapshot } = useGifteez();
  const year = new Date().getFullYear();
  const yearTotal = yearSpentCents(personId, snapshot.gifts, year);
  const allTotal = allTimeSpentCents(personId, snapshot.gifts);
  return (
    <Card>
      <Body>{t('person.yearTotal', { amount: money(yearTotal) })}</Body>
      <Body>{t('person.allTotal', { amount: money(allTotal) })}</Body>
      <Body>{budgetCents == null ? t('person.noBudget') : t('person.budgetLine', { amount: money(budgetCents) })}</Body>
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

function IdeaCard({
  idea,
  art,
  saved,
  onSave,
  onUp,
  onDown,
  onShop,
}: {
  idea: GiftIdea | string;
  art: ReturnType<typeof occasionLook>['art'];
  saved: boolean;
  onSave: () => void | Promise<unknown> | undefined;
  onUp: () => void;
  onDown: () => void;
  onShop: () => void;
}) {
  const gift = asGiftIdea(idea);
  const { colors } = useTheme();
  return (
    <Card>
      <View style={styles.ideaRow}>
        <ArtSlot name={art} size={48} />
        <View style={styles.ideaCopy}>
          <Heading>{gift.title}</Heading>
          <Caption>{`$${gift.priceMin}–${gift.priceMax}`}</Caption>
          <Body>{gift.reason}</Body>
        </View>
      </View>
      <Cluster>
        <Button compact label={t('person.thumbsUp')} tone="secondary" onPress={onUp} />
        <Button compact label={t('person.thumbsDown')} tone="secondary" onPress={onDown} />
        <HeartPop saved={saved}>
          <IconButton
            label={saved ? t('person.unsaveIdea') : t('person.saveIdea')}
            name="heart"
            color={saved ? colors.pink : colors.text}
            filled={saved}
            size={28}
            onPress={() => { onSave(); }}
          />
        </HeartPop>
      </Cluster>
      <Button label={t('person.shopIdea')} tone="secondary" onPress={onShop} />
    </Card>
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
  onGift: (value: string) => void;
  onPrice: (value: string) => void;
  onDate: (value: string) => void;
  onSave: () => void | Promise<unknown>;
  onClose: () => void;
}) {
  return (
    <Sheet visible onClose={onClose}>
      <Heading>{title}</Heading>
      <Field label={t('purchase.gift')} value={gift} error={giftError} onChangeText={onGift} />
      <Field label={t('purchase.price')} value={price} error={priceError} onChangeText={onPrice} keyboardType="decimal-pad" />
      <DateField label={t('purchase.date')} value={date} error={dateError} maximumDate={new Date()} onChange={onDate} />
      <Button label={saveLabel} accessibilityLabel={saveAccessibilityLabel} onPress={onSave} />
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
  personHead: { alignItems: 'center', gap: space.xs },
  personMenu: { position: 'absolute', top: 0, right: 0, zIndex: 1 },
  summaryName: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.xs },
  avatarName: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flex: 1 },
  personCopy: { flex: 1, gap: 2 },
  ideaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  ideaCopy: { flex: 1 },
  occasionRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  logged: { alignSelf: 'flex-start' },
});
