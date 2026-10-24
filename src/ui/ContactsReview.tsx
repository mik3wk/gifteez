import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { getEnv } from '../config/env';
import { contactAddDecision, freeSlotsLeft, withDefaultBudget } from '../domain/contactImport';
import type { ImportedPerson } from '../domain/logic';
import { accountUnlocked, activePeopleCount } from '../domain/logic';
import { t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { useTheme } from '../theme/useTheme';
import { Body, Button, Caption, CheckRow, Field, Sheet } from './ui';

export function ContactsReviewLink({
  label,
  button,
  link,
  row,
  onDone,
}: {
  label: string;
  button?: boolean;
  /** Pink text link for the top of a form. */
  link?: boolean;
  row?: (open: () => void) => React.ReactNode;
  onDone?: (result: number | 'denied') => void;
}) {
  const { colors, type, typeScale } = useTheme();
  const gifteez = useGifteez();
  const [open, setOpen] = useState(false);
  const [denied, setDenied] = useState(false);
  const [drafts, setDrafts] = useState<ImportedPerson[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const paywallAfterClose = useRef(false);

  async function openReview() {
    setDenied(false);
    setQuery('');
    const found = await gifteez.loadContacts();
    if (found === 'denied') {
      setDrafts([]);
      setDenied(true);
      setOpen(true);
      onDone?.('denied');
      return;
    }
    setDrafts(found);
    setPicked({});
    setOpen(true);
  }

  const needle = query.trim().toLowerCase();
  const visible = drafts.filter(person => !needle || person.name.toLowerCase().includes(needle));
  const chosen = drafts.filter((_, index) => picked[String(index)] === true);
  const slotsLeft = freeSlotsLeft(
    activePeopleCount(gifteez.snapshot),
    getEnv().freeTierMaxPeople,
    accountUnlocked(gifteez.snapshot),
  );
  const slotsShown = slotsLeft == null ? null : Math.max(0, slotsLeft - chosen.length);

  async function addChosen() {
    const decision = contactAddDecision(chosen.length, slotsLeft);
    if (decision === 'paywall') {
      paywallAfterClose.current = true;
      setOpen(false);
      return;
    }
    if (decision !== 'add') {
      return;
    }
    setBusy(true);
    try {
      const rows = withDefaultBudget(chosen, gifteez.snapshot.profile.defaultBudgetCents);
      const count = await gifteez.importPeople(rows);
      setOpen(false);
      onDone?.(count);
    } finally {
      setBusy(false);
    }
  }

  const startReview = () => { openReview().catch(() => undefined); };
  return (
    <>
      {row ? row(startReview) : button ? (
        <Button label={label} tone="secondary" onPress={startReview} />
      ) : link ? (
        <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={startReview} style={styles.link}>
          <Text maxFontSizeMultiplier={typeScale.body} style={[type.body, { color: colors.pink }]}>{label}</Text>
        </Pressable>
      ) : (
        <Button label={label} tone="secondary" onPress={startReview} />
      )}
      <Sheet
        visible={open}
        title={t('importFlow.contactsTitle')}
        onClose={() => setOpen(false)}
        onDismiss={() => {
          if (!paywallAfterClose.current) {
            return;
          }
          paywallAfterClose.current = false;
          gifteez.openPaywall();
        }}>
        <Caption>{t('importFlow.contactsReadOnly')}</Caption>
        {denied ? <Body>{t('importFlow.denied')}</Body> : null}
        {!denied && drafts.length === 0 ? <Body>{t('importFlow.none')}</Body> : null}
        {!denied && drafts.length > 0 ? (
          <Field
            label={t('importFlow.searchContacts')}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            textContentType="none"
            returnKeyType="search"
          />
        ) : null}
        {!denied && slotsShown != null ? <Caption>{t('importFlow.freeLeft', { left: slotsShown, limit: getEnv().freeTierMaxPeople })}</Caption> : null}
        {visible.map(person => {
          const index = drafts.indexOf(person);
          const key = String(index);
          const when = person.month && person.day ? ` · ${person.month}/${person.day}` : '';
          return (
            <CheckRow
              key={`${person.name}-${key}`}
              label={`${person.name}${when}`}
              checked={picked[key] === true}
              onPress={() => setPicked(current => ({ ...current, [key]: !current[key] }))}
            />
          );
        })}
        {chosen.length > 0 ? (
          <Button
            label={chosen.length === 1 ? t('importFlow.addPersonOne') : t('importFlow.addPersonMany', { count: chosen.length })}
            busy={busy}
            onPress={() => { addChosen().catch(() => undefined); }}
          />
        ) : null}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
});
