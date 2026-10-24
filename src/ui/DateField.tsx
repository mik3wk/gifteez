import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { parseLocalDate } from '../domain/calendarDate';
import { commonDates, occasionLabel } from '../domain/occasions';
import { formatDate, formatLongDate, t, todayIso } from '../i18n';
import { useTheme } from '../theme/useTheme';
import { space, stroke, touch } from '../theme/tokens';
import { Body, Caption, Chip, Cluster, Toggle } from './ui';

export function MonthDayField({
  label,
  month,
  day,
  year,
  knowYear,
  onKnowYear,
  onChange,
  error,
}: {
  label: string;
  month: string;
  day: string;
  year: string;
  knowYear: boolean;
  onKnowYear: (value: boolean) => void;
  onChange: (next: { month: string; day: string; year: string }) => void;
  error?: string;
}) {
  const { colors, radius } = useTheme();
  const [androidOpen, setAndroidOpen] = useState(false);
  const picked = partsDate(month, day, year, knowYear);
  const shown = month && day ? formatDate(picked) : t('person.chooseDate');
  function apply(date: Date, keepYear: boolean) {
    const cap = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const dayNum = Math.min(date.getDate(), cap);
    onChange({
      month: String(date.getMonth() + 1),
      day: String(dayNum),
      year: keepYear ? String(date.getFullYear()) : '',
    });
  }
  const picker = (
    <DateTimePicker
      value={picked}
      mode="date"
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      style={styles.picker}
      onValueChange={(_event, next) => {
        if (Platform.OS !== 'ios') {
          setAndroidOpen(false);
        }
        if (next) {
          apply(next, knowYear);
        }
      }}
    />
  );
  return (
    <View style={styles.monthDay}>
      <Caption>{label}</Caption>
      <Cluster>
        {commonDates().map(item => {
          const text = `${occasionLabel({ type: item.type })} · ${formatDate(item.date)}`;
          const selected = Number(month) === item.date.getMonth() + 1 && Number(day) === item.date.getDate();
          return (
            <Chip
              key={item.type}
              label={text}
              selected={selected}
              onPress={() => apply(item.date, knowYear)}
            />
          );
        })}
      </Cluster>
      {Platform.OS === 'ios' ? (
        <View style={styles.pickerHost}>{picker}</View>
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={shown}
            onPress={() => setAndroidOpen(true)}
            style={[styles.field, { borderColor: colors.outline, backgroundColor: colors.surface, borderRadius: radius.card }]}>
            <Body>{shown}</Body>
          </Pressable>
          {androidOpen ? picker : null}
        </>
      )}
      <Toggle
        label={t('person.knowYear')}
        value={knowYear}
        onValueChange={value => {
          onKnowYear(value);
          if (value) {
            apply(picked, true);
            return;
          }
          onChange({ month, day, year: '' });
        }}
      />
      {error ? <Caption tone="danger">{error}</Caption> : null}
    </View>
  );
}

function partsDate(month: string, day: string, year: string, knowYear: boolean): Date {
  const now = new Date();
  const monthNum = Number(month) >= 1 && Number(month) <= 12 ? Number(month) : now.getMonth() + 1;
  const yearNum = knowYear && Number(year) > 0 ? Number(year) : now.getFullYear();
  const cap = new Date(yearNum, monthNum, 0).getDate();
  const dayNum = Number(day) >= 1 ? Math.min(Number(day), cap) : Math.min(now.getDate(), cap);
  return new Date(yearNum, monthNum - 1, dayNum);
}

export function DateField({
  label,
  value,
  onChange,
  error,
  maximumDate,
  hideYear,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  error?: string;
  maximumDate?: Date;
  hideYear?: boolean;
}) {
  const { colors, radius } = useTheme();
  const [open, setOpen] = useState(false);
  const known = parseIso(value);
  const parsed = known ?? new Date();
  const shown = known ? (hideYear ? formatDate(known) : formatLongDate(known)) : t('person.chooseDate');
  return (
    <>
      <Caption>{label}</Caption>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={error ? `${label}. ${error}` : `${label}. ${shown}`}
        onPress={() => setOpen(valueOpen => !valueOpen)}
        style={[styles.field, { borderColor: error ? colors.dangerText : colors.outline, backgroundColor: colors.surface, borderRadius: radius.card }]}>
        <Body>{shown}</Body>
      </Pressable>
      {error ? <Caption tone="danger">{error}</Caption> : null}
      {open ? (
        <View style={styles.pickerHost}>
          <DateTimePicker
            value={parsed}
            mode="date"
            maximumDate={maximumDate}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            style={styles.picker}
            onValueChange={(_event, next) => {
              if (Platform.OS !== 'ios') {
                setOpen(false);
              }
              if (next) {
                onChange(todayIso(next));
              }
            }}
            onDismiss={() => setOpen(false)}
          />
        </View>
      ) : null}
    </>
  );
}

function parseIso(value: string): Date | null {
  return parseLocalDate(value);
}

const styles = StyleSheet.create({
  field: {
    minHeight: touch.minTarget,
    borderWidth: stroke.inner,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  monthDay: { gap: space.xs },
  pickerHost: { height: 216, flexShrink: 0, justifyContent: 'center' },
  picker: { height: 216 },
});
