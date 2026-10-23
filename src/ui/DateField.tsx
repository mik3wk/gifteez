import React, { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDate, formatLongDate, t, todayIso } from '../i18n';
import { useTheme } from '../theme/useTheme';
import { space, stroke, touch } from '../theme/tokens';
import { Icon } from './icons';
import { Body, Caption, Toggle } from './ui';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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
  const monthNum = Number(month);
  const yearNum = Number(year);
  const length = daysInMonth(monthNum, knowYear ? yearNum : undefined);
  const days = Array.from({ length }, (_, index) => String(index + 1));
  const years = Array.from({ length: new Date().getFullYear() + 2 - 1920 }, (_, index) => String(new Date().getFullYear() + 1 - index));
  return (
    <View style={styles.monthDay}>
      <Caption>{label}</Caption>
      <View style={styles.wheels}>
        <Wheel
          label={t('person.month')}
          items={MONTHS.map((name, index) => ({ id: String(index + 1), label: name }))}
          value={month}
          onChange={next => {
            const cap = daysInMonth(Number(next), knowYear ? yearNum : undefined);
            const nextDay = Number(day) > cap ? String(cap) : day;
            onChange({ month: next, day: nextDay, year });
          }}
        />
        <Wheel
          label={t('person.day')}
          items={days.map(item => ({ id: item, label: item }))}
          value={day}
          onChange={next => onChange({ month, day: next, year })}
        />
        {knowYear ? (
          <Wheel
            label={t('person.year')}
            items={years.map(item => ({ id: item, label: item }))}
            value={year}
            onChange={next => onChange({ month, day, year: next })}
          />
        ) : null}
      </View>
      <Toggle label={t('person.knowYear')} value={knowYear} onValueChange={onKnowYear} />
      {error ? <Caption tone="danger">{error}</Caption> : null}
    </View>
  );
}

function Wheel({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  const { colors, radius, type, typeScale } = useTheme();
  const list = useRef<ComponentRef<typeof ScrollView>>(null);
  const index = Math.max(0, items.findIndex(item => item.id === value));
  const offset = index * touch.minTarget;
  useEffect(() => {
    list.current?.scrollTo({ y: offset, animated: false });
  }, [offset]);
  return (
    <View style={styles.wheel}>
      <Caption>{label}</Caption>
      <ScrollView
        ref={list}
        style={styles.wheelList}
        accessibilityLabel={label}
        contentOffset={{ x: 0, y: offset }}
        snapToInterval={touch.minTarget}
        decelerationRate="fast"
        onLayout={() => list.current?.scrollTo({ y: offset, animated: false })}>
        {items.map(item => {
          const selected = item.id === value;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              onPress={() => onChange(item.id)}
              style={[
                styles.wheelItem,
                selected ? { backgroundColor: colors.pink, borderRadius: radius.chip } : null,
              ]}>
              {selected ? <Icon name="check" color={colors.onPink} size={16} /> : null}
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={typeScale.body}
                style={[selected ? type.heading : type.body, styles.wheelLabel, { color: selected ? colors.onPink : colors.text }]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function daysInMonth(month: number, year?: number): number {
  if (!month || month < 1 || month > 12) {
    return 31;
  }
  const safeYear = year && year > 0 ? year : 2024;
  return new Date(safeYear, month, 0).getDate();
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
        <DateTimePicker
          value={parsed}
          mode="date"
          maximumDate={maximumDate}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, next) => {
            if (Platform.OS !== 'ios') {
              setOpen(false);
            }
            if (event.type === 'dismissed' || !next) {
              return;
            }
            onChange(todayIso(next));
          }}
        />
      ) : null}
    </>
  );
}

function parseIso(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

const styles = StyleSheet.create({
  field: {
    minHeight: touch.minTarget,
    borderWidth: stroke.inner,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  monthDay: { gap: space.xs },
  wheels: { flexDirection: 'row', gap: space.xs },
  wheel: { flex: 1, gap: space.xxs },
  wheelList: { maxHeight: 160 },
  wheelItem: {
    minHeight: touch.minTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
    paddingHorizontal: space.xs,
  },
  wheelLabel: { flex: 1 },
});
