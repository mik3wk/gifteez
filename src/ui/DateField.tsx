import React, { useLayoutEffect, useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { parseLocalDate } from '../domain/calendarDate';
import { formatDate, formatLongDate, t, todayIso } from '../i18n';
import { useTheme } from '../theme/useTheme';
import { space, stroke, touch } from '../theme/tokens';
import { Icon } from './icons';
import { Body, Caption, Toggle } from './ui';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WHEEL_ROW = touch.minTarget;
const WHEEL_ROWS = 5;
const WHEEL_HEIGHT = WHEEL_ROW * WHEEL_ROWS;
const WHEEL_PAD = WHEEL_ROW * 2;

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

function centeredIndex(offsetY: number, count: number): number {
  if (count <= 0) {
    return 0;
  }
  return Math.min(count - 1, Math.max(0, Math.round(offsetY / WHEEL_ROW)));
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
  const fromScroll = useRef(false);
  const index = Math.max(0, items.findIndex(item => item.id === value));
  const offset = index * WHEEL_ROW;
  function scrollToExact(y: number, animated: boolean) {
    const node = list.current as { scrollTo?: (options: { y: number; animated: boolean }) => void } | null;
    node?.scrollTo?.({ y, animated });
  }
  useLayoutEffect(() => {
    if (fromScroll.current) {
      fromScroll.current = false;
      return;
    }
    scrollToExact(offset, false);
  }, [offset, items.length]);
  function selectCentered(offsetY: number) {
    const id = items[centeredIndex(offsetY, items.length)]?.id;
    if (!id || id === value) {
      return;
    }
    fromScroll.current = true;
    onChange(id);
  }
  function onScrollEndDrag(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const velocity = event.nativeEvent.velocity?.y ?? 0;
    // A slow drag can report a tiny velocity and then never fire momentum.
    if (Math.abs(velocity) >= 0.2) {
      return;
    }
    const raw = event.nativeEvent.targetContentOffset?.y ?? event.nativeEvent.contentOffset.y;
    const next = centeredIndex(raw, items.length);
    scrollToExact(next * WHEEL_ROW, true);
    selectCentered(raw);
  }
  return (
    <View style={styles.wheel}>
      <Caption>{label}</Caption>
      <ScrollView
        ref={list}
        style={styles.wheelList}
        contentContainerStyle={styles.wheelContent}
        accessibilityLabel={label}
        contentOffset={{ x: 0, y: offset }}
        snapToInterval={WHEEL_ROW}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        onMomentumScrollEnd={event => {
          const y = event.nativeEvent.contentOffset.y;
          const next = centeredIndex(y, items.length);
          if (Math.abs(y - next * WHEEL_ROW) > 1) {
            scrollToExact(next * WHEEL_ROW, true);
          }
          selectCentered(y);
        }}
        onScrollEndDrag={onScrollEndDrag}>
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
                style={[selected ? type.heading : type.body, styles.wheelLabel, { color: selected ? colors.onPink : colors.text, fontSize: selected ? 22 : 18 }]}>
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
  wheels: { flexDirection: 'row', gap: space.xs },
  wheel: { flex: 1, flexShrink: 0, gap: space.xxs },
  wheelList: { height: WHEEL_HEIGHT, flexShrink: 0, overflow: 'hidden' },
  pickerHost: { height: 216, flexShrink: 0, justifyContent: 'center' },
  picker: { height: 216 },
  wheelContent: { paddingVertical: WHEEL_PAD },
  wheelItem: {
    height: WHEEL_ROW,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
    paddingHorizontal: space.xs,
  },
  wheelLabel: { flex: 1 },
});
