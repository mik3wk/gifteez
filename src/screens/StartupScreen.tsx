import React from 'react';
import type { StartupFailure } from '../domain/startup';
import { t } from '../i18n';
import { ArtSlot, Body, Button, Screen, Title } from '../ui/ui';

export function StartupScreen({
  kind,
  detail,
  onRetry,
}: {
  kind: StartupFailure;
  detail: string;
  onRetry: () => void;
}) {
  const title = t('startup.title');
  return (
    <Screen centered>
      <ArtSlot name="error" size={160} />
      <Title accessibilityLabel={title}>{title}</Title>
      <Body>{t(`startup.${kind}`)}</Body>
      <Body>{detail}</Body>
      <Button label={t('startup.retry')} accessibilityLabel={t('startup.retryLabel')} onPress={onRetry} />
    </Screen>
  );
}

export function DataRecoveryScreen({
  onRetry,
  onRestore,
  onExport,
}: {
  onRetry: () => void;
  onRestore: () => void;
  onExport: () => void;
}) {
  const title = t('recovery.title');
  return (
    <Screen centered>
      <ArtSlot name="error" size={160} />
      <Title accessibilityLabel={title}>{title}</Title>
      <Body>{t('recovery.body')}</Body>
      <Button label={t('recovery.retry')} onPress={onRetry} />
      <Button label={t('recovery.restore')} tone="secondary" onPress={onRestore} />
      <Button label={t('recovery.export')} tone="secondary" onPress={onExport} />
    </Screen>
  );
}
