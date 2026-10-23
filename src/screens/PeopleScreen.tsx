import React, { useLayoutEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStack } from '../app/navigation';
import { groupCurrency, statusFor, upcomingOccasion } from '../domain/logic';
import { sortPeople } from '../domain/logic';
import { isHiddenFromViewer } from '../domain/visibility';
import { deviceLocale, formatDate, formatMoney, t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { DuplicateOffers } from './mergeUi';
import { SkinBanner } from '../ui/art';
import { useGroupHeading } from '../ui/heading';
import { AccountSheet, Banner, Button, EmptyState, Row, Screen, Title } from '../ui/ui';
import { yearSpentCents } from '../domain/logic';

export function PeopleScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const { snapshot, showBanner, dismissBanner, colors, skinId, duplicateOffers, dismissDuplicateOffer, resumePersonId, clearResumePerson } = useGifteez();
  const heading = useGroupHeading();
  const [upgrade, setUpgrade] = useState(false);
  const people = sortPeople(snapshot.people, snapshot.occasions, new Date());
  const year = new Date().getFullYear();
  useLayoutEffect(() => {
    if (!resumePersonId) {
      return;
    }
    const personId = resumePersonId;
    clearResumePerson();
    navigation.navigate('Person', { personId });
  }, [clearResumePerson, navigation, resumePersonId]);
  return (
    <Screen
      footer={people.length > 0 ? <Button label={t('people.add')} accessibilityLabel={t('people.add')} onPress={() => navigation.navigate('AddPerson')} /> : undefined}>
      <SkinBanner skinId={skinId} />
      <Title>{people.length === 0 ? t('people.title') : `${heading.emoji} ${heading.label}`}</Title>
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
      {people.length === 0 ? (
        <EmptyState
          kind="people"
          text={t('people.empty')}
          action={t('people.add')}
          onAction={() => navigation.navigate('AddPerson')}
        />
      ) : null}
      {people.map(person => {
        const next = upcomingOccasion(person.id, snapshot.occasions, new Date());
        const hidden = isHiddenFromViewer(person, snapshot.profile.uid);
        const money = (cents: number) => formatMoney(cents, deviceLocale(), groupCurrency(snapshot.group));
        const spent = yearSpentCents(person.id, snapshot.gifts, year);
        const budget = hidden
          ? ''
          : person.budgetCents == null
            ? t('people.spent', { used: money(spent) })
            : t('people.budgetLeft', { used: money(spent), budget: money(person.budgetCents) });
        const status = hidden || !next ? null : statusFor(next.occasion, snapshot.states, new Date());
        return (
          <Row
            key={person.id}
            accessibilityLabel={person.name}
            onPress={() => navigation.navigate('Person', { personId: person.id })}>
              <Text style={[styles.name, { color: colors.text }]}>{person.name}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>
                {next ? `${t(`person.${next.occasion.type}`)} · ${formatDate(next.date)}` : t('people.noOccasion')}
              </Text>
              <Text style={[styles.meta, { color: colors.text }]}>{budget}</Text>
              {status ? <Text style={[styles.meta, { color: colors.accent }]}>{t(statusKey(status))}</Text> : null}
              {person.imported && !person.opened ? <Text style={[styles.meta, { color: colors.muted }]}>{t('people.imported')}</Text> : null}
          </Row>
        );
      })}
      <View style={styles.actions}>
        <Button flex label={t('people.fairness')} tone="ghost" onPress={() => navigation.navigate('Fairness')} />
        <Button flex label={t('people.group')} tone="ghost" onPress={() => navigation.navigate('Group')} />
        <Button flex label={t('people.settings')} tone="ghost" onPress={() => navigation.navigate('Settings')} />
      </View>
      <AccountSheet visible={upgrade} allowName={false} showCreate={false} onClose={() => setUpgrade(false)} />
    </Screen>
  );
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

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  name: { fontSize: 20, fontWeight: '700', flexShrink: 1 },
  meta: { fontSize: 15, flexShrink: 1 },
});
