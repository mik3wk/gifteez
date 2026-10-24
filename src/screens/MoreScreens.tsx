import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DeviceInfo from 'react-native-device-info';
import type { RootStack } from '../app/navigation';
import { accountUnlocked, parseBudget } from '../domain/logic';
import { t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import type { SkinId } from '../theme/skins';
import { CalendarReviewLink } from '../ui/CalendarReview';
import { SessionEntrance } from '../ui/motion';
import {
  AppHeader,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Cluster,
  Field,
  Heading,
  priceLabel,
  Screen,
  Toggle,
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

export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const {
    snapshot,
    setReminders,
    buy,
    restorePurchases,
    storeProduct,
    importFromContacts,
    shareBackup,
    pickBackup,
    storeBusy,
    error,
    appearance,
    setAppearance,
    updateProfile,
    previewSkin,
    skinPreview,
  } = useGifteez();
  const [household, setHousehold] = useState(snapshot.profile.householdName ?? '');
  const [given, setGiven] = useState(snapshot.profile.givenName ?? '');
  const [days, setDays] = useState(String(snapshot.profile.reminderLeadDays ?? 7));
  const [hour, setHour] = useState(String(snapshot.profile.reminderHour ?? 9));
  const [budget, setBudget] = useState(budgetField(snapshot.profile.defaultBudgetCents));
  const [message, setMessage] = useState<string | null>(null);

  function saveHousehold() {
    const next = household.trim().slice(0, 40);
    if (next === (snapshot.profile.householdName ?? '')) {
      return;
    }
    updateProfile({ householdName: next }).catch(() => undefined);
  }

  function saveGiven() {
    const next = given.trim().slice(0, 40);
    if (next === (snapshot.profile.givenName ?? '')) {
      return;
    }
    updateProfile({ givenName: next }).catch(() => undefined);
  }

  function saveDays() {
    const value = Number(days);
    if (!Number.isInteger(value) || value < 0 || value > 30) {
      return;
    }
    if (value === (snapshot.profile.reminderLeadDays ?? 7)) {
      return;
    }
    updateProfile({ reminderLeadDays: value }).catch(() => undefined);
  }

  function saveHour() {
    const value = Number(hour);
    if (!Number.isInteger(value) || value < 0 || value > 23) {
      return;
    }
    if (value === (snapshot.profile.reminderHour ?? 9)) {
      return;
    }
    updateProfile({ reminderHour: value }).catch(() => undefined);
  }

  function saveBudget() {
    if (!budget.trim()) {
      if (snapshot.profile.defaultBudgetCents != null) {
        updateProfile({ defaultBudgetCents: null }).catch(() => undefined);
      }
      return;
    }
    const cents = parseBudget(budget);
    if (cents == null || cents === snapshot.profile.defaultBudgetCents) {
      return;
    }
    updateProfile({ defaultBudgetCents: cents }).catch(() => undefined);
  }

  return (
    <Screen tab="settings">
      <AppHeader title={t('settings.title')} />
      <SessionEntrance id="settings">
        <Card>
          <Heading>{t('settings.household')}</Heading>
          <Field
            label={t('settings.householdName')}
            value={household}
            onChangeText={setHousehold}
            onBlur={saveHousehold}
            onSubmitEditing={saveHousehold}
            placeholder={t('people.householdDefault')}
            textContentType="name"
            autoComplete="name"
          />
          <Field
            label={t('settings.givenName')}
            value={given}
            onChangeText={setGiven}
            onBlur={saveGiven}
            onSubmitEditing={saveGiven}
            textContentType="name"
            autoComplete="name"
          />
        </Card>
        <Card>
          <Heading>{t('settings.reminders')}</Heading>
          <Body>{t('settings.remindersHint')}</Body>
          <Toggle
            label={t('settings.remindersLabel')}
            value={snapshot.profile.reminders === 'on'}
            onValueChange={value => { Promise.resolve(setReminders(value)).catch(() => undefined); }}
          />
          <Field
            label={t('settings.reminderDays')}
            value={days}
            onChangeText={setDays}
            onBlur={saveDays}
            onSubmitEditing={saveDays}
            keyboardType="number-pad"
          />
          <Field
            label={t('settings.reminderHour')}
            value={hour}
            onChangeText={setHour}
            onBlur={saveHour}
            onSubmitEditing={saveHour}
            keyboardType="number-pad"
          />
        </Card>
        <Card>
          <Heading>{t('settings.theme')}</Heading>
          <Cluster>
            <Chip label={t('settings.appearanceSystem')} selected={appearance === 'system'} onPress={() => { setAppearance('system').catch(() => undefined); }} />
            <Chip label={t('settings.appearanceLight')} selected={appearance === 'light'} onPress={() => { setAppearance('light').catch(() => undefined); }} />
            <Chip label={t('settings.appearanceDark')} selected={appearance === 'dark'} onPress={() => { setAppearance('dark').catch(() => undefined); }} />
          </Cluster>
        </Card>
        <Card>
          <Heading>{t('settings.gifting')}</Heading>
          <Field
            label={t('settings.defaultBudget')}
            value={budget}
            onChangeText={setBudget}
            onBlur={saveBudget}
            onSubmitEditing={saveBudget}
            keyboardType="decimal-pad"
          />
          <Button label={t('settings.circles')} tone="secondary" onPress={() => navigation.navigate('Fairness')} />
        </Card>
        <Card>
          <Heading>{t('settings.importBackup')}</Heading>
          <Body>{t('settings.backupHint')}</Body>
          <Button label={t('settings.export')} tone="secondary" onPress={() => { shareBackup().catch(() => undefined); }} />
          <Button label={t('settings.restoreBackup')} tone="secondary" onPress={() => { pickBackup().catch(() => undefined); }} />
          <Body>{t('settings.calendarHint')}</Body>
          <CalendarReviewLink label={t('settings.findEvents')} button />
          <Body>{t('settings.contactsHint')}</Body>
          <Button
            label={t('settings.contacts')}
            tone="secondary"
            onPress={async () => setMessage(await describeImport(await importFromContacts()))}
          />
          {message ? <Body>{message}</Body> : null}
        </Card>
        <Card>
          <Heading>{t('settings.unlock')}</Heading>
          {accountUnlocked(snapshot) ? <Body>{t('settings.unlocked')}</Body> : (
            <>
              <Body>{priceLabel(storeProduct?.displayPrice)}</Body>
              {error ? <Caption tone="danger">{error}</Caption> : null}
              <Button label={t('settings.unlockAction')} busy={storeBusy} onPress={buy} />
              <Button label={t('settings.restore')} tone="secondary" onPress={restorePurchases} />
            </>
          )}
        </Card>
        <Card>
          <Heading>{t('settings.about')}</Heading>
          <Caption tone="text">{t('settings.privacy')}</Caption>
          <Caption tone="text">{t('shop.disclosure')}</Caption>
          <Caption tone="text">{t('settings.aboutVersion', { version: DeviceInfo.getVersion(), build: DeviceInfo.getBuildNumber() })}</Caption>
        </Card>
        {__DEV__ ? (
          <Card>
            <Heading>{t('settings.developer')}</Heading>
            <Caption tone="text">{t('settings.skinPreview')}</Caption>
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
            <Button label={t('settings.resetRemote')} tone="secondary" onPress={() => previewSkin('remote')} />
            <Button label={t('settings.gallery')} tone="secondary" onPress={() => navigation.navigate('ThemeGallery')} />
          </Card>
        ) : null}
      </SessionEntrance>
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

async function describeImport(result: number | 'denied'): Promise<string> {
  if (result === 'denied') {
    return t('importFlow.denied');
  }
  if (result === 0) {
    return t('importFlow.none');
  }
  return t('importFlow.added', { count: result });
}

