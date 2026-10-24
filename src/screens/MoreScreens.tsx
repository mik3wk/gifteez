import React, { useState } from 'react';
import DeviceInfo from 'react-native-device-info';
import { accountUnlocked } from '../domain/logic';
import { t } from '../i18n';
import { useGifteez } from '../state/GifteezContext';
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

export function SettingsScreen() {
  const {
    snapshot,
    setReminders,
    buy,
    restorePurchases,
    storeProduct,
    importText,
    importFromContacts,
    importFromCalendar,
    shareBackup,
    pickBackup,
    previewBackup,
    appearance,
    setAppearance,
  } = useGifteez();
  const [pasted, setPasted] = useState('');
  const [backup, setBackup] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  return (
    <Screen tab="settings">
      <AppHeader title={t('settings.title')} />
      <SessionEntrance id="settings">
      <Card>
        <Heading>{t('settings.unlock')}</Heading>
        {accountUnlocked(snapshot) ? <Body>{t('settings.unlocked')}</Body> : (
          <>
            <Body>{priceLabel(storeProduct?.displayPrice)}</Body>
            <Button label={t('settings.unlockAction')} onPress={buy} />
            <Button label={t('settings.restore')} tone="secondary" onPress={restorePurchases} />
          </>
        )}
      </Card>
      <Card>
        <Heading>{t('settings.data')}</Heading>
        <Body>{t('settings.backupHint')}</Body>
        <Button label={t('settings.export')} tone="secondary" onPress={() => { shareBackup().catch(() => undefined); }} />
        <Button label={t('settings.restoreBackup')} tone="secondary" onPress={() => { pickBackup().catch(() => undefined); }} />
        {__DEV__ ? (
          <>
            <Field label={t('settings.backupPaste')} value={backup} onChangeText={setBackup} />
            <Button
              label={t('settings.restoreConfirm')}
              tone="secondary"
              onPress={() => previewBackup(backup)}
            />
          </>
        ) : null}
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
        <Heading>{t('settings.theme')}</Heading>
        <Cluster>
          <Chip label={t('settings.appearanceSystem')} selected={appearance === 'system'} onPress={() => { setAppearance('system').catch(() => undefined); }} />
          <Chip label={t('settings.appearanceLight')} selected={appearance === 'light'} onPress={() => { setAppearance('light').catch(() => undefined); }} />
          <Chip label={t('settings.appearanceDark')} selected={appearance === 'dark'} onPress={() => { setAppearance('dark').catch(() => undefined); }} />
        </Cluster>
      </Card>
      <Card>
        <Heading>{t('settings.about')}</Heading>
        <Caption tone="text">{t('settings.aboutVersion', { version: DeviceInfo.getVersion(), build: DeviceInfo.getBuildNumber() })}</Caption>
        <Caption tone="text">{t('shop.disclosure')}</Caption>
      </Card>
      {message ? <Body>{message}</Body> : null}
      </SessionEntrance>
    </Screen>
  );
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
