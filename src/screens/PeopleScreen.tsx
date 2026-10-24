import React, { useLayoutEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStack } from '../app/navigation';
import { daysUntil, listCurrency, occurrenceYear, sortPeople, upcomingOccasion, yearSpentCents, fairnessRows } from '../domain/logic';
import { personSeal } from '../domain/seal';
import type { Occasion, OccasionState } from '../domain/types';
import { isOneTimeOccasion, occasionLabel } from '../domain/occasions';
import { isHiddenFromViewer, isPersonLocked } from '../domain/visibility';
import { deviceLocale, formatDate, formatLongDate, formatMoney, t, timeGreeting } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { SessionEntrance } from '../ui/motion';
import { FairnessCard, GiftTagCard, RibbonDivider } from '../ui/stationery';
import { AppHeader, Button, EmptyState, PersonRow, Screen, SectionHeader } from '../ui/ui';
import { summaryPrimaryLabel } from './personSummary';

export function PeopleScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const { snapshot, resumePersonId, clearResumePerson } = useGifteez();
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
      <AppHeader title={t('people.home')} greeting={timeGreeting(today)} />
      <SessionEntrance id="people">
      {next && nextPerson ? (
        <GiftTagCard
          personId={nextPerson.id}
          name={nextPerson.name}
          title={t('people.nextTitle', { name: nextPerson.name, occasion: occasionLabel(next.occasion) })}
          when={isOneTimeOccasion(next.occasion) ? formatLongDate(next.date) : formatDate(next.date)}
          countdown={daysUntil(next.date, today) === 0 ? t('people.today') : t('people.inDays', { count: daysUntil(next.date, today) })}
          budgetLabel={isHiddenFromViewer(nextPerson, snapshot.profile.uid)
            ? undefined
            : heroDetail(nextPerson.id, nextPerson.budgetCents, snapshot.gifts, year, listCurrency(snapshot))}
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
        money={cents => formatMoney(cents, deviceLocale(), listCurrency(snapshot), true)}
      />
      <RibbonDivider />
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
        const money = (cents: number) => formatMoney(cents, deviceLocale(), listCurrency(snapshot), true);
        const spent = yearSpentCents(person.id, snapshot.gifts, year);
        const when = item
          ? `${occasionLabel(item.occasion)} ${isOneTimeOccasion(item.occasion) ? formatLongDate(item.date) : formatDate(item.date)}`
          : t('people.noOccasion');
        const days = item ? daysUntil(item.date, today) : null;
        const trailing = days == null ? undefined : days === 0 ? t('people.today') : t('people.inDays', { count: days });
        const progress = hidden || person.budgetCents == null || person.budgetCents <= 0 ? null : spent / person.budgetCents;
        const budgetLine = hidden || person.budgetCents == null
          ? ''
          : t('people.budgetYear', { used: money(spent), budget: money(person.budgetCents) });
        return (
          <PersonRow
            key={person.id}
            name={person.name}
            personId={person.id}
            relationship={person.relationship}
            occasionId={item?.occasion.type}
            occasionLabel={item ? occasionLabel(item.occasion) : undefined}
            trailing={trailing}
            budget={budgetLine}
            progress={progress}
            note={person.imported && !person.opened ? t('people.imported') : t('people.noOccasion')}
            accessibilityLabel={[person.name, person.relationship, when, budgetLine].filter(Boolean).join(', ')}
            onPress={() => navigation.navigate('Person', { personId: person.id })}
          />
        );
      })}
      </SessionEntrance>
      )}
    </Screen>
  );
}

function heroDetail(
  personId: string,
  budgetCents: number | null,
  gifts: Parameters<typeof yearSpentCents>[1],
  year: number,
  currency: string,
): string {
  const money = (cents: number) => formatMoney(cents, deviceLocale(), currency, true);
  const spent = yearSpentCents(personId, gifts, year);
  if (budgetCents == null) {
    return t('people.heroOpen', { used: money(spent) });
  }
  return t('people.heroSpent', { used: money(spent), budget: money(budgetCents) });
}

function heroState(occasion: Occasion, states: OccasionState[], today: Date): OccasionState | undefined {
  return states.find(item => item.occasionId === occasion.id && item.year === occurrenceYear(occasion, today) && !item.deleted);
}
