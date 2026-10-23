import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDate, formatLongDate, t, todayIso } from '../i18n';
import { useTheme } from '../theme/useTheme';
import { stroke, touch } from '../theme/tokens';
import { Body, Caption } from './ui';

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
});
