import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStack } from '../app/navigation';
import {
  circleSections,
  circleSuggestions,
  cleanCircleName,
  joinNames,
  uncircledPeople,
  type CircleSuggestion,
} from '../domain/circles';
import { listCurrency, yearSpentCents } from '../domain/logic';
import { relationshipCircleName } from '../domain/relationship';
import { deviceLocale, formatMoney, t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { SessionEntrance } from '../ui/motion';
import { WaxSeal } from '../ui/stationery';
import { space } from '../theme/tokens';
import {
  AppHeader,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Cluster,
  confirmDestructive,
  EmptyState,
  Field,
  Heading,
  Screen,
  Sheet,
} from '../ui/ui';

export function FairnessScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const {
    snapshot,
    createCircle,
    renameCircle,
    deleteCircle,
    setPersonCircle,
    acceptCircleSuggestion,
  } = useGifteez();
  const today = new Date();
  const year = today.getFullYear();
  const money = (cents: number) => formatMoney(cents, deviceLocale(), listCurrency(snapshot), true);
  const sections = circleSections(snapshot, year);
  const suggestions = circleSuggestions(snapshot.people).filter(item => (
    !snapshot.circles.some(circle => circle.name === relationshipCircleName(item.key))
  ));
  const others = uncircledPeople(snapshot);
  const people = snapshot.people.filter(person => !person.deleted);
  const [hidden, setHidden] = useState<string[]>([]);
  const [editor, setEditor] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState('');
  const [nameError, setNameError] = useState('');
  const editing = editor && editor !== 'new' ? snapshot.circles.find(circle => circle.id === editor) : undefined;

  function openEditor(id: string) {
    const circle = snapshot.circles.find(item => item.id === id);
    setDraft(circle?.name ?? '');
    setNameError('');
    setEditor(id);
  }

  async function saveName() {
    const cleaned = cleanCircleName(draft);
    if (!cleaned) {
      setNameError(t('fairness.nameInvalid'));
      return;
    }
    if (editor === 'new') {
      const id = await createCircle(cleaned);
      if (!id) {
        setNameError(t('fairness.nameInvalid'));
        return;
      }
      setEditor(id);
      setDraft(cleaned);
      return;
    }
    if (editor && cleaned !== editing?.name) {
      await renameCircle(editor, cleaned);
    }
  }

  return (
    <Screen tab="fairness">
      <AppHeader title={t('fairness.title')} />
      <SessionEntrance id="fairness">
        <Body>{t('fairness.intro')}</Body>
        {people.length === 0 && sections.length === 0 ? (
          <EmptyState
            kind="fairness"
            text={t('fairness.empty')}
            action={t('fairness.emptyAction')}
            onAction={() => navigation.navigate('AddPerson')}
          />
        ) : (
          <>
            {suggestions.filter(item => !hidden.includes(item.key)).map(item => (
              <SuggestionCard
                key={item.key}
                item={item}
                onAccept={() => { acceptCircleSuggestion(item.key, item.personIds).catch(() => undefined); }}
                onDismiss={() => setHidden(current => [...current, item.key])}
              />
            ))}
            {sections.map(section => (
              <Card key={section.circleId}>
                <Heading>{section.name}</Heading>
                {section.status === 'even' ? (
                  <WaxSeal state="balanced" label={t('fairness.evenStatus')} />
                ) : null}
                {section.status === 'empty' ? <Caption>{t('fairness.emptyCircle')}</Caption> : null}
                {section.behind.map(member => (
                  <View key={member.personId}>
                    <Caption tone="text">{member.name}</Caption>
                    <Caption>{t('fairness.behind', { amount: money(member.behindCents) })}</Caption>
                  </View>
                ))}
                <Button label={t('fairness.edit')} tone="secondary" onPress={() => openEditor(section.circleId)} />
              </Card>
            ))}
            {others.length > 0 ? (
              <Card>
                <Heading>{t('fairness.everyoneElse')}</Heading>
                {others.map(person => {
                  const spent = yearSpentCents(person.id, snapshot.gifts, year);
                  const line = person.budgetCents == null
                    ? t('fairness.year', { amount: money(spent) })
                    : t('fairness.ownBudget', {
                      used: money(spent),
                      budget: money(person.budgetCents),
                      left: money(Math.max(0, person.budgetCents - spent)),
                    });
                  return (
                    <View key={person.id}>
                      <Caption tone="text">{person.name}</Caption>
                      <Caption>{line}</Caption>
                    </View>
                  );
                })}
              </Card>
            ) : null}
            <Button
              label={t('fairness.newCircle')}
              tone="secondary"
              onPress={() => {
                setDraft('');
                setNameError('');
                setEditor('new');
              }}
            />
          </>
        )}
      </SessionEntrance>
      <Sheet visible={editor != null} onClose={() => setEditor(null)}>
        <Heading>{editor === 'new' ? t('fairness.newCircle') : editing?.name ?? t('fairness.edit')}</Heading>
        <Field
          label={t('fairness.circleName')}
          value={draft}
          error={nameError}
          onChangeText={value => {
            setDraft(value);
            setNameError('');
          }}
        />
        <Button label={editor === 'new' ? t('fairness.create') : t('fairness.rename')} onPress={() => { saveName().catch(() => undefined); }} />
        {editing ? (
          <>
            <Caption>{t('fairness.addToCircle')}</Caption>
            <Cluster>
              {snapshot.people.filter(person => !person.deleted && person.circleId !== editing.id).map(person => (
                <Chip
                  key={person.id}
                  label={person.name}
                  onPress={() => { setPersonCircle(person.id, editing.id).catch(() => undefined); }}
                />
              ))}
            </Cluster>
            {snapshot.people.filter(person => !person.deleted && person.circleId === editing.id).map(person => (
              <Button
                key={person.id}
                label={`${person.name} · ${t('fairness.removeFromCircle')}`}
                tone="secondary"
                onPress={() => { setPersonCircle(person.id, null).catch(() => undefined); }}
              />
            ))}
            <Button
              label={t('fairness.deleteCircle')}
              tone="danger-quiet"
              onPress={async () => {
                const ok = await confirmDestructive(
                  t('fairness.deleteCircleTitle', { name: editing.name }),
                  t('fairness.deleteCircleBody'),
                  t('fairness.deleteCircle'),
                );
                if (!ok) {
                  return;
                }
                setEditor(null);
                await deleteCircle(editing.id);
              }}
            />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

function SuggestionCard({
  item,
  onAccept,
  onDismiss,
}: {
  item: CircleSuggestion;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card>
      <Body>{t('fairness.suggest', { name: relationshipCircleName(item.key), people: joinNames(item.names) })}</Body>
      <View style={styles.actions}>
        <Button label={t('fairness.suggestYes')} onPress={onAccept} />
        <Button label={t('fairness.suggestNotNow')} tone="secondary" onPress={onDismiss} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: { gap: space.xs },
});
