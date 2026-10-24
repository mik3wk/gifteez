import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { CalendarDraft } from '../domain/calendarImport';
import { scanCalendar } from '../platform/importers';
import { deviceLocale, formatDate, t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Icon } from './icons';
import { Body, Button, CheckRow, Sheet } from './ui';

export function CalendarReviewLink({ label, button }: { label: string; button?: boolean }) {
  const { colors, type, typeScale } = useTheme();
  const gifteez = useGifteez();
  const [open, setOpen] = useState(false);
  const [denied, setDenied] = useState(false);
  const [drafts, setDrafts] = useState<CalendarDraft[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  async function openReview() {
    setDenied(false);
    const found = await scanCalendar(gifteez.snapshot.people);
    if (found === 'denied') {
      setDrafts([]);
      setDenied(true);
      setOpen(true);
      return;
    }
    setDrafts(found);
    setPicked(Object.fromEntries(found.map(item => [item.key, true])));
    setOpen(true);
  }

  const chosen = drafts.filter(item => picked[item.key]);

  async function addChosen() {
    setBusy(true);
    const created = new Map<string, string>();
    const added = new Set<string>();
    try {
      for (const draft of chosen) {
        const nameKey = draft.name.toLowerCase();
        let personId = draft.personId ?? created.get(nameKey) ?? null;
        if (!personId || !gifteez.snapshot.people.some(person => person.id === personId && !person.deleted)) {
          if (!created.has(nameKey)) {
            personId = await gifteez.addPerson({
              name: draft.name,
              budget: '',
              tags: [],
              imported: true,
              relationship: '',
            });
            if (personId) {
              created.set(nameKey, personId);
            }
          } else {
            personId = created.get(nameKey) ?? null;
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

  return (
    <>
      {button ? (
        <Button label={label} tone="secondary" onPress={() => { openReview().catch(() => undefined); }} />
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { openReview().catch(() => undefined); }} style={styles.link}>
          <Icon name="calendar" color={colors.pink} size={18} />
          <Text maxFontSizeMultiplier={typeScale.caption} style={[type.caption, { color: colors.pink }]}>{label}</Text>
        </Pressable>
      )}
      <Sheet visible={open} title={t('importFlow.reviewTitle')} onClose={() => setOpen(false)}>
        {denied ? <Body>{t('importFlow.denied')}</Body> : null}
        {!denied && drafts.length === 0 ? <Body>{t('importFlow.none')}</Body> : null}
        {drafts.map(draft => {
          const when = formatDate(new Date(2026, draft.month - 1, draft.day), deviceLocale());
          const who = draft.personId ? t('importFlow.matched', { name: draft.name }) : t('importFlow.newPerson', { name: draft.name });
          return (
            <CheckRow
              key={draft.key}
              label={`${draft.title} · ${when}. ${who}`}
              checked={picked[draft.key] !== false}
              onPress={() => setPicked(current => ({ ...current, [draft.key]: !current[draft.key] }))}
            />
          );
        })}
        {chosen.length > 0 ? (
          <Button
            label={chosen.length === 1 ? t('importFlow.addOne') : t('importFlow.addMany', { count: chosen.length })}
            busy={busy}
            onPress={() => { addChosen().catch(() => undefined); }}
          />
        ) : null}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', minHeight: 44 },
});
