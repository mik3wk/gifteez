import React, { useLayoutEffect } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStack } from '../app/navigation';
import { circleHomeLine, circleSections } from '../domain/circles';
import { daysUntil, listCurrency, occurrenceYear, yearSpentCents } from '../domain/logic';
import { isOneTimeOccasion, nextOccasionDate, occasionLabel } from '../domain/occasions';
import type { AppSnapshot, GiftRecord, Occasion, OccasionState, Person } from '../domain/types';
import { deviceLocale, formatDate, formatLongDate, formatMoney, t, timeGreeting } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { occasionLook, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { bowSource } from '../ui/art';
import { MonogramAvatar, WaxSeal } from '../ui/stationery';
import { ArtSlot, Body, Button, Caption, Card, EmptyState, Heading, Screen, Title } from '../ui/ui';

type Upcoming = { person: Person; occasion: Occasion; date: Date };

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const { snapshot, resumePersonId, clearResumePerson } = useGifteez();
  const today = new Date();
  const year = today.getFullYear();
  const people = snapshot.people.filter(person => !person.deleted);
  const upcoming = upcomingRows(people, snapshot.occasions, today);
  const hero = upcoming[0];
  const coming = upcoming.slice(1, 5);
  const money = (cents: number) => formatMoney(cents, deviceLocale(), listCurrency(snapshot), true);
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);
  useLayoutEffect(() => {
    if (!resumePersonId) {
      return;
    }
    const personId = resumePersonId;
    clearResumePerson();
    navigation.navigate('Person', { personId, section: 'ideas' });
  }, [clearResumePerson, navigation, resumePersonId]);

  return (
    <Screen tab="home">
      <View>
        <Title>{t('appName')}</Title>
        <Caption tone="text">{timeGreeting(today)}</Caption>
      </View>
      {people.length === 0 ? (
        <EmptyState
          kind="people"
          text={t('people.addFirst')}
          action={t('people.addPerson')}
          onAction={() => navigation.navigate('AddPerson')}
        />
      ) : hero ? (
        <Hero item={hero} year={year} snapshot={snapshot} money={money} onOpen={navigation.navigate} />
      ) : (
        <Card>
          <Body>{t('people.nothingComing')}</Body>
          <Button
            label={t('person.addOccasion')}
            onPress={() => {
              if (people.length === 1) {
                navigation.navigate('Person', { personId: people[0].id, section: 'occasions' });
                return;
              }
              navigation.navigate('People');
            }}
          />
        </Card>
      )}
      {coming.length > 0 ? (
        <View style={styles.block}>
          <View style={styles.rowBetween}>
            <Heading>{t('people.comingUp')}</Heading>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('People')}>
              <Caption tone="text">{t('people.seeAll')}</Caption>
            </Pressable>
          </View>
          {coming.map(item => (
            <ComingRow
              key={`${item.person.id}:${item.occasion.id}`}
              item={item}
              gifts={snapshot.gifts}
              states={snapshot.states}
              today={today}
              onPress={() => navigation.navigate('Person', { personId: item.person.id, section: 'ideas' })}
            />
          ))}
        </View>
      ) : null}
      <HomeFairness snapshot={snapshot} year={year} money={money} onPress={() => navigation.navigate('Fairness')} />
    </Screen>
  );
}

function Hero({
  item,
  year,
  snapshot,
  money,
  onOpen,
}: {
  item: Upcoming;
  year: number;
  snapshot: AppSnapshot;
  money: (cents: number) => string;
  onOpen: NativeStackNavigationProp<RootStack>['navigate'];
}) {
  const { colors, scheme, radius } = useTheme();
  const today = new Date();
  const spent = yearSpentCents(item.person.id, snapshot.gifts, year);
  const logged = isLogged(item, snapshot.gifts, snapshot.states, today);
  const days = daysUntil(item.date, today);
  const budget = item.person.budgetCents == null
    ? t('people.heroOpen', { used: money(spent) })
    : t('people.heroBudget', { budget: money(item.person.budgetCents), used: money(spent) });
  return (
    <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card }]}>
      <Image accessible={false} source={bowSource(scheme)} resizeMode="contain" style={styles.heroBow} />
      <View style={styles.heroBody}>
        <MonogramAvatar name={item.person.name} personId={item.person.id} size={44} />
        <View style={styles.copy}>
          <Heading>{t('people.nextTitle', { name: item.person.name, occasion: occasionLabel(item.occasion).toLowerCase() })}</Heading>
          <Caption tone="text">{isOneTimeOccasion(item.occasion) ? formatLongDate(item.date) : formatDate(item.date)}</Caption>
          <Caption tone="text">{days === 0 ? t('people.today') : t('people.inDays', { count: days })}</Caption>
          <Caption tone="text">{budget}</Caption>
          {logged ? <WaxSeal state="purchased" size={28} /> : null}
        </View>
      </View>
      <Button
        label={logged ? t('people.viewGift') : t('people.findGift')}
        onPress={() => onOpen('Person', { personId: item.person.id, section: logged ? 'history' : 'ideas' })}
      />
    </View>
  );
}

function ComingRow({
  item,
  gifts,
  states,
  today,
  onPress,
}: {
  item: Upcoming;
  gifts: GiftRecord[];
  states: OccasionState[];
  today: Date;
  onPress: () => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.person.name}, ${occasionLabel(item.occasion)}`}
      onPress={onPress}
      style={[styles.coming, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card }]}>
      <ArtSlot name={occasionLook(item.occasion.type).art} size={28} />
      <View style={styles.copy}>
        <Body>{`${item.person.name} · ${occasionLabel(item.occasion)}`}</Body>
        <Caption>{isOneTimeOccasion(item.occasion) ? formatLongDate(item.date) : formatDate(item.date)}</Caption>
      </View>
      <WaxSeal state={rowSeal(item, states, gifts, today)} size={28} />
    </Pressable>
  );
}

function HomeFairness({
  snapshot,
  year,
  money,
  onPress,
}: {
  snapshot: AppSnapshot;
  year: number;
  money: (cents: number) => string;
  onPress: () => void;
}) {
  const lines = circleSections(snapshot, year).flatMap(section => {
    const line = circleHomeLine(section);
    if (!line) {
      return [];
    }
    const text = line.status === 'even'
      ? t('fairness.homeEven', { name: section.name })
      : t('fairness.homeBehind', { name: section.name, person: line.personName ?? '', amount: money(line.behindCents ?? 0) });
    return [{ id: section.circleId, text }];
  }).slice(0, 3);
  if (lines.length === 0) {
    return null;
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('fairness.title')} onPress={onPress}>
      <Card>
        <Heading>{t('fairness.title')}</Heading>
        {lines.map(line => <Caption key={line.id} tone="text">{line.text}</Caption>)}
        <Caption>{t('fairness.seeAll')}</Caption>
      </Card>
    </Pressable>
  );
}

function upcomingRows(people: Person[], occasions: Occasion[], today: Date): Upcoming[] {
  const rows: Upcoming[] = [];
  people.forEach(person => {
    occasions.filter(item => item.personId === person.id && !item.deleted).forEach(occasion => {
      const date = nextOccasionDate(occasion, today);
      if (date) {
        rows.push({ person, occasion, date });
      }
    });
  });
  return rows.sort((a, b) => a.date.getTime() - b.date.getTime() || a.person.name.localeCompare(b.person.name));
}

function isLogged(item: Upcoming, gifts: GiftRecord[], states: OccasionState[], today: Date): boolean {
  const year = occurrenceYear(item.occasion, today);
  if (gifts.some(gift => gift.personId === item.person.id && gift.occasionId === item.occasion.id && gift.year === year && !gift.deleted)) {
    return true;
  }
  return states.some(state => state.occasionId === item.occasion.id && state.year === year && state.status === 'purchased' && !state.deleted);
}

function rowSeal(item: Upcoming, states: OccasionState[], gifts: GiftRecord[], today: Date) {
  if (isLogged(item, gifts, states, today)) {
    return 'purchased' as const;
  }
  const year = occurrenceYear(item.occasion, today);
  const state = states.find(entry => entry.occasionId === item.occasion.id && entry.year === year && !entry.deleted);
  if (state?.status === 'idea-saved' || state?.savedIdea) {
    return 'idea-saved' as const;
  }
  return 'not-started' as const;
}

const styles = StyleSheet.create({
  block: { gap: space.xs },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  coming: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, padding: space.sm },
  copy: { flex: 1, gap: 2 },
  hero: { borderWidth: 1, padding: space.md, gap: space.sm, overflow: 'visible' },
  heroBody: { flexDirection: 'row', gap: space.sm },
  heroBow: { position: 'absolute', top: -12, right: -8, width: 48, height: 40 },
});
