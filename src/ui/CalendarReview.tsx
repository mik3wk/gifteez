import React, { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getEnv } from '../config/env';
import { calendarAddLabel, calendarSelection, draftStatus, initiallyChosen, type CalendarDraft } from '../domain/calendarImport';
import { contactAddDecision, freeSlotCaption, freeSlotsLeft } from '../domain/contactImport';
import { accountUnlocked, activePeopleCount } from '../domain/logic';
import { scanCalendar } from '../platform/importers';
import { deviceLocale, formatDate, t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Icon } from './icons';
import { Body, Button, Caption, CheckRow, Sheet } from './ui';

function budgetField(cents: number | null | undefined): string {
  if (typeof cents !== 'number') {
    return '';
  }
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
}

export function CalendarReviewLink({
  label,
  button,
  row,
}: {
  label: string;
  button?: boolean;
  row?: (open: () => void) => React.ReactNode;
}) {
  const { colors, type, typeScale, radius } = useTheme();
  const gifteez = useGifteez();
  const [open, setOpen] = useState(false);
  const [denied, setDenied] = useState(false);
  const [drafts, setDrafts] = useState<CalendarDraft[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const paywallAfterClose = useRef(false);
  const reviewAfterAsk = useRef(false);

  async function openReview() {
    setDenied(false);
    const found = await scanCalendar(gifteez.snapshot.people, gifteez.snapshot.occasions);
    if (found === 'denied') {
      setDrafts([]);
      setDenied(true);
      setOpen(true);
      return;
    }
    setDrafts(found);
    setPicked(Object.fromEntries(found.map(item => [item.key, initiallyChosen(item)])));
    setOpen(true);
  }

  const chosen = drafts.filter(item => !item.alreadyAdded && picked[item.key]);
  const summary = calendarSelection(chosen);
  const slotsLeft = freeSlotsLeft(
    activePeopleCount(gifteez.snapshot),
    getEnv().freeTierMaxPeople,
    accountUnlocked(gifteez.snapshot),
  );
  const slotCaption = freeSlotCaption(summary.people, slotsLeft);

  async function addChosen() {
    if (summary.people > 0 && contactAddDecision(summary.people, slotsLeft) === 'paywall') {
      paywallAfterClose.current = true;
      setOpen(false);
      return;
    }
    setBusy(true);
    const created = new Map<string, string>();
    const added = new Set<string>();
    try {
      for (const draft of chosen) {
        const nameKey = draft.name.trim().toLowerCase();
        if (!nameKey) {
          continue;
        }
        let personId = draft.personId ?? created.get(nameKey) ?? null;
        if (!personId || !gifteez.snapshot.people.some(person => person.id === personId && !person.deleted)) {
          const living = gifteez.snapshot.people.find(person => (
            !person.deleted && person.name.trim().toLowerCase() === nameKey
          ));
          personId = living?.id ?? created.get(nameKey) ?? null;
        }
        if (!personId) {
          personId = await gifteez.addPerson({
            name: draft.name.trim(),
            budget: budgetField(gifteez.snapshot.profile.defaultBudgetCents),
            tags: [],
            imported: true,
            relationship: '',
          });
          if (personId) {
            created.set(nameKey, personId);
          }
        }
        if (!personId) {
          break;
        }
        const mark = `${personId}|${draft.occasion}|${draft.month}|${draft.day}`;
        const already = added.has(mark) || gifteez.snapshot.occasions.some(item => (
          !item.deleted
          && item.personId === personId
          && item.type === draft.occasion
          && item.month === draft.month
          && item.day === draft.day
        ));
        if (!already) {
          await gifteez.addOccasion(personId, draft.occasion, draft.month, draft.day);
          added.add(mark);
        }
      }
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  const startReview = () => {
    if (Platform.OS === 'ios') {
      setAsk(true);
      return;
    }
    openReview().catch(() => undefined);
  };
  return (
    <>
      {row ? row(startReview) : button ? (
        <Button label={label} tone="secondary" onPress={startReview} />
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={startReview} style={styles.link}>
          <Icon name="calendar" color={colors.pink} size={18} />
          <Text maxFontSizeMultiplier={typeScale.caption} style={[type.caption, { color: colors.pink }]}>{label}</Text>
        </Pressable>
      )}
      <Sheet
        visible={ask}
        compact
        title={t('people.findBirthdays')}
        onClose={() => setAsk(false)}
        onDismiss={() => {
          if (!reviewAfterAsk.current) {
            return;
          }
          reviewAfterAsk.current = false;
          openReview().catch(() => undefined);
        }}>
        <Body>{t('importFlow.calendarPreprompt')}</Body>
        <Button label={t('common.continue')} onPress={() => {
          reviewAfterAsk.current = true;
          setAsk(false);
        }} />
      </Sheet>
      <Sheet
        visible={open}
        title={t('importFlow.reviewTitle')}
        onClose={() => setOpen(false)}
        onDismiss={() => {
          if (!paywallAfterClose.current) {
            return;
          }
          paywallAfterClose.current = false;
          gifteez.openPaywall();
        }}>
        <Caption>{t('importFlow.readOnly')}</Caption>
        {denied ? <Body>{t('importFlow.denied')}</Body> : null}
        {!denied && drafts.length === 0 ? <Body>{t('importFlow.none')}</Body> : null}
        {!denied && slotCaption.kind === 'left' ? <Caption>{t('importFlow.freeLeft', { left: slotCaption.left, limit: getEnv().freeTierMaxPeople })}</Caption> : null}
        {!denied && slotCaption.kind === 'unlock' ? <Caption>{t('importFlow.unlockMore', { count: slotCaption.count })}</Caption> : null}
        {drafts.map(draft => {
          const when = formatDate(new Date(2026, draft.month - 1, draft.day), deviceLocale());
          const status = draftStatus(draft);
          const who = status === 'matched'
            ? t('importFlow.matched', { name: draft.name })
            : status === 'newPerson'
              ? t('importFlow.newPerson', { name: draft.name })
              : t(`importFlow.${status}`);
          const toggle = () => {
            if (draft.alreadyAdded) {
              return;
            }
            setPicked(current => ({ ...current, [draft.key]: !current[draft.key] }));
          };
          return (
            <View key={draft.key}>
              {draft.nameEditable ? (
                <CheckRow
                  label={t('importFlow.editName')}
                  checked={picked[draft.key] === true}
                  disabled={draft.alreadyAdded === true}
                  onPress={toggle}
                  field={(
                    <>
                      <TextInput
                        accessibilityLabel={t('importFlow.editName')}
                        placeholder={t('importFlow.addName')}
                        value={draft.name}
                        onChangeText={name => setDrafts(current => current.map(item => (
                          item.key === draft.key ? { ...item, name } : item
                        )))}
                        autoCorrect={false}
                        autoCapitalize="words"
                        maxFontSizeMultiplier={typeScale.body}
                        placeholderTextColor={colors.muted}
                        style={[type.body, styles.nameInput, { color: colors.text, borderColor: colors.outline, backgroundColor: colors.surface, borderRadius: radius.button }]}
                      />
                      <Caption>{`${when}. ${who}`}</Caption>
                    </>
                  )}
                />
              ) : (
                <CheckRow
                  label={`${draft.name} · ${when}. ${who}`}
                  checked={!draft.alreadyAdded && picked[draft.key] === true}
                  disabled={draft.alreadyAdded === true}
                  onPress={toggle}
                />
              )}
            </View>
          );
        })}
        {summary.people > 0 || summary.occasions > 0 ? (
          <Button
            label={calendarAddLabel(summary.people, summary.occasions)}
            busy={busy}
            onPress={() => { addChosen().catch(() => undefined); }}
          />
        ) : null}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  nameInput: { borderWidth: 1, minHeight: 44, paddingHorizontal: space.sm },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', minHeight: 44 },
});
