import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStack } from '../app/navigation';
import { getEnv } from '../config/env';
import {
  circleSections,
  circleSuggestions,
  cleanCircleName,
  joinNames,
  uncircledPeople,
  type CircleSuggestion,
} from '../domain/circles';
import { formatSpentOfBudget } from '../domain/budgetBar';
import { canAddPerson, listCurrency, parseBudget, yearSpentCents } from '../domain/logic';
import { relationshipCircleName } from '../domain/relationship';
import { deviceLocale, formatMoney, t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { SessionEntrance } from '../ui/motion';
import { CircleFairnessCard, RowCard } from '../ui/stationery';
import { space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import {
  AppHeader,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Cluster,
  confirmChoice,
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
    setCircleBudget,
    acceptCircleSuggestion,
    openPaywall,
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
  const [budget, setBudget] = useState('');
  const [budgetError, setBudgetError] = useState('');
  const editing = editor && editor !== 'new' ? snapshot.circles.find(circle => circle.id === editor) : undefined;

  function openEditor(id: string) {
    const circle = snapshot.circles.find(item => item.id === id);
    setDraft(circle?.name ?? '');
    setNameError('');
    setBudget(budgetField(circle?.budgetCents));
    setBudgetError('');
    setEditor(id);
  }

  async function saveEditor(): Promise<boolean> {
    const cents = budget.trim() ? parseBudget(budget) : null;
    if (budget.trim() && cents == null) {
      setBudgetError(t('errors.price'));
      return false;
    }
    const cleaned = cleanCircleName(draft);
    if (!cleaned) {
      setNameError(t('fairness.nameInvalid'));
      return false;
    }
    if (editor === 'new') {
      const id = await createCircle(cleaned);
      if (!id) {
        setNameError(t('fairness.nameInvalid'));
        return false;
      }
      if (cents != null) {
        await setCircleBudget(id, cents);
      }
      return true;
    }
    if (!editor) {
      return true;
    }
    if (cleaned !== editing?.name) {
      await renameCircle(editor, cleaned);
    }
    const current = editing?.budgetCents ?? null;
    if (cents !== current) {
      const members = snapshot.people.filter(person => !person.deleted && person.circleId === editor);
      if (members.length > 0) {
        const amount = cents == null
          ? t('settings.none')
          : formatMoney(cents, deviceLocale(), listCurrency(snapshot), true);
        const choice = await confirmChoice(
          t('fairness.circleBudget'),
          t('fairness.applyBudget', { amount, names: joinNames(members.map(person => person.name)) }),
          t('fairness.applyEveryone'),
          t('fairness.applyNew'),
        );
        if (choice === 'dismiss') {
          return false;
        }
        await setCircleBudget(editor, cents, choice === 'primary' ? 'everyone' : 'new');
      } else {
        await setCircleBudget(editor, cents, 'new');
      }
    }
    return true;
  }

  const editorDirty = editor == null
    ? false
    : editor === 'new'
      ? Boolean(draft.trim() || budget.trim())
      : draft.trim() !== (editing?.name ?? '') || budget !== budgetField(editing?.budgetCents);

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
            onAction={() => {
              if (!canAddPerson(snapshot, getEnv().freeTierMaxPeople)) {
                openPaywall();
                return;
              }
              navigation.navigate('AddPerson');
            }}
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
              <CircleFairnessCard
                key={section.circleId}
                section={section}
                money={money}
                sealBeside
                onOpenIdeas={personId => navigation.navigate('Person', { personId, section: 'ideas' })}
                onEdit={() => openEditor(section.circleId)}
              />
            ))}
            {sections.length === 0 && people.length > 0 ? <Body>{t('fairness.noCircles')}</Body> : null}
            {others.length > 0 ? <Uncircled people={others} gifts={snapshot.gifts} year={year} money={money} /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('fairness.newCircle')}
              onPress={() => {
                setDraft('');
                setNameError('');
                setBudget('');
                setBudgetError('');
                setEditor('new');
              }}
              style={styles.addCircle}>
              <AddCircleLabel label={sections.length === 0 ? t('fairness.createCircle') : `+ ${t('fairness.newCircle')}`} />
            </Pressable>
          </>
        )}
      </SessionEntrance>
      <Sheet
        visible={editor != null}
        title={editor === 'new' ? t('fairness.newCircle') : editing?.name ?? t('fairness.edit')}
        dirty={editorDirty}
        onClose={() => setEditor(null)}
      >
        <Field
          label={t('fairness.circleName')}
          value={draft}
          error={nameError}
          onChangeText={value => {
            setDraft(value);
            setNameError('');
          }}
        />
        <Field
          label={t('fairness.circleBudget')}
          value={budget}
          error={budgetError}
          prefix="$"
          suffix={t('person.perYearSuffix')}
          keyboardType="decimal-pad"
          onChangeText={value => {
            setBudget(value);
            setBudgetError('');
          }}
        />
        <Caption>{t('fairness.circleBudgetHint')}</Caption>
        <Button
          label={t('common.saveChanges')}
          onPress={() => {
            saveEditor().then(ok => {
              if (ok) {
                setEditor(null);
              }
            }).catch(() => undefined);
          }}
        />
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

function budgetField(cents: number | null | undefined): string {
  if (cents == null) {
    return '';
  }
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
}

function AddCircleLabel({ label }: { label: string }) {
  const { colors, type, typeScale } = useTheme();
  return (
    <Text maxFontSizeMultiplier={typeScale.button} style={[type.button, { color: colors.pink }]}>{label}</Text>
  );
}

function Uncircled({
  people,
  gifts,
  year,
  money,
}: {
  people: ReturnType<typeof uncircledPeople>;
  gifts: Parameters<typeof yearSpentCents>[1];
  year: number;
  money: (cents: number) => string;
}) {
  const { colors, type, typeScale } = useTheme();
  return (
    <View style={styles.uncircled}>
      <Heading>{t('fairness.notInCircle')}</Heading>
      <RowCard>
        {people.map((person, index) => {
          const spent = yearSpentCents(person.id, gifts, year);
          const line = formatSpentOfBudget(spent, person.budgetCents, money);
          return (
            <View
              key={person.id}
              style={[styles.plainRow, { borderBottomColor: colors.border, borderBottomWidth: index === people.length - 1 ? 0 : StyleSheet.hairlineWidth }]}>
              <Text numberOfLines={1} maxFontSizeMultiplier={typeScale.body} style={[type.body, styles.plainName, { color: colors.text }]}>{person.name}</Text>
              <Text maxFontSizeMultiplier={typeScale.caption} style={[type.caption, { color: colors.muted }]}>{line}</Text>
            </View>
          );
        })}
      </RowCard>
    </View>
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
  uncircled: { gap: space.lg, marginTop: space.lg, marginBottom: space.sm },
  addCircle: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  plainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, minHeight: 48, paddingHorizontal: space.sm },
  plainName: { flex: 1 },
});
