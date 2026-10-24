import React, { useState } from 'react';
import { Share } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStack } from '../app/navigation';
import { getEnv } from '../config/env';
import { accountUnlocked, fairnessRows, listCurrency } from '../domain/logic';
import { deviceLocale, formatMoney, t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
import { useGroupLabel } from '../ui/heading';
import { SessionEntrance } from '../ui/motion';
import { FairnessCard } from '../ui/stationery';
import {
  AppHeader,
  Body,
  Button,
  Caption,
  Card,
  confirmDestructive,
  Display,
  EmptyState,
  Field,
  Heading,
  Screen,
  Toggle,
} from '../ui/ui';

export function FairnessScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const { snapshot } = useGifteez();
  const heading = useGroupLabel();
  const money = (cents: number) => formatMoney(cents, deviceLocale(), listCurrency(snapshot), true);
  const rows = fairnessRows(snapshot, new Date());
  return (
    <Screen tab="fairness">
      <AppHeader title={heading.label} />
      <Display>{t('fairness.title')}</Display>
      <SessionEntrance id="fairness">
      <Body>{t('fairness.intro')}</Body>
      {rows.length === 0 ? (
        <EmptyState
          kind="fairness"
          text={t('fairness.empty')}
          action={t('fairness.emptyAction')}
          onAction={() => navigation.navigate('AddPerson')}
        />
      ) : (
        <FairnessCard rows={rows} money={money} />
      )}
      </SessionEntrance>
    </Screen>
  );
}

export function SettingsScreen() {
  const {
    snapshot,
    setReminders,
    buy,
    restorePurchases,
    storeProduct,
    storeReady,
    skinId,
    importText,
    importFromContacts,
    importFromCalendar,
    exportBackup,
    restoreBackup,
    envNotice,
  } = useSettingsData();
  const heading = useGroupLabel();
  const [pasted, setPasted] = useState('');
  const [backup, setBackup] = useState('');
  const [message, setMessage] = useState<string | null>(envNotice);
  return (
    <Screen tab="settings">
      <AppHeader title={heading.label} />
      <Heading>{t('settings.title')}</Heading>
      <SessionEntrance id="settings">
      <Card>
        <Heading>{t('settings.unlock')}</Heading>
        {accountUnlocked(snapshot) ? <Body>{t('settings.unlocked')}</Body> : (
          <>
            <Body>{t('settings.unlockPrice', { price: storeProduct?.displayPrice || messagePrice() })}</Body>
            {storeReady ? null : <Body>{t('settings.storeMissing')}</Body>}
            <Button label={t('settings.unlock')} tone="secondary" onPress={buy} />
            <Button label={t('settings.restore')} tone="secondary" onPress={restorePurchases} />
          </>
        )}
      </Card>
      <Card>
        <Heading>{t('settings.reminders')}</Heading>
        <Body>{t('settings.remindersHint')}</Body>
        <Toggle
          label={t('settings.remindersLabel')}
          value={snapshot.profile.reminders === 'on'}
          onValueChange={value => { Promise.resolve(setReminders(value)).catch(() => undefined); }}
        />
      </Card>
      <Card>
        <Heading>{t('settings.appearance')}</Heading>
        <Caption tone="text">{t('settings.skinNow', { skin: skinId })}</Caption>
      </Card>
      <Card>
        <Heading>{t('settings.data')}</Heading>
        <Body>{t('settings.backupHint')}</Body>
        <Button
          label={t('settings.export')}
          onPress={() => {
            Share.share({ title: 'gifteez-backup.json', message: exportBackup() }).catch(() => undefined);
          }}
        />
        <Field label={t('settings.backupPaste')} value={backup} onChangeText={setBackup} />
        <Button
          label={t('settings.restoreBackup')}
          tone="secondary"
          onPress={() => {
            confirmDestructive(
              t('settings.restoreTitle'),
              t('settings.restoreBody'),
              t('settings.restoreConfirm'),
              t('settings.restoreConfirmLabel'),
            ).then(async ok => {
              if (!ok) {
                return;
              }
              const result = await restoreBackup(backup);
              setMessage(result === 'ok' ? t('settings.restoreDone') : t('settings.restoreInvalid'));
              if (result === 'ok') {
                setBackup('');
              }
            }).catch(() => undefined);
          }}
        />
        <Body>{t('settings.optional')}</Body>
        <Body>{t('settings.calendarHint')}</Body>
        <Button
          label={t('settings.calendar')}
          tone="secondary"
          onPress={async () => setMessage(await describeImport(await importFromCalendar()))}
        />
        <Body>{t('settings.contactsHint')}</Body>
        <Button
          label={t('settings.contacts')}
          tone="secondary"
          onPress={async () => setMessage(await describeImport(await importFromContacts()))}
        />
        <Field label={t('settings.pasteImport')} value={pasted} onChangeText={setPasted} />
        <Body>{t('settings.pasteHint')}</Body>
        <Button
          label={t('settings.importAction')}
          tone="secondary"
          onPress={async () => setMessage(await describeImport(await importText(pasted)))}
        />
      </Card>
      {message ? <Body>{message}</Body> : null}
      </SessionEntrance>
    </Screen>
  );
}

function useSettingsData() {
  const api = useGifteez();
  return { ...api, envNotice: api.error };
}

function messagePrice(): string {
  return formatMoney(Math.round(getEnv().iapPriceUsd * 100));
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
