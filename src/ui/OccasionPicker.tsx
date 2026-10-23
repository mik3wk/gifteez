import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { isRealMonthDay } from '../domain/logic';
import {
  nextOccasionDate,
  OCCASION_PRESETS,
  occasionLabel,
  occasionNeedsDate,
  planOccasion,
  presetFor,
  type OccasionPreset,
} from '../domain/occasions';
import type { Occasion } from '../domain/types';
import { formatDate, t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { Body, Button, Field } from './ui';

const GROUPS: OccasionPreset['group'][] = ['holiday', 'celebration', 'life'];

export function OccasionPicker({ personId }: { personId: string }) {
  const { addOccasion, colors } = useGifteez();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('birthday');
  const [customName, setCustomName] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const [everyYear, setEveryYear] = useState(true);
  const [dateError, setDateError] = useState('');
  const [nameError, setNameError] = useState('');

  const q = query.trim().toLowerCase();
  const needsDate = occasionNeedsDate(selected);
  const preset = presetFor(selected);
  const asksRecurrence = selected === 'custom' || !preset || preset.rule.kind === 'ask';
  const filtered = OCCASION_PRESETS.filter(item => occasionLabel({ type: item.id }).toLowerCase().includes(q));
  const planned = planOccasion({
    type: selected,
    month: needsDate ? Number(month) || undefined : undefined,
    day: needsDate ? Number(day) || undefined : undefined,
    year: needsDate ? Number(year) || undefined : undefined,
    label: selected === 'custom' ? customName : undefined,
    recurs: asksRecurrence ? everyYear : true,
    today: new Date(),
  });
  const preview = previewLabel(planned, selected, personId);

  function choose(id: string) {
    setSelected(id);
    setDateError('');
    setNameError('');
    const next = presetFor(id);
    setEveryYear(next ? next.yearly : false);
  }

  return (
    <View style={styles.block}>
      <Field
        label={t('person.searchOccasions')}
        value={query}
        onChangeText={setQuery}
        placeholder={t('person.searchOccasions')}
      />
      {q ? (
        filtered.length === 0 ? <Body>{t('person.noOccasionMatch')}</Body> : (
          <View style={styles.list}>
            {filtered.map(item => (
              <Choice key={item.id} label={occasionLabel({ type: item.id })} selected={selected === item.id} onPress={() => choose(item.id)} />
            ))}
          </View>
        )
      ) : (
        <View style={styles.chips}>
          {OCCASION_PRESETS.filter(item => item.featured).map(item => (
            <Choice key={item.id} label={occasionLabel({ type: item.id })} selected={selected === item.id} onPress={() => choose(item.id)} chip />
          ))}
        </View>
      )}
      {q ? null : (
        <Button
          label={open ? t('person.fewerOccasions') : t('person.allOccasions')}
          tone="ghost"
          onPress={() => setOpen(value => !value)}
        />
      )}
      {!q && open ? GROUPS.map(group => {
        const items = OCCASION_PRESETS.filter(item => item.group === group && !item.featured);
        if (items.length === 0) {
          return null;
        }
        return (
          <View key={group} style={styles.list}>
            <Text style={[styles.group, { color: colors.muted }]}>{t(`occasions.groups.${group}`)}</Text>
            {items.map(item => (
              <Choice key={item.id} label={occasionLabel({ type: item.id })} selected={selected === item.id} onPress={() => choose(item.id)} />
            ))}
          </View>
        );
      }) : null}
{!q || filtered.length === 0 || t('occasions.custom').toLowerCase().includes(q) ? (
        <Choice label={t('occasions.custom')} selected={selected === 'custom'} onPress={() => choose('custom')} />
      ) : null}
      {selected === 'custom' ? (
        <Field
          label={t('person.customName')}
          value={customName}
          error={nameError}
          onChangeText={value => {
            setCustomName(value);
            setNameError('');
          }}
        />
      ) : null}
      {needsDate ? (
        <>
          <View style={styles.dates}>
            <View style={styles.flex}>
              <Field
                label={t('person.month')}
                value={month}
                error={dateError}
                onChangeText={value => {
                  setMonth(value);
                  setDateError('');
                }}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.flex}>
              <Field label={t('person.day')} value={day} onChangeText={setDay} keyboardType="number-pad" />
            </View>
          </View>
          <Field label={t('person.year')} value={year} onChangeText={setYear} keyboardType="number-pad" />
        </>
      ) : null}
      {asksRecurrence ? (
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={t('person.everyYear')}
          accessibilityState={{ checked: everyYear }}
          onPress={() => setEveryYear(value => !value)}
          style={({ pressed }) => [
            styles.choice,
            { borderColor: colors.border, backgroundColor: everyYear ? colors.accent : colors.surface, opacity: pressed ? 0.72 : 1 },
          ]}>
          <Text style={{ color: everyYear ? colors.accentText : colors.text }}>
            {everyYear ? t('person.everyYear') : t('person.oneTime')}
          </Text>
        </Pressable>
      ) : null}
      {preset?.note ? <Body>{preset.note}</Body> : null}
      {!needsDate && preview ? <Body>{preview}</Body> : null}
      <Button
        label={t('person.addOccasion')}
        onPress={() => {
          if (selected === 'custom' && !customName.trim()) {
            setNameError(t('person.nameNeeded'));
            return;
          }
          const monthNum = Number(month);
          const dayNum = Number(day);
          if (needsDate && !isRealMonthDay(monthNum, dayNum)) {
            setDateError(t('errors.date'));
            return;
          }
          const yearNum = Number(year);
          return addOccasion(
            personId,
            selected,
            needsDate ? monthNum : undefined,
            needsDate ? dayNum : undefined,
            needsDate && yearNum > 0 ? yearNum : undefined,
            {
              label: selected === 'custom' ? customName.trim() : undefined,
              recurs: asksRecurrence ? everyYear : true,
            },
          );
        }}
      />
    </View>
  );
}

function previewLabel(
  planned: ReturnType<typeof planOccasion>,
  type: string,
  personId: string,
): string {
  if (planned === 'need-date' || planned === 'need-name') {
    return '';
  }
  const draft: Occasion = {
    id: 'draft',
    personId,
    type,
    month: planned.month,
    day: planned.day,
    ...(planned.year ? { year: planned.year } : {}),
    recurs: planned.recurs,
    ...(planned.label ? { label: planned.label } : {}),
    updatedAt: 0,
  };
  const next = nextOccasionDate(draft, new Date());
  return next ? formatDate(next) : '';
}

function Choice({
  label,
  selected,
  onPress,
  chip,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  chip?: boolean;
}) {
  const { colors } = useGifteez();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        chip ? styles.chip : styles.choice,
        {
          borderColor: selected ? colors.accent : colors.border,
          backgroundColor: selected ? colors.accent : colors.surface,
          opacity: pressed ? 0.72 : 1,
        },
      ]}>
      <Text style={{ color: selected ? colors.accentText : colors.text }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  list: { gap: 8 },
  group: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  choice: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  chip: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dates: { flexDirection: 'row', gap: 8 },
  flex: { flexGrow: 1, flexBasis: 120 },
});
