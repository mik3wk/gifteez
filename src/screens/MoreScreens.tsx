import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DeviceInfo from 'react-native-device-info';
import type { RootStack } from '../app/navigation';
import { describeImport } from '../domain/importNote';
import { accountUnlocked, parseBudget } from '../domain/logic';
import { t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import type { SkinId } from '../theme/skins';
import { chrome, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { CalendarReviewLink } from '../ui/CalendarReview';
import { Icon, type IconName } from '../ui/icons';
import { SessionEntrance } from '../ui/motion';
import {
  AppHeader,
  Body,
  Caption,
  Chip,
  Cluster,
  Field,
  Screen,
  Segment,
  Sheet,
  UnlockSheet,
} from '../ui/ui';

export { FairnessScreen } from './FairnessScreen';

const SKIN_CHOICES: Array<{ id: SkinId | 'auto'; label: string }> = [
  { id: 'auto', label: 'settings.skinAuto' },
  { id: 'base', label: 'settings.skinBase' },
  { id: 'fall', label: 'settings.skinFall' },
  { id: 'winter', label: 'settings.skinWinter' },
  { id: 'spring', label: 'settings.skinSpring' },
  { id: 'summer', label: 'settings.skinSummer' },
];

const LEAD_CHOICES = [1, 3, 7, 14];

type SheetId = 'household' | 'name' | 'remind' | 'theme' | 'privacy' | 'contact' | 'skins' | 'unlock' | 'budget';

export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const {
    snapshot,
    restorePurchases,
    shareBackup,
    pickBackup,
    error,
    appearance,
    setAppearance,
    updateProfile,
    previewSkin,
    skinPreview,
    importFromContacts,
  } = useGifteez();
  const [sheet, setSheet] = useState<SheetId | null>(null);
  const [budget, setBudget] = useState('');
  const [budgetError, setBudgetError] = useState('');
  const [importNote, setImportNote] = useState('');
  const [household, setHousehold] = useState(snapshot.profile.householdName ?? '');
  const [given, setGiven] = useState(snapshot.profile.givenName ?? '');
  const [lead, setLead] = useState(snapshot.profile.reminderLeadDays ?? 7);
  const [clock, setClock] = useState(() => clockFrom(snapshot.profile.reminderHour ?? 9, snapshot.profile.reminderMinute ?? 0));
  const householdValue = snapshot.profile.householdName?.trim() || t('people.householdDefault');
  const givenValue = snapshot.profile.givenName?.trim() ?? '';
  const remindValue = t('settings.remindValue', {
    count: snapshot.profile.reminderLeadDays ?? 7,
    time: formatClock(snapshot.profile.reminderHour ?? 9, snapshot.profile.reminderMinute ?? 0),
  });
  const themeValue = appearance === 'light'
    ? t('settings.appearanceLight')
    : appearance === 'dark'
      ? t('settings.appearanceDark')
      : t('settings.appearanceSystem');
  const leadOptions = LEAD_CHOICES.includes(lead) ? LEAD_CHOICES : [...LEAD_CHOICES, lead].sort((a, b) => a - b);

  function openHousehold() {
    setHousehold(snapshot.profile.householdName ?? '');
    setSheet('household');
  }

  function openName() {
    setGiven(snapshot.profile.givenName ?? '');
    setSheet('name');
  }

  function openRemind() {
    const days = snapshot.profile.reminderLeadDays ?? 7;
    const hour = snapshot.profile.reminderHour ?? 9;
    const minute = snapshot.profile.reminderMinute ?? 0;
    setLead(days);
    setClock(clockFrom(hour, minute));
    setSheet('remind');
  }

  function saveHousehold() {
    const next = household.trim().slice(0, 40);
    setSheet(null);
    if (next !== (snapshot.profile.householdName ?? '')) {
      updateProfile({ householdName: next }).catch(() => undefined);
    }
  }

  function openBudget() {
    setBudget(budgetField(snapshot.profile.defaultBudgetCents));
    setBudgetError('');
    setSheet('budget');
  }

  function saveBudget() {
    if (!budget.trim()) {
      setSheet(null);
      if (snapshot.profile.defaultBudgetCents != null) {
        updateProfile({ defaultBudgetCents: null }).catch(() => undefined);
      }
      return;
    }
    const cents = parseBudget(budget);
    if (cents == null) {
      setBudgetError(t('errors.price'));
      return;
    }
    setSheet(null);
    if (cents !== snapshot.profile.defaultBudgetCents) {
      updateProfile({ defaultBudgetCents: cents }).catch(() => undefined);
    }
  }

  function saveGiven() {
    const next = given.trim().slice(0, 40);
    setSheet(null);
    if (next !== (snapshot.profile.givenName ?? '')) {
      updateProfile({ givenName: next }).catch(() => undefined);
    }
  }

  return (
    <Screen tab="settings">
      <AppHeader title={t('settings.title')} />
      <SessionEntrance id="settings">
        <SettingsGroup title={t('settings.household')}>
          <SettingsRow icon="home" label={t('settings.householdName')} value={householdValue} onPress={openHousehold} />
          <SettingsRow icon="people" label={t('settings.yourName')} value={givenValue} onPress={openName} />
        </SettingsGroup>
        <SettingsGroup title={t('settings.reminders')}>
          <ReminderRow />
          <SettingsRow icon="bell" label={t('settings.remindMe')} value={remindValue} onPress={openRemind} />
        </SettingsGroup>
        <SettingsGroup title={t('settings.appearance')}>
          <SettingsRow icon="sparkle" label={t('settings.theme')} value={themeValue} onPress={() => setSheet('theme')} />
        </SettingsGroup>
        <SettingsGroup title={t('settings.gifts')}>
          <SettingsRow
            icon="gift"
            label={t('settings.defaultBudget')}
            value={budgetLabel(snapshot.profile.defaultBudgetCents)}
            onPress={openBudget}
          />
        </SettingsGroup>
        <SettingsGroup title={t('settings.plus')}>
          <SettingsRow
            icon="gift"
            label={t('settings.unlockAction')}
            value={accountUnlocked(snapshot) ? t('settings.unlockedValue') : undefined}
            onPress={() => setSheet('unlock')}
          />
          <SettingsRow icon="gift" label={t('settings.restore')} onPress={() => { restorePurchases().catch(() => undefined); }} />
        </SettingsGroup>
        {error ? <Caption tone="danger">{error}</Caption> : null}
        <SettingsGroup title={t('settings.yourData')} footer={t('settings.backupHint')}>
          <SettingsRow icon="gear" label={t('settings.export')} onPress={() => { shareBackup().catch(() => undefined); }} />
          <SettingsRow icon="gear" label={t('settings.restoreRow')} onPress={() => { pickBackup().catch(() => undefined); }} />
        </SettingsGroup>
        <SettingsGroup footer={t('settings.calendarHint')}>
          <CalendarReviewLink
            label={t('people.findBirthdays')}
            row={open => <SettingsRow icon="calendar" label={t('people.findBirthdays')} onPress={open} />}
          />
        </SettingsGroup>
        <SettingsGroup footer={t('settings.contactsHint')}>
          <SettingsRow
            icon="people"
            label={t('settings.contacts')}
            onPress={() => {
              importFromContacts().then(result => setImportNote(describeImport(result))).catch(() => undefined);
            }}
          />
        </SettingsGroup>
        {importNote ? <Caption>{importNote}</Caption> : null}
        <SettingsGroup title={t('settings.about')} footer={t('shop.disclosure')}>
          <SettingsRow icon="heart" label={t('settings.privacyTitle')} onPress={() => setSheet('privacy')} />
          <SettingsRow icon="heart" label={t('settings.contact')} onPress={() => setSheet('contact')} />
          <SettingsRow
            icon="sparkle"
            label={t('settings.version')}
            value={`${DeviceInfo.getVersion()} (${DeviceInfo.getBuildNumber()})`}
            chevron={false}
          />
        </SettingsGroup>
        {__DEV__ ? (
          <SettingsGroup title={t('settings.developer')}>
            <SettingsRow icon="sparkle" label={t('settings.skinPreview')} onPress={() => setSheet('skins')} />
            <SettingsRow icon="sparkle" label={t('settings.gallery')} onPress={() => navigation.navigate('ThemeGallery')} />
          </SettingsGroup>
        ) : null}
      </SessionEntrance>
      <Sheet visible={sheet === 'household'} title={t('settings.householdName')} doneLabel={t('common.done')} onClose={saveHousehold}>
        <Field
          label={t('settings.householdName')}
          value={household}
          onChangeText={setHousehold}
          onSubmitEditing={saveHousehold}
          placeholder={t('people.householdDefault')}
          textContentType="name"
          autoComplete="name"
        />
      </Sheet>
      <Sheet visible={sheet === 'name'} title={t('settings.yourName')} doneLabel={t('common.done')} onClose={saveGiven}>
        <Field
          label={t('settings.yourName')}
          value={given}
          onChangeText={setGiven}
          onSubmitEditing={saveGiven}
          textContentType="name"
          autoComplete="name"
        />
      </Sheet>
      <Sheet visible={sheet === 'remind'} compact title={t('settings.remindMe')} doneLabel={t('common.done')} onClose={() => setSheet(null)}>
        <Caption>{t('settings.reminderDays')}</Caption>
        <Segment
          value={String(lead)}
          options={leadOptions.map(days => ({ id: String(days), label: String(days) }))}
          onChange={id => {
            const days = Number(id);
            setLead(days);
            updateProfile({ reminderLeadDays: days }).catch(() => undefined);
          }}
        />
        {sheet === 'remind' ? (
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={t('settings.reminderTime')}
            accessibilityValue={{ text: formatClock(clock.getHours(), clock.getMinutes()) }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={event => {
              const step = event.nativeEvent.actionName === 'increment' ? 15 : -15;
              const next = new Date(clock.getTime() + step * 60 * 1000);
              setClock(next);
              updateProfile({ reminderHour: next.getHours(), reminderMinute: next.getMinutes() }).catch(() => undefined);
            }}
            style={styles.timeWheel}>
            <DateTimePicker
              mode="time"
              display="spinner"
              value={clock}
              style={styles.timeWheel}
              accessibilityLabel={t('settings.reminderTime')}
              onValueChange={(_event, date) => {
                setClock(date);
                updateProfile({ reminderHour: date.getHours(), reminderMinute: date.getMinutes() }).catch(() => undefined);
              }}
            />
          </View>
        ) : null}
      </Sheet>
      <Sheet visible={sheet === 'budget'} title={t('settings.defaultBudget')} doneLabel={t('common.done')} onClose={saveBudget}>
        <Field
          label={t('settings.defaultBudget')}
          value={budget}
          error={budgetError}
          keyboardType="decimal-pad"
          onChangeText={value => {
            setBudget(value);
            setBudgetError('');
          }}
          onSubmitEditing={saveBudget}
        />
        <Caption>{t('person.perYear')}</Caption>
      </Sheet>
      <Sheet visible={sheet === 'theme'} title={t('settings.theme')} doneLabel={t('common.done')} onClose={() => setSheet(null)}>
        <Cluster>
          <Chip label={t('settings.appearanceSystem')} selected={appearance === 'system'} onPress={() => { setAppearance('system').catch(() => undefined); }} />
          <Chip label={t('settings.appearanceLight')} selected={appearance === 'light'} onPress={() => { setAppearance('light').catch(() => undefined); }} />
          <Chip label={t('settings.appearanceDark')} selected={appearance === 'dark'} onPress={() => { setAppearance('dark').catch(() => undefined); }} />
        </Cluster>
      </Sheet>
      <Sheet visible={sheet === 'privacy'} title={t('settings.privacyTitle')} onClose={() => setSheet(null)}>
        <Body>{t('settings.privacy')}</Body>
      </Sheet>
      <Sheet visible={sheet === 'contact'} title={t('settings.contact')} onClose={() => setSheet(null)}>
        <Body>{t('settings.contactBody')}</Body>
      </Sheet>
      <Sheet visible={sheet === 'skins'} title={t('settings.skinPreview')} onClose={() => setSheet(null)}>
        <Caption>{t('settings.skinPreview')}</Caption>
        <Cluster>
          {SKIN_CHOICES.map(choice => (
            <Chip
              key={choice.id}
              label={t(choice.label)}
              selected={skinPreview === choice.id}
              onPress={() => previewSkin(choice.id)}
            />
          ))}
        </Cluster>
        <Chip label={t('settings.resetRemote')} onPress={() => previewSkin('remote')} />
      </Sheet>
      <UnlockSheet visible={sheet === 'unlock'} onClose={() => setSheet(null)} />
    </Screen>
  );
}

function ReminderRow() {
  const { snapshot, setReminders } = useGifteez();
  const on = snapshot.profile.reminders === 'on';
  const { colors, scheme, type, typeScale } = useTheme();
  const off = scheme === 'dark' ? chrome.switchOffDark : chrome.switchOff;
  const thumb = scheme === 'dark' ? chrome.switchThumbDark : chrome.white;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={t('settings.remindersLabel')}
      accessibilityState={{ checked: on }}
      onPress={() => { Promise.resolve(setReminders(!on)).catch(() => undefined); }}
      style={styles.row}>
      <View style={[styles.tile, { backgroundColor: colors.surfaceAlt }]}>
        <Icon name="bell" color={colors.pink} size={16} />
      </View>
      <Text maxFontSizeMultiplier={typeScale.body} style={[type.body, styles.label, { color: colors.text }]}>{t('settings.occasionReminders')}</Text>
      <Switch
        pointerEvents="none"
        value={on}
        onValueChange={value => { Promise.resolve(setReminders(value)).catch(() => undefined); }}
        trackColor={{ false: off, true: colors.pink }}
        ios_backgroundColor={off}
        thumbColor={on ? colors.onPink : thumb}
      />
    </Pressable>
  );
}

function SettingsGroup({ title, footer, children }: { title?: string; footer?: string; children: React.ReactNode }) {
  const { colors, type, typeScale, radius } = useTheme();
  const rows = React.Children.toArray(children);
  return (
    <View style={styles.group}>
      {title ? (
        <Text
          maxFontSizeMultiplier={typeScale.caption}
          style={[type.caption, styles.groupLabel, { color: colors.muted }]}>
          {title}
        </Text>
      ) : null}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card }]}>
        {rows.map((child, index) => (
          <View key={index}>
            {child}
            {index < rows.length - 1 ? <View style={[styles.hairline, { backgroundColor: colors.border }]} /> : null}
          </View>
        ))}
      </View>
      {footer ? (
        <Text maxFontSizeMultiplier={typeScale.caption} style={[type.caption, styles.groupFooter, { color: colors.muted }]}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

export function SettingsRow({
  icon,
  label,
  value,
  onPress,
  chevron = true,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
  chevron?: boolean;
}) {
  const { colors, type, typeScale } = useTheme();
  const body = (
    <>
      <View style={[styles.tile, { backgroundColor: colors.surfaceAlt }]}>
        <Icon name={icon} color={colors.pink} size={16} />
      </View>
      <Text maxFontSizeMultiplier={typeScale.body} style={[type.body, styles.label, { color: colors.text }]}>{label}</Text>
      {value ? (
        <Text numberOfLines={1} maxFontSizeMultiplier={typeScale.caption} style={[type.caption, styles.value, { color: colors.muted }]}>{value}</Text>
      ) : null}
      {chevron && onPress ? <Icon name="chevron" color={colors.muted} size={16} /> : null}
    </>
  );
  if (!onPress) {
    return <View style={styles.row}>{body}</View>;
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.row}>
      {body}
    </Pressable>
  );
}

function budgetField(cents: number | null | undefined): string {
  if (cents == null) {
    return '';
  }
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
}

function budgetLabel(cents: number | null | undefined): string | undefined {
  const shown = budgetField(cents);
  return shown ? `$${shown}` : undefined;
}

function clockFrom(hour: number, minute: number): Date {
  return new Date(2026, 0, 1, hour, minute, 0, 0);
}

function formatClock(hour: number, minute: number): string {
  const shown = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? 'AM' : 'PM';
  return `${shown}:${String(minute).padStart(2, '0')} ${suffix}`;
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  groupLabel: { textTransform: 'uppercase', letterSpacing: 0.6, marginLeft: space.md },
  groupFooter: { marginHorizontal: space.md },
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, gap: space.sm },
  timeWheel: { height: 180 },
  tile: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1 },
  value: { maxWidth: '46%', textAlign: 'right' },
  hairline: { height: StyleSheet.hairlineWidth, marginLeft: 56 },
});
