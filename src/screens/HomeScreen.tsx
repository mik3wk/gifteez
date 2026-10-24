import React, { useLayoutEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStack } from '../app/navigation';
import { getEnv } from '../config/env';
import { circleHomeLine, circleSections } from '../domain/circles';
import { canAddPerson, daysUntil, listCurrency, occurrenceYear, yearSpentCents } from '../domain/logic';
import { isOneTimeOccasion, nextOccasionDate, occasionLabel } from '../domain/occasions';
import { relationshipLabel } from '../domain/relationship';
import type { AppSnapshot, GiftRecord, Occasion, OccasionState, Person } from '../domain/types';
import { deviceLocale, formatDate, formatLongDate, formatMoney, t, timeGreeting } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { occasionLook, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { heroCardSource, RibbonBanner } from '../ui/art';
import { WaxSeal } from '../ui/stationery';
import { ArtSlot, Body, Button, Caption, Card, EmptyState, Heading, Screen, Title } from '../ui/ui';

type Upcoming = { person: Person; occasion: Occasion; date: Date };

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const { snapshot, resumePersonId, clearResumePerson, openPaywall } = useGifteez();
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
  function addSomeone() {
    if (!canAddPerson(snapshot, getEnv().freeTierMaxPeople)) {
      openPaywall();
      return;
    }
    navigation.navigate('AddPerson');
  }

  return (
    <Screen tab="home">
      <View>
        <Title>{t('appName')}</Title>
        <Caption tone="text">{homeGreeting(today, upcoming)}</Caption>
      </View>
      {people.length === 0 ? (
        <EmptyState
          kind="people"
          text={t('people.addFirst')}
          action={t('people.addPerson')}
          onAction={addSomeone}
        />
      ) : hero ? (
        <Hero item={hero} year={year} snapshot={snapshot} money={money} onOpen={navigation.navigate} />
      ) : (
        <NoOccasion person={people.slice().sort((a, b) => a.name.localeCompare(b.name))[0]} onAdd={navigation.navigate} />
      )}
      {people.length > 0 ? <RibbonBanner /> : null}
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
  const { colors, scheme, type, typeScale } = useTheme();
  const { width } = useWindowDimensions();
  const cardWidth = Math.max(280, width - space.md * 2);
  const scale = cardWidth / 370;
  const cardHeight = 230 * scale;
  const today = new Date();
  const spent = yearSpentCents(item.person.id, snapshot.gifts, year);
  const logged = isLogged(item, snapshot.gifts, snapshot.states, today);
  const days = daysUntil(item.date, today);
  const when = days === 0 ? t('people.today').toUpperCase() : t('people.inDays', { count: days }).toUpperCase();
  const relationship = relationshipLabel(item.person.relationship);
  const dateLabel = isOneTimeOccasion(item.occasion) ? formatLongDate(item.date) : formatDate(item.date);
  const meta = [relationship, dateLabel].filter(Boolean).join(' · ');
  const budget = item.person.budgetCents == null
    ? t('people.heroOpen', { used: money(spent) })
    : t('people.heroBudget', { budget: money(item.person.budgetCents), used: money(spent) });
  const pad = 22 * scale;
  return (
    <View style={[styles.heroWrap, { width: cardWidth, height: cardHeight, marginBottom: 12 * scale }]}>
      <Image
        accessible={false}
        source={heroCardSource(scheme)}
        resizeMode="contain"
        style={{ position: 'absolute', left: -14 * scale, top: -16 * scale, width: 398 * scale, height: 266 * scale }}
      />
      <View style={[styles.heroCopy, { paddingHorizontal: pad, paddingTop: 28 * scale, paddingBottom: pad, maxWidth: cardWidth }]}>
        <Text
          maxFontSizeMultiplier={typeScale.caption}
          style={[type.caption, { color: colors.pink, fontWeight: '600', letterSpacing: 1.4, fontSize: 11 * scale, maxWidth: 238 * scale }]}>
          {t('people.nextKicker', { when })}
        </Text>
        <Text
          numberOfLines={2}
          maxFontSizeMultiplier={typeScale.display}
          style={[type.display, { color: colors.text, fontSize: 28 * scale, lineHeight: 33 * scale, maxWidth: 238 * scale }]}>
          {t('people.nextTitle', { name: item.person.name, occasion: occasionLabel(item.occasion) })}
        </Text>
        <Text maxFontSizeMultiplier={typeScale.body} style={[type.body, { color: colors.muted, fontSize: 14 * scale, maxWidth: 238 * scale }]}>{meta}</Text>
        <Text maxFontSizeMultiplier={typeScale.body} style={[type.body, { color: colors.muted, fontSize: 14 * scale, maxWidth: 238 * scale }]}>{budget}</Text>
        {logged ? <WaxSeal state="purchased" size={28} /> : null}
        <View style={styles.heroSpacer} />
        <Button
          label={logged ? t('people.viewGift') : t('people.findGift')}
          onPress={() => onOpen('Person', { personId: item.person.id, section: logged ? 'history' : 'ideas' })}
        />
      </View>
    </View>
  );
}

function NoOccasion({
  person,
  onAdd,
}: {
  person: Person;
  onAdd: NativeStackNavigationProp<RootStack>['navigate'];
}) {
  return (
    <Card>
      <Body>{t('people.addBirthday', { name: person.name })}</Body>
      <Button
        label={t('person.addOccasion')}
        onPress={() => onAdd('Person', { personId: person.id, section: 'occasions' })}
      />
    </Card>
  );
}

function homeGreeting(today: Date, upcoming: Upcoming[]): string {
  const due = upcoming.filter(item => {
    const days = daysUntil(item.date, today);
    return days >= 0 && days <= 7;
  }).length;
  if (due === 0) {
    return timeGreeting(today);
  }
  return t('people.greetingWithSort', { greeting: timeGreeting(today), count: due });
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
      accessibilityLabel={`${item.person.name}, ${occasionLabel(item.occasion)}, ${t(`seal.${rowSeal(item, states, gifts, today)}`)}`}
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
  const noCircles = (snapshot.circles ?? []).length === 0 && snapshot.people.some(person => !person.deleted);
  if (lines.length === 0 && !noCircles) {
    return null;
  }
  if (lines.length === 0) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={t('fairness.homePrompt')} onPress={onPress}>
        <Card>
          <Caption tone="text">{t('fairness.homePrompt')}</Caption>
        </Card>
      </Pressable>
    );
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
  heroWrap: { overflow: 'visible', alignSelf: 'center' },
  heroCopy: { flex: 1, gap: 2, overflow: 'visible' },
  heroSpacer: { flex: 1, minHeight: 8 },
});
