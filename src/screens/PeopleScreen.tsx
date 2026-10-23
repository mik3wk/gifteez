import React, { useLayoutEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStack } from '../app/navigation';
import { daysUntil, groupCurrency, sortPeople, statusFor, upcomingOccasion, yearSpentCents } from '../domain/logic';
import { isOneTimeOccasion, occasionLabel } from '../domain/occasions';
import { isHiddenFromViewer } from '../domain/visibility';
import { deviceLocale, formatDate, formatLongDate, formatMoney, t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { groupHue } from '../theme/skins';
import { useTheme } from '../theme/useTheme';
import { occasionLook } from '../theme/tokens';
import { SkinBanner } from '../ui/art';
import { useGroupLabel } from '../ui/heading';
import { AccountSheet, AppHeader, Banner, EmptyState, HeroCard, PersonRow, Screen, SectionHeader, StatRow, StatTile } from '../ui/ui';
import { DuplicateOffers } from './mergeUi';

export function PeopleScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const { snapshot, showBanner, dismissBanner, skinId, duplicateOffers, dismissDuplicateOffer, resumePersonId, clearResumePerson } = useGifteez();
  const { scheme } = useTheme();
  const heading = useGroupLabel();
  const [upgrade, setUpgrade] = useState(false);
  const today = new Date();
  const people = sortPeople(snapshot.people, snapshot.occasions, today);
  const year = today.getFullYear();
  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: undefined });
  }, [navigation]);
  useLayoutEffect(() => {
    if (!resumePersonId) {
      return;
    }
    const personId = resumePersonId;
    clearResumePerson();
    navigation.navigate('Person', { personId });
  }, [clearResumePerson, navigation, resumePersonId]);

  const nextPerson = people.find(person => upcomingOccasion(person.id, snapshot.occasions, today));
  const next = nextPerson ? upcomingOccasion(nextPerson.id, snapshot.occasions, today) : null;
  const upcomingCount = people.filter(person => {
    const item = upcomingOccasion(person.id, snapshot.occasions, today);
    return item != null && daysUntil(item.date, today) <= 120;
  }).length;
  const spentValues = people.map(person => yearSpentCents(person.id, snapshot.gifts, year));
  const spread = spentValues.length === 0 ? 0 : Math.max(...spentValues) - Math.min(...spentValues);
  const balanced = spread === 0 || (Math.max(...spentValues) > 0 && spread <= Math.max(...spentValues) * 0.25);
  const greeting = snapshot.profile.displayName.trim()
    ? t('people.greeting', { name: snapshot.profile.displayName.trim() })
    : undefined;

  return (
    <Screen tab="people">
      <AppHeader title={heading.label} greeting={greeting} />
      <SkinBanner skinId={skinId} />
      <DuplicateOffers
        offers={duplicateOffers}
        onReview={offer => navigation.navigate('SamePerson', {
          personId: offer.targetPersonId,
          sourcePersonId: offer.sourcePersonId,
          sourceGroupId: offer.sourceGroupId,
        })}
        onDismiss={offer => dismissDuplicateOffer(offer.sourcePersonId, offer.sourceGroupId, offer.targetPersonId)}
      />
      {showBanner ? (
        <Banner
          text={t('people.banner')}
          action={t('people.bannerAction')}
          onAction={() => setUpgrade(true)}
          onDismiss={dismissBanner}
        />
      ) : null}
      {next && nextPerson ? (
        <HeroCard
          kicker={t('people.nextUp')}
          title={t('people.nextTitle', { name: nextPerson.name, occasion: occasionLabel(next.occasion) })}
          figure={daysUntil(next.date, today) === 0 ? t('people.today') : String(daysUntil(next.date, today))}
          unit={daysUntil(next.date, today) === 0 ? undefined : t('people.daysUnit', { count: daysUntil(next.date, today) })}
          detail={heroDetail(nextPerson.id, nextPerson.budgetCents, snapshot.gifts, year, snapshot.group)}
          action={t('people.findGift')}
          art={occasionLook(next.occasion.type).art}
          onAction={() => navigation.navigate('Person', { personId: nextPerson.id })}
        />
      ) : null}
      <StatRow>
        <StatTile value={String(people.length)} label={t('people.statPeople')} icon="people" tint="pink" />
        <StatTile value={String(upcomingCount)} label={t('people.statUpcoming')} icon="calendar" tint="teal" />
        <StatTile
          value={balanced ? t('people.fairnessBalanced') : t('people.fairnessCheck')}
          label={t('people.statFairness')}
          icon="scale"
          tint="lilac"
          onPress={() => navigation.navigate('Fairness')}
        />
      </StatRow>
      {people.length === 0 ? (
        <EmptyState kind="people" text={t('people.empty')} action={t('people.add')} onAction={() => navigation.navigate('AddPerson')} />
      ) : (
        <SectionHeader title={t('people.title')} action={t('people.addShort')} onAction={() => navigation.navigate('AddPerson')} />
      )}
      {people.map(person => {
        const item = upcomingOccasion(person.id, snapshot.occasions, today);
        const hidden = isHiddenFromViewer(person, snapshot.profile.uid);
        const money = (cents: number) => formatMoney(cents, deviceLocale(), groupCurrency(snapshot.group));
        const spent = yearSpentCents(person.id, snapshot.gifts, year);
        const budget = hidden
          ? ''
          : person.budgetCents == null
            ? t('people.spent', { used: money(spent) })
            : t('people.budgetLeft', { used: money(spent), budget: money(person.budgetCents) });
        const status = hidden || !item ? null : statusFor(item.occasion, snapshot.states, today);
        const when = item
          ? `${occasionLabel(item.occasion)} ${isOneTimeOccasion(item.occasion) ? formatLongDate(item.date) : formatDate(item.date)}`
          : t('people.noOccasion');
        const days = item ? daysUntil(item.date, today) : null;
        const trailing = days == null ? undefined : days === 0 ? t('people.today') : t('people.inDays', { count: days });
        const statusText = status ? t(statusKey(status)) : '';
        const progress = hidden || person.budgetCents == null || person.budgetCents <= 0 ? null : spent / person.budgetCents;
        return (
          <PersonRow
            key={person.id}
            name={person.name}
            initials={person.name}
            hue={groupHue(person.name.length, scheme)}
            occasionId={item?.occasion.type}
            occasionLabel={item ? occasionLabel(item.occasion) : undefined}
            trailing={trailing}
            budget={budget}
            progress={progress}
            note={person.imported && !person.opened ? t('people.imported') : t('people.noOccasion')}
            accessibilityLabel={[person.name, when, budget, statusText].filter(Boolean).join(', ')}
            onPress={() => navigation.navigate('Person', { personId: person.id })}
          />
        );
      })}
      <AccountSheet visible={upgrade} allowName={false} showCreate={false} onClose={() => setUpgrade(false)} />
    </Screen>
  );
}

function heroDetail(
  personId: string,
  budgetCents: number | null,
  gifts: Parameters<typeof yearSpentCents>[1],
  year: number,
  group: Parameters<typeof groupCurrency>[0],
): string {
  const money = (cents: number) => formatMoney(cents, deviceLocale(), groupCurrency(group));
  const spent = yearSpentCents(personId, gifts, year);
  if (budgetCents == null) {
    return t('people.heroOpen', { used: money(spent) });
  }
  return t('people.heroSpent', { used: money(spent), budget: money(budgetCents) });
}

function statusKey(status: string): string {
  if (status === 'idea-saved') {
    return 'person.statusIdea';
  }
  if (status === 'purchased') {
    return 'person.statusPurchased';
  }
  return 'person.statusNotStarted';
}
