import React, { useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStack } from '../app/navigation';
import { INTEREST_TAGS } from '../domain/catalog';
import { buyerLabel, claimerName, claimWarningUid, isMyPurchase, spendByMember, visibleGifts } from '../domain/claims';
import { ideaCacheId } from '../domain/ideas';
import { canEditSharedGift } from '../domain/edits';
import { allTimeSpentCents, groupCurrency, isRealMonthDay, occurrenceYear, parseBudget, statusFor, upcomingOccasion, yearSpentCents } from '../domain/logic';
import { dateIsEstimated, isOneTimeOccasion, nextOccasionDate, occasionLabel, occasionNeedsDate, presetFor } from '../domain/occasions';
import { isHiddenFromViewer, isPersonLocked } from '../domain/visibility';
import { peopleOnOtherLists } from '../domain/merge';
import type { Occasion } from '../domain/types';
import { deviceLocale, formatDate, formatLongDate, formatMoney, t, todayIso } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { OccasionPicker } from '../ui/OccasionPicker';
import { Body, Button, Card, Field, Heading, Screen, Title } from '../ui/ui';

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
  const { snapshot, colors, focusPerson, savePerson, removePerson, saveIdeaFor, logGift, vote, refreshIdeas, cloudIdeas, cloudRemaining, updateGift, deleteGift, linkRecipient, undoMerge } = useGifteez();
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
      navigation.setOptions({ title: person.name });
    }
  }, [navigation, person?.name]);

  if (!person) {
    return (
      <Screen>
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
      {hidden || locked ? null : <Heading>{t('person.ideas')}</Heading>}
      {hidden || locked ? null : <Body>{t('person.ideasHint')}</Body>}
      {hidden || locked || !findingIdeas || ideas.length > 0 ? null : (
        <ActivityIndicator accessibilityLabel={t('person.ideasLoading')} color={colors.accent} />
      )}
      {hidden || locked || !findingIdeas || ideas.length > 0 ? null : <Body>{t('person.ideasLoading')}</Body>}
      {ideaNote ? <Body>{ideaNote}</Body> : null}
      {hidden || locked ? null : ideas.map(idea => (
        <IdeaRow
          key={idea}
          idea={idea}
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
      {hidden || locked ? null : <Body>{t('person.tagsHint')}</Body>}
      {hidden || locked ? null : (
        <TagPicker
          tags={interestTags}
          onChange={tags => {
            setInterestTags(tags);
            setIdeaNote('');
            return savePerson(person.id, { tags }).then(() => refreshIdeas(person.id));
          }}
        />
      )}
      {hidden || locked ? null : <Button label={t('person.refresh')} tone="secondary" onPress={() => refreshIdeas(person.id)} />}
      {hidden || locked ? null : <Body>{t('person.cloudHint')}</Body>}
      {!hidden && !locked && cloudRemaining[person.id] != null ? <Body>{t('person.cloudLeft', { count: cloudRemaining[person.id] })}</Body> : null}
      {hidden || locked ? null : <Button label={t('person.cloud')} tone="secondary" onPress={() => cloudIdeas(person.id)} />}
      {hidden || locked ? null : (cloud?.ideas ?? []).map(idea => (
        <IdeaRow
          key={`cloud-${idea}`}
          idea={idea}
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
      {peopleOnOtherLists(snapshot).length > 0 ? (
        <Button
          label={t('person.samePerson')}
          accessibilityLabel={t('person.samePersonLabel')}
          tone="secondary"
          onPress={() => navigation.navigate('SamePerson', { personId: person.id })}
        />
      ) : null}
      <Heading>{t('person.occasions')}</Heading>
      {snapshot.occasions.filter(item => item.personId === person.id && !item.deleted).map(occasion => (
        <OccasionCard
          key={occasion.id}
          occasion={occasion}
          hidden={hidden}
          locked={locked}
          onPurchase={idea => {
            setBuying(occasion.id);
            setGift(idea);
            setEditingGift(null);
          }}
        />
      ))}
      {locked ? null : <OccasionPicker personId={person.id} />}
      <ReminderOffer />
      <Heading>{t('person.details')}</Heading>
      <Field label={t('person.name')} value={name} onChangeText={setName} />
      <Field label={t('person.budget')} value={budget} onChangeText={setBudget} keyboardType="decimal-pad" />
      <Button
        label={t('person.save')}
        onPress={() => savePerson(person.id, { name: name.trim() || person.name, budgetCents: budget.trim() ? parseBudget(budget) : null, tags: interestTags })}
      />
      {hidden || !showSpend ? null : <SpendBreakdown personId={person.id} budgetCents={person.budgetCents} money={money} />}
      {hidden ? null : <Heading>{t('person.history')}</Heading>}
      {hidden ? null : (
        <Button
          label={mineOnly ? t('person.allPurchases') : t('person.myPurchases')}
          accessibilityLabel={mineOnly ? t('person.allPurchasesLabel') : t('person.myPurchasesLabel')}
          tone="secondary"
          onPress={() => setMineOnly(value => !value)}
        />
      )}
      {hidden || history.length === 0 ? (hidden ? null : <Body>{mineOnly ? t('person.historyMineEmpty') : t('person.historyEmpty')}</Body>) : null}
      {hidden ? null : history.map(item => {
        const buyerText = buyerLine(item.boughtBy, snapshot.profile.uid, snapshot.members);
        const editable = item.privateGift || canEditSharedGift(snapshot, item, snapshot.profile.uid);
        return (
          <Card key={item.id}>
            <Text style={{ color: colors.text }}>
              {item.title} · {money(item.priceCents)} · {formatLongDate(new Date(item.purchasedOn))}
              {buyerText ? `\n${buyerText}` : ''}
              {item.privateGift ? `\n${t('person.privateGift')}` : ''}
            </Text>
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
                  setBuying(null);
                }}
              />
            ) : null}
            {editable && !locked ? (
              <Button
                label={t('person.deleteGift')}
                accessibilityLabel={t('person.deleteGiftLabel', { title: item.title })}
                tone="danger"
                onPress={() => deleteGift(item.id, item.privateGift)}
              />
            ) : null}
          </Card>
        );
      })}
      {snapshot.profile.uid === snapshot.group?.ownerId ? (
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
            <Button label={t('person.unlink')} accessibilityLabel={t('person.unlinkLabel')} onPress={() => linkRecipient(person.id, '')} />
          ) : null}
        </Card>
      ) : null}
      {!hidden && !locked && buying ? (
        <Card>
          <Heading>{t('purchase.title')}</Heading>
          <PurchaseWarning occasionId={buying} date={date} />
          <Field label={t('purchase.gift')} value={gift} onChangeText={setGift} />
          <Field label={t('purchase.price')} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
          <Field label={t('purchase.date')} value={date} onChangeText={setDate} />
          <Button label={t('purchase.save')} onPress={() => { logGift(buying, gift, price, date); setBuying(null); }} />
        </Card>
      ) : null}
      {editingGift ? (
        <Card>
          <Heading>{t('person.editGift')}</Heading>
          <Field label={t('purchase.gift')} value={gift} onChangeText={setGift} />
          <Field label={t('purchase.price')} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
          <Field label={t('purchase.date')} value={date} onChangeText={setDate} />
          <Button
            label={t('person.save')}
            accessibilityLabel={t('person.editGiftLabel', { title: gift || t('person.editGift') })}
            onPress={() => { updateGift(editingGift.id, gift, price, date, editingGift.privateGift); setEditingGift(null); }}
          />
        </Card>
      ) : null}
      <Button label={t('person.delete')} tone="danger" onPress={() => removePerson(person.id)} />
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
  const { snapshot, colors, updateOccasion, deleteOccasion, claimOccasion, unclaimOccasion } = useGifteez();
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
  return (
    <Card>
      <Text style={[styles.name, { color: colors.text }]}>{label} · {when}</Text>
      {note ? <Text style={{ color: colors.muted }}>{note}</Text> : null}
      {estimated ? <Text style={{ color: colors.muted }}>{t('person.dateEstimated')}</Text> : null}
      {hidden ? null : <Text style={{ color: colors.accent }}>{t(status === 'idea-saved' ? 'person.statusIdea' : status === 'purchased' ? 'person.statusPurchased' : 'person.statusNotStarted')}</Text>}
      {!hidden && state?.savedIdea ? <Text style={{ color: colors.text }}>{state.savedIdea}</Text> : null}
      {!hidden && !locked && canEdit && editing ? (
        <>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Field
                label={t('person.month')}
                value={month}
                error={dateError}
                onChangeText={value => {
                  setMonth(value);
                  setDateError('');
                }}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.flex}>
              <Field label={t('person.day')} value={day} onChangeText={setDay} keyboardType="number-pad" />
            </View>
          </View>
          <Field label={t('person.year')} value={year} onChangeText={setYear} keyboardType="number-pad" />
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
      {!hidden && !locked ? (
        <Button
          label={t('person.deleteOccasion')}
          accessibilityLabel={t('person.deleteOccasionLabel', { occasion: label })}
          tone="danger"
          onPress={() => deleteOccasion(occasion.id)}
        />
      ) : null}
      {hidden || locked ? null : state?.claimedBy ? (
        <Text accessibilityLabel={t('person.claimedBy', { name: claimerName(state.claimedBy, snapshot.members) })} style={{ color: colors.text }}>
          {t('person.claimedBy', { name: claimerName(state.claimedBy, snapshot.members) })}
        </Text>
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
        <Button label={t('person.purchase')} tone="secondary" onPress={() => onPurchase(state?.savedIdea ?? '')} />
      )}
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
  const { snapshot, colors } = useGifteez();
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
      <Text style={{ color: colors.text }}>{t('person.yearTotal', { amount: money(sharedYear) })}</Text>
      <Text style={{ color: colors.text }}>{t('person.allTotal', { amount: money(sharedAll) })}</Text>
      {privateYear > 0 || privateAll > 0 ? <Text style={{ color: colors.muted }}>{t('person.privateSpend', { amount: money(privateYear) })}</Text> : null}
      <Text style={{ color: colors.text }}>
        {budgetCents == null ? t('person.noBudget') : t('person.budgetLine', { amount: money(budgetCents) })}
      </Text>
      {spend.rows.map(row => (
        <Text key={row.uid} style={{ color: colors.muted }}>
          {row.self ? t('person.spendYou') : row.name} · {t('person.spendYear', { amount: money(row.yearCents) })} · {t('person.spendAll', { amount: money(row.allCents) })}
        </Text>
      ))}
      {spend.unknownAllCents > 0 ? (
        <Text style={{ color: colors.muted }}>
          {t('person.spendUnknown')} · {t('person.spendYear', { amount: money(spend.unknownYearCents) })} · {t('person.spendAll', { amount: money(spend.unknownAllCents) })}
        </Text>
      ) : null}
    </Card>
  );
}

function PurchaseWarning({ occasionId, date }: { occasionId: string; date: string }) {
  const { snapshot, colors } = useGifteez();
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
  return <Text accessibilityLabel={message} style={{ color: colors.muted }}>{message}</Text>;
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
  const { colors } = useGifteez();
  return (
    <View style={styles.tags}>
      {INTEREST_TAGS.map(tag => {
        const selected = tags.includes(tag);
        return (
          <Pressable
            key={tag}
            accessibilityRole="button"
            accessibilityLabel={tag}
            accessibilityState={{ selected }}
            onPress={() => onChange(selected ? tags.filter(item => item !== tag) : [...tags, tag])}
            style={({ pressed }) => [
              styles.tag,
              { borderColor: colors.border, backgroundColor: selected ? colors.accent : colors.surface, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Text style={{ color: selected ? colors.accentText : colors.text }}>{tag}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function IdeaRow({ idea, onUp, onDown, onSave }: { idea: string; onUp: () => void; onDown: () => void; onSave: () => void }) {
  const { colors } = useGifteez();
  return (
    <Card>
      <Text style={[styles.name, { color: colors.text }]}>{idea}</Text>
      <View style={styles.row}>
        <Button label={t('person.thumbsUp')} tone="secondary" onPress={onUp} />
        <Button label={t('person.thumbsDown')} tone="secondary" onPress={onDown} />
        <Button label={t('person.saveIdea')} onPress={onSave} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flex: { flexGrow: 1, flexBasis: 120 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, flexShrink: 1 },
});
