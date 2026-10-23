import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStack } from '../app/navigation';
import { INTEREST_TAGS } from '../domain/catalog';
import { buyerLabel, claimerName, claimWarningUid, isMyPurchase, spendByMember, visibleGifts } from '../domain/claims';
import { ideaCacheId } from '../domain/ideas';
import { allTimeSpentCents, occurrenceYear, parseBudget, statusFor, upcomingOccasion, yearSpentCents } from '../domain/logic';
import { peopleOnOtherLists } from '../domain/merge';
import { formatLongDate, formatMoney, t, todayIso } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { Body, Button, Card, Field, Screen, Title } from '../ui/ui';
import type { OccasionType } from '../domain/types';

export function AddPersonScreen() {
  const navigation = useNavigation();
  const { addPerson } = useGifteez();
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  return (
    <Screen>
      <Title>{t('person.addTitle')}</Title>
      <Field label={t('person.name')} value={name} onChangeText={setName} />
      <Field label={t('person.budget')} value={budget} onChangeText={setBudget} keyboardType="decimal-pad" />
      <TagPicker tags={tags} onChange={setTags} />
      <Button
        label={t('person.save')}
        onPress={async () => {
          const id = await addPerson({ name, budget, tags });
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
  const { snapshot, colors, focusPerson, savePerson, removePerson, addOccasion, saveIdeaFor, logGift, vote, refreshIdeas, cloudIdeas, cloudRemaining, claimOccasion, unclaimOccasion } = useGifteez();
  const person = snapshot.people.find(item => item.id === route.params.personId && !item.deleted);
  const [budget, setBudget] = useState(person?.budgetCents == null ? '' : String(person.budgetCents / 100));
  const [name, setName] = useState(person?.name ?? '');
  const [type, setType] = useState<OccasionType>('birthday');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const [gift, setGift] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(todayIso());
  const [buying, setBuying] = useState<string | null>(null);
  const [mineOnly, setMineOnly] = useState(false);

  useEffect(() => {
    if (person) {
      focusPerson(person.id).catch(() => undefined);
    }
    // Focus once when the screen opens. Later edits should not regenerate ideas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params.personId]);

  if (!person) {
    return (
      <Screen>
        <Body>{t('errors.generic')}</Body>
      </Screen>
    );
  }
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
  return (
    <Screen>
      <Title>{person.name}</Title>
      {person.imported ? <Body>{t('person.openedImported')}</Body> : null}
      <Field label={t('person.name')} value={name} onChangeText={setName} />
      <Field label={t('person.budget')} value={budget} onChangeText={setBudget} keyboardType="decimal-pad" />
      <Button
        label={t('person.save')}
        onPress={() => savePerson(person.id, { name: name.trim() || person.name, budgetCents: budget.trim() ? parseBudget(budget) : null, tags: person.tags })}
      />
      <SpendBreakdown personId={person.id} budgetCents={person.budgetCents} />
      {peopleOnOtherLists(snapshot).length > 0 ? (
        <Button
          label={t('person.samePerson')}
          accessibilityLabel={t('person.samePersonLabel')}
          tone="secondary"
          onPress={() => navigation.navigate('SamePerson', { personId: person.id })}
        />
      ) : null}
      <Body>{t('person.tagsHint')}</Body>
      <TagPicker tags={person.tags} onChange={tags => savePerson(person.id, { tags })} />
      <Title>{t('person.occasions')}</Title>
      {snapshot.occasions.filter(item => item.personId === person.id && !item.deleted).map(occasion => {
        const status = statusFor(occasion, snapshot.states, new Date());
        const state = snapshot.states.find(item => item.occasionId === occasion.id && item.year === occurrenceYear(occasion, new Date()) && !item.deleted);
        return (
          <Card key={occasion.id}>
            <Text style={[styles.name, { color: colors.text }]}>{t(`person.${occasion.type}`)} · {occasion.month}/{occasion.day}</Text>
            <Text style={{ color: colors.accent }}>{t(status === 'idea-saved' ? 'person.statusIdea' : status === 'purchased' ? 'person.statusPurchased' : 'person.statusNotStarted')}</Text>
            {state?.savedIdea ? <Text style={{ color: colors.text }}>{state.savedIdea}</Text> : null}
            {state?.claimedBy ? (
              <Text accessibilityLabel={t('person.claimedBy', { name: claimerName(state.claimedBy, snapshot.members) })} style={{ color: colors.text }}>
                {t('person.claimedBy', { name: claimerName(state.claimedBy, snapshot.members) })}
              </Text>
            ) : null}
            {state?.claimedBy && snapshot.profile.uid && (state.claimedBy === snapshot.profile.uid || snapshot.group?.ownerId === snapshot.profile.uid) ? (
              <Button
                label={t('person.unclaim')}
                accessibilityLabel={t('person.unclaimLabel', { occasion: t(`person.${occasion.type}`) })}
                tone="secondary"
                onPress={() => unclaimOccasion(occasion.id)}
              />
            ) : null}
            {!state?.claimedBy ? (
              <Button
                label={t('person.claim')}
                accessibilityLabel={t('person.claimLabel', { occasion: t(`person.${occasion.type}`) })}
                tone="secondary"
                onPress={() => claimOccasion(occasion.id)}
              />
            ) : null}
            <Button label={t('person.purchase')} tone="secondary" onPress={() => { setBuying(occasion.id); setGift(state?.savedIdea ?? ''); }} />
          </Card>
        );
      })}
      <View style={styles.row}>
        {(['birthday', 'christmas', 'wedding'] as OccasionType[]).map(item => (
          <Button key={item} label={t(`person.${item}`)} tone={type === item ? 'primary' : 'secondary'} onPress={() => setType(item)} />
        ))}
      </View>
      {type !== 'christmas' ? (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Field label={t('person.month')} value={month} onChangeText={setMonth} keyboardType="number-pad" />
          </View>
          <View style={styles.flex}>
            <Field label={t('person.day')} value={day} onChangeText={setDay} keyboardType="number-pad" />
          </View>
        </View>
      ) : null}
      <Field label={t('person.year')} value={year} onChangeText={setYear} keyboardType="number-pad" />
      <Button
        label={t('person.addOccasion')}
        onPress={() => addOccasion(person.id, type, Number(month) || undefined, Number(day) || undefined, Number(year) || undefined)}
      />
      <Title>{t('person.ideas')}</Title>
      <Body>{t('person.ideasHint')}</Body>
      {(onDevice?.ideas ?? []).map(idea => (
        <IdeaRow key={idea} idea={idea} onUp={() => vote(person.id, idea, 'up')} onDown={() => vote(person.id, idea, 'down')} onSave={() => next && saveIdeaFor(next.occasion.id, idea)} />
      ))}
      <Button label={t('person.refresh')} tone="secondary" onPress={() => refreshIdeas(person.id)} />
      <Body>{t('person.cloudHint')}</Body>
      {cloudRemaining[person.id] != null ? <Body>{t('person.cloudLeft', { count: cloudRemaining[person.id] })}</Body> : null}
      <Button label={t('person.cloud')} onPress={() => cloudIdeas(person.id)} />
      {(cloud?.ideas ?? []).map(idea => (
        <IdeaRow key={`cloud-${idea}`} idea={idea} onUp={() => vote(person.id, idea, 'up')} onDown={() => vote(person.id, idea, 'down')} onSave={() => next && saveIdeaFor(next.occasion.id, idea)} />
      ))}
      <Title>{t('person.history')}</Title>
      <Button
        label={mineOnly ? t('person.allPurchases') : t('person.myPurchases')}
        accessibilityLabel={mineOnly ? t('person.allPurchasesLabel') : t('person.myPurchasesLabel')}
        tone="secondary"
        onPress={() => setMineOnly(value => !value)}
      />
      {history.length === 0 ? <Body>{mineOnly ? t('person.historyMineEmpty') : t('person.historyEmpty')}</Body> : null}
      {history.map(item => {
        const buyerText = buyerLine(item.boughtBy, snapshot.profile.uid, snapshot.members);
        return (
          <Text key={item.id} style={{ color: colors.text }}>
            {item.title} · {formatMoney(item.priceCents)} · {formatLongDate(new Date(item.purchasedOn))}
            {buyerText ? `\n${buyerText}` : ''}
            {item.privateGift ? `\n${t('person.privateGift')}` : ''}
          </Text>
        );
      })}
      {buying ? (
        <Card>
          <Title>{t('purchase.title')}</Title>
          <PurchaseWarning occasionId={buying} date={date} />
          <Field label={t('purchase.gift')} value={gift} onChangeText={setGift} />
          <Field label={t('purchase.price')} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
          <Field label={t('purchase.date')} value={date} onChangeText={setDate} />
          <Button label={t('purchase.save')} onPress={() => { logGift(buying, gift, price, date); setBuying(null); }} />
        </Card>
      ) : null}
      <Button label={t('person.delete')} tone="danger" onPress={() => removePerson(person.id)} />
    </Screen>
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

function SpendBreakdown({ personId, budgetCents }: { personId: string; budgetCents: number | null }) {
  const { snapshot, colors } = useGifteez();
  const year = new Date().getFullYear();
  const visible = visibleGifts({
    personId,
    gifts: snapshot.gifts,
    privateGifts: snapshot.privateGifts ?? [],
    groupId: snapshot.group?.id ?? null,
  });
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
      <Text style={{ color: colors.text }}>{t('person.yearTotal', { amount: formatMoney(yearSpentCents(personId, visible, year)) })}</Text>
      <Text style={{ color: colors.text }}>{t('person.allTotal', { amount: formatMoney(allTimeSpentCents(personId, visible)) })}</Text>
      <Text style={{ color: colors.text }}>
        {budgetCents == null ? t('person.noBudget') : t('person.budgetLine', { amount: formatMoney(budgetCents) })}
      </Text>
      {spend.rows.map(row => (
        <Text key={row.uid} style={{ color: colors.muted }}>
          {row.self ? t('person.spendYou') : row.name} · {t('person.spendYear', { amount: formatMoney(row.yearCents) })} · {t('person.spendAll', { amount: formatMoney(row.allCents) })}
        </Text>
      ))}
      {spend.unknownAllCents > 0 ? (
        <Text style={{ color: colors.muted }}>
          {t('person.spendUnknown')} · {t('person.spendYear', { amount: formatMoney(spend.unknownYearCents) })} · {t('person.spendAll', { amount: formatMoney(spend.unknownAllCents) })}
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

function TagPicker({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const { colors } = useGifteez();
  return (
    <View style={styles.tags}>
      {INTEREST_TAGS.map(tag => {
        const selected = tags.includes(tag);
        return (
          <Pressable
            key={tag}
            onPress={() => onChange(selected ? tags.filter(item => item !== tag) : [...tags, tag])}
            style={[styles.tag, { borderColor: colors.border, backgroundColor: selected ? colors.accent : colors.surface }]}>
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
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  name: { fontSize: 16, flexShrink: 1 },
});
