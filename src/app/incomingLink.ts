import { parseLink } from '../crypto/crypto';
import { t } from '../i18n';

/** What a tapped link should do. An invite never joins until the confirm screen says so. */
export type IncomingLinkKind = 'confirm-invite' | 'email' | 'ignore';

export function describeIncomingLink(url: string): IncomingLinkKind {
  const parsed = parseLink(url);
  if (!parsed) {
    return 'ignore';
  }
  if (parsed.kind === 'invite') {
    return 'confirm-invite';
  }
  return 'email';
}

export type JoinPreview = { label: string; emoji: string; color: string };

export function joinConfirmModel(preview: JoinPreview | null) {
  const label = preview?.label.trim() || t('join.previewPending');
  return {
    question: t('join.confirmQuestion', { name: label }),
    emoji: preview?.emoji ?? '',
    color: preview?.color ?? '',
    joinLabel: t('join.confirmJoinLabel', { name: label }),
    cancelLabel: t('join.confirmCancelLabel'),
  };
}
