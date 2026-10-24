import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStack } from '../app/navigation';
import { getEnv } from '../config/env';
import { accountUnlocked, canAddPerson, listCurrency, sortPeople, upcomingOccasion, yearSpentCents } from '../domain/logic';
import { isOneTimeOccasion, occasionLabel } from '../domain/occasions';
import { relationshipLabel } from '../domain/relationship';
import { deviceLocale, formatDate, formatLongDate, formatMoney, t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { space } from '../theme/tokens';
import { MonogramAvatar } from '../ui/stationery';
import { Body, Button, Caption, EmptyState, Field, Heading, Screen, Title } from '../ui/ui';

export function PeopleScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const { snapshot, resumePersonId, clearResumePerson, openPaywall } = useGifteez();
  const [query, setQuery] = useState('');
  const order = useRef<string[] | null>(null);
  useFocusEffect(useCallback(() => {
    order.current = null;
  }, []));
  const today = new Date();
  const year = today.getFullYear();
  const money = (cents: number) => formatMoney(cents, deviceLocale(), listCurrency(snapshot), true);
  const needle = query.trim().toLowerCase();
  const sorted = sortPeople(snapshot.people, snapshot.occasions, today);
  const byId = new Map(sorted.map(person => [person.id, person]));
  if (!order.current) {
    order.current = sorted.map(person => person.id);
  } else {
    const known = new Set(order.current);
    const kept = order.current.filter(id => byId.has(id));
    const added = sorted.map(person => person.id).filter(id => !known.has(id));
    order.current = [...kept, ...added];
  }
  const people = order.current.map(id => byId.get(id)).filter((person): person is NonNullable<typeof person> => Boolean(person)).filter(person => {
    if (!needle) {
      return true;
    }
    const circle = snapshot.circles.find(item => item.id === person.circleId)?.name ?? '';
    const relationship = relationshipLabel(person.relationship);
    return [person.name, relationship, circle].join(' ').toLowerCase().includes(needle);
  });
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
  const limit = getEnv().freeTierMaxPeople;
  const used = snapshot.people.filter(person => !person.deleted).length;
  function addSomeone() {
    if (!canAddPerson(snapshot, limit)) {
      openPaywall();
      return;
    }
    navigation.navigate('AddPerson');
  }

  return (
    <Screen tab="people">
      <View style={styles.header}>
        <Title>{t('people.title')}</Title>
        <Button compact label={t('people.addPerson')} onPress={addSomeone} />
      </View>
      {accountUnlocked(snapshot) ? null : <Caption>{t('people.freeCount', { used: Math.min(used, limit), limit })}</Caption>}
      <Field label={t('people.search')} value={query} onChangeText={setQuery} returnKeyType="search" />
      {snapshot.people.some(person => !person.deleted) ? null : (
        <EmptyState kind="people" text={t('people.addFirst')} action={t('people.addPerson')} onAction={addSomeone} />
      )}
      {needle && people.length === 0 && snapshot.people.some(person => !person.deleted) ? (
        <Body>{t('people.noMatch', { query: query.trim() })}</Body>
      ) : null}
      {people.map(person => {
        const item = upcomingOccasion(person.id, snapshot.occasions, today);
        const spent = yearSpentCents(person.id, snapshot.gifts, year);
        const circle = snapshot.circles.find(entry => entry.id === person.circleId)?.name;
        const relationship = relationshipLabel(person.relationship);
        const meta = [relationship, circle].filter(Boolean).join(' · ');
        const budget = person.budgetCents == null
          ? t('people.spent', { used: money(spent) })
          : t('people.budgetLeft', { used: money(spent), budget: money(person.budgetCents) });
        const when = item
          ? `${occasionLabel(item.occasion)} · ${isOneTimeOccasion(item.occasion) ? formatLongDate(item.date) : formatDate(item.date)}`
          : t('people.noOccasion');
        return (
          <Pressable
            key={person.id}
            accessibilityRole="button"
            accessibilityLabel={[person.name, meta, budget, when].filter(Boolean).join(', ')}
            onPress={() => navigation.navigate('Person', { personId: person.id, section: 'ideas' })}
            style={styles.row}>
            <MonogramAvatar name={person.name} personId={person.id} size={44} />
            <View style={styles.copy}>
              <Heading>{person.name}</Heading>
              {meta ? <Caption tone="text">{meta}</Caption> : null}
              <Caption tone="text">{budget}</Caption>
              <Caption>{when}</Caption>
            </View>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48 },
  copy: { flex: 1, gap: 2 },
});
