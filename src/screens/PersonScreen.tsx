import React, { useEffect, useLayoutEffect, useState } from 'react';
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
import type { Occasion } from '../domain/types';
import { deviceLocale, formatDate, formatLongDate, formatMoney, t, todayIso } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { occasionLook } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { DateField } from '../ui/DateField';
import { OccasionPicker } from '../ui/OccasionPicker';
import { ArtRow, ArtSlot, Body, Button, Caption, Card, Chip, Cluster, confirmDestructive, EmptyState, Field, HeaderTextButton, Heading, IconButton, OccasionChip, Screen, Segment, Sheet, Title, Toggle } from '../ui/ui';

export function AddPersonScreen() {
  const navigation = useNavigation();
  const { addPerson } = useGifteez();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
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
      <Button
        label={t('firstOpen.start')}
        onPress={async () => {
          if (!name.trim()) {
            setNameError(t('errors.name'));
            return;
          }
          const id = await addPerson({ name, budget: '', tags: [] });
          if (id) {
            (navigation as { navigate: (name: string, params: { personId: string }) => void }).navigate('Person', { personId: id });
          }
        }}
      />
    </Screen>
  );
}

export function PersonScreen() {
  const route = useRoute<RouteProp<RootStack, 'Person'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const { snapshot, focusPerson, savePerson, removePerson, saveIdeaFor, logGift, vote, refreshIdeas, cloudIdeas, cloudRemaining, updateGift, deleteGift, linkRecipient, undoMerge } = useGifteez();
  const person = snapshot.people.find(item => item.id === route.params.personId && !item.deleted);
  const [budget, setBudget] = useState(person?.budgetCents == null ? '' : String(person.budgetCents / 100));
  const [name, setName] = useState(person?.name ?? '');
  const [gift, setGift] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(todayIso());
  const [buying, setBuying] = useState<string | null>(null);
  const [mineOnly, setMineOnly] = useState(false);
  const [editingGift, setEditingGift] = useState<{ id: string; privateGift: boolean } | null>(null);
  const [findingIdeas, setFindingIdeas] = useState(true);
  const [ideaNote, setIdeaNote] = useState('');
  const [interestTags, setInterestTags] = useState<string[]>(person?.tags ?? []);
  const [nameError, setNameError] = useState('');
  const [budgetError, setBudgetError] = useState('');
  const [giftError, setGiftError] = useState('');
  const [priceError, setPriceError] = useState('');
  const [dateError, setDateError] = useState('');
  const [section, setSection] = useState<'ideas' | 'occasions' | 'history'>('ideas');
  const [editingDetails, setEditingDetails] = useState(false);
  const [addingOccasion, setAddingOccasion] = useState(false);
  const [savedNote, setSavedNote] = useState('');

  useEffect(() => {
    setInterestTags(person?.tags ?? []);
  }, [person?.id, person?.tags]);

  useEffect(() => {
    let cancelled = false;
    setFindingIdeas(true);
    setIdeaNote('');
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
    if (person?.name) {
      navigation.setOptions({
        title: person.name,
        headerRight: () => (
          <HeaderTextButton label={t('person.editDetails')} onPress={() => setEditingDetails(true)} />
        ),
      });
    }
  }, [navigation, person?.name]);

  if (!person) {
    return (
      <Screen>
        <ArtSlot name="error" size={160} />
        <Body>{t('errors.generic')}</Body>
        <Button label={t('common.back')} onPress={() => navigation.goBack()} />
      </Screen>
    );
  }
  const money = (cents: number) => formatMoney(cents, deviceLocale(), groupCurrency(snapshot.group));
  const hidden = isHiddenFromViewer(person, snapshot.profile.uid);
  const locked = isPersonLocked(snapshot.group?.lockedPersonIds, person.id);
  const next = upcomingOccasion(person.id, snapshot.occasions, new Date());
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
  return (
    <Screen>
      {hidden ? <Body>{t('person.hiddenRecipient')}</Body> : null}
      {locked ? <Body>{t('person.readOnly')}</Body> : null}
      {snapshot.mergeJournal?.targetPersonId === person.id ? (
        <Button label={t('merge.undo')} accessibilityLabel={t('merge.undoLabel')} tone="secondary" onPress={() => undoMerge()} />
      ) : null}
      {person.imported ? <Body>{t('person.openedImported')}</Body> : null}
      <Segment
        value={section}
        onChange={id => setSection(id as 'ideas' | 'occasions' | 'history')}
        options={[
          { id: 'ideas', label: t('person.ideas') },
          { id: 'occasions', label: t('person.occasions') },
          { id: 'history', label: t('person.history') },
        ]}
      />
      {section !== 'ideas' || hidden || locked ? null : <Heading>{t('person.ideas')}</Heading>}
      {section !== 'ideas' || hidden || locked ? null : <Body>{t('person.ideasHint')}</Body>}
      {section !== 'ideas' || hidden || locked || !findingIdeas || ideas.length > 0 ? null : <Body>{t('person.ideasLoading')}</Body>}
      {section !== 'ideas' || hidden || locked || findingIdeas || ideas.length > 0 || (cloud?.ideas ?? []).length > 0 ? null : (
        <EmptyState kind="ideas" text={t('person.ideasEmpty')} />
      )}
      {ideaNote ? <Body>{ideaNote}</Body> : null}
      {section !== 'ideas' || hidden || locked ? null : ideas.map(idea => (
        <IdeaRow
          key={idea}
          idea={idea}
          onUp={() => vote(person.id, idea, 'up')}
          onDown={() => vote(person.id, idea, 'down')}
          saved={Boolean(next?.occasion && snapshot.states.some(item => item.occasionId === next.occasion.id && !item.deleted && item.savedIdea === idea))}
          onSave={() => {
            if (!next) {
              setIdeaNote(t('person.saveIdeaNeedsDate'));
              return;
            }
            setIdeaNote('');
            return saveIdeaFor(next.occasion.id, idea).then(() => setIdeaNote(t('person.ideaKept')));
          }}
        />
      ))}
      {section !== 'ideas' || hidden || locked ? null : <Body>{t('person.tagsHint')}</Body>}
      {section !== 'ideas' || hidden || locked ? null : (
        <TagPicker
          tags={interestTags}
          onChange={tags => {
            setInterestTags(tags);
            setIdeaNote('');
            return savePerson(person.id, { tags }).then(() => refreshIdeas(person.id));
          }}
        />
      )}
      {section !== 'ideas' || hidden || locked ? null : <Button label={t('person.refresh')} tone="secondary" onPress={() => refreshIdeas(person.id)} />}
      {section === 'ideas' && !hidden && !locked && cloudRemaining[person.id] != null ? <Body>{t('person.cloudLeft', { count: cloudRemaining[person.id] })}</Body> : null}
      {section !== 'ideas' || hidden || locked ? null : <Button label={t('person.cloud')} tone="secondary" onPress={() => cloudIdeas(person.id)} />}
      {section !== 'ideas' || hidden || locked ? null : <Body>{t('person.cloudHint')}</Body>}
      {section !== 'ideas' || hidden || locked ? null : (cloud?.ideas ?? []).map(idea => (
        <IdeaRow
          key={`cloud-${idea}`}
          idea={idea}
          saved={Boolean(next?.occasion && snapshot.states.some(item => item.occasionId === next.occasion.id && !item.deleted && item.savedIdea === idea))}
          onUp={() => vote(person.id, idea, 'up')}
          onDown={() => vote(person.id, idea, 'down')}
          onSave={() => {
            if (!next) {
              setIdeaNote(t('person.saveIdeaNeedsDate'));
              return;
            }
            setIdeaNote('');
            return saveIdeaFor(next.occasion.id, idea).then(() => setIdeaNote(t('person.ideaKept')));
          }}
        />
      ))}
      {section === 'ideas' && peopleOnOtherLists(snapshot).length > 0 ? (
        <Button
          label={t('person.samePerson')}
          accessibilityLabel={t('person.samePersonLabel')}
          tone="secondary"
          onPress={() => navigation.navigate('SamePerson', { personId: person.id })}
        />
      ) : null}
      {section !== 'occasions' ? null : <Heading>{t('person.occasions')}</Heading>}
      {section !== 'occasions' || snapshot.occasions.some(item => item.personId === person.id && !item.deleted) ? null : (
        <EmptyState kind="occasions" text={t('person.occasionsEmpty')} />
      )}
      {section !== 'occasions' ? null : snapshot.occasions.filter(item => item.personId === person.id && !item.deleted).map(occasion => (
        <OccasionCard
          key={occasion.id}
          occasion={occasion}
          hidden={hidden}
          locked={locked}
          onPurchase={idea => {
            setBuying(occasion.id);
            setGift(idea);
            setPrice('');
            setDate(todayIso());
            setGiftError('');
            setPriceError('');
            setDateError('');
            setEditingGift(null);
          }}
        />
      ))}
      {section !== 'occasions' || locked ? null : (
        <Button label={t('person.addOccasion')} onPress={() => setAddingOccasion(true)} />
      )}
      {section !== 'occasions' ? null : <ReminderOffer />}
      <Sheet visible={addingOccasion} onClose={() => setAddingOccasion(false)}>
        <OccasionPicker personId={person.id} />
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
      <Button
        label={t('person.save')}
        onPress={() => {
          const trimmed = name.trim();
          const nextNameError = trimmed ? '' : t('errors.name');
          const nextBudgetError = budget.trim() && parseBudget(budget) == null ? t('errors.price') : '';
          setNameError(nextNameError);
          setBudgetError(nextBudgetError);
          if (nextNameError || nextBudgetError) {
            return;
          }
          setSavedNote(t('person.saved'));
          setEditingDetails(false);
          return savePerson(person.id, {
            name: trimmed,
            budgetCents: budget.trim() ? parseBudget(budget) : null,
            tags: interestTags,
          });
        }}
      />
      {savedNote ? <Body>{savedNote}</Body> : null}
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
      {section !== 'history' || hidden || !showSpend ? null : <SpendBreakdown personId={person.id} budgetCents={person.budgetCents} money={money} />}
      {section !== 'history' || hidden ? null : <Heading>{t('person.history')}</Heading>}
      {section !== 'history' || hidden ? null : (
        <Toggle
          label={t('person.myPurchasesLabel')}
          value={mineOnly}
          onValueChange={setMineOnly}
        />
      )}
      {section !== 'history' || hidden || history.length > 0 ? null : (
        <EmptyState kind="ideas" text={mineOnly ? t('person.historyMineEmpty') : t('person.historyEmpty')} />
      )}
      {section !== 'history' || hidden ? null : history.map(item => {
        const buyerText = buyerLine(item.boughtBy, snapshot.profile.uid, snapshot.members);
        const editable = item.privateGift || canEditSharedGift(snapshot, item, snapshot.profile.uid);
        return (
          <Card key={item.id}>
            <Body>
              {`${item.title} · ${money(item.priceCents)} · ${formatLongDate(new Date(item.purchasedOn))}${buyerText ? `\n${buyerText}` : ''}${item.privateGift ? `\n${t('person.privateGift')}` : ''}`}
            </Body>
            {editable && !locked ? (
              <Button
                label={t('person.editGift')}
                accessibilityLabel={t('person.editGiftLabel', { title: item.title })}
                tone="secondary"
                onPress={() => {
                  setEditingGift({ id: item.id, privateGift: item.privateGift });
                  setGift(item.title);
                  setPrice(String(item.priceCents / 100));
                  setDate(item.purchasedOn);
                  setGiftError('');
                  setPriceError('');
                  setDateError('');
                  setBuying(null);
                }}
              />
            ) : null}
            {editable && !locked ? (
              <Button
                label={t('person.deleteGift')}
                accessibilityLabel={t('person.deleteGiftLabel', { title: item.title })}
                tone="danger-quiet"
                onPress={async () => {
                  const ok = await confirmDestructive(
                    t('person.deleteGiftConfirm'),
                    t('person.deleteGiftBody'),
                    t('person.deleteGift'),
                  );
                  if (ok) {
                    await deleteGift(item.id, item.privateGift);
                  }
                }}
              />
            ) : null}
          </Card>
        );
      })}
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

function OccasionCard({
  occasion,
  hidden,
  locked,
  onPurchase,
}: {
  occasion: Occasion;
  hidden: boolean;
  locked: boolean;
  onPurchase: (idea: string) => void;
}) {
  const { snapshot, updateOccasion, deleteOccasion, claimOccasion, unclaimOccasion } = useGifteez();
  const [editing, setEditing] = useState(false);
  const [month, setMonth] = useState(occasion.month ? String(occasion.month) : '');
  const [day, setDay] = useState(occasion.day ? String(occasion.day) : '');
  const [year, setYear] = useState(occasion.year ? String(occasion.year) : '');
  const [dateError, setDateError] = useState('');
  const label = occasionLabel(occasion);
  const today = new Date();
  const next = nextOccasionDate(occasion, today);
  const when = next
    ? (isOneTimeOccasion(occasion) ? formatLongDate(next) : formatDate(next))
    : occasion.year
      ? formatLongDate(new Date(occasion.year, occasion.month - 1, occasion.day))
      : `${occasion.month}/${occasion.day}`;
  const status = statusFor(occasion, snapshot.states, today);
  const state = snapshot.states.find(item => item.occasionId === occasion.id && item.year === occurrenceYear(occasion, today) && !item.deleted);
  const estimated = dateIsEstimated(occasion, (next ?? today).getFullYear());
  const canEdit = occasionNeedsDate(occasion.type) || estimated;
  const note = presetFor(occasion.type)?.note;
  const days = next ? daysUntil(next, today) : null;
  const iso = isRealMonthDay(Number(month), Number(day))
    ? `${year.trim() || '2000'}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    : '';
  return (
    <Card>
      <ArtRow art={occasionLook(occasion.type).art}>
        <OccasionChip
          occasionId={occasion.type}
          label={label}
          trailing={days == null ? undefined : days === 0 ? t('people.today') : t('people.inDays', { count: days })}
        />
        <Body strong>{when}</Body>
      </ArtRow>
      {note ? <Caption>{t(note)}</Caption> : null}
      {estimated ? <Caption>{t('person.dateEstimated')}</Caption> : null}
      {hidden ? null : <Caption tone="text">{t(status === 'idea-saved' ? 'person.statusIdea' : status === 'purchased' ? 'person.statusPurchased' : 'person.statusNotStarted')}</Caption>}
      {!hidden && state?.savedIdea ? <Body>{state.savedIdea}</Body> : null}
      {!hidden && !locked && canEdit && editing ? (
        <>
          <DateField
            label={t('person.date')}
            value={iso}
            hideYear={!year.trim()}
            error={dateError}
            onChange={nextIso => {
              const [yearText, monthText, dayText] = nextIso.split('-');
              setMonth(String(Number(monthText)));
              setDay(String(Number(dayText)));
              if (year.trim()) {
                setYear(yearText ?? '');
              }
              setDateError('');
            }}
          />
          <Field
            label={t('person.year')}
            value={year}
            invalid={Boolean(dateError)}
            onChangeText={value => {
              setYear(value);
              setDateError('');
            }}
            keyboardType="number-pad"
          />
          <Button
            label={t('person.updateOccasion')}
            accessibilityLabel={t('person.updateOccasionLabel', { occasion: label })}
            onPress={() => {
              const monthNum = Number(month);
              const dayNum = Number(day);
              if (!isRealMonthDay(monthNum, dayNum)) {
                setDateError(t('errors.date'));
                return;
              }
              const yearNum = Number(year);
              updateOccasion(occasion.id, monthNum, dayNum, yearNum > 0 ? yearNum : undefined);
              setEditing(false);
            }}
          />
          <Button label={t('person.cancelUpdate')} tone="secondary" onPress={() => { setEditing(false); setDateError(''); }} />
        </>
      ) : null}
      {!hidden && !locked && canEdit && !editing ? (
        <Button
          label={t('person.updateOccasion')}
          accessibilityLabel={t('person.updateOccasionLabel', { occasion: label })}
          tone="secondary"
          onPress={() => setEditing(true)}
        />
      ) : null}
      {hidden || locked ? null : state?.claimedBy ? (
        <Body accessibilityLabel={t('person.claimedBy', { name: claimerName(state.claimedBy, snapshot.members) })}>
          {t('person.claimedBy', { name: claimerName(state.claimedBy, snapshot.members) })}
        </Body>
      ) : null}
      {!hidden && !locked && state?.claimedBy && snapshot.profile.uid && (state.claimedBy === snapshot.profile.uid || snapshot.group?.ownerId === snapshot.profile.uid) ? (
        <Button
          label={t('person.unclaim')}
          accessibilityLabel={t('person.unclaimLabel', { occasion: label })}
          tone="secondary"
          onPress={() => unclaimOccasion(occasion.id)}
        />
      ) : null}
      {!hidden && !locked && !state?.claimedBy ? (
        <Button
          label={t('person.claim')}
          accessibilityLabel={t('person.claimLabel', { occasion: label })}
          tone="secondary"
          onPress={() => claimOccasion(occasion.id)}
        />
      ) : null}
      {hidden || locked ? null : (
        <Button label={t('person.purchase')} onPress={() => onPurchase(state?.savedIdea ?? '')} />
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
              await deleteOccasion(occasion.id);
            }
          }}
        />
      ) : null}
    </Card>
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
      <Title accessibilityLabel={t('person.spendTitle')}>{t('person.spendTitle')}</Title>
      <Body>{t('person.yearTotal', { amount: money(sharedYear) })}</Body>
      <Body>{t('person.allTotal', { amount: money(sharedAll) })}</Body>
      {privateYear > 0 || privateAll > 0 ? <Caption>{t('person.privateSpend', { amount: money(privateYear) })}</Caption> : null}
      <Body>
        {budgetCents == null ? t('person.noBudget') : t('person.budgetLine', { amount: money(budgetCents) })}
      </Body>
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
  const message = t('purchase.claimedWarning', { name: claimerName(other, snapshot.members) });
  return <Caption>{message}</Caption>;
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
      <Heading>{t('person.remindTitle')}</Heading>
      <Body>{t('person.remindBody')}</Body>
      <Button label={t('person.remindYes')} onPress={() => setReminders(true)} />
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
  onUp,
  onDown,
  onSave,
}: {
  idea: string;
  saved?: boolean;
  onUp: () => void;
  onDown: () => void;
  onSave: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Card>
      <Body>{idea}</Body>
      <Cluster>
        <Button label={t('person.thumbsUp')} tone="secondary" onPress={onUp} />
        <Button label={t('person.thumbsDown')} tone="secondary" onPress={onDown} />
        <IconButton
          label={saved ? t('person.savedMark') : t('person.saveIdea')}
          name="heart"
          color={saved ? colors.pink : colors.text}
          filled={Boolean(saved)}
          onPress={onSave}
        />
      </Cluster>
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
      <Button label={t('common.cancel')} tone="secondary" onPress={onClose} />
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
