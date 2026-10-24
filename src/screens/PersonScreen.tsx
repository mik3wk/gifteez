import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStack } from '../app/navigation';
import { INTEREST_TAGS } from '../domain/catalog';
import { buyerLabel, claimerName, claimWarningUid, isMyPurchase, spendByMember, visibleGifts } from '../domain/claims';
import { ideaCacheId } from '../domain/ideas';
import { canEditSharedGift } from '../domain/edits';
import { allTimeSpentCents, daysUntil, groupCurrency, isRealMonthDay, occurrenceYear, parseBudget, parseLooseDate, statusFor, upcomingOccasion, yearSpentCents } from '../domain/logic';
import { dateIsEstimated, isOneTimeOccasion, nextOccasionDate, occasionLabel, occasionNeedsDate, presetFor } from '../domain/occasions';
import { isHiddenFromViewer, isPersonLocked } from '../domain/visibility';
import { peopleOnOtherLists } from '../domain/merge';
import type { Occasion, OccasionState } from '../domain/types';
import { cleanRelationship } from '../domain/relationship';
import { initialPersonSection, summaryPrimary, summaryPrimaryLabel } from './personSummary';
import { deviceLocale, formatDate, formatLongDate, formatMoney, t, todayIso } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { occasionLook, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { DateField, MonthDayField } from '../ui/DateField';
import { HeartPop, Moment, Shimmer } from '../ui/motion';
import { OccasionPicker } from '../ui/OccasionPicker';
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
  OccasionChip,
  ProgressBar,
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
  const navigation = useNavigation();
  const { addPerson } = useGifteez();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [relationship, setRelationship] = useState('');
  const [relationshipError, setRelationshipError] = useState('');
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
      <Button
        label={t('firstOpen.start')}
        onPress={async () => {
          if (!name.trim()) {
            setNameError(t('errors.name'));
            return;
          }
          const cleaned = cleanRelationship(relationship);
          if (cleaned == null) {
            setRelationshipError(t('relationship.invalid'));
            return;
          }
          const id = await addPerson({ name, budget: '', tags: [], relationship: cleaned });
          if (id) {
            (navigation as { navigate: (screen: string, params: { personId: string }) => void }).navigate('Person', { personId: id });
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
    linkRecipient,
    undoMerge,
    claimOccasion,
  } = useGifteez();
  const { colors } = useTheme();
  const person = snapshot.people.find(item => item.id === route.params.personId && !item.deleted);
  const today = new Date();
  const firstUpcoming = person ? upcomingOccasion(person.id, snapshot.occasions, today) : null;
  const [budget, setBudget] = useState(person?.budgetCents == null ? '' : String(person.budgetCents / 100));
  const [name, setName] = useState(person?.name ?? '');
  const [relationship, setRelationship] = useState(person?.relationship ?? '');
  const [relationshipError, setRelationshipError] = useState('');
  const [gift, setGift] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(todayIso());
  const [buying, setBuying] = useState<string | null>(null);
  const [mineOnly, setMineOnly] = useState(false);
  const [editingGift, setEditingGift] = useState<{ id: string; privateGift: boolean } | null>(null);
  const [findingIdeas, setFindingIdeas] = useState(true);
  const [showAllIdeas, setShowAllIdeas] = useState(false);
  const [interestTags, setInterestTags] = useState<string[]>(person?.tags ?? []);
  const [nameError, setNameError] = useState('');
  const [budgetError, setBudgetError] = useState('');
  const [giftError, setGiftError] = useState('');
  const [priceError, setPriceError] = useState('');
  const [dateError, setDateError] = useState('');
  const [section, setSection] = useState<'ideas' | 'occasions' | 'history'>(() =>
    initialPersonSection(firstUpcoming ? daysUntil(firstUpcoming.date, today) : null),
  );
  const [editingDetails, setEditingDetails] = useState(false);
  const [addingOccasion, setAddingOccasion] = useState(false);
  const [tuning, setTuning] = useState(false);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [moment, setMoment] = useState<'claim' | 'wrap' | null>(null);
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

  const money = (cents: number) => formatMoney(cents, deviceLocale(), groupCurrency(snapshot.group), true);
  const hidden = isHiddenFromViewer(person, snapshot.profile.uid);
  const locked = isPersonLocked(snapshot.group?.lockedPersonIds, person.id);
  const next = upcomingOccasion(person.id, snapshot.occasions, today);
  const occasionKey = next ? `${next.occasion.id}:${next.date.getFullYear()}` : 'general';
  const onDevice = snapshot.ideas.find(item => item.id === ideaCacheId(person.id, occasionKey, 'on-device') && !item.deleted);
  const cloud = snapshot.ideas.find(item => item.id === ideaCacheId(person.id, occasionKey, 'cloud') && !item.deleted);
  const visible = visibleGifts({
    personId: person.id,
    gifts: snapshot.gifts,
    privateGifts: snapshot.privateGifts ?? [],
    groupId: snapshot.group?.id ?? null,
  });
  const history = visible.filter(item => !mineOnly || isMyPurchase(item, snapshot.profile.uid));
  const showSpend = person.budgetCents != null
    || snapshot.gifts.some(item => item.personId === person.id && !item.deleted)
    || (snapshot.privateGifts ?? []).some(item => item.personId === person.id && !item.deleted);
  const ideas = onDevice?.ideas ?? [];
  const cloudList = cloud?.ideas ?? [];
  const shownIdeas = showAllIdeas ? ideas : ideas.slice(0, 3);
  const hiddenIdeaCount = Math.max(0, ideas.length - shownIdeas.length);
  const year = today.getFullYear();
  const spent = yearSpentCents(person.id, snapshot.gifts, year);
  const nextState = next
    ? snapshot.states.find(item => item.occasionId === next.occasion.id && item.year === occurrenceYear(next.occasion, today) && !item.deleted)
    : undefined;
  const uid = snapshot.profile.uid;
  const summaryInput = {
    hidden,
    locked,
    hasOccasion: Boolean(next),
    purchased: nextState?.status === 'purchased',
    claimedByMe: Boolean(nextState?.claimedBy && nextState.claimedBy === uid),
    claimedByOther: Boolean(nextState?.claimedBy && nextState.claimedBy !== uid),
    savedIdea: Boolean(nextState?.savedIdea),
  };
  const action = summaryPrimary(summaryInput);
  const primaryLabel = summaryPrimaryLabel(summaryInput) ?? '';
  const days = next ? daysUntil(next.date, today) : null;
  const occasions = snapshot.occasions.filter(item => item.personId === person.id && !item.deleted);
  const menuOccasion = menu?.kind === 'occasion' ? occasions.find(item => item.id === menu.id) : undefined;
  const budgetLabel = hidden
    ? ''
    : person.budgetCents == null
      ? t('people.spent', { used: money(spent) })
      : t('people.budgetLeft', { used: money(spent), budget: money(person.budgetCents) });
  const progress = hidden || person.budgetCents == null || person.budgetCents <= 0 ? null : spent / person.budgetCents;

  function savedFor(idea: string): boolean {
    return Boolean(next && nextState?.savedIdea === idea);
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

  function runPrimary() {
    if (action === 'add') {
      setSection('occasions');
      setAddingOccasion(true);
      return;
    }
    if (action === 'find') {
      setSection('ideas');
      return;
    }
    if (action === 'claim' && next) {
      claimOccasion(next.occasion.id).then(ok => {
        if (ok) {
          setMoment('claim');
        }
      }).catch(() => undefined);
      return;
    }
    if (action === 'log' && next) {
      openPurchase(next.occasion.id, nextState?.savedIdea ?? '');
    }
  }

  return (
    <Screen
      pinned={(
        <>
          {hidden ? <Body>{t('person.hiddenRecipient')}</Body> : null}
          {locked ? <Body>{t('person.readOnly')}</Body> : null}
          {person.imported ? <Caption>{t('person.openedImported')}</Caption> : null}
          <Card>
            <View style={styles.summaryName}>
              <View style={styles.avatarName}>
                <MonogramAvatar name={person.name} personId={person.id} />
                <View style={styles.personCopy}>
                  <Heading>{person.name}</Heading>
                  {person.relationship ? <Caption tone="text">{person.relationship}</Caption> : null}
                </View>
              </View>
              <IconButton label={t('person.editDetails')} name="more" filled onPress={() => setEditingDetails(true)} />
            </View>
            {next ? (
              <OccasionChip
                occasionId={next.occasion.type}
                label={occasionLabel(next.occasion)}
                trailing={days == null ? undefined : days === 0 ? t('people.today') : t('people.inDays', { count: days })}
              />
            ) : (
              <Caption>{t('people.noOccasion')}</Caption>
            )}
            {nextState?.claimedBy ? (
              <Caption tone="text">{t('person.claimedBy', { name: claimerName(nextState.claimedBy, snapshot.members) })}</Caption>
            ) : null}
            {budgetLabel ? <Caption tone="text">{budgetLabel}</Caption> : null}
            {hidden ? null : <ProgressBar value={progress} />}
            {(action === 'claim' || action === 'log') && nextState?.savedIdea ? (
              <Body>{t('person.savedIdeaLine', { idea: nextState.savedIdea })}</Body>
            ) : null}
            {action === 'logged' ? (
              <View style={styles.logged}>
                <Caption tone="text">{t('person.logged')}</Caption>
              </View>
            ) : null}
            {action && action !== 'logged' ? (
              <Button icon={action === 'find' ? 'gift' : undefined} label={primaryLabel} onPress={runPrimary} />
            ) : null}
            {moment ? (
              <Moment
                kind={moment}
                name={moment === 'wrap' ? 'purchase' : 'claim'}
                onDone={() => setMoment(null)}
              />
            ) : null}
          </Card>
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
          {!findingIdeas && ideas.length === 0 && cloudList.length === 0 ? <EmptyState kind="ideas" text={t('person.ideasEmpty')} /> : null}
          {shownIdeas.map(idea => (
            <IdeaRow
              key={idea}
              idea={idea}
              saved={savedFor(idea)}
              color={savedFor(idea) ? colors.pink : colors.text}
              onSave={() => onSaveIdea(idea)}
              onMenu={() => setMenu({ kind: 'idea', idea })}
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
              members={snapshot.members}
              state={snapshot.states.find(item => item.occasionId === occasion.id && item.year === occurrenceYear(occasion, today) && !item.deleted)}
              hidden={hidden}
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
          <Chip label={t('person.mineChip')} selected={mineOnly} onPress={() => setMineOnly(value => !value)} />
          {history.length === 0 ? <EmptyState kind="ideas" text={mineOnly ? t('person.historyMineEmpty') : t('person.historyEmpty')} /> : null}
          {history.map(item => {
            const buyerText = buyerLine(item.boughtBy, snapshot.profile.uid, snapshot.members);
            const editable = item.privateGift || canEditSharedGift(snapshot, item, snapshot.profile.uid);
            return (
              <Card key={item.id}>
                <View style={styles.ideaRow}>
                  <View style={styles.ideaCopy}>
                    <Body>{item.title}</Body>
                    <Caption tone="text">{`${money(item.priceCents)} · ${formatLongDate(new Date(item.purchasedOn))}`}</Caption>
                    {buyerText ? <Caption>{buyerText}</Caption> : null}
                    {item.privateGift ? <Caption>{t('person.privateGift')}</Caption> : null}
                  </View>
                  {editable && !locked ? (
                    <IconButton
                      label={t('person.giftMenu')}
                      name="more"
                      filled
                      onPress={() => setMenu({ kind: 'gift', id: item.id, privateGift: item.privateGift, title: item.title })}
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
        onClose={() => setTuning(false)}
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
        {cloudRemaining[person.id] != null ? <Body>{t('person.cloudLeft', { count: cloudRemaining[person.id] })}</Body> : null}
        <Button label={t('person.cloud')} tone="secondary" onPress={() => cloudIdeas(person.id)} />
        <Body>{t('person.cloudHint')}</Body>
        {cloudList.map(idea => (
          <IdeaRow
            key={`cloud-${idea}`}
            idea={idea}
            saved={savedFor(idea)}
            color={savedFor(idea) ? colors.pink : colors.text}
            onSave={() => onSaveIdea(idea)}
            onMenu={() => {
              queuedMenu.current = { kind: 'idea', idea };
              setTuning(false);
            }}
          />
        ))}
      </Sheet>
      <Sheet visible={addingOccasion} onClose={() => setAddingOccasion(false)}>
        <OccasionPicker personId={person.id} onAdded={() => setAddingOccasion(false)} />
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
        <Button
          label={t('person.save')}
          onPress={() => {
            const trimmed = name.trim();
            const nextNameError = trimmed ? '' : t('errors.name');
            const nextBudgetError = budget.trim() && parseBudget(budget) == null ? t('errors.price') : '';
            const cleaned = cleanRelationship(relationship);
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
            });
          }}
        />
        {snapshot.mergeJournal?.targetPersonId === person.id ? (
          <Button label={t('merge.undo')} accessibilityLabel={t('merge.undoLabel')} tone="secondary" onPress={() => undoMerge()} />
        ) : null}
        {peopleOnOtherLists(snapshot).length > 0 ? (
          <Button
            label={t('person.samePerson')}
            accessibilityLabel={t('person.samePersonLabel')}
            tone="secondary"
            onPress={() => {
              setEditingDetails(false);
              navigation.navigate('SamePerson', { personId: person.id });
            }}
          />
        ) : null}
        {snapshot.profile.uid === snapshot.group?.ownerId
          && (snapshot.members.some(member => !member.deleted && member.uid !== snapshot.profile.uid) || person.linkedUid) ? (
          <Card>
            <Heading>{t('person.linkTitle')}</Heading>
            <Body>{t('person.linkHint')}</Body>
            {snapshot.members.filter(member => !member.deleted && member.uid !== snapshot.profile.uid).map(member => (
              <Button
                key={member.uid}
                label={t('person.linkTo', { name: member.displayName })}
                accessibilityLabel={t('person.linkToLabel', { name: member.displayName })}
                tone="secondary"
                onPress={() => linkRecipient(person.id, member.uid)}
              />
            ))}
            {person.linkedUid ? (
              <Button label={t('person.unlink')} accessibilityLabel={t('person.unlinkLabel')} tone="secondary" onPress={() => linkRecipient(person.id, '')} />
            ) : null}
          </Card>
        ) : null}
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
            onClaimed={() => setMoment('claim')}
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
          occasionId={buying}
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
  members,
  state,
  hidden,
  onMenu,
}: {
  occasion: Occasion;
  today: Date;
  members: Parameters<typeof claimerName>[1];
  state: OccasionState | undefined;
  hidden: boolean;
  onMenu: () => void;
}) {
  const label = occasionLabel(occasion);
  const next = nextOccasionDate(occasion, today);
  const when = next
    ? (isOneTimeOccasion(occasion) ? formatLongDate(next) : formatDate(next))
    : `${occasion.month}/${occasion.day}`;
  const days = next ? daysUntil(next, today) : null;
  const trailing = days == null ? '' : days === 0 ? t('people.today') : t('people.inDays', { count: days });
  const status = hidden
    ? ''
    : state?.claimedBy
      ? t('person.claimedBy', { name: claimerName(state.claimedBy, members) })
      : t(state?.status === 'purchased' ? 'person.statusPurchased' : state?.status === 'idea-saved' ? 'person.statusIdea' : 'person.statusNotStarted');
  const row = (
    <Card>
      <View style={styles.occasionRow}>
        <ArtSlot name={occasionLook(occasion.type).art} size={40} />
        <View style={styles.ideaCopy}>
          <Body strong>{label}</Body>
          <Caption tone="text">{trailing ? `${when} · ${trailing}` : when}</Caption>
          {status ? <Caption>{status}</Caption> : null}
        </View>
        {hidden ? null : <IconButton label={t('person.occasionMenu')} name="more" filled onPress={onMenu} />}
      </View>
    </Card>
  );
  if (hidden) {
    return row;
  }
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
  onClaimed,
}: {
  occasion: Occasion;
  hidden: boolean;
  locked: boolean;
  onClose: () => void;
  onPurchase: (idea: string) => void;
  onClaimed: () => void;
}) {
  const { snapshot, updateOccasion, deleteOccasion, claimOccasion, unclaimOccasion } = useGifteez();
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
  const mine = Boolean(state?.claimedBy && state.claimedBy === snapshot.profile.uid);
  const canUnclaim = Boolean(state?.claimedBy && snapshot.profile.uid && (mine || snapshot.group?.ownerId === snapshot.profile.uid));
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
      {!hidden && !locked && !state?.claimedBy && status !== 'purchased' ? (
        <Button
          label={t('person.claim')}
          accessibilityLabel={t('person.claimLabel', { occasion: label })}
          tone="secondary"
          onPress={() => {
            claimOccasion(occasion.id).then(ok => {
              if (ok) {
                onClaimed();
              }
            }).catch(() => undefined);
            onClose();
          }}
        />
      ) : null}
      {canUnclaim ? (
        <Button
          label={t('person.unclaim')}
          accessibilityLabel={t('person.unclaimLabel', { occasion: label })}
          tone="secondary"
          onPress={() => {
            unclaimOccasion(occasion.id).catch(() => undefined);
            onClose();
          }}
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

function buyerLine(boughtBy: string | undefined, uid: string | null, members: Parameters<typeof buyerLabel>[2]): string {
  const buyer = buyerLabel(boughtBy, uid, members);
  if (buyer.kind === 'you') {
    return t('person.boughtByYou');
  }
  if (buyer.kind === 'name') {
    return t('person.boughtBy', { name: buyer.name });
  }
  return '';
}

function SpendBreakdown({ personId, budgetCents, money }: { personId: string; budgetCents: number | null; money: (cents: number) => string }) {
  const { snapshot } = useGifteez();
  const year = new Date().getFullYear();
  const sharedYear = yearSpentCents(personId, snapshot.gifts, year);
  const sharedAll = allTimeSpentCents(personId, snapshot.gifts);
  const privateYear = yearSpentCents(
    personId,
    (snapshot.privateGifts ?? []).filter(gift => gift.groupId === snapshot.group?.id).map(gift => ({
      ...gift,
      occasionId: gift.occasionId,
    })),
    year,
  );
  const privateAll = allTimeSpentCents(
    personId,
    (snapshot.privateGifts ?? []).filter(gift => gift.groupId === snapshot.group?.id).map(gift => ({ ...gift })),
  );
  const spend = spendByMember({
    personId,
    gifts: snapshot.gifts,
    privateGifts: snapshot.privateGifts ?? [],
    members: snapshot.members,
    selfUid: snapshot.profile.uid,
    year,
    groupId: snapshot.group?.id ?? null,
  });
  return (
    <Card>
      <Heading>{t('person.spendTitle')}</Heading>
      <Body>{t('person.yearTotal', { amount: money(sharedYear) })}</Body>
      <Body>{t('person.allTotal', { amount: money(sharedAll) })}</Body>
      {privateYear > 0 || privateAll > 0 ? <Caption>{t('person.privateSpend', { amount: money(privateYear) })}</Caption> : null}
      <Body>{budgetCents == null ? t('person.noBudget') : t('person.budgetLine', { amount: money(budgetCents) })}</Body>
      {spend.rows.map(row => (
        <Caption key={row.uid}>
          {`${row.self ? t('person.spendYou') : row.name} · ${t('person.spendYear', { amount: money(row.yearCents) })} · ${t('person.spendAll', { amount: money(row.allCents) })}`}
        </Caption>
      ))}
      {spend.unknownAllCents > 0 ? (
        <Caption>
          {`${t('person.spendUnknown')} · ${t('person.spendYear', { amount: money(spend.unknownYearCents) })} · ${t('person.spendAll', { amount: money(spend.unknownAllCents) })}`}
        </Caption>
      ) : null}
    </Card>
  );
}

function PurchaseWarning({ occasionId, date }: { occasionId: string; date: string }) {
  const { snapshot } = useGifteez();
  const occasion = snapshot.occasions.find(item => item.id === occasionId);
  if (!occasion) {
    return null;
  }
  const year = Number(date.slice(0, 4)) || occurrenceYear(occasion, new Date());
  const other = claimWarningUid({
    states: snapshot.states,
    occasion,
    purchaseYear: year,
    today: new Date(),
    uid: snapshot.profile.uid,
  });
  if (!other) {
    return null;
  }
  return <Caption>{t('purchase.claimedWarning', { name: claimerName(other, snapshot.members) })}</Caption>;
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

function IdeaRow({
  idea,
  saved,
  color,
  onSave,
  onMenu,
}: {
  idea: string;
  saved: boolean;
  color: string;
  onSave: () => void | Promise<unknown> | undefined;
  onMenu: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={idea}
      accessibilityHint={t('person.ideaMenuHint')}
      accessibilityActions={[{ name: 'open-menu', label: t('person.ideaMenu') }]}
      onAccessibilityAction={event => {
        if (event.nativeEvent.actionName === 'activate' || event.nativeEvent.actionName === 'open-menu') {
          onMenu();
        }
      }}
      onPress={onMenu}>
      <Card>
        <View style={styles.ideaRow}>
          <View style={styles.ideaCopy}>
            <Body>{idea}</Body>
          </View>
          <HeartPop saved={saved}>
            <IconButton
              label={saved ? t('person.unsaveIdea') : t('person.saveIdea')}
              name="heart"
              color={color}
              filled={saved}
              size={28}
              onPress={() => { onSave(); }}
            />
          </HeartPop>
        </View>
      </Card>
    </Pressable>
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
  occasionId,
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
  occasionId?: string;
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
      {occasionId ? <PurchaseWarning occasionId={occasionId} date={date} /> : null}
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

const styles = StyleSheet.create({
  summaryName: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.xs },
  avatarName: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flex: 1 },
  personCopy: { flex: 1, gap: 2 },
  ideaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  ideaCopy: { flex: 1 },
  occasionRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  logged: { alignSelf: 'flex-start' },
});
