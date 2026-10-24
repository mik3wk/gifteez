import React, { useLayoutEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStack } from '../app/navigation';
import { getEnv } from '../config/env';
import { circleSections, homeCircle } from '../domain/circles';
import { canAddPerson, daysUntil, listCurrency, occurrenceYear, yearSpentCents } from '../domain/logic';
import { isOneTimeOccasion, nextOccasionDate, occasionLabel } from '../domain/occasions';
import { relationshipLabel } from '../domain/relationship';
import type { AppSnapshot, GiftRecord, Occasion, OccasionState, Person } from '../domain/types';
import { deviceLocale, formatDate, formatLongDate, formatMoney, formatWeekday, t, timeGreeting } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { RibbonBanner, tagBowSource, tagStringSource } from '../ui/art';
import { Icon } from '../ui/icons';
import { BudgetBar, CircleFairnessCard, ListRow, MonogramAvatar, RowCard, SealPill } from '../ui/stationery';
import { Body, Button, Caption, Card, EmptyState, IconButton, Screen, Sheet } from '../ui/ui';

type Upcoming = { person: Person; occasion: Occasion; date: Date };

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const { snapshot, resumePersonId, clearResumePerson, openPaywall, setReminders } = useGifteez();
  const [remindersOpen, setRemindersOpen] = useState(false);
  const today = new Date();
  const year = today.getFullYear();
  const people = snapshot.people.filter(person => !person.deleted);
  const upcoming = upcomingRows(people, snapshot.occasions, today);
  const hero = upcoming[0];
  const listed = upcoming.slice(0, 5);
  const featured = homeCircle(circleSections(snapshot, year));
  const money = (cents: number) => formatMoney(cents, deviceLocale(), listCurrency(snapshot), true);
  const household = householdTitle(snapshot.profile.householdName);
  const greeting = greetingLine(snapshot.profile.givenName, today);
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
  const remindersOn = snapshot.profile.reminders === 'on';

  return (
    <Screen tab="home">
      <HomeHeader
        household={household}
        greeting={greeting}
        onBell={() => setRemindersOpen(true)}
      />
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
      {featured ? (
        <CircleFairnessCard
          section={featured}
          money={money}
          onOpenFairness={() => navigation.navigate('Fairness')}
          onOpenIdeas={personId => navigation.navigate('Person', { personId, section: 'ideas' })}
        />
      ) : null}
      {people.length > 0 && !featured && (snapshot.circles ?? []).length === 0 ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('fairness.homePrompt')} onPress={() => navigation.navigate('Fairness')}>
          <Card>
            <Caption tone="text">{t('fairness.homePrompt')}</Caption>
          </Card>
        </Pressable>
      ) : null}
      {people.length > 0 ? <RibbonBanner /> : null}
      {listed.length > 0 ? (
        <View style={styles.block}>
          <View style={styles.rowBetween}>
            <SectionTitle>{t('people.comingUp')}</SectionTitle>
            <Pressable accessibilityRole="button" accessibilityLabel={t('people.addPerson')} onPress={addSomeone}>
              <AddLink>{`+ ${t('people.addPerson')}`}</AddLink>
            </Pressable>
          </View>
          <RowCard>
            {listed.map((item, index) => (
              <ListRow
                key={`${item.person.id}:${item.occasion.id}`}
                name={item.person.name}
                personId={item.person.id}
                relationship={relationshipLabel(item.person.relationship) || undefined}
                detail={`${occasionLabel(item.occasion)} · ${isOneTimeOccasion(item.occasion) ? formatLongDate(item.date) : formatDate(item.date)}`}
                budget={rowBudget(item.person, snapshot, year, money)}
                seal={rowSeal(item, snapshot.states, snapshot.gifts, today)}
                onPress={() => navigation.navigate('Person', { personId: item.person.id, section: 'ideas' })}
                last={index === listed.length - 1}
              />
            ))}
          </RowCard>
          {upcoming.length > 5 ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('people.seeAll')} onPress={() => navigation.navigate('People')}>
              <AddLink>{t('people.seeAll')}</AddLink>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {people.length > 0 ? <CalendarAction /> : null}
      <Sheet visible={remindersOpen} title={t('people.remindersA11y')} onClose={() => setRemindersOpen(false)}>
        <Body>{remindersOn ? t('people.remindersOn') : t('person.remindBody')}</Body>
        {remindersOn ? (
          <Button label={t('person.remindNo')} tone="secondary" onPress={() => { setReminders(false).catch(() => undefined); setRemindersOpen(false); }} />
        ) : (
          <Button label={t('person.remindYes')} onPress={() => { setReminders(true).catch(() => undefined); setRemindersOpen(false); }} />
        )}
      </Sheet>
    </Screen>
  );
}

function householdTitle(name: string | undefined): string {
  const trimmed = name?.trim();
  return trimmed || t('people.householdDefault');
}

function greetingLine(givenName: string | undefined, today: Date): string {
  const greeting = timeGreeting(today);
  const first = givenName?.trim();
  return first ? t('people.greetingNamed', { greeting, name: first }) : greeting;
}

function HomeHeader({
  household,
  greeting,
  onBell,
}: {
  household: string;
  greeting: string;
  onBell: () => void;
}) {
  const { colors, type, typeScale } = useTheme();
  const initial = household.split(/\s+/)[0] || household;
  return (
    <View style={styles.header}>
      <MonogramAvatar name={initial} personId="household" size={36} crest />
      <View style={styles.headerCopy}>
        <Caption>{greeting}</Caption>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          maxFontSizeMultiplier={typeScale.display}
          style={[type.display, { color: colors.text, fontSize: 30, lineHeight: 34 }]}>
          {household}
        </Text>
      </View>
      <IconButton label={t('people.remindersA11y')} name="bell" onPress={onBell} />
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  const { colors, type, typeScale } = useTheme();
  return (
    <Text accessibilityRole="header" maxFontSizeMultiplier={typeScale.display} style={[type.display, { color: colors.text, fontSize: 28, lineHeight: 32 }]}>
      {children}
    </Text>
  );
}

function AddLink({ children }: { children: string }) {
  const { colors, type, typeScale } = useTheme();
  return (
    <Text maxFontSizeMultiplier={typeScale.button} style={[type.button, { color: colors.pink }]}>{children}</Text>
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
  const { colors, scheme, type, typeScale, radius } = useTheme();
  const today = new Date();
  const spent = yearSpentCents(item.person.id, snapshot.gifts, year);
  const days = daysUntil(item.date, today);
  const when = days === 0 ? t('people.today') : t('people.inDays', { count: days });
  const dateLabel = isOneTimeOccasion(item.occasion) ? formatLongDate(item.date) : formatDate(item.date);
  const budget = item.person.budgetCents == null
    ? t('people.spent', { used: money(spent) })
    : t('people.budgeted', { used: money(spent), budget: money(item.person.budgetCents) });
  return (
    <View style={styles.heroWrap}>
      <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card }]}>
        <Text
          maxFontSizeMultiplier={typeScale.caption}
          style={[type.caption, styles.kicker, { color: colors.muted }]}>
          {t('people.comingUp')}
        </Text>
        <View style={styles.heroRow}>
          <MonogramAvatar name={item.person.name} personId={item.person.id} size={56} />
          <View style={styles.heroCopy}>
            <Text
              numberOfLines={2}
              maxFontSizeMultiplier={typeScale.display}
              style={[type.display, styles.heroTitle, { color: colors.text }]}>
              {t('people.nextTitle', { name: item.person.name, occasion: occasionLabel(item.occasion) })}
            </Text>
            <Text maxFontSizeMultiplier={typeScale.body} style={[type.body, { color: colors.muted, fontSize: 15 }]}>
              {`${formatWeekday(item.date)}, ${dateLabel} · ${when}`}
            </Text>
          </View>
        </View>
        <View style={styles.heroSeal}>
          <SealPill state={rowSeal(item, snapshot.states, snapshot.gifts, today)} />
        </View>
        <View style={styles.heroFoot}>
          <View style={styles.heroBudget}>
            <BudgetBar spentCents={spent} budgetCents={item.person.budgetCents ?? null} caption={budget} />
          </View>
          <Button
            compact
            serif
            label={t('people.planGift')}
            onPress={() => onOpen('Person', { personId: item.person.id, section: 'ideas' })}
          />
        </View>
      </View>
      <Image
        accessible={false}
        pointerEvents="none"
        source={tagStringSource(scheme)}
        resizeMode="contain"
        style={styles.heroString}
      />
      <Image
        accessible={false}
        pointerEvents="none"
        source={tagBowSource(scheme)}
        resizeMode="contain"
        style={styles.heroBow}
      />
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

function CalendarAction() {
  const { colors, type, typeScale } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('people.findBirthdays')}
      onPress={() => undefined}
      style={styles.calendar}>
      <Icon name="calendar" color={colors.pink} size={18} />
      <Text maxFontSizeMultiplier={typeScale.caption} style={[type.caption, { color: colors.pink }]}>{t('people.findBirthdays')}</Text>
    </Pressable>
  );
}

function rowBudget(person: Person, snapshot: AppSnapshot, year: number, money: (cents: number) => string): string {
  const spent = yearSpentCents(person.id, snapshot.gifts, year);
  if (person.budgetCents == null) {
    return t('people.spent', { used: money(spent) });
  }
  return t('people.budgetYear', { used: money(spent), budget: money(person.budgetCents) });
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
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  headerCopy: { flex: 1, gap: 2 },
  heroWrap: { overflow: 'visible', marginTop: space.xs },
  hero: { borderWidth: 1, padding: space.md, paddingTop: space.sm, gap: space.sm, overflow: 'visible' },
  heroBow: { position: 'absolute', top: 2, right: 4, width: 72, height: 56 },
  heroString: { position: 'absolute', left: -20, top: -20, width: 64, height: 64 },
  kicker: { fontSize: 12, fontWeight: '600', letterSpacing: 1.4, textTransform: 'uppercase', marginLeft: 14 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  heroCopy: { flex: 1, gap: 2 },
  heroTitle: { fontSize: 28, lineHeight: 32 },
  heroSeal: { alignItems: 'flex-end', minHeight: 32 },
  heroFoot: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  heroBudget: { flex: 1 },
  calendar: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', minHeight: 44 },
});
