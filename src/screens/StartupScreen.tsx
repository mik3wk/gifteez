import React from 'react';
import type { StartupFailure } from '../domain/startup';
import { t } from '../i18n';
import { Body, Button, Screen, Title } from '../ui/ui';

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
    <Screen>
      <Title accessibilityLabel={title}>{title}</Title>
      <Body>{t(`startup.${kind}`)}</Body>
      <Body>{detail}</Body>
      <Button label={t('startup.retry')} accessibilityLabel={t('startup.retryLabel')} onPress={onRetry} />
    </Screen>
  );
}
