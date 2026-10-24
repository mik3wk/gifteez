import React, { useLayoutEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { openTab, type RootStack } from '../app/navigation';
import { daysUntil, groupCurrency, occurrenceYear, sortPeople, statusFor, upcomingOccasion, yearSpentCents, fairnessRows } from '../domain/logic';
import { personSeal } from '../domain/seal';
import type { Occasion, OccasionState } from '../domain/types';
import { isOneTimeOccasion, occasionLabel } from '../domain/occasions';
import { isHiddenFromViewer, isPersonLocked } from '../domain/visibility';
import { deviceLocale, formatDate, formatLongDate, formatMoney, t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { useGroupLabel } from '../ui/heading';
import { SessionEntrance } from '../ui/motion';
import { FairnessCard, GiftTagCard, RibbonDivider } from '../ui/stationery';
import { AccountSheet, AppHeader, Banner, Button, EmptyState, PersonRow, Screen, SectionHeader, StatRow, StatTile } from '../ui/ui';
import { DuplicateOffers } from './mergeUi';
import { summaryPrimaryLabel } from './personSummary';

export function PeopleScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const { snapshot, showBanner, dismissBanner, duplicateOffers, dismissDuplicateOffer, resumePersonId, clearResumePerson } = useGifteez();
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
  const nextHero = next && nextPerson ? heroState(next.occasion, snapshot.states, today) : undefined;
  const heroLabel = next && nextPerson
    ? summaryPrimaryLabel({
      hidden: isHiddenFromViewer(nextPerson, snapshot.profile.uid),
      locked: isPersonLocked(snapshot.group?.lockedPersonIds, nextPerson.id),
      hasOccasion: true,
      purchased: nextHero?.status === 'purchased',
      claimedByMe: Boolean(nextHero?.claimedBy && nextHero.claimedBy === snapshot.profile.uid),
      claimedByOther: Boolean(nextHero?.claimedBy && nextHero.claimedBy !== snapshot.profile.uid),
      savedIdea: Boolean(nextHero?.savedIdea),
    })
    : null;

  return (
    <Screen tab="people">
      <AppHeader title={heading.label} greeting={greeting} />
      <SessionEntrance id="people">
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
        <GiftTagCard
          personId={nextPerson.id}
          name={nextPerson.name}
          title={t('people.nextTitle', { name: nextPerson.name, occasion: occasionLabel(next.occasion) })}
          when={isOneTimeOccasion(next.occasion) ? formatLongDate(next.date) : formatDate(next.date)}
          countdown={daysUntil(next.date, today) === 0 ? t('people.today') : t('people.inDays', { count: daysUntil(next.date, today) })}
          budgetLabel={isHiddenFromViewer(nextPerson, snapshot.profile.uid)
            ? undefined
            : heroDetail(nextPerson.id, nextPerson.budgetCents, snapshot.gifts, year, snapshot.group)}
          progress={isHiddenFromViewer(nextPerson, snapshot.profile.uid) || !nextPerson.budgetCents
            ? null
            : yearSpentCents(nextPerson.id, snapshot.gifts, year) / nextPerson.budgetCents}
          seal={isHiddenFromViewer(nextPerson, snapshot.profile.uid) ? undefined : personSeal({
            status: nextHero?.status ?? 'not-started',
            claimed: Boolean(nextHero?.claimedBy),
            logged: snapshot.gifts.some(gift => gift.personId === nextPerson.id && gift.occasionId === next.occasion.id && gift.year === occurrenceYear(next.occasion, today) && !gift.deleted),
          })}
          action={heroLabel ? (
            <Button label={heroLabel} onPress={() => navigation.navigate('Person', { personId: nextPerson.id })} />
          ) : null}
        />
      ) : null}
      <FairnessCard
        rows={fairnessRows(snapshot, today).filter(row => {
          const person = snapshot.people.find(item => item.id === row.personId);
          return !isHiddenFromViewer(person, snapshot.profile.uid);
        })}
        money={cents => formatMoney(cents, deviceLocale(), groupCurrency(snapshot.group), true)}
      />
      <RibbonDivider />
      <StatRow>
        <StatTile value={String(people.length)} label={t('people.statPeople')} icon="people" tint="pink" />
        <StatTile value={String(upcomingCount)} label={t('people.statUpcoming')} icon="calendar" tint="teal" />
        <StatTile
          value={balanced ? t('people.fairnessBalanced') : t('people.fairnessCheck')}
          label={t('people.statFairness')}
          icon="scale"
          tint="lilac"
          onPress={() => openTab(navigation, 'Fairness')}
        />
      </StatRow>
      {people.length === 0 ? (
        <EmptyState kind="people" text={t('people.empty')} action={t('people.add')} onAction={() => navigation.navigate('AddPerson')} />
      ) : null}
      </SessionEntrance>
      {people.length === 0 ? null : (
        <SectionHeader display title={t('people.title')} action={t('people.addShort')} onAction={() => navigation.navigate('AddPerson')} />
      )}
      {people.length === 0 ? null : (
      <SessionEntrance id="people-list">
      {people.map(person => {
        const item = upcomingOccasion(person.id, snapshot.occasions, today);
        const hidden = isHiddenFromViewer(person, snapshot.profile.uid);
        const money = (cents: number) => formatMoney(cents, deviceLocale(), groupCurrency(snapshot.group), true);
        const spent = yearSpentCents(person.id, snapshot.gifts, year);
        const budget = hidden
          ? ''
          : person.budgetCents == null
            ? t('people.spent', { used: money(spent) })
            : t('people.budgetLeft', { used: money(spent), budget: money(person.budgetCents) });
        const state = hidden || !item ? undefined : heroState(item.occasion, snapshot.states, today);
        const status = hidden || !item ? null : statusFor(item.occasion, snapshot.states, today);
        const logged = Boolean(item && snapshot.gifts.some(gift => (
          gift.personId === person.id && gift.occasionId === item.occasion.id && gift.year === occurrenceYear(item.occasion, today) && !gift.deleted
        )));
        const seal = hidden || !status ? undefined : personSeal({
          status,
          claimed: Boolean(state?.claimedBy),
          logged,
        });
        const when = item
          ? `${occasionLabel(item.occasion)} ${isOneTimeOccasion(item.occasion) ? formatLongDate(item.date) : formatDate(item.date)}`
          : t('people.noOccasion');
        const days = item ? daysUntil(item.date, today) : null;
        const trailing = days == null ? undefined : days === 0 ? t('people.today') : t('people.inDays', { count: days });
        const statusText = seal ? t(`seal.${seal}`) : '';
        const progress = hidden || person.budgetCents == null || person.budgetCents <= 0 ? null : spent / person.budgetCents;
        return (
          <PersonRow
            key={person.id}
            name={person.name}
            personId={person.id}
            relationship={person.relationship}
            occasionId={item?.occasion.type}
            occasionLabel={item ? occasionLabel(item.occasion) : undefined}
            trailing={trailing}
            budget={budget}
            progress={progress}
            seal={seal}
            note={person.imported && !person.opened ? t('people.imported') : t('people.noOccasion')}
            accessibilityLabel={[person.name, person.relationship, when, budget, statusText].filter(Boolean).join(', ')}
            onPress={() => navigation.navigate('Person', { personId: person.id })}
          />
        );
      })}
      </SessionEntrance>
      )}
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
  const money = (cents: number) => formatMoney(cents, deviceLocale(), groupCurrency(group), true);
  const spent = yearSpentCents(personId, gifts, year);
  if (budgetCents == null) {
    return t('people.heroOpen', { used: money(spent) });
  }
  return t('people.heroSpent', { used: money(spent), budget: money(budgetCents) });
}

function heroState(occasion: Occasion, states: OccasionState[], today: Date): OccasionState | undefined {
  return states.find(item => item.occasionId === occasion.id && item.year === occurrenceYear(occasion, today) && !item.deleted);
}
