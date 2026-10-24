import { t } from '../i18n';

export function describeImport(result: number | 'denied'): string {
  if (result === 'denied') {
    return t('importFlow.denied');
  }
  if (result === 0) {
    return t('importFlow.none');
  }
  return t('importFlow.added', { count: result });
}
